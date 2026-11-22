'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseClient';

export default function NewMessagePage() {
  const supabase = createClient();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function startConversation() {
    setError(null);
    const clean = username.trim().toLowerCase();
    if (!clean) return;
    setSearching(true);

    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me) {
      setError('Session expired — sign in again.');
      setSearching(false);
      return;
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', clean)
      .maybeSingle();

    if (!target) {
      setError('No user with that username.');
      setSearching(false);
      return;
    }
    if (target.id === me) {
      setError("That's you!");
      setSearching(false);
      return;
    }

    const { data: mine } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', me);
    const myConvoIds = (mine ?? []).map((m) => m.conversation_id);

    let existingId: string | null = null;
    if (myConvoIds.length) {
      const { data: shared } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', target.id)
        .in('conversation_id', myConvoIds)
        .limit(1)
        .maybeSingle();
      existingId = shared?.conversation_id ?? null;
    }

    if (existingId) {
      router.push(`/messages/${existingId}`);
      return;
    }

    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .insert({ is_group: false })
      .select()
      .single();

    if (convoError || !convo) {
      setError('Could not start conversation.');
      setSearching(false);
      return;
    }

    await supabase.from('conversation_participants').insert([
      { conversation_id: convo.id, user_id: me },
      { conversation_id: convo.id, user_id: target.id },
    ]);

    router.push(`/messages/${convo.id}`);
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px' }}>
      <h1 className="brand" style={{ fontSize: '20px', marginBottom: '18px' }}>
        New message
      </h1>

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter a username"
        autoCapitalize="none"
        style={{
          width: '100%', padding: '14px 16px', borderRadius: '14px',
          border: '1px solid var(--glass-edge)', background: 'rgba(255,255,255,0.04)',
          color: 'var(--ink)', fontSize: '15px', marginBottom: '14px',
        }}
      />

      {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '14px' }}>{error}</p>}

      <button
        onClick={startConversation}
        disabled={searching}
        style={{
          width: '100%', padding: '14px', borderRadius: '14px',
          border: '1px solid var(--glass-edge)', background: 'var(--glass-strong)',
          color: 'var(--ink)', fontWeight: 600, fontSize: '15px',
          cursor: searching ? 'default' : 'pointer', opacity: searching ? 0.6 : 1,
        }}
      >
        {searching ? 'Starting…' : 'Start chat'}
      </button>
    </main>
  );
  }
