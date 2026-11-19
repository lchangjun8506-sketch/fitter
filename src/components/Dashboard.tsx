import { useMemo, useState } from 'react';
import { ROUTINES, ROUTINE_META } from '../data/exercises';
import { estimate1RM, progressStatus, topWeight, type Status } from '../lib/analysis';
import { todayStr } from '../lib/date';
import type { Routine, WorkoutLog } from '../lib/types';

const BADGE: Record<Status, { text: string; cls: string }> = {
  progress: { text: '↗ 성장 중', cls: 'bg-lime text-black' },
  stall: { text: '⚠ 정체', cls: 'bg-coral text-black' },
  hold: { text: '→ 유지', cls: 'bg-white/10 text-white/80' },
  new: { text: '기록 부족', cls: 'bg-white/5 text-mute' },
};

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8">
      <polyline points={pts} fill="none" stroke="#D4FF3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Dashboard({ logs }: { logs: WorkoutLog[] }) {
  const [filter, setFilter] = useState<Routine | '전체'>('전체');

  const weekCount = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const from = todayStr(d);
    return new Set(logs.filter((l) => l.date >= from).map((l) => l.date)).size;
  }, [logs]);

  const rows = useMemo(() => {
    const grouped = new Map<string, WorkoutLog[]>();
    logs
      .filter((l) => filter === '전체' || l.routine === filter)
      .forEach((l) => grouped.set(l.exercise, [...(grouped.get(l.exercise) ?? []), l]));
    return [...grouped.entries()].map(([ex, hist]) => ({ ex, hist, status: progressStatus(hist) }));
  }, [logs, filter]);

  const comparable = rows.filter((r) => r.status !== 'new');
  const ratio = comparable.length ? Math.round((comparable.filter((r) => r.status === 'progress').length / comparable.length) * 100) : 0;
  const stalls = rows.filter((r) => r.status === 'stall').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3.5 col-span-3 flex items-end justify-between bg-gradient-to-br from-lime to-[#9EE01A] border-none text-black">
          <div>
            <div className="text-[11px] font-bold opacity-70">최근 7일 운동</div>
            <div className="text-4xl font-black tabular-nums leading-none mt-1">
              {weekCount}
              <span className="text-lg ml-1">일</span>
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className={`w-2.5 h-8 rounded-full ${i < weekCount ? 'bg-black' : 'bg-black/15'}`} />
            ))}
          </div>
        </div>
        <div className="card p-3.5 col-span-2">
          <div className="label">성장 종목 비율</div>
          <div className="text-2xl font-black tabular-nums mt-1">{ratio}%</div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-lime rounded-full" style={{ width: `${ratio}%` }} />
          </div>
        </div>
        <div className="card p-3.5">
          <div className="label">정체</div>
          <div className={`text-2xl font-black tabular-nums mt-1 ${stalls ? 'text-coral' : ''}`}>{stalls}개</div>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {(['전체', ...ROUTINES] as const).map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`chip whitespace-nowrap ${filter === r ? 'bg-white text-black border-white' : 'bg-surface border-line text-white/70'}`}
          >
            {r === '전체' ? '전체' : `${ROUTINE_META[r].emoji} ${ROUTINE_META[r].short}`}
          </button>
        ))}
      </div>

      {rows.length === 0 && <div className="card p-10 text-center text-sm text-mute font-semibold">분석할 기록이 아직 없어요</div>}

      <div className="space-y-2">
        {rows.map(({ ex, hist, status }) => {
          const latest = hist[0];
          const trend = hist.slice(0, 8).reverse().map((h) => topWeight(h.sets));
          return (
            <div key={ex} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-extrabold truncate">{ex}</h4>
                  <p className="text-[11px] text-mute font-semibold mt-0.5">
                    {hist.length}회 기록 · 최근 {topWeight(latest.sets)}kg · 1RM {estimate1RM(latest.sets)}kg
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 ${BADGE[status].cls}`}>{BADGE[status].text}</span>
              </div>
              <div className="mt-2">
                <Spark values={trend} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
