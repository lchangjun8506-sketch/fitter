import { useMemo, useState } from 'react';
import { MessageCircle, Pencil, Search, Trash2 } from 'lucide-react';
import { ROUTINE_META } from '../data/exercises';
import { prettyDate } from '../lib/date';
import { setVolume } from '../lib/analysis';
import type { WorkoutLog } from '../lib/types';

interface Props {
  logs: WorkoutLog[];
  onEdit: (log: WorkoutLog) => void;
  onDelete: (id: string) => void;
}

export default function HistoryList({ logs, onEdit, onDelete }: Props) {
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
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="종목, 루틴, 날짜, 메모 검색" className="field w-full pl-11 pr-4 h-12 text-sm" />
      </div>

      {groups.length === 0 && (
        <div className="card p-10 text-center">
          <div className="text-4xl">🏋️</div>
          <p className="mt-3 text-sm text-mute font-semibold">{q ? '검색 결과가 없어요' : '아직 기록이 없어요. 첫 세트를 찍어볼까요?'}</p>
        </div>
      )}

      {groups.map(([date, items]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-sm font-extrabold">{prettyDate(date)}</h3>
            <span className="text-[11px] text-mute font-semibold tabular-nums">
              {items.reduce((a, l) => a + setVolume(l.sets), 0).toLocaleString()} kg
            </span>
          </div>
          {items.map((log) => (
            <article key={log.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-lime">
                    {ROUTINE_META[log.routine]?.emoji} {log.routine}
                  </span>
                  <h4 className="text-base font-extrabold truncate">{log.exercise}</h4>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onEdit(log)} aria-label="수정" className="press w-9 h-9 grid place-items-center rounded-xl bg-raised text-white/60">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(log.id)} aria-label="삭제" className="press w-9 h-9 grid place-items-center rounded-xl bg-raised text-white/60 hover:text-coral">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {log.sets.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-raised text-xs font-bold tabular-nums">
                    <span className="text-mute mr-1">{i + 1}</span>
                    {s.weight}kg × {s.reps}
                    {s.drops?.map((d, k) => (
                      <span key={k} className="text-violet ml-1">
                        ↳{d.weight}×{d.reps}
                      </span>
                    ))}
                  </span>
                ))}
              </div>
              {log.memo && (
                <p className="text-xs text-white/60 flex gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 mt-px shrink-0" /> {log.memo}
                </p>
              )}
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}
