'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseClient';

export default function NewRoomPage() {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) {
      setError('Give the room a title.');
      return;
    }
    setError(null);
    setCreating(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setError('Session expired — sign in again.');
      setCreating(false);
      return;
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ host_id: auth.user.id, title: title.trim() })
      .select()
      .single();

    if (roomError || !room) {
      setError('Could not create room — try again.');
      setCreating(false);
      return;
    }

    await supabase.from('room_participants').insert({
      room_id: room.id,
      user_id: auth.user.id,
      role: 'leader',
    });

    router.push(`/rooms/${room.id}`);
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px' }}>
      <h1 className="brand" style={{ fontSize: '20px', marginBottom: '18px' }}>
        New room
      </h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's this room about?"
        style={{
          width: '100%', padding: '14px 16px', borderRadius: '14px',
          border: '1px solid var(--glass-edge)', background: 'rgba(255,255,255,0.04)',
          color: 'var(--ink)', fontSize: '15px', marginBottom: '14px',
        }}
      />

      {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '14px' }}>{error}</p>}

      <button
        onClick={handleCreate}
        disabled={creating}
        style={{
          width: '100%', padding: '14px', borderRadius: '14px',
          border: '1px solid var(--glass-edge)', background: 'var(--glass-strong)',
          color: 'var(--ink)', fontWeight: 600, fontSize: '15px',
          cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.6 : 1,
        }}
      >
        {creating ? 'Creating…' : 'Go live'}
      </button>
    </main>
  );
               }
