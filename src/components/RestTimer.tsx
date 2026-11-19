import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Timer } from 'lucide-react';

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

  const done = total > 0 && left === 0;
  const pct = total ? ((total - left) / total) * 100 : 0;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="card relative overflow-hidden p-3 pl-4 flex items-center gap-3">
      <div className="absolute inset-y-0 left-0 bg-lime/10 transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      <Timer className="relative w-5 h-5 text-lime shrink-0" />
      <div className="relative flex-1">
        <div className="label">휴식</div>
        <div className={`text-xl font-extrabold tabular-nums leading-none mt-0.5 ${done ? 'text-lime' : ''}`}>
          {done ? 'GO! 💥' : `${mm}:${ss}`}
        </div>
      </div>
      <div className="relative flex gap-1.5">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => start(p)} className="press h-9 px-3 rounded-full bg-raised border border-line text-xs font-bold">
            {p < 120 ? `${p}s` : `${p / 60}m`}
          </button>
        ))}
        <button onClick={reset} aria-label="타이머 초기화" className="press h-9 w-9 grid place-items-center rounded-full bg-raised border border-line text-mute">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
