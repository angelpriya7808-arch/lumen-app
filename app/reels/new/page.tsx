'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseClient';

export default function NewReelPage() {
  const supabase = createClient();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [audioLabel, setAudioLabel] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video')) {
      setError('Reels are video only.');
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handlePost() {
    if (!file) {
      setError('Pick a video first.');
      return;
    }
    setError(null);
    setPosting(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setError('Session expired — sign in again.');
      setPosting(false);
      return;
    }

    const ext = file.name.split('.').pop();
    const path = `${auth.user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('reels').upload(path, file);
    if (uploadError) {
      setError('Upload failed — try again.');
      setPosting(false);
      return;
    }

    const { error: insertError } = await supabase.from('reels').insert({
      user_id: auth.user.id,
      caption,
      audio_label: audioLabel || null,
      storage_path: path,
    });

    if (insertError) {
      setError('Could not publish reel — try again.');
      setPosting(false);
      return;
    }

    router.push('/reels');
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px' }}>
      <h1 className="brand" style={{ fontSize: '20px', marginBottom: '18px' }}>
        New reel
      </h1>

      <label
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: preview ? 'auto' : 300,
          marginBottom: '16px',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        {preview ? (
          <video src={preview} controls style={{ width: '100%' }} />
        ) : (
          <span style={{ color: 'var(--ink-dim)' }}>Tap to choose a video</span>
        )}
        <input type="file" accept="video/*" onChange={handleFile} hidden />
      </label>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Write a caption…"
        rows={2}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid var(--glass-edge)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--ink)',
          fontSize: '14px',
          marginBottom: '12px',
          resize: 'none',
        }}
      />

      <input
        value={audioLabel}
        onChange={(e) => setAudioLabel(e.target.value)}
        placeholder="Audio name (optional)"
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid var(--glass-edge)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--ink)',
          fontSize: '14px',
          marginBottom: '14px',
        }}
      />

      {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '14px' }}>{error}</p>}

      <button
        onClick={handlePost}
        disabled={posting}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '14px',
          border: '1px solid var(--glass-edge)',
          background: 'var(--glass-strong)',
          color: 'var(--ink)',
          fontWeight: 600,
          fontSize: '15px',
          cursor: posting ? 'default' : 'pointer',
          opacity: posting ? 0.6 : 1,
        }}
      >
        {posting ? 'Publishing…' : 'Publish reel'}
      </button>
    </main>
  );
                  }
