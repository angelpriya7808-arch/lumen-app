'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabaseClient';
import BottomNav from '../../components/BottomNav';

type Room = {
  id: string;
  title: string;
  host_id: string;
  profiles: { username: string };
  speaker_count: number;
};

export default function RoomsPage() {
  const supabase = createClient();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('rooms')
      .select('id, title, host_id, profiles(username), room_participants(user_id)')
      .eq('is_open', true)
      .order('created_at', { ascending: false });

    setRooms(
      (data ?? []).map((r: any) => ({
        ...r,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
        speaker_count: r.room_participants?.length ?? 0,
      }))
    );
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px 100px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="brand" style={{ fontSize: '22px', margin: 0 }}>
          Rooms
        </h1>
        <Link
          href="/rooms/new"
          className="glass-panel"
          style={{
            width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', textDecoration: 'none', color: 'var(--ink)',
          }}
        >
          +
        </Link>
      </header>

      {loading && <p style={{ color: 'var(--ink-dim)' }}>Loading rooms…</p>}
      {!loading && rooms.length === 0 && (
        <p style={{ color: 'var(--ink-dim)' }}>No rooms open right now — start one.</p>
      )}

      {rooms.map((r) => (
        <Link
          key={r.id}
          href={`/rooms/${r.id}`}
          className="glass-panel"
          style={{ display: 'block', padding: '16px', marginBottom: '12px', textDecoration: 'none', color: 'var(--ink)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--aurora-a)', boxShadow: '0 0 8px var(--aurora-a)' }} />
            <strong style={{ fontSize: '15px' }}>{r.title}</strong>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>
            hosted by {r.profiles?.username} · {r.speaker_count} speaking
          </span>
        </Link>
      ))}
      <BottomNav />
    </main>
  );
                  }
