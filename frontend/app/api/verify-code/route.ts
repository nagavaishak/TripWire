import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code: string = (body.code ?? '').trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const raw = process.env.TRIPWIRE_ACCESS_CODES ?? 'SIGNAL,TRENDLE,ORACLE,LAUNCH';
  const valid = raw
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (!valid.includes(code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('tw_access', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return res;
}
