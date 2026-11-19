import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * 휴식 타이머 (앱 전체에서 하나)
 * - 끝나는 시각 기준 계산 → 화면이 꺼지거나 다른 앱에 다녀와도 정확
 * - 세트 입력 시트를 닫아도 계속 돌고, 기록 화면 아래에 작게 떠 있음
 */
export const REST_PRESETS = [60, 90, 120];

type WakeLock = { release: () => Promise<void> };

interface Rest {
  total: number;
  left: number;
  running: boolean;
  done: boolean;
  /** 마지막으로 고른 휴식 시간 (세트 완료 시 자동 시작에 사용) */
  preferred: number;
  start: (sec?: number) => void;
  reset: () => void;
}

const Ctx = createContext<Rest | null>(null);
const PREF_KEY = 'fitter.restSec';

const readPref = () => {
  try {
    const v = Number(localStorage.getItem(PREF_KEY));
    return REST_PRESETS.includes(v) ? v : 90;
  } catch {
    return 90;
  }
};

export function RestProvider({ children }: { children: ReactNode }) {
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(0);
  const [preferred, setPreferred] = useState(readPref);
  const endAt = useRef(0);
  const tick = useRef<number>();
  const audio = useRef<AudioContext | null>(null);
  const wake = useRef<WakeLock | null>(null);

  const releaseWake = () => {
    wake.current?.release().catch(() => {});
    wake.current = null;
  };

  // 휴식 중엔 화면이 꺼지지 않게 (iOS 16.4+, 안드로이드 크롬)
  const keepAwake = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
      if (nav.wakeLock && !wake.current) wake.current = await nav.wakeLock.request('screen');
    } catch {
      /* 저전력 모드 등에서는 거부될 수 있음 */
    }
  };

  // 종료 알림: 안드로이드는 진동, iOS는 진동 API가 없어 짧은 비프음
  const notify = () => {
    navigator.vibrate?.([200, 100, 200]);
    const ctx = audio.current;
    if (!ctx) return;
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  };

  const sync = () => {
    if (!endAt.current) return;
    const remain = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
    setLeft(remain);
    if (remain === 0) {
      clearInterval(tick.current);
      endAt.current = 0;
      releaseWake();
      notify();
    }
  };

  useEffect(() => {
    // 앱으로 돌아왔을 때 즉시 남은 시간 보정 + 화면 켜짐 재요청(백그라운드 가면 해제됨)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      sync();
      if (endAt.current) keepAwake();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(tick.current);
      releaseWake();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback((sec?: number) => {
    const s = sec ?? readPref();
    // iOS는 사용자 탭 안에서만 소리 재생 권한이 열림 → 시작하는 탭에서 미리 준비
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audio.current && AC) audio.current = new AC();
      audio.current?.resume();
    } catch {
      /* noop */
    }
    if (sec) {
      setPreferred(sec);
      try {
        localStorage.setItem(PREF_KEY, String(sec));
      } catch {
        /* noop */
      }
    }
    clearInterval(tick.current);
    endAt.current = Date.now() + s * 1000;
    setTotal(s);
    setLeft(s);
    keepAwake();
    tick.current = window.setInterval(sync, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    clearInterval(tick.current);
    endAt.current = 0;
    releaseWake();
    setTotal(0);
    setLeft(0);
  }, []);

  const value = useMemo<Rest>(
    () => ({ total, left, running: left > 0, done: total > 0 && left === 0, preferred, start, reset }),
    [total, left, preferred, start, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRest() {
  const v = useContext(Ctx);
  if (!v) throw new Error('RestProvider 밖에서 useRest 사용');
  return v;
}

export const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
