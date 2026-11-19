/**
 * 휴식 끝 알림 (잠금화면 · 애플워치)
 *
 * GET  /api/rest-push                       → { publicKey }  알림 구독에 쓰는 공개 키
 * POST /api/rest-push { action:'schedule', token, delay, test? }
 *      → rest_push.token 을 이 값으로 바꾸고 delay초 기다린 뒤, 그때도 token이 같으면 푸시 발송
 *        (그 사이 타이머를 멈추거나 다시 시작하면 token이 바뀌어 발송 안 함)
 * POST /api/rest-push { action:'cancel' }   → token 비움
 *
 * 아이폰이 잠겨 있으면 애플워치로 알림이 넘어감 (iOS 16.4+, 홈 화면에 추가한 앱)
 *
 * 필요한 Vercel 환경 변수:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY        서버 전용
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  로그인 확인용 (앱과 공유)
 */
import webpush from 'web-push';

export const maxDuration = 200;

const MAX_DELAY = 180;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const sbUrl = () => process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const sbKey = () => process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(): Promise<Response> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return json(503, { error: '알림 기능이 아직 설정되지 않았어요' });
  return json(200, { publicKey });
}

export async function POST(request: Request): Promise<Response> {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  const url = sbUrl(), key = sbKey();
  if (!pub || !priv || !url || !key) return json(503, { error: '알림 기능이 아직 설정되지 않았어요' });

  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: '로그인이 필요해요' });
  let body: { action?: string; token?: string; delay?: number; test?: boolean };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: '잘못된 요청' });
  }

  const headers = { apikey: key, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' };
  const userRes = await fetch(`${url}/auth/v1/user`, { headers });
  if (!userRes.ok) return json(401, { error: '로그인이 필요해요' });
  const uid = ((await userRes.json()) as { id: string }).id;
  const row = `${url}/rest/v1/rest_push?user_id=eq.${uid}`;

  const setToken = (token: string | null) =>
    fetch(row, { method: 'PATCH', headers: { ...headers, prefer: 'return=representation' }, body: JSON.stringify({ token, updated_at: new Date().toISOString() }) });

  if (body.action === 'cancel') {
    await setToken(null);
    return json(200, { ok: true });
  }
  if (body.action !== 'schedule' || typeof body.token !== 'string' || body.token.length > 64) return json(400, { error: '잘못된 요청' });

  const delay = Math.max(1, Math.min(MAX_DELAY, Math.round(Number(body.delay) || 0)));
  const set = await setToken(body.token);
  if (!set.ok) return json(500, { error: '알림 표(rest_push)가 없어요. 0005 SQL을 실행해 주세요' });
  if (!((await set.json()) as unknown[]).length) return json(409, { error: '이 기기에서 알림을 다시 켜 주세요' });

  // 기다린 뒤 아직 같은 휴식인지 확인 (네트워크 왕복만큼 1초 일찍 깨어남)
  await sleep(Math.max(0, delay * 1000 - 1000));
  const now = await fetch(`${row}&select=token,subscription`, { headers });
  const [cur] = (await now.json()) as { token: string | null; subscription: webpush.PushSubscription }[];
  if (!cur || cur.token !== body.token) return json(200, { sent: false });

  webpush.setVapidDetails('https://fitter-cyan.vercel.app', pub, priv);
  try {
    await webpush.sendNotification(
      cur.subscription,
      JSON.stringify(body.test ? { title: '알림 테스트', body: '워치에서 이 알림이 보이면 준비 끝이에요.' } : { title: '휴식 끝', body: '다음 세트를 시작하세요.' }),
      { TTL: 60, urgency: 'high', topic: 'rest' },
    );
    await setToken(null);
    return json(200, { sent: true });
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    // 구독이 만료됨 → 지워서 앱이 다시 켜도록
    if (code === 404 || code === 410) await fetch(row, { method: 'DELETE', headers });
    return json(502, { error: '알림을 보내지 못했어요', code });
  }
}
