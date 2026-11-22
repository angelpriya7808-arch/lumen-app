'use client';

import { useState } from 'react';
import { createClient } from '../lib/supabaseClient';

type PostMedia = { id: string; media_type: 'image' | 'video'; storage_path: string; position: number };
type Author = { username: string; avatar_url: string | null; is_verified: boolean };

export type Post = {
  id: string;
  caption: string | null;
  created_at: string;
  profiles: Author;
  post_media: PostMedia[];
  liked_by_me?: boolean;
  like_count?: number;
};

export default function PostCard({ post, currentUserId }: { post: Post; currentUserId: string }) {
  const supabase = createClient();
  const [liked, setLiked] = useState(!!post.liked_by_me);
  const [count, setCount] = useState(post.like_count ?? 0);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));

    if (next) {
      await supabase
        .from('likes')
        .insert({ user_id: currentUserId, target_type: 'post', target_id: post.id });
    } else {
      await supabase
        .from('likes')
        .delete()
        .match({ user_id: currentUserId, target_type: 'post', target_id: post.id });
    }
  }

  const media = [...post.post_media].sort((a, b) => a.position - b.position)[0];
  const mediaUrl = media
    ? supabase.storage.from('posts').getPublicUrl(media.storage_path).data.publicUrl
    : null;

  return (
    <article className="glass-panel" style={{ marginBottom: '18px', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px' }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: post.profiles.avatar_url
              ? `url(${post.profiles.avatar_url}) center/cover`
              : 'var(--glass-strong)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{post.profiles.username}</span>
        {post.profiles.is_verified && <span className="verified-badge" />}
      </header>

      {mediaUrl && (
        <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#000' }}>
          {media!.media_type === 'video' ? (
            <video src={mediaUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <img src={mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
      )}

      <div style={{ padding: '14px 16px' }}>
        <button
          onClick={toggleLike}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            className={liked ? 'aurora-text' : ''}
            style={{ fontSize: '20px', color: liked ? undefined : 'var(--ink-dim)' }}
          >
            {liked ? '♥' : '♡'}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>{count}</span>
        </button>

        {post.caption && (
          <p style={{ fontSize: '14px', margin: 0 }}>
            <strong>{post.profiles.username}</strong> {post.caption}
          </p>
        )}
      </div>
    </article>
  );
        }
