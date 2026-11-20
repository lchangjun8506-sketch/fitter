import { useMemo, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { prettyDate } from '../lib/date';
import { setVolume } from '../lib/analysis';
import type { WorkoutLog } from '../lib/types';

interface Props {
  logs: WorkoutLog[];
  onEdit: (log: WorkoutLog) => void;
  onDelete: (id: string) => void;
  /** 검색칸 표시 (날짜 하나만 볼 때는 숨김) */
  search?: boolean;
}

export default function HistoryList({ logs, onEdit, onDelete, search = true }: Props) {
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const k = q.trim().toLowerCase();
    const filtered = k
      ? logs.filter((l) => [l.exercise, l.routine, l.date, l.memo ?? ''].some((v) => v.toLowerCase().includes(k)))
      : logs;
    const map = new Map<string, WorkoutLog[]>();
    filtered.forEach((l) => map.set(l.date, [...(map.get(l.date) ?? []), l]));
    return [...map.entries()];
  }, [logs, q]);

  return (
    <div className="space-y-6">
      {search && <label className="flex items-center gap-2 h-11 px-3 rounded-[12px] bg-fill">
        <Search aria-hidden className="w-[18px] h-[18px] text-sub" strokeWidth={2} />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="기록 검색" placeholder="검색"
          className="flex-1 min-w-0 bg-transparent text-[16px] placeholder:text-sub focus:outline-none" />
      </label>}

      {groups.length === 0 && (
        <p className="py-16 text-center text-[15px] text-sub">{q ? '검색 결과가 없습니다.' : '아직 기록이 없습니다.'}</p>
      )}

      {groups.map(([date, items]) => (
        <section key={date}>
          <div className="flex items-baseline justify-between px-4 pb-2">
            <h2 className="text-[13px] font-semibold text-sub">{prettyDate(date)}</h2>
            <span className="num text-[15px] text-sub">{items.reduce((a, l) => a + setVolume(l.sets), 0).toLocaleString()} KG</span>
          </div>
          <div className="group-card">
            {items.map((log) => (
              <article key={log.id} className="flex gap-2 pl-4 pr-1 py-3.5 [&+&]:shadow-[inset_0_1px_0_var(--sep)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-[17px] font-semibold truncate">{log.exercise}</h3>
                    <span className="text-[13px] text-sub shrink-0">{log.routine}</span>
                  </div>
                  <p className="num text-[18px] text-ink/85 mt-1 leading-snug">
                    {log.sets.map((s, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-sub/60 mx-1.5">/</span>}
                        {s.weight}×{s.reps}
                        {s.drops?.map((d, k) => (
                          <span key={k} className="text-sub"> ↓{d.weight}×{d.reps}</span>
                        ))}
                      </span>
                    ))}
                  </p>
                  {log.memo && <p className="text-[14px] text-sub mt-1.5">{log.memo}</p>}
                </div>
                <div className="flex shrink-0 -my-1">
                  <button onClick={() => onEdit(log)} aria-label={`${log.exercise} 수정`} className="tap w-11 h-11 grid place-items-center text-sub">
                    <Pencil aria-hidden className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </button>
                  <button onClick={() => onDelete(log.id)} aria-label={`${log.exercise} 삭제`} className="tap w-11 h-11 grid place-items-center text-sub">
                    <Trash2 aria-hidden className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
