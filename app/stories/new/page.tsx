'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseClient';

export default function NewStoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handlePost() {
    if (!file) {
      setError('Pick a photo or video first.');
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

    const isVideo = file.type.startsWith('video');
    const ext = file.name.split('.').pop();
    const path = `${auth.user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('stories').upload(path, file);
    if (uploadError) {
      setError('Upload failed — try again.');
      setPosting(false);
      return;
    }

    const { error: insertError } = await supabase.from('stories').insert({
      user_id: auth.user.id,
      media_type: isVideo ? 'video' : 'image',
      storage_path: path,
    });

    if (insertError) {
      setError('Could not post story — try again.');
      setPosting(false);
      return;
    }

    router.push('/feed');
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px' }}>
      <h1 className="brand" style={{ fontSize: '20px', marginBottom: '6px' }}>
        New story
      </h1>
      <p style={{ color: 'var(--ink-dim)', fontSize: '13px', marginBottom: '18px' }}>
        Disappears after 24 hours.
      </p>

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
          file?.type.startsWith('video') ? (
            <video src={preview} controls style={{ width: '100%' }} />
          ) : (
            <img src={preview} alt="" style={{ width: '100%', display: 'block' }} />
          )
        ) : (
          <span style={{ color: 'var(--ink-dim)' }}>Tap to choose a photo or video</span>
        )}
        <input type="file" accept="image/*,video/*" onChange={handleFile} hidden />
      </label>

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
        {posting ? 'Posting…' : 'Share to story'}
      </button>
    </main>
  );
}
