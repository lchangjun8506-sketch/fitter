/**
 * 휴식 끝 알림 (잠금화면 · 애플워치)
 * 휴식을 시작하면 서버에 "N초 뒤 알려 줘"를 보내고, 서버가 그 시각에 푸시를 보냄.
 * 아이폰이 잠겨 있으면 애플워치로 넘어가 손목이 울림.
 */
import { supabase } from './supabase';

const FLAG = 'fitter.push';

export type PushSupport = 'ok' | 'ios-install' | 'unsupported';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIOS() && !standalone()) return 'ios-install'; // iOS는 홈 화면에 추가한 앱에서만 알림 가능
  return has ? 'ok' : 'unsupported';
}

export function pushEnabled(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1' && 'Notification' in window && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

const setFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(FLAG, '1');
    else localStorage.removeItem(FLAG);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event('fitter-push'));
};

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function authHeader(): Promise<string | null> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  return data.session ? `Bearer ${data.session.access_token}` : null;
}

/** 알림 켜기 (반드시 버튼 탭 안에서 호출: iOS 권한 요청 조건) */
export async function enablePush(): Promise<void> {
  if (!supabase) throw new Error('로그인 기능이 설정된 앱에서만 쓸 수 있어요');
  const sup = pushSupport();
  if (sup === 'ios-install') throw new Error('먼저 Safari 공유 버튼 → "홈 화면에 추가"로 설치한 뒤, 홈 화면의 FITTER에서 켜 주세요');
  if (sup === 'unsupported') throw new Error('이 브라우저는 알림을 지원하지 않아요');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('알림이 허용되지 않았어요. 설정 → 알림 → FITTER에서 허용해 주세요');

  const res = await fetch('/api/rest-push');
  if (!res.ok) throw new Error('서버에 알림 설정이 아직 없어요');
  const { publicKey } = (await res.json()) as { publicKey: string };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('로그인이 필요해요');
  const { error } = await supabase.from('rest_push').upsert({ user_id: u.user.id, subscription: sub.toJSON(), token: null, updated_at: new Date().toISOString() });
  if (error) throw new Error(/rest_push|relation|schema cache/.test(error.message) ? '서버 준비가 덜 됐어요 (0005 SQL 실행 필요)' : error.message);
  setFlag(true);
}

export async function disablePush(): Promise<void> {
  setFlag(false);
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    const { data: u } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (u.user) await supabase?.from('rest_push').delete().eq('user_id', u.user.id);
  } catch {
    /* noop */
  }
}

/** 휴식 시작 → delay초 뒤 알림 예약. 결과는 서버가 끝까지 기다리므로 기다리지 않음 */
export async function scheduleRestPush(delay: number, test = false): Promise<Response | null> {
  if (!pushEnabled()) return null;
  const auth = await authHeader();
  if (!auth) return null;
  const token = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  // keepalive: 바로 화면을 잠가도 요청이 끝까지 전송되도록
  return fetch('/api/rest-push', {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json', authorization: auth },
    body: JSON.stringify({ action: 'schedule', token, delay, test }),
  }).catch(() => null);
}

export async function cancelRestPush(): Promise<void> {
  if (!pushEnabled()) return;
  const auth = await authHeader();
  if (!auth) return;
  fetch('/api/rest-push', {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json', authorization: auth },
    body: JSON.stringify({ action: 'cancel' }),
  }).catch(() => {});
}
