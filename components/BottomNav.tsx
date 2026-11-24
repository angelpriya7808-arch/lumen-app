'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '../lib/supabaseClient';

export default function BottomNav() {
  const supabase = createClient();
  const pathname = usePathname();
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', auth.user.id)
        .maybeSingle();
      setAvatar(data?.avatar_url ?? null);
    })();
  }, []);

  const items = [
    { href: '/feed', icon: '◈' },
    { href: '/rooms', icon: '✧' },
    { href: '/post/new', icon: '✚', create: true },
    { href: '/reels', icon: '▷' },
    { href: '/messages', icon: '💬' },
  ];

  return (
    <nav className="glass-panel" id="bottom-nav">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-btn${pathname === item.href ? ' active' : ''}${item.create ? ' create' : ''}`}
        >
          {item.icon}
        </Link>
      ))}
      <Link href="/profile" className={`nav-btn${pathname === '/profile' ? ' active' : ''}`}>
        {avatar ? (
          <span className="nav-avatar" style={{ backgroundImage: `url(${avatar})` }} />
        ) : (
          <span className="nav-avatar" style={{ background: 'var(--glass-strong)' }} />
        )}
      </Link>
    </nav>
  );
}
