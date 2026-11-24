'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabaseClient';

export default function BackgroundLayer() {
  const supabase = createClient();
  const [wallpaper, setWallpaper] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('wallpaper_url')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (data?.wallpaper_url) setWallpaper(data.wallpaper_url);
  }

  return (
    <div
      className="bg-layer"
      style={wallpaper ? ({ '--bgimg': `url(${wallpaper})` } as React.CSSProperties) : undefined}
    />
  );
}
