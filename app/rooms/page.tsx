'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseClient';

type Participant = { user_id: string; username: string; role: 'leader' | 'speaker' };
type PendingRequest = { id: string; user_id: string; username: string };

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function RoomPage() {
  const supabase = createClient();
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();

  const [myId, setMyId] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState('');
  const [hostId, setHostId] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<'checking' | 'none' | 'pending' | 'in'>('checking');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const signalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isLeader = myId !== null && hostId === myId;

  useEffect(() => {
    init();
    return () => cleanup();
  }, [roomId]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id ?? null;
    setMyId(me);
    if (!me) return;

    const { data: room } = await supabase
      .from('rooms')
      .select('title, host_id')
      .eq('id', roomId)
      .single();
    if (!room) {
      router.push('/rooms');
      return;
    }
    setRoomTitle(room.title);
    setHostId(room.host_id);

    await refreshParticipants();

    const { data: myRequest } = await supabase
      .from('room_join_requests')
      .select('status')
      .eq('room_id', roomId)
      .eq('user_id', me)
      .maybeSingle();

    const { data: myParticipant } = await supabase
      .from('room_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', me)
      .maybeSingle();

    if (myParticipant) {
      setMyStatus('in');
      joinMesh(me);
    } else if (myRequest?.status === 'pending') {
      setMyStatus('pending');
    } else {
      setMyStatus('none');
    }

    if (room.host_id === me) {
      await refreshPending();
    }

    supabase
      .channel(`room-participants:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          await refreshParticipants();
          if (payload.eventType === 'INSERT' && (payload.new as any).user_id === me) {
            setMyStatus('in');
            joinMesh(me);
          }
          if (payload.eventType === 'DELETE' && (payload.old as any).user_id === me) {
            setMyStatus('none');
            cleanup();
          }
        }
      )
      .subscribe();

    supabase
      .channel(`room-requests:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_join_requests', filter: `room_id=eq.${roomId}` },
        () => {
          if (room.host_id === me) refreshPending();
        }
      )
      .subscribe();
  }

  async function refreshParticipants() {
    const { data } = await supabase
      .from('room_participants')
      .select('user_id, role, profiles(username)')
      .eq('room_id', roomId);
    setParticipants(
      (data ?? []).map((p: any) => ({
        user_id: p.user_id,
        role: p.role,
        username: (Array.isArray(p.profiles) ? p.profiles[0] : p.profiles)?.username ?? 'unknown',
      }))
    );
  }

  async function refreshPending() {
    const { data } = await supabase
      .from('room_join_requests')
      .select('id, user_id, profiles(username)')
      .eq('room_id', roomId)
      .eq('status', 'pending');
    setPending(
      (data ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        username: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.username ?? 'unknown',
      }))
    );
  }

  async function requestToJoin() {
    if (!myId) return;
    const { error } = await supabase.from('room_join_requests').insert({ room_id: roomId, user_id: myId });
    if (!error) setMyStatus('pending');
  }

  async function decide(requestId: string, approve: boolean) {
    await supabase
      .from('room_join_requests')
      .update({ status: approve ? 'approved' : 'denied' })
      .eq('id', requestId);
    refreshPending();
  }

  async function removeParticipant(userId: string) {
    await supabase.from('room_participants').delete().match({ room_id: roomId, user_id: userId });
  }

  async function joinMesh(me: string) {
    if (localStreamRef.current) return;
    setConnecting(true);
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setConnecting(false);
      return;
    }

    const channel = supabase.channel(`room-signal:${roomId}`, {
      config: { presence: { key: me }, broadcast: { self: false } },
    });
    signalChannelRef.current = channel;

    channel.on('broadcast', { event: 'webrtc-signal' }, async ({ payload }) => {
      if (payload.to !== me) return;
      await handleSignal(payload, me);
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const others = Object.keys(state).filter((id) => id !== me);
      for (const otherId of others) {
        if (!peersRef.current.has(otherId) && me < otherId) {
          createPeer(otherId, me, true);
        }
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: me });
        setConnecting(false);
      }
    });
  }

  function createPeer(otherId: string, me: string, initiator: boolean) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signalChannelRef.current?.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { to: otherId, from: me, kind: 'candidate', data: e.candidate },
        });
      }
    };

    pc.ontrack = (e) => {
      let el = audioElsRef.current.get(otherId);
      if (!el) {
        el = new Audio();
        el.autoplay = true;
        audioElsRef.current.set(otherId, el);
      }
      el.srcObject = e.streams[0];
    };

    peersRef.current.set(otherId, pc);

    if (initiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        signalChannelRef.current?.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { to: otherId, from: me, kind: 'offer', data: offer },
        });
      });
    }
    return pc;
  }

  async function handleSignal(payload: any, me: string) {
    const { from, kind, data } = payload;
    let pc = peersRef.current.get(from);

    if (kind === 'offer') {
      if (!pc) pc = createPeer(from, me, false);
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signalChannelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: { to: from, from: me, kind: 'answer', data: answer },
      });
    } else if (kind === 'answer' && pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (kind === 'candidate' && pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch {}
    }
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = muted;
    setMuted(!muted);
  }

  function cleanup() {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    audioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    signalChannelRef.current?.unsubscribe();
    signalChannelRef.current = null;
  }

  async function leaveRoom() {
    if (myId) await removeParticipant(myId);
    cleanup();
    router.push('/rooms');
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '20px 16px 120px' }}>
      <h1 className="brand aurora-text" style={{ fontSize: '22px', marginBottom: '4px' }}>
        {roomTitle || 'Room'}
      </h1>
      <p style={{ color: 'var(--ink-dim)', fontSize: '13px', marginBottom: '20px' }}>
        {participants.length} in the room{connecting ? ' · connecting mic…' : ''}
      </p>

      {myStatus === 'none' && (
        <button
          onClick={requestToJoin}
          className="glass-panel"
          style={{ width: '100%', padding: '14px', color: 'var(--ink)', fontWeight: 600, border: 'none', cursor: 'pointer', marginBottom: '20px' }}
        >
          Request to join
        </button>
      )}
      {myStatus === 'pending' && (
        <p className="glass-panel" style={{ padding: '14px', textAlign: 'center', color: 'var(--ink-dim)', marginBottom: '20px' }}>
          Waiting for the host to let you in…
        </p>
      )}

      {isLeader && pending.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '8px' }}>Join requests</h3>
          {pending.map((p) => (
            <div key={p.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px' }}>{p.username}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => decide(p.id, true)} className="aurora-text" style={{ border: 'none', background: 'none', fontWeight: 600, cursor: 'pointer' }}>Accept</button>
                <button onClick={() => decide(p.id, false)} style={{ border: 'none', background: 'none', color: 'var(--ink-dim)', cursor: 'pointer' }}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {participants.map((p) => (
          <div key={p.user_id} style={{ textAlign: 'center' }}>
            <div className="story-ring" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 6px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--glass-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                🎙️
              </div>
            </div>
            <div style={{ fontSize: '12px' }}>{p.username}</div>
            {p.role === 'leader' && <div style={{ fontSize: '10px', color: 'var(--ink-dim)' }}>host</div>}
            {isLeader && p.user_id !== myId && (
              <button onClick={() => removeParticipant(p.user_id)} style={{ fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                remove
              </button>
            )}
          </div>
        ))}
      </div>

      {myStatus === 'in' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '14px', padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={toggleMute} className="glass-panel" style={{ width: 54, height: 54, borderRadius: '50%', border: 'none', fontSize: '20px', color: 'var(--ink)', cursor: 'pointer' }}>
            {muted ? '🔇' : '🎙️'}
          </button>
          <button onClick={leaveRoom} style={{ width: 54, height: 54, borderRadius: '50%', border: 'none', background: 'var(--danger)', fontSize: '20px', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}
    </main>
  );
}
