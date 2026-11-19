import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Provider = 'kakao' | 'google';

interface AuthState {
  enabled: boolean;          // Supabase 설정 여부
  ready: boolean;            // 세션 확인 끝
  session: Session | null;
  handle: string | null;     // 닉네임-0000, 아직 없으면 null
  signIn: (p: Provider) => Promise<void>;
  signOut: () => Promise<void>;
  claimNickname: (nick: string) => Promise<string>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [ready, setReady] = useState(!supabase);

  const loadHandle = useCallback(async (s: Session | null) => {
    if (!supabase || !s) return setHandle(null);
    const { data } = await supabase.from('profiles').select('handle').eq('id', s.user.id).maybeSingle();
    setHandle(data?.handle ?? null);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadHandle(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadHandle(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadHandle]);

  const signIn = async (provider: Provider) => {
    if (!supabase) return;
    // 돌아올 주소는 사이트 첫 화면으로 고정(Supabase 허용 목록과 정확히 맞추기 위해),
    // 보고 있던 탭은 따로 기억했다가 로그인 후 복원
    try {
      sessionStorage.setItem('fitter.returnHash', location.hash);
    } catch {
      /* noop */
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/` },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setHandle(null);
  };

  const claimNickname = async (nick: string) => {
    if (!supabase) throw new Error('서버가 설정되지 않았어요');
    const { data, error } = await supabase.rpc('claim_nickname', { nick });
    if (error) throw error;
    setHandle(data as string);
    return data as string;
  };

  return (
    <Ctx.Provider value={{ enabled: !!supabase, ready, session, handle, signIn, signOut, claimNickname }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}
