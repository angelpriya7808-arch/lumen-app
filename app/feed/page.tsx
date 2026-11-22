'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabaseClient';
import PostCard, { Post } from '../../components/PostCard';
import StoryBar from '../../components/StoryBar';

export default function FeedPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id ?? null;
    setUserId(me);

    const { data: rawPosts, error } = await supabase
      .from('posts')
      .select('id, caption, created_at, profiles(username, avatar_url, is_verified), post_media(*)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !rawPosts) {
      setLoading(false);
      return;
    }

    const postIds = rawPosts.map((p: any) => p.id);
    const { data: likeRows } = await supabase
      .from('likes')
      .select('user_id, target_id')
      .eq('target_type', 'post')
      .in('target_id', postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000']);

    const enriched: Post[] = rawPosts.map((p: any) => {
      const likesForPost = (likeRows ?? []).filter((l) => l.target_id === p.id);
      return {
        ...p,
        profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
        like_count: likesForPost.length,
        liked_by_me: likesForPost.some((l) => l.user_id === me),
      };
    });

    setPosts(enriched);
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px 100px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h1 className="brand aurora-text" style={{ fontSize: '24px', margin: 0 }}>
          Lumen
        </h1>
        <Link
          href="/post/new"
          className="glass-panel"
          style={{
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            textDecoration: 'none',
            color: 'var(--ink)',
          }}
        >
          +
        </Link>
      </header>

      <StoryBar />

      {loading && <p style={{ color: 'var(--ink-dim)' }}>Loading feed…</p>}
      {!loading && posts.length === 0 && (
        <p style={{ color: 'var(--ink-dim)' }}>No posts yet — be the first to share something.</p>
      )}

      {userId &&
        posts.map((post) => <PostCard key={post.id} post={post} currentUserId={userId} />)}
    </main>
  );
      }
