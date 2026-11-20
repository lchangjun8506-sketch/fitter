import { useMemo, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { goalStatuses, series, signed, verdict, type BodyGoal } from '../lib/body';
import type { InBodyRecord } from '../lib/inbody';
import { muscleLoad, recentPRs, weekCompare, weeklyVolume } from '../lib/stats';
import type { WorkoutLog } from '../lib/types';
import { AnatomyPair } from './Anatomy';
import BodyInsights, { GoalBar } from './BodyInsights';
import Dashboard from './Dashboard';
import InBodySection from './InBodySection';
import LoginPanel from './LoginPanel';
import NicknameForm from './NicknameForm';

export type StatsSub = 'home' | 'workout' | 'volume' | 'inbody';
export const STATS_TITLES: Record<StatsSub, string> = { home: '분석', workout: '종목별 성장', volume: '운동량', inbody: '인바디' };

interface Props {
  sub: StatsSub;
  onSub: (s: StatsSub) => void;
  logs: WorkoutLog[];
  inbody: InBodyRecord[];
  reloadInBody: () => void;
  toast: (m: string) => void;
  goal: BodyGoal | null;
  saveGoal: (g: BodyGoal | null) => Promise<void>;
}

const tons = (kg: number) => (kg >= 1000 ? { v: (kg / 1000).toFixed(1), u: 't' } : { v: String(Math.round(kg)), u: 'kg' });

/** 같은 모양의 요약 카드: 제목 + 화살표, 누르면 자세히 */
function Tile({ title, onClick, children, className = '' }: { title: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button onClick={onClick} className={`tap group-card text-left px-3.5 pt-3 pb-3.5 flex flex-col min-h-[156px] ${className}`}>
      <span className="flex items-center justify-between w-full text-[13px] font-bold text-sub">
        {title}
        <ChevronRight aria-hidden className="w-4 h-4 text-sub/60" />
      </span>
      <span className="flex-1 flex flex-col justify-end mt-2 w-full">{children}</span>
    </button>
  );
}

function Bars({ values, highlightLast = true, height = 40 }: { values: number[]; highlightLast?: boolean; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <span className="flex items-end gap-1 w-full" style={{ height }} aria-hidden>
      {values.map((v, i) => (
        <i key={i} className={`flex-1 rounded-[3px] ${highlightLast && i === values.length - 1 ? 'bg-accent' : 'bg-fill'}`} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
      ))}
    </span>
  );
}

function Home({ logs, inbody, goal, onSub }: Pick<Props, 'logs' | 'inbody' | 'goal' | 'onSub'>) {
  const load = useMemo(() => muscleLoad(logs, 14), [logs]);
  const weeks = useMemo(() => weeklyVolume(logs, 8), [logs]);
  const cmp = useMemo(() => weekCompare(logs), [logs]);
  const prs = useMemo(() => recentPRs(logs), [logs]);
  const v = useMemo(() => verdict(inbody), [inbody]);
  const st = useMemo(() => (goal && inbody.length ? goalStatuses(goal, inbody) : null), [goal, inbody]);
  const muscle = series(inbody, 'skeletal_muscle');
  const sorted = [...inbody].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const tv = tons(cmp.tv);

  return (
    <div className="space-y-3">
      <button onClick={() => onSub('workout')} className="tap w-full group-card text-left px-4 pt-3.5 pb-3">
        <span className="flex items-center justify-between text-[15px] font-bold">
          최근 2주 부위별 자극
          <span className="flex items-center text-[13px] font-semibold text-sub">자세히<ChevronRight aria-hidden className="w-4 h-4 text-sub/60" /></span>
        </span>
        <span className="flex items-center gap-3 mt-2">
          <AnatomyPair heat={load.heat} height={170} label="최근 2주 부위별 운동량 그림" />
          {load.total ? (
            <span className="flex-1 min-w-0 text-[13px] leading-snug">
              <span className="block text-sub">많이 한 부위</span>
              <b className="block text-[17px]">{load.most?.name}</b>
              <span className="block text-sub mt-2.5">부족한 부위</span>
              <b className="block text-[17px] text-down">{load.least.name}</b>
              <span className="block h-2 rounded-full mt-4 bg-gradient-to-r from-[#FF9A3C]/20 to-[#F05A00]" aria-hidden />
              <span className="flex justify-between text-[11px] text-sub mt-1"><span>적음</span><span>많음</span></span>
            </span>
          ) : (
            <span className="flex-1 text-[14px] text-sub leading-relaxed">최근 2주 기록이 없어요. 운동을 기록하면 많이 쓴 근육이 진하게 칠해져요.</span>
          )}
        </span>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <Tile title="주간 운동량" onClick={() => onSub('volume')}>
          <span className="num text-[30px] leading-none">{tv.v}<span className="font-sans text-[13px] text-sub ml-0.5">{tv.u}</span></span>
          {cmp.delta != null ? (
            <span className={`text-[12px] font-bold mt-1 ${cmp.delta >= 0 ? 'text-up' : 'text-down'}`}>{cmp.delta >= 0 ? '▲' : '▼'} {Math.abs(cmp.delta)}% 지난주 같은 요일보다</span>
          ) : (
            <span className="text-[12px] text-sub mt-1">이번 주</span>
          )}
          <span className="mt-2.5"><Bars values={weeks.map((w) => w.vol)} /></span>
        </Tile>

        <Tile title="신기록" onClick={() => onSub('workout')}>
          <span className="num text-[30px] leading-none">{prs.length}<span className="font-sans text-[13px] text-sub ml-0.5">종목</span></span>
          <span className="text-[12px] text-sub mt-1">최근 30일 · 추정 1RM</span>
          <span className="mt-2 text-[13px] leading-relaxed">
            {prs.slice(0, 2).map((p) => (
              <span key={p.ex} className="flex justify-between gap-2">
                <b className="truncate font-semibold">{p.ex}</b>
                <span className="num text-[15px] text-accentfg shrink-0">{p.to}</span>
              </span>
            ))}
            {!prs.length && <span className="text-sub">꾸준히 기록하면 여기에 떠요</span>}
          </span>
        </Tile>

        <Tile title="인바디" onClick={() => onSub('inbody')}>
          {v && last ? (
            <>
              <span className={`self-start text-[11px] font-extrabold px-1.5 py-0.5 rounded-[5px] ${v.tone === 'good' ? 'bg-up/10 text-up' : v.tone === 'neutral' ? 'bg-fill text-sub' : 'bg-down/10 text-down'}`}>{v.tag}</span>
              {first !== last && first.skeletal_muscle != null && last.skeletal_muscle != null && first.body_fat_pct != null && last.body_fat_pct != null ? (
                <span className="text-[13px] leading-relaxed mt-1.5">
                  골격근 <b>{signed(last.skeletal_muscle - first.skeletal_muscle)}</b>kg
                  <br />
                  체지방률 <b>{signed(last.body_fat_pct - first.body_fat_pct)}</b>%p
                </span>
              ) : (
                <span className="text-[13px] mt-1.5">측정 {inbody.length}회</span>
              )}
              {muscle.length > 1 && (
                <svg viewBox="0 0 100 24" className="w-full h-6 mt-1.5" aria-hidden>
                  <polyline
                    fill="none"
                    stroke="rgb(var(--cyan))"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    points={(() => {
                      const vs = muscle.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs) || 1;
                      return muscle.map((p, i) => `${2 + (i / (muscle.length - 1)) * 96},${21 - ((p.v - lo) / (hi - lo || 1)) * 18}`).join(' ');
                    })()}
                  />
                </svg>
              )}
            </>
          ) : (
            <span className="text-[14px] text-sub leading-snug">결과지를 올리면 몸 변화를 분석해 드려요</span>
          )}
        </Tile>

        <Tile title="신체 목표" onClick={() => onSub('inbody')}>
          {st && (st.fat || st.muscle) ? (
            <span className="space-y-0.5">
              {st.fat && <GoalBar s={st.fat} color="bg-accent" compact mini />}
              {st.muscle && <GoalBar s={st.muscle} color="bg-cyan" compact mini />}
            </span>
          ) : (
            <span className="text-[14px] text-sub leading-snug">체지방률 줄이기 · 근육 늘리기 목표를 정해 보세요</span>
          )}
        </Tile>
      </div>
    </div>
  );
}

