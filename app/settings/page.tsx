'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setError(null);
    setDone(false);
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setError('Session expired — sign in again.');
      setSaving(false);
      return;
    }

    const ext = file.name.split('.').pop();
    const path = `${auth.user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('wallpapers').upload(path, file);
    if (uploadError) {
      setError('Upload failed — try again.');
      setSaving(false);
      return;
    }

    const url = supabase.storage.from('wallpapers').getPublicUrl(path).data.publicUrl;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ wallpaper_url: url })
      .eq('id', auth.user.id);

    setSaving(false);
    if (updateError) {
      setError('Could not save wallpaper — try again.');
      return;
    }
    setDone(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px' }}>
      <h1 className="brand" style={{ fontSize: '20px', marginBottom: '18px' }}>
        Settings
      </h1>

      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', marginTop: 0 }}>App wallpaper</h3>
        <p style={{ color: 'var(--ink-dim)', fontSize: '13px', marginBottom: '14px' }}>
          Shows behind every screen in Lumen, just for you.
        </p>

        <label
          className="glass-panel"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: preview ? 'auto' : 160, cursor: 'pointer', overflow: 'hidden', marginBottom: '10px',
          }}
        >
          {preview ? (
            <img src={preview} alt="" style={{ width: '100%', display: 'block' }} />
          ) : (
            <span style={{ color: 'var(--ink-dim)' }}>Tap to choose an image</span>
          )}
          <input type="file" accept="image/*" onChange={handleFile} hidden />
        </label>

        {saving && <p style={{ color: 'var(--ink-dim)', fontSize: '13px' }}>Saving…</p>}
        {done && <p style={{ color: 'var(--aurora-a)', fontSize: '13px' }}>Wallpaper updated ✓</p>}
        {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}
      </div>

      <button
        onClick={signOut}
        className="glass-panel"
        style={{
          width: '100%', padding: '14px', color: 'var(--danger)', fontWeight: 600,
          border: 'none', cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </main>
  );
            }
