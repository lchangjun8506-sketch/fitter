import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

const PRESETS = [60, 90, 120];

type WakeLock = { release: () => Promise<void> };

/** 끝나는 시각 기준으로 계산 → 화면이 꺼지거나 다른 앱에 다녀와도 정확 */
export default function RestTimer() {
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(0);
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

  const start = (sec: number) => {
    // iOS는 사용자 탭 안에서만 소리 재생 권한이 열림 → 시작 버튼에서 미리 준비
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audio.current && AC) audio.current = new AC();
      audio.current?.resume();
    } catch {
      /* noop */
    }
    clearInterval(tick.current);
    endAt.current = Date.now() + sec * 1000;
    setTotal(sec);
    setLeft(sec);
    keepAwake();
    tick.current = window.setInterval(sync, 250);
  };
  const reset = () => {
    clearInterval(tick.current);
    endAt.current = 0;
    releaseWake();
    setTotal(0);
    setLeft(0);
  };

  const running = left > 0;
  const done = total > 0 && left === 0;
  const pct = total ? ((total - left) / total) * 100 : 0;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <section aria-label="휴식 타이머" className="group-card relative">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="caption">{done ? '휴식 끝' : running ? '휴식 중' : '휴식 타이머'}</div>
          <div className={`num text-[40px] leading-none mt-1 ${done ? 'text-accent' : running ? 'text-ink' : 'text-sub/60'}`} aria-live="off">
            {mm}:{ss}
          </div>
        </div>
        <div className="flex bg-fill rounded-[10px] p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => start(p)}
              className={`tap h-11 min-w-[44px] px-2.5 rounded-[8px] num text-[17px] transition-colors ${total === p && running ? 'bg-seg shadow-sm' : ''}`}
            >
              {p < 120 ? p : '2:00'}
            </button>
          ))}
        </div>
        <button onClick={reset} aria-label="타이머 초기화" className="tap w-11 h-11 -mr-2 grid place-items-center text-sub">
          <RotateCcw aria-hidden className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>
      <div className="absolute left-0 bottom-0 h-[3px] bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
    </section>
  );
}
