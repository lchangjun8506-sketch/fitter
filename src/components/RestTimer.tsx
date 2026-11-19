import { X } from 'lucide-react';
import { REST_PRESETS, mmss, useRest } from '../lib/rest';

/**
 * 휴식 타이머 알약. 세트 입력 시트 안, 그리고 시트를 닫았을 때 기록 화면 아래에 떠 있음.
 * 숫자 버튼 = 그 시간으로 다시 시작, X = 멈춤
 */
export default function RestPill({ floating = false }: { floating?: boolean }) {
  const r = useRest();
  const label = r.done ? '휴식 끝' : r.running ? '휴식' : '휴식 타이머';

  return (
    <section
      aria-label="휴식 타이머"
      className={`relative overflow-hidden inline-flex items-center gap-1 h-12 rounded-full pl-4 pr-1 bg-ink text-onink ${floating ? 'shadow-[0_8px_24px_rgba(0,0,0,.25)]' : ''}`}
    >
      <span className={`text-[13px] font-semibold ${r.done ? 'text-accent' : 'opacity-80'}`}>{label}</span>
      {(r.running || r.done) && (
        <span className={`num text-[22px] leading-none ml-1 mr-1 ${r.done ? 'text-accent' : ''}`} aria-live="off">
          {mmss(r.left)}
        </span>
      )}
      {REST_PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => r.start(p)}
          aria-label={`${p}초 휴식`}
          aria-pressed={r.running && r.total === p}
          className={`tap h-10 min-w-[44px] px-2 rounded-full num text-[16px] transition-colors ${r.running && r.total === p ? 'bg-onink text-ink' : 'bg-onink/15'}`}
        >
          {p}
        </button>
      ))}
      {(r.running || r.done) && (
        <button onClick={r.reset} aria-label="타이머 멈춤" className="tap w-10 h-10 grid place-items-center opacity-70">
          <X aria-hidden className="w-4 h-4" strokeWidth={2} />
        </button>
      )}
      {r.running && (
        <span
          aria-hidden
          className="absolute left-0 bottom-0 h-[3px] bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${((r.total - r.left) / r.total) * 100}%` }}
        />
      )}
    </section>
  );
}