function Volume({ logs }: { logs: WorkoutLog[] }) {
  const weeks = useMemo(() => weeklyVolume(logs, 12), [logs]);
  const load = useMemo(() => muscleLoad(logs, 14), [logs]);
  const cur = weeks[weeks.length - 1];
  const cmp = useMemo(() => weekCompare(logs), [logs]);
  const max = Math.max(1, ...weeks.map((w) => w.vol));
  const gmax = Math.max(1, ...load.groups.map((g) => g.sets));
  const t = tons(cur.vol);
  return (
    <div className="space-y-6">
      <section className="group-card grid grid-cols-3" aria-label="이번 주">
        {[
          { k: '이번 주 볼륨', v: t.v, u: t.u },
          { k: '운동한 날', v: String(cur.days), u: '/7' },
          { k: '세트', v: String(cur.sets), u: '' },
        ].map((s, i) => (
          <div key={s.k} className={`px-4 py-3.5 ${i ? 'shadow-[inset_1px_0_0_var(--sep)]' : ''}`}>
            <div className="caption">{s.k}</div>
            <div className="num text-[26px] leading-none mt-1.5">{s.v}<span className="font-sans text-[13px] text-sub ml-0.5">{s.u}</span></div>
          </div>
        ))}
      </section>
      {cmp.delta != null && (
        <p className={`-mt-3 px-4 text-[13px] font-semibold ${cmp.delta >= 0 ? 'text-up' : 'text-down'}`}>
          지난주 같은 요일까지보다 {cmp.delta >= 0 ? '+' : ''}{cmp.delta}%
        </p>
      )}

      <section>
        <h2 className="section-label">주별 볼륨 · 최근 12주</h2>
        <div className="group-card px-4 pt-4 pb-3">
          <div className="flex items-end gap-1.5 h-40" role="img" aria-label={`주별 볼륨: ${weeks.map((w) => `${w.start.slice(5)} ${Math.round(w.vol)}kg`).join(', ')}`}>
            {weeks.map((w, i) => (
              <div key={w.start} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                {i === weeks.length - 1 && <span className="num text-[11px] text-accentfg">{tons(w.vol).v}</span>}
                <i className={`w-full rounded-[4px] ${i === weeks.length - 1 ? 'bg-accent' : 'bg-ink/80'}`} style={{ height: `${Math.max(2, (w.vol / max) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-sub">
            <span>{weeks[0].start.slice(5).replace('-', '.')}</span>
            <span>이번 주</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-label">부위 밸런스 · 최근 2주 세트</h2>
        <div className="group-card px-4 py-3.5 space-y-2.5">
          {load.groups.map((g) => (
            <div key={g.name} className="flex items-center gap-3">
              <span className="w-10 text-[14px] shrink-0">{g.name}</span>
              <div className="flex-1 h-2.5 rounded-full bg-fill overflow-hidden">
                <div className={`h-full rounded-full ${g.name === load.least.name ? 'bg-amber' : 'bg-accent'}`} style={{ width: `${(g.sets / gmax) * 100}%` }} />
              </div>
              <span className="num w-8 text-right text-[17px]">{g.sets}</span>
            </div>
          ))}
          {load.total > 0 && (
            <p className="text-[13px] text-sub pt-1">
              <b className="text-ink">{load.least.name}</b>
              {load.least.sets === 0 ? '을(를) 2주 동안 안 했어요.' : '이(가) 가장 적어요.'} 기록 탭의 추천 루틴을 확인해 보세요.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Workout({ logs }: { logs: WorkoutLog[] }) {
  const prs = useMemo(() => recentPRs(logs), [logs]);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="section-label">최근 30일 신기록 · 추정 1RM</h2>
        <div className="group-card">
          {prs.length === 0 ? (
            <p className="px-4 py-3.5 text-[15px] text-sub">아직 없어요. 같은 종목을 꾸준히 기록하면 여기에 나타나요.</p>
          ) : (
            prs.map((p) => (
              <div key={p.ex} className="row justify-between gap-3">
                <span className="text-[16px] font-semibold truncate">{p.ex}</span>
                <span className="shrink-0 text-[14px] text-sub">
                  {p.from} → <b className="num text-[20px] text-accentfg">{p.to}</b>kg
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      <Dashboard logs={logs} />
    </div>
  );
}

export default function StatsTab({ sub, onSub, logs, inbody, reloadInBody, toast, goal, saveGoal }: Props) {
  const { ready, session, handle } = useAuth();
  if (sub === 'volume') return <Volume logs={logs} />;
  if (sub === 'workout') return <Workout logs={logs} />;
  if (sub === 'inbody')
    return !ready ? null : !session ? (
      <LoginPanel reason="인바디 결과지를 올리면 휴대폰에서 바로 수치를 읽어 기록해요(무료). 기록은 계정에 저장되니 로그인해 주세요." />
    ) : !handle ? (
      <NicknameForm />
    ) : (
      <div className="space-y-6">
        <BodyInsights records={inbody} logs={logs} goal={goal} saveGoal={saveGoal} />
        <InBodySection toast={toast} records={inbody} reload={reloadInBody} />
      </div>
    );
  return <Home logs={logs} inbody={inbody} goal={goal} onSub={onSub} />;
}
