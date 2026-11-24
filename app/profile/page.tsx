'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabaseClient';
import BottomNav from '../../components/BottomNav';

type Profile = {
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
};

type GridPost = { id: string; storage_path: string; media_type: 'image' | 'video' };

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<GridPost[]>([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0, likes: 0 });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('username, full_name, bio, avatar_url, is_verified')
      .eq('id', me)
      .single();
    setProfile(prof);

    const { data: myPosts } = await supabase
      .from('posts')
      .select('id, post_media(storage_path, media_type, position)')
      .eq('user_id', me)
      .order('created_at', { ascending: false });

    const grid: GridPost[] = (myPosts ?? [])
      .map((p: any) => {
        const media = [...(p.post_media ?? [])].sort((a: any, b: any) => a.position - b.position)[0];
        return media ? { id: p.id, storage_path: media.storage_path, media_type: media.media_type } : null;
      })
      .filter(Boolean) as GridPost[];
    setPosts(grid);

    const { count: followerCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', me);
    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', me);

    const postIds = (myPosts ?? []).map((p: any) => p.id);
    let likeCount = 0;
    if (postIds.length) {
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('target_type', 'post')
        .in('target_id', postIds);
      likeCount = count ?? 0;
    }

    setStats({
      posts: grid.length,
      followers: followerCount ?? 0,
      following: followingCount ?? 0,
      likes: likeCount,
    });
  }

  if (!profile) return null;

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px 120px' }}>
      <div className="glass-panel" style={{ padding: '28px 20px', textAlign: 'center', marginBottom: '20px' }}>
        <div
          style={{
            width: 88, height: 88, borderRadius: '50%', margin: '0 auto 14px',
            background: profile.avatar_url ? `url(${profile.avatar_url}) center/cover` : 'var(--glass-strong)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.5)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <strong style={{ fontSize: '19px' }}>{profile.full_name || profile.username}</strong>
          {profile.is_verified && <span className="verified-badge" />}
        </div>
        <p style={{ color: 'var(--ink-dim)', margin: '2px 0 10px' }}>@{profile.username}</p>
        <p style={{ fontSize: '14px', margin: '0 0 18px' }}>{profile.bio || 'No bio yet'}</p>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
          {[
            ['Posts', stats.posts],
            ['Followers', stats.followers],
            ['Following', stats.following],
            ['Likes', stats.likes],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div style={{ fontWeight: 700, fontSize: '18px' }}>{value}</div>
              <div style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link
            href="/profile-setup"
            className="pill-gradient"
            style={{ flex: 1, padding: '12px', borderRadius: '999px', textDecoration: 'none', textAlign: 'center', fontSize: '14px' }}
          >
            Edit profile
          </Link>
          <Link
            href="/settings"
            className="glass-panel"
            style={{ flex: 1, padding: '12px', borderRadius: '999px', textDecoration: 'none', textAlign: 'center', fontSize: '14px', color: 'var(--ink)' }}
          >
            ⚙ Settings
          </Link>
        </div>
      </div>

      {posts.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-dim)' }}>No posts yet. Tap ✚ to create one.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {posts.map((p) => {
            const url = supabase.storage.from('posts').getPublicUrl(p.storage_path).data.publicUrl;
            return (
              <div key={p.id} style={{ aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                {p.media_type === 'video' ? (
                  <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            );
          })}
        </div>
      )}
      <BottomNav />
    </main>
  );
      }
