'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/supabaseClient';

type StoryGroup = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  all_seen: boolean;
};

export default function StoryBar() {
  const supabase = createClient();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id ?? null;
    setMyId(me);

    const { data: stories } = await supabase
      .from('stories')
      .select('id, user_id, profiles(username, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (!stories) return;

    const { data: views } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', me);
    const seenIds = new Set((views ?? []).map((v) => v.story_id));

    const byUser = new Map<string, StoryGroup>();
    for (const s of stories as any[]) {
      const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      const existing = byUser.get(s.user_id);
      const seenThis = seenIds.has(s.id);
      if (!existing) {
        byUser.set(s.user_id, {
          user_id: s.user_id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          all_seen: seenThis,
        });
      } else {
        existing.all_seen = existing.all_seen && seenThis;
      }
    }
    setGroups(Array.from(byUser.values()));
  }

  return (
    <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '4px 2px 18px' }}>
      <Link
        href="/stories/new"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0, textDecoration: 'none' }}
      >
        <div
          className="glass-panel"
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            color: 'var(--ink)',
          }}
        >
          +
        </div>
        <span style={{ fontSize: '11px', color: 'var(--ink-dim)' }}>Your story</span>
      </Link>

      {groups
        .filter((g) => g.user_id !== myId)
        .map((g) => (
          <Link
            key={g.user_id}
            href={`/stories/view/${g.user_id}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0, textDecoration: 'none' }}
          >
            <div className={`story-ring${g.all_seen ? ' seen' : ''}`}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: g.avatar_url ? `url(${g.avatar_url}) center/cover` : 'var(--glass-strong)',
                  border: '2px solid var(--void)',
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--ink-dim)', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.username}
            </span>
          </Link>
        ))}
    </div>
  );
              }
