import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

const PRESETS = [60, 90, 120];

export default function RestTimer() {
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(0);
  const ref = useRef<number>();

  useEffect(() => () => clearInterval(ref.current), []);

  const start = (sec: number) => {
    clearInterval(ref.current);
    setTotal(sec);
    setLeft(sec);
    ref.current = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(ref.current);
          navigator.vibrate?.([200, 100, 200]);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  };
  const reset = () => {
    clearInterval(ref.current);
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
          <div className={`num text-[40px] leading-none mt-1 ${running || done ? 'text-ink' : 'text-sub/60'}`} aria-live="off">
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
      <div className="absolute left-0 bottom-0 h-[2px] bg-ink transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
    </section>
  );
}
