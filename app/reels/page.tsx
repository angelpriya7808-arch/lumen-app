'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabaseClient';
import ReelCard, { Reel } from '../../components/ReelCard';

export default function ReelsPage() {
  const supabase = createClient();
  const [reels, setReels] = useState<Reel[]>([]);
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

    const { data: raw, error } = await supabase
      .from('reels')
      .select('id, caption, audio_label, storage_path, profiles(username, avatar_url, is_verified)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !raw) {
      setLoading(false);
      return;
    }

    const ids = raw.map((r: any) => r.id);
    const { data: likeRows } = await supabase
      .from('likes')
      .select('user_id, target_id')
      .eq('target_type', 'reel')
      .in('target_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

    setReels(
      raw.map((r: any) => {
        const mine = (likeRows ?? []).filter((l) => l.target_id === r.id);
        return {
          ...r,
          profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
          like_count: mine.length,
          liked_by_me: mine.some((l) => l.user_id === me),
        };
      })
    );
    setLoading(false);
  }

  return (
    <main
      style={{
        height: '100dvh',
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        position: 'relative',
      }}
    >
      <Link
        href="/reels/new"
        className="glass-panel"
        style={{
          position: 'fixed',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 16,
          zIndex: 10,
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          color: '#fff',
          textDecoration: 'none',
        }}
      >
        +
      </Link>

      {loading && (
        <p style={{ color: '#fff', textAlign: 'center', paddingTop: '40vh' }}>Loading reels…</p>
      )}
      {!loading && reels.length === 0 && (
        <p style={{ color: '#fff', textAlign: 'center', paddingTop: '40vh' }}>
          No reels yet — upload the first one.
        </p>
      )}
      {userId && reels.map((r) => <ReelCard key={r.id} reel={r} currentUserId={userId} />)}
    </main>
  );
}
