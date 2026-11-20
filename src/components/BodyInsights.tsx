import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Target } from 'lucide-react';
import {
  addDays,
  daysBetween,
  defaultGoal,
  goalStatuses,
  monthDay,
  paceCheck,
  series,
  signed,
  trainingLink,
  verdict,
  type BodyGoal,
  type GoalStatus,
} from '../lib/body';
import type { InBodyRecord } from '../lib/inbody';
import type { WorkoutLog } from '../lib/types';
import Sheet from './Sheet';
import Segmented from './Segmented';

const TONE = {
  good: 'bg-up/10 text-up',
  warn: 'bg-down/10 text-down',
  bad: 'bg-accent/10 text-accentfg',
  neutral: 'bg-fill text-sub',
};

/* ── 목표 막대 (분석·MY 대시보드 공용) ── */
export function GoalBar({ s, color, compact = false, mini = false }: { s: GoalStatus; color: string; compact?: boolean; mini?: boolean }) {
  if (mini)
    return (
      <span className="block py-1">
        <span className="flex justify-between text-[12px]">
          <span className="font-semibold">{s.unit === '%' ? '체지방률' : '골격근'}</span>
          <span className="text-sub">
            {s.current} → {s.target}
          </span>
        </span>
        <span className="relative block h-1.5 mt-1 rounded-full bg-fill" aria-label={`${s.label} ${Math.round(s.pct * 100)}%`}>
          <span className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${Math.max(s.pct * 100, s.pct > 0 ? 4 : 0)}%` }} />
        </span>
      </span>
    );
  const paceCls = s.pace === 'ahead' || s.pace === 'done' ? 'text-up' : s.pace === 'behind' || s.pace === 'wrong' ? 'text-down' : 'text-sub';
  return (
    <div className={compact ? 'py-2' : 'px-4 py-3.5 [&+*]:shadow-[inset_0_1px_0_var(--sep)]'}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`${compact ? 'text-[14px]' : 'text-[15px]'} font-bold`}>{s.label}</span>
        <span className="text-[13px] text-sub shrink-0">
          <b className={`num ${compact ? 'text-[17px]' : 'text-[20px]'} text-ink`}>{s.current}</b>
          {s.unit} → {s.target}
          {s.unit}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${s.label} 진행률`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s.pct * 100)}
        className={`relative ${compact ? 'h-2 mt-2' : 'h-2.5 mt-2.5'} rounded-full bg-fill`}
      >
        <div className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${Math.max(s.pct * 100, s.pct > 0 ? 3 : 0)}%` }} />
        <div aria-hidden className="absolute -top-1 -bottom-1 right-0 w-[2px] bg-ink" />
      </div>
      <div className="flex justify-between mt-1.5 text-[12px] text-sub">
        <span>
          {s.start}
          {s.unit}에서 시작 · <b className="text-ink">{Math.round(s.pct * 100)}%</b> 달성
        </span>
        {!s.done && (
          <span>
            남은 {s.left}
            {s.unit === '%' ? '%p' : s.unit}
          </span>
        )}
      </div>
      {!compact && <p className={`mt-1.5 text-[13px] font-semibold ${paceCls}`}>{s.message}</p>}
    </div>
  );
}

/* ── 추세 그래프 ── */
function TrendChart({ title, unit, pts, target, stroke, period }: { title: string; unit: string; pts: { date: string; v: number }[]; target: number | null; stroke: string; period: number | null }) {
  const [sel, setSel] = useState<number | null>(null);
  const shown = useMemo(() => {
    if (!period || !pts.length) return pts;
    const from = addDays(pts[pts.length - 1].date, -period);
    const f = pts.filter((p) => p.date >= from);
    return f.length >= 2 ? f : pts.slice(-2);
  }, [pts, period]);
  useEffect(() => setSel(null), [period]);
  if (!shown.length) return null;

  const W = 334, H = 112, padX = 10, top = 16, bottom = 96;
  const vals = [...shown.map((p) => p.v), ...(target != null ? [target] : [])];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padV = Math.max(0.5, (hi - lo) * 0.15);
  lo -= padV;
  hi += padV;
  const t0 = shown[0].date, span = Math.max(1, daysBetween(t0, shown[shown.length - 1].date));
  const x = (d: string) => (shown.length === 1 ? W / 2 : padX + (daysBetween(t0, d) / span) * (W - padX * 2));
  const y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const last = shown[shown.length - 1];
  const delta = shown.length > 1 ? last.v - shown[0].v : 0;
  const mid = shown[Math.floor((shown.length - 1) / 2)];
  const s = sel != null ? shown[sel] : null;
  const fmt = (d: string) => d.slice(5).replace('-', '.');

  return (
    <div className="group-card px-3.5 pt-3 pb-1.5">
      <div className="flex items-baseline justify-between">
        <b className="text-[15px]">{title}</b>
        <span className="text-[13px] text-sub">
          {s ? `${monthDay(s.date)} ` : ''}
          <b className="num text-[18px] text-ink">{(s ?? last).v}</b> {unit}
          {!s && shown.length > 1 && <span className="font-bold ml-1">{signed(delta)}</span>}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mt-1 overflow-visible" role="img" aria-label={`${title} 변화: ${shown.map((p) => `${monthDay(p.date)} ${p.v}${unit}`).join(', ')}${target != null ? `, 목표 ${target}${unit}` : ''}`}>
        <line x1="0" x2={W} y1={bottom + 2} y2={bottom + 2} stroke="var(--sep)" />
        {target != null && (
          <>
            <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke={stroke} strokeDasharray="4 4" strokeWidth="1.2" opacity="0.8" />
            <text x={W - 2} y={y(target) - 4} textAnchor="end" fontSize="11" fill={stroke}>
              목표 {target}
            </text>
          </>
        )}
        {shown.length > 1 && <polyline fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={shown.map((p) => `${x(p.date)},${y(p.v)}`).join(' ')} />}
        {shown.map((p, i) => (
          <g key={p.date + i}>
            <circle cx={x(p.date)} cy={y(p.v)} r={i === shown.length - 1 || i === sel ? 5 : 4} fill={i === shown.length - 1 || i === sel ? stroke : 'rgb(var(--card))'} stroke={stroke} strokeWidth="2" />
            {/* 손가락으로 누르기 쉬운 투명 영역 */}
            <circle cx={x(p.date)} cy={y(p.v)} r="18" fill="transparent" onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }} />
          </g>
        ))}
        <g fontSize="10" fill="rgb(var(--sub))">
          <text x={x(t0)} y={H - 1} textAnchor="start">{fmt(t0)}</text>
          {shown.length > 2 && <text x={x(mid.date)} y={H - 1} textAnchor="middle">{fmt(mid.date)}</text>}
          {shown.length > 1 && <text x={x(last.date)} y={H - 1} textAnchor="end">{fmt(last.date)}</text>}
        </g>
      </svg>
    </div>
  );
}

/* ── 목표 정하기 시트 ── */
function GoalSheet({ open, latest, goal, onClose, onSave }: { open: boolean; latest: InBodyRecord; goal: BodyGoal | null; onClose: () => void; onSave: (g: BodyGoal | null) => Promise<void> }) {
  const [g, setG] = useState<BodyGoal>(() => goal ?? defaultGoal(latest));
  const [weeks, setWeeks] = useState(12);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // 목표를 새로 정하거나 고칠 때 시작점은 최근 측정값
    const base = defaultGoal(latest);
    const w = goal ? Math.round(daysBetween(goal.startDate, goal.targetDate) / 7) : 12;
    setWeeks([8, 12, 24].includes(w) ? w : 12);
    setG(goal ? { ...goal, fatStart: base.fatStart, muscleStart: base.muscleStart, startDate: base.startDate, targetDate: addDays(base.startDate, ([8, 12, 24].includes(w) ? w : 12) * 7) } : base);
    setErr(null);
  }, [open, goal, latest]);

  const pace = paceCheck(g);
  const bump = (k: 'fatTarget' | 'muscleTarget', d: number) => setG((x) => ({ ...x, [k]: Math.round((x[k] + d) * 10) / 10 }));
  const Step = ({ k, label, unit, step }: { k: 'fatTarget' | 'muscleTarget'; label: string; unit: string; step: number }) => {
    const diff = g[k] - (k === 'fatTarget' ? g.fatStart : g.muscleStart);
    return (
      <div>
        <div className="flex justify-between px-1 pb-2 text-[13px] font-semibold text-sub">
          <span>{label}</span>
          <span>
            {signed(diff)}
            {unit === '%' ? '%p' : unit}
          </span>
        </div>
        <div className="flex items-center h-14 rounded-[14px] bg-elevcard">
          <button onClick={() => bump(k, -step)} aria-label={`${label} 낮추기`} className="tap w-14 h-14 text-[26px] text-sub">−</button>
          <span className="num flex-1 text-center text-[28px]" aria-live="polite">
            {g[k]}
            <span className="font-sans text-[15px] text-sub ml-0.5">{unit}</span>
          </span>
          <button onClick={() => bump(k, step)} aria-label={`${label} 높이기`} className="tap w-14 h-14 text-[26px] text-sub">+</button>
        </div>
      </div>
    );
  };

  const save = async (v: BodyGoal | null) => {
    setBusy(true);
    setErr(null);
    try {
      await onSave(v);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="내 목표" onClose={onClose} action={{ label: busy ? '저장 중' : '저장', disabled: busy, onClick: () => save(g) }}>
      <p className="px-1 text-[14px] text-sub">
        지금 체지방률 {g.fatStart}% · 골격근량 {g.muscleStart}kg ({monthDay(g.startDate)} 측정)
      </p>
      <Step k="fatTarget" label="체지방률 목표" unit="%" step={0.5} />
      <Step k="muscleTarget" label="골격근량 목표" unit="kg" step={0.5} />
      <div>
        <h4 className="section-label">언제까지</h4>
        <Segmented
          label="기간"
          value={String(weeks)}
          onChange={(v) => {
            setWeeks(Number(v));
            setG((x) => ({ ...x, targetDate: addDays(x.startDate, Number(v) * 7) }));
          }}
          options={[8, 12, 24].map((w) => ({ id: String(w), label: `${w}주` }))}
        />
        <p className="px-1 pt-2 text-[13px] text-sub">{monthDay(g.targetDate)}까지</p>
      </div>
      <div className={`group-card !bg-elevcard px-4 py-3 text-[14px] leading-relaxed ${pace.ok ? '' : 'shadow-[inset_0_0_0_1.5px_rgb(var(--down))]'}`}>
        <b className={pace.ok ? 'text-up' : 'text-down'}>{pace.ok ? '무리 없는 속도예요' : pace.issues[0]}</b>
        <span className="block text-[13px] text-sub">
          체지방률 월 {Math.max(0, pace.fat)}%p (권장 1.5%p 이하) · 골격근량 월 {Math.max(0, pace.muscle)}kg (권장 0.5~1kg)
        </span>
      </div>
      {err && <p role="alert" className="px-1 text-[14px] text-down">{err}</p>}
      {goal && (
        <button onClick={() => save(null)} disabled={busy} className="tap w-full h-11 text-[15px] text-sub">목표 지우기</button>
      )}
    </Sheet>
  );
}

/* ── 분석 › 인바디 상단 ── */
export default function BodyInsights({ records, logs, goal, saveGoal }: { records: InBodyRecord[]; logs: WorkoutLog[]; goal: BodyGoal | null; saveGoal: (g: BodyGoal | null) => Promise<void> }) {
  const [sheet, setSheet] = useState(false);
  const [period, setPeriod] = useState<'90' | '180' | 'all'>('180');
  const latest = records[0];
  const v = useMemo(() => verdict(records), [records]);
  const st = useMemo(() => (goal ? goalStatuses(goal, records) : null), [goal, records]);
  const link = useMemo(() => trainingLink(records, logs, st ?? undefined), [records, logs, st]);
  const muscle = useMemo(() => series(records, 'skeletal_muscle'), [records]);
  const fat = useMemo(() => series(records, 'body_fat_pct'), [records]);
  if (!latest || !v) return null;
  const enough = Math.max(muscle.length, fat.length) >= 3;

  return (
    <div className="space-y-6">
      <section aria-label="한 줄 결론" className="group-card px-4 py-3.5">
        <span className={`inline-block text-[11px] font-extrabold px-2 py-1 rounded-[6px] ${TONE[v.tone]}`}>{v.tag}</span>
        <h3 className="text-[19px] font-bold mt-1.5 leading-snug">{v.title}</h3>
        <p className="text-[14px] leading-relaxed mt-1 text-ink/80">{v.detail}</p>
      </section>

      <section aria-label="내 목표">
        <div className="flex items-end justify-between">
          <h2 className="section-label">{goal ? `내 목표 · ${monthDay(goal.targetDate)}까지` : '내 목표'}</h2>
          {goal && (
            <button onClick={() => setSheet(true)} className="tap h-11 px-1 pb-2 text-[14px] font-semibold text-accentfg">목표 수정</button>
          )}
        </div>
        {goal && st ? (
          <div className="group-card">
            {st.fat && <GoalBar s={st.fat} color="bg-accent" />}
            {st.muscle && <GoalBar s={st.muscle} color="bg-cyan" />}
          </div>
        ) : (
          <button onClick={() => setSheet(true)} className="tap w-full group-card row gap-3 min-h-[64px] text-left">
            <span className="w-10 h-10 rounded-full bg-accent/10 text-accentfg grid place-items-center shrink-0">
              <Target aria-hidden className="w-5 h-5" strokeWidth={2} />
            </span>
            <span className="flex-1">
              <span className="block text-[16px] font-semibold">목표 정하기</span>
              <span className="block text-[13px] text-sub">체지방률 줄이기 · 근육 늘리기</span>
            </span>
            <ChevronRight aria-hidden className="w-5 h-5 text-sub/60" />
          </button>
        )}
      </section>

      <section aria-label="변화 추이">
        <h2 className="section-label">변화 추이</h2>
        {enough ? (
          <div className="space-y-2.5">
            <Segmented label="기간" value={period} onChange={setPeriod} options={[{ id: '90', label: '3개월' }, { id: '180', label: '6개월' }, { id: 'all', label: '전체' }]} />
            <TrendChart title="골격근량" unit="kg" pts={muscle} target={goal?.muscleTarget ?? null} stroke="rgb(var(--cyan))" period={period === 'all' ? null : Number(period)} />
            <TrendChart title="체지방률" unit="%" pts={fat} target={goal?.fatTarget ?? null} stroke="rgb(var(--accent))" period={period === 'all' ? null : Number(period)} />
            <p className="px-1 text-[12px] text-sub">점선은 목표, 점을 누르면 그날 수치를 볼 수 있어요.</p>
          </div>
        ) : (
          <div className="group-card px-4 py-3.5 text-[14px] text-sub leading-relaxed">
            측정이 3번 쌓이면 그래프로 보여 드려요. 지금 {Math.max(muscle.length, fat.length)}번 측정했어요.
          </div>
        )}
      </section>

      {link && (
        <section aria-label="운동과 함께 보기">
          <h2 className="section-label">
            운동과 함께 보기 · {monthDay(link.from)}~{monthDay(link.to)}
          </h2>
          <div className="group-card">
            <div className="row justify-between">
              <span className="text-[15px]">주당 운동</span>
              <span className="text-[14px] text-sub">
                <b className="num text-[19px] text-ink">{link.daysPerWeek}</b>일{link.prevDaysPerWeek != null && ` (그전 ${link.prevDaysPerWeek}일)`}
              </span>
            </div>
            {link.volumeChange != null && (
              <div className="row justify-between">
                <span className="text-[15px]">볼륨 변화</span>
                <span className={`text-[14px] font-semibold ${link.volumeChange >= 0 ? 'text-up' : 'text-down'}`}>
                  <b className="num text-[19px]">{signed(link.volumeChange)}</b>% · 그전 같은 기간 대비
                </span>
              </div>
            )}
            <div className="row gap-2 py-3 flex-wrap">
              <span className="text-[15px] w-full">부위 비중 · 세트 수</span>
              <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-fill" aria-hidden>
                {link.share.map((s, i) => (
                  <div key={s.routine} style={{ width: `${s.pct}%` }} className={['bg-accent', 'bg-ink', 'bg-amber', 'bg-cyan'][i]} />
                ))}
              </div>
              <div className="flex w-full justify-between text-[12px] text-sub">
                {link.share.map((s, i) => (
                  <span key={s.routine} className="flex items-center gap-1">
                    <i aria-hidden className={`w-2 h-2 rounded-full ${['bg-accent', 'bg-ink', 'bg-amber', 'bg-cyan'][i]}`} />
                    {s.routine} {s.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
          {link.tip && <p className="px-4 pt-2 text-[13px] text-sub leading-relaxed">{link.tip}</p>}
        </section>
      )}

      <GoalSheet open={sheet} latest={latest} goal={goal} onClose={() => setSheet(false)} onSave={saveGoal} />
    </div>
  );
}
