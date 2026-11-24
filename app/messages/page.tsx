'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabaseClient';
import BottomNav from '../../components/BottomNav';

type ThreadRow = {
  conversation_id: string;
  other_username: string;
  other_avatar: string | null;
  last_body: string | null;
  last_at: string;
};

export default function MessagesListPage() {
  const supabase = createClient();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me) {
      setLoading(false);
      return;
    }

    const { data: myConvos } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', me);

    const convoIds = (myConvos ?? []).map((c) => c.conversation_id);
    if (convoIds.length === 0) {
      setLoading(false);
      return;
    }

    const rows: ThreadRow[] = [];
    for (const convoId of convoIds) {
      const { data: others } = await supabase
        .from('conversation_participants')
        .select('profiles(username, avatar_url)')
        .eq('conversation_id', convoId)
        .neq('user_id', me)
        .limit(1)
        .single();

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('body, created_at')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const otherProfile = others?.profiles
        ? Array.isArray(others.profiles)
          ? others.profiles[0]
          : others.profiles
        : null;

      rows.push({
        conversation_id: convoId,
        other_username: otherProfile?.username ?? 'Unknown',
        other_avatar: otherProfile?.avatar_url ?? null,
        last_body: lastMsg?.body ?? null,
        last_at: lastMsg?.created_at ?? '',
      });
    }

    rows.sort((a, b) => (b.last_at > a.last_at ? 1 : -1));
    setThreads(rows);
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px 100px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="brand" style={{ fontSize: '22px', margin: 0 }}>
          Messages
        </h1>
        <Link
          href="/messages/new"
          className="glass-panel"
          style={{
            width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', textDecoration: 'none', color: 'var(--ink)',
          }}
        >
          +
        </Link>
      </header>

      {loading && <p style={{ color: 'var(--ink-dim)' }}>Loading…</p>}
      {!loading && threads.length === 0 && (
        <p style={{ color: 'var(--ink-dim)' }}>No conversations yet — start one.</p>
      )}

      {threads.map((t) => (
        <Link
          key={t.conversation_id}
          href={`/messages/${t.conversation_id}`}
          className="glass-panel"
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
            marginBottom: '10px', textDecoration: 'none', color: 'var(--ink)',
          }}
        >
          <div
            style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: t.other_avatar ? `url(${t.other_avatar}) center/cover` : 'var(--glass-strong)',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.other_username}</div>
            <div
              style={{
                fontSize: '13px', color: 'var(--ink-dim)', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {t.last_body ?? 'Say hello 👋'}
            </div>
          </div>
        </Link>
      ))}
      <BottomNav />
    </main>
  );
}
