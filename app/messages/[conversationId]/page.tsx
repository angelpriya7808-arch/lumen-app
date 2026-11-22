'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '../../../lib/supabaseClient';

type Message = {
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
};

export default function ThreadPage() {
  const supabase = createClient();
  const { conversationId } = useParams<{ conversationId: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    init();
    return () => {
      supabase.channel(`messages:${conversationId}`).unsubscribe();
      typingChannelRef.current?.unsubscribe();
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id ?? null;
    setMyId(me);

    const { data: existing } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(existing ?? []);

    supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    const typingChannel = supabase.channel(`typing:${conversationId}`);
    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.user_id === me) return;
        setOtherTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setOtherTyping(false), 2500);
      })
      .subscribe();
    typingChannelRef.current = typingChannel;
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: myId },
    });
  }

  async function send() {
    const body = draft.trim();
    if (!body || !myId) return;
    setDraft('');
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: myId, body });
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {messages.map((m) => (
          <div key={m.id} className={`msg-row${m.sender_id === myId ? ' mine' : ''}`}>
            <div className="msg-bubble">{m.body}</div>
          </div>
        ))}

        {otherTyping && (
          <div className="msg-row">
            <div className="msg-bubble">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          display: 'flex', gap: '10px', padding: '12px 14px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid var(--glass-edge)',
        }}
      >
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message…"
          style={{
            flex: 1, padding: '12px 16px', borderRadius: '20px',
            border: '1px solid var(--glass-edge)', background: 'rgba(255,255,255,0.04)',
            color: 'var(--ink)', fontSize: '14px',
          }}
        />
        <button
          onClick={send}
          className="aurora-text"
          style={{
            padding: '0 18px', borderRadius: '20px', border: '1px solid var(--glass-edge)',
            background: 'var(--glass-strong)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </main>
  );
}
