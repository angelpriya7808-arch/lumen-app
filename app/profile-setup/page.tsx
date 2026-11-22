'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

export default function ProfileSetupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    const clean = username.trim().toLowerCase();
    if (clean.length < 3) {
      setError('Username needs to be at least 3 characters.');
      return;
    }

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setError('Session expired — please sign in again.');
      setSaving(false);
      return;
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: auth.user.id,
      username: clean,
      full_name: auth.user.user_metadata?.full_name ?? null,
      avatar_url: auth.user.user_metadata?.avatar_url ?? null,
    });

    setSaving(false);
    if (upsertError) {
      setError(
        upsertError.code === '23505'
          ? 'That username is taken — try another.'
          : 'Something went wrong — try again.'
      );
      return;
    }

    router.push('/feed');
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="glass-panel"
        style={{ width: '100%', maxWidth: '380px', padding: '32px 26px' }}
      >
        <h1 className="brand" style={{ fontSize: '22px', margin: '0 0 6px' }}>
          Pick your username
        </h1>
        <p style={{ color: 'var(--ink-dim)', fontSize: '13px', margin: '0 0 24px' }}>
          This is how people find and mention you.
        </p>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoCapitalize="none"
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '14px',
            border: '1px solid var(--glass-edge)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--ink)',
            fontSize: '15px',
            marginBottom: '14px',
          }}
        />

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="aurora-text"
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            border: '1px solid var(--glass-edge)',
            background: 'var(--glass-strong)',
            fontWeight: 600,
            fontSize: '15px',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </main>
  );
}
