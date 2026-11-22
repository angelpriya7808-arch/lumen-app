'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseClient';

export default function NewPostPage() {
  const supabase = createClient();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
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

    const { error: uploadError } = await supabase.storage.from('posts').upload(path, file);
    if (uploadError) {
      setError('Upload failed — try again.');
      setPosting(false);
      return;
    }

    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({ user_id: auth.user.id, caption })
      .select()
      .single();

    if (postError || !post) {
      setError('Could not create post — try again.');
      setPosting(false);
      return;
    }

    await supabase.from('post_media').insert({
      post_id: post.id,
      media_type: isVideo ? 'video' : 'image',
      storage_path: path,
      position: 0,
    });

    router.push('/feed');
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px' }}>
      <h1 className="brand" style={{ fontSize: '20px', marginBottom: '18px' }}>
        New post
      </h1>

      <label
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: preview ? 'auto' : 220,
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

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Write a caption…"
        rows={3}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid var(--glass-edge)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--ink)',
          fontSize: '14px',
          marginBottom: '14px',
          resize: 'none',
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
        {posting ? 'Posting…' : 'Share'}
      </button>
    </main>
  );
}
