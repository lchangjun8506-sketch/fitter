import { useMemo, useState } from 'react';
import { ROUTINES } from '../data/exercises';
import { estimate1RM, progressStatus, topWeight, type Status } from '../lib/analysis';
import { todayStr } from '../lib/date';
import type { Routine, WorkoutLog } from '../lib/types';

const STATUS: Record<Status, { text: string; cls: string }> = {
  progress: { text: '상승', cls: 'text-up' },
  stall: { text: '정체', cls: 'text-down' },
  hold: { text: '유지', cls: 'text-sub' },
  new: { text: '—', cls: 'text-sub/60' },
};
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function Spark({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <div className="w-20" />;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${26 - ((v - min) / span) * 22}`).join(' ');
  return (
    <svg role="img" aria-label={label} viewBox="0 0 100 28" preserveAspectRatio="none" className="w-20 h-7 text-ink">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Dashboard({ logs }: { logs: WorkoutLog[] }) {
  const [filter, setFilter] = useState<Routine | '전체'>('전체');

  const days = useMemo(() => {
    const trained = new Set(logs.map((l) => l.date));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { label: WEEK[d.getDay()], on: trained.has(todayStr(d)) };
    });
  }, [logs]);
  const weekCount = days.filter((d) => d.on).length;

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
    <div className="space-y-6">
      <section aria-label="최근 7일" className="group-card px-4 pt-4 pb-3.5">
        <div className="flex items-end justify-between">
          <div>
            <div className="caption">최근 7일</div>
            <div className="num text-[56px] leading-[0.9] mt-2">
              {weekCount}<span className="text-[22px] text-sub ml-1.5">DAYS</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {days.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={`w-6 h-10 rounded-[6px] ${d.on ? 'bg-ink' : 'bg-fill'}`} />
                <span className={`text-[11px] font-medium ${i === 6 ? 'text-ink' : 'text-sub'}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 group-card">
        <div className="px-4 py-3.5">
          <div className="caption">상승 중인 종목</div>
          <div className="num text-[32px] leading-none mt-1.5">{ratio}<span className="text-[17px] text-sub ml-0.5">%</span></div>
        </div>
        <div className="px-4 py-3.5 shadow-[inset_1px_0_0_var(--sep)]">
          <div className="caption">3회 이상 정체</div>
          <div className={`num text-[32px] leading-none mt-1.5 ${stalls ? 'text-down' : ''}`}>{stalls}</div>
        </div>
      </section>

      <section>
        <div role="tablist" aria-label="루틴 필터" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-3">
          {(['전체', ...ROUTINES] as const).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={filter === r}
              onClick={() => setFilter(r)}
              className={`tap shrink-0 h-9 px-3.5 rounded-full text-[14px] font-medium transition-colors ${filter === r ? 'bg-ink text-onink' : 'bg-card'}`}
            >
              {r}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="py-16 text-center text-[15px] text-sub">분석할 기록이 없습니다.</p>
        ) : (
          <div className="group-card">
            {rows.map(({ ex, hist, status }) => {
              const latest = hist[0];
              const trend = hist.slice(0, 8).reverse().map((h) => topWeight(h.sets));
              return (
                <div key={ex} className="row gap-3 py-3 [&+&]:shadow-[inset_0_1px_0_var(--sep)]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[17px] font-semibold truncate">{ex}</div>
                    <div className="text-[13px] text-sub mt-0.5">
                      {hist.length}회 · 1RM <span className="num text-[15px]">{estimate1RM(latest.sets)}</span>kg
                    </div>
                  </div>
                  <Spark values={trend} label={`${ex} 최고 무게 추이`} />
                  <div className="w-12 text-right">
                    <div className="num text-[22px] leading-none">{topWeight(latest.sets)}</div>
                    <div className={`text-[12px] font-semibold mt-1 ${STATUS[status].cls}`}>{STATUS[status].text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
