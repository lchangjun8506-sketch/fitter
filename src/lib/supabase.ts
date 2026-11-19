import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 환경 변수가 없으면 null → 앱은 로그인 없이 이 기기 저장 모드로 동작 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }) : null;

/** Supabase 오류를 화면용 한국어 문장으로 */
export function errText(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '인터넷 연결을 확인해 주세요';
  if (/JWT|not signed in/i.test(m)) return '다시 로그인해 주세요';
  return m;
}
