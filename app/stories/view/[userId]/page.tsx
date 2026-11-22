'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabaseClient';

type Story = {
  id: string;
  media_type: 'image' | 'video';
  storage_path: string;
};

const DURATION_MS = 5000;

export default function StoryViewerPage() {
  const supabase = createClient();
  const router = useRouter();
  const { userId } = useParams<{ userId: string }>();

  const [stories, setStories] = useState<Story[]>([]);
  const [username, setUsername] = useState('');
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (stories.length === 0) return;
    markViewed(stories[index].id);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    const start = Date.now();
    timerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) advance(1);
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [index, stories]);

  async function load() {
    const { data } = await supabase
      .from('stories')
      .select('id, media_type, storage_path, profiles(username)')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) {
      router.push('/feed');
      return;
    }
    const profile = Array.isArray((data[0] as any).profiles)
      ? (data[0] as any).profiles[0]
      : (data[0] as any).profiles;
    setUsername(profile?.username ?? '');
    setStories(data as any);
  }

  async function markViewed(storyId: string) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    await supabase
      .from('story_views')
      .upsert(
        { story_id: storyId, viewer_id: auth.user.id },
        { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
      );
  }

  function advance(dir: 1 | -1) {
    const next = index + dir;
    if (next < 0) return;
    if (next >= stories.length) {
      router.push('/feed');
      return;
    }
    setIndex(next);
  }

  if (stories.length === 0) return null;
  const current = stories[index];
  const mediaUrl = supabase.storage.from('stories').getPublicUrl(current.storage_path).data.publicUrl;

  return (
    <main style={{ position: 'relative', height: '100dvh', background: '#000', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 'calc(10px + env(safe-area-inset-top, 0px))',
          left: 10,
          right: 10,
          display: 'flex',
          gap: '4px',
          zIndex: 10,
        }}
      >
        {stories.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${i < index ? 100 : i === index ? progress : 0}%`,
                background: '#fff',
                transition: i === index ? 'none' : 'width 150ms',
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 'calc(24px + env(safe-area-inset-top, 0px))',
          left: 14,
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          zIndex: 10,
        }}
      >
        {username}
      </div>

      {current.media_type === 'video' ? (
        <video src={mediaUrl} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <img src={mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      )}

      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ flex: 1 }} onClick={() => advance(-1)} />
        <div style={{ flex: 1 }} onClick={() => advance(1)} />
      </div>
    </main>
  );
}
