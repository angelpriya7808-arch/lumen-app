'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '../lib/supabaseClient';

export type Reel = {
  id: string;
  caption: string | null;
  audio_label: string | null;
  storage_path: string;
  profiles: { username: string; avatar_url: string | null; is_verified: boolean };
  liked_by_me?: boolean;
  like_count?: number;
};

export default function ReelCard({ reel, currentUserId }: { reel: Reel; currentUserId: string }) {
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(!!reel.liked_by_me);
  const [count, setCount] = useState(reel.like_count ?? 0);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? el.play().catch(() => {}) : el.pause()),
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    if (next) {
      await supabase.from('likes').insert({ user_id: currentUserId, target_type: 'reel', target_id: reel.id });
    } else {
      await supabase.from('likes').delete().match({ user_id: currentUserId, target_type: 'reel', target_id: reel.id });
    }
  }

  const videoUrl = supabase.storage.from('reels').getPublicUrl(reel.storage_path).data.publicUrl;

  return (
    <section
      style={{
        position: 'relative',
        height: '100dvh',
        scrollSnapAlign: 'start',
        background: '#000',
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        loop
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onClick={() => (videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause())}
      />

      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 90,
          bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <strong style={{ fontSize: '14px' }}>{reel.profiles.username}</strong>
          {reel.profiles.is_verified && <span className="verified-badge" />}
        </div>
        {reel.caption && <p style={{ fontSize: '13px', margin: '0 0 6px' }}>{reel.caption}</p>}
        {reel.audio_label && (
          <p style={{ fontSize: '12px', opacity: 0.75, margin: 0 }}>♪ {reel.audio_label}</p>
        )}
      </div>

      <button
        onClick={toggleLike}
        style={{
          position: 'absolute',
          right: 14,
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          background: 'none',
          border: 'none',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span style={{ fontSize: '30px' }} className={liked ? 'aurora-text' : ''}>
          {liked ? '♥' : '♡'}
        </span>
        <span style={{ fontSize: '12px' }}>{count}</span>
      </button>
    </section>
  );
}
