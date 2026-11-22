import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabaseServer';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile?.username) {
        return NextResponse.redirect(`${origin}/feed`);
      }
      return NextResponse.redirect(`${origin}/profile-setup`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
