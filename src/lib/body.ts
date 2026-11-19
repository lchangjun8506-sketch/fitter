/**
 * 인바디 분석 (무료 · 휴대폰 안에서 계산)
 * - 한 줄 결론: 첫 측정 → 최근 측정의 골격근량·체지방률 변화
 * - 목표 2개: 체지방률 줄이기, 골격근량 늘리기 (진행률 + 이 속도면 언제 도달)
 * - 운동과 함께 보기: 측정 사이 기간의 운동 빈도·볼륨·부위 비중
 */
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { ROUTINES } from '../data/exercises';
import { setVolume } from './analysis';
import { todayStr } from './date';
import type { InBodyRecord } from './inbody';
import { supabase } from './supabase';
import type { Routine, WorkoutLog } from './types';

/* ── 날짜 ── */
const DAY = 86400000;
const toMs = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd);
};
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);
export const addDays = (d: string, n: number) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);
export const monthDay = (d: string) => {
  const [, m, dd] = d.split('-').map(Number);
  return `${m}월 ${dd}일`;
};
/** "2월 중순"처럼 대략적으로 */
export const roughDate = (d: string) => {
  const [, m, dd] = d.split('-').map(Number);
  return `${m}월 ${dd <= 10 ? '초' : dd <= 20 ? '중순' : '말'}`;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(r1(n))}`;

/* ── 목표 ── */
export interface BodyGoal {
  fatStart: number; // 체지방률 %
  fatTarget: number;
  muscleStart: number; // 골격근량 kg
  muscleTarget: number;
  startDate: string;
  targetDate: string;
}

const LOCAL = 'fitter.bodyGoal';
const META = 'fitter_goal';

const readLocal = (): BodyGoal | null => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) ?? 'null');
  } catch {
    return null;
  }
};

/** 목표는 계정 정보(user_metadata)에 저장 → 기기를 바꿔도 유지, 별도 표 필요 없음 */
export function useBodyGoal(session: Session | null) {
  const fromSession = (session?.user.user_metadata?.[META] as BodyGoal | undefined) ?? null;
  const [goal, setGoal] = useState<BodyGoal | null>(() => fromSession ?? readLocal());
  useEffect(() => {
    if (fromSession) setGoal(fromSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, JSON.stringify(fromSession)]);

  const save = useCallback(
    async (g: BodyGoal | null) => {
      if (session && supabase) {
        const { error } = await supabase.auth.updateUser({ data: { [META]: g } });
        if (error) throw error;
      }
      try {
        if (g) localStorage.setItem(LOCAL, JSON.stringify(g));
        else localStorage.removeItem(LOCAL);
      } catch {
        /* noop */
      }
      setGoal(g);
    },
    [session],
  );
  return { goal, save };
}

/** 추천 목표: 체지방률 −3%p · 골격근량 +1.5kg · 12주 */
export function defaultGoal(latest: InBodyRecord, weeks = 12): BodyGoal {
  const fat = latest.body_fat_pct ?? 20;
  const muscle = latest.skeletal_muscle ?? 30;
  return {
    fatStart: fat,
    fatTarget: r1(Math.max(5, fat - 3)),
    muscleStart: muscle,
    muscleTarget: r1(muscle + 1.5),
    startDate: latest.measured_at,
    targetDate: addDays(latest.measured_at, weeks * 7),
  };
}

/** 목표 속도가 무리한지: 체지방률 월 1.5%p, 골격근량 월 1kg 이하 권장 */
export function paceCheck(g: BodyGoal) {
  const months = Math.max(0.25, daysBetween(g.startDate, g.targetDate) / 30.4);
  const fat = (g.fatStart - g.fatTarget) / months;
  const muscle = (g.muscleTarget - g.muscleStart) / months;
  const issues: string[] = [];
  if (fat > 1.5) issues.push('체지방률을 너무 빨리 줄이려고 해요');
  if (muscle > 1) issues.push('근육을 너무 빨리 늘리려고 해요');
  if (fat < 0) issues.push('체지방률 목표가 지금보다 높아요');
  if (muscle < 0) issues.push('골격근량 목표가 지금보다 낮아요');
  return { fat: r1(fat), muscle: r1(muscle), ok: issues.length === 0, issues };
}

/* ── 기울기(하루당 변화) ── */
type Pt = { date: string; v: number };
function slopePerDay(pts: Pt[]): number | null {
  if (pts.length < 2) return null;
  const x0 = toMs(pts[0].date);
  const xs = pts.map((p) => (toMs(p.date) - x0) / DAY), ys = pts.map((p) => p.v);
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (den === 0) return null;
  return xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den;
}

export const series = (records: InBodyRecord[], key: 'skeletal_muscle' | 'body_fat_pct'): Pt[] =>
  [...records]
    .filter((r) => r[key] != null)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
    .map((r) => ({ date: r.measured_at, v: r[key] as number }));

export interface GoalStatus {
  label: string;
  unit: string;
  start: number;
  target: number;
  current: number;
  pct: number; // 0~1
  left: number;
  done: boolean;
  eta: string | null; // 예상 도달일
  pace: 'ahead' | 'behind' | 'wrong' | 'unknown' | 'done';
  message: string;
}

function goalStatus(kind: 'fat' | 'muscle', g: BodyGoal, records: InBodyRecord[]): GoalStatus | null {
  const key = kind === 'fat' ? 'body_fat_pct' : 'skeletal_muscle';
  const pts = series(records, key);
  if (!pts.length) return null;
  const start = kind === 'fat' ? g.fatStart : g.muscleStart;
  const target = kind === 'fat' ? g.fatTarget : g.muscleTarget;
  const current = pts[pts.length - 1].v;
  const dir = kind === 'fat' ? -1 : 1;
  const span = target - start;
  const pct = span === 0 ? 1 : Math.max(0, Math.min(1, (current - start) / span));
  const left = r1(Math.abs(target - current));
  const done = dir * (current - target) >= 0;
  const base = { label: kind === 'fat' ? '체지방률 줄이기' : '근육 늘리기', unit: kind === 'fat' ? '%' : 'kg', start, target, current, pct, left: done ? 0 : left, done };

  if (done) return { ...base, eta: null, pace: 'done', message: '목표에 도달했어요. 새 목표를 정해 보세요.' };

  // 목표 시작 이후 측정으로 속도 계산 (부족하면 최근 측정 전부)
  const since = pts.filter((p) => p.date >= g.startDate);
  const k = slopePerDay(since.length >= 2 ? since : pts.slice(-4));
  if (k == null) return { ...base, eta: null, pace: 'unknown', message: '한 번 더 측정하면 도달 예상일을 알려 드려요.' };
  if (dir * k <= 0) return { ...base, eta: null, pace: 'wrong', message: kind === 'fat' ? '요즘은 체지방률이 오르는 쪽이에요.' : '요즘은 골격근량이 줄어드는 쪽이에요.' };
  const last = pts[pts.length - 1].date;
  const eta = addDays(last, Math.ceil(Math.abs(target - current) / Math.abs(k)));
  const ahead = eta <= g.targetDate;
  return {
    ...base,
    eta,
    pace: ahead ? 'ahead' : 'behind',
    message: `이 속도면 ${roughDate(eta)} 도달 · ${ahead ? '예정보다 빨라요' : '조금 느려요'}`,
  };
}

export const goalStatuses = (g: BodyGoal, records: InBodyRecord[]) => ({
  fat: goalStatus('fat', g, records),
  muscle: goalStatus('muscle', g, records),
});

/* ── 한 줄 결론 ── */
export interface Verdict {
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  tag: string;
  title: string;
  detail: string;
}

export function verdict(records: InBodyRecord[]): Verdict | null {
  const sorted = [...records].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const first = sorted[0], last = sorted[sorted.length - 1];
  if (!first) return null;
  if (sorted.length === 1)
    return { tone: 'neutral', tag: '첫 측정', title: '기준점이 생겼어요', detail: '2~4주 뒤 같은 시간대(아침 공복 추천)에 다시 재면 변화를 알려 드려요.' };
  if (first.skeletal_muscle == null || last.skeletal_muscle == null || first.body_fat_pct == null || last.body_fat_pct == null)
    return { tone: 'neutral', tag: '정보 부족', title: '골격근량·체지방률이 비어 있어요', detail: '측정 기록에서 두 값을 채우면 분석해 드려요.' };

  const dm = last.skeletal_muscle - first.skeletal_muscle;
  const df = last.body_fat_pct - first.body_fat_pct;
  const m = dm >= 0.3 ? 1 : dm <= -0.3 ? -1 : 0;
  const f = df <= -0.5 ? -1 : df >= 0.5 ? 1 : 0;
  const weight = first.weight != null && last.weight != null ? last.weight - first.weight : null;
  const nums = `${monthDay(first.measured_at)}보다 골격근량 ${signed(dm)}kg, 체지방률 ${signed(df)}%p.`;
  const weightNote = weight != null && Math.abs(weight) < 1 && m === 1 && f === -1 ? ' 체중은 거의 그대로인데 몸의 구성이 바뀌고 있어요.' : '';

  const table: Record<string, Omit<Verdict, 'detail'> & { tip: string }> = {
    '1,-1': { tone: 'good', tag: '좋은 변화', title: '근육은 늘고 체지방은 줄었어요', tip: weightNote || ' 지금 방식을 유지하세요.' },
    '1,0': { tone: 'good', tag: '좋은 변화', title: '근육이 늘고 있어요', tip: ' 체지방률까지 낮추려면 유산소나 식단을 조금 더해 보세요.' },
    '0,-1': { tone: 'good', tag: '좋은 변화', title: '체지방률이 줄고 있어요', tip: ' 근육도 늘리려면 단백질과 점진적 과부하를 챙기세요.' },
    '1,1': { tone: 'warn', tag: '살펴보기', title: '근육과 함께 체지방도 늘고 있어요', tip: ' 먹는 양을 조금만 줄이면 근육만 남기기 쉬워요.' },
    '-1,-1': { tone: 'warn', tag: '근손실 주의', title: '체지방은 줄었지만 근육도 줄었어요', tip: ' 감량 속도를 늦추고 단백질·근력 운동을 유지하세요.' },
    '-1,0': { tone: 'warn', tag: '살펴보기', title: '근육이 조금 줄었어요', tip: ' 운동 빈도와 단백질 섭취를 확인해 보세요.' },
    '0,1': { tone: 'warn', tag: '살펴보기', title: '체지방률이 조금 늘었어요', tip: ' 식단과 활동량을 확인해 보세요.' },
    '-1,1': { tone: 'bad', tag: '주의', title: '근육은 줄고 체지방은 늘었어요', tip: ' 운동을 꾸준히 이어 가는 것부터 시작해요.' },
    '0,0': { tone: 'neutral', tag: '유지', title: '큰 변화 없이 유지 중이에요', tip: ' 바꾸고 싶다면 목표를 정하고 볼륨을 조금씩 늘려 보세요.' },
  };
  const v = table[`${m},${f}`];
  return { tone: v.tone, tag: v.tag, title: v.title, detail: nums + v.tip };
}

/* ── 운동과 함께 보기 ── */
export interface TrainingLink {
  from: string;
  to: string;
  daysPerWeek: number;
  prevDaysPerWeek: number | null;
  volumeChange: number | null; // %
  share: { routine: Routine; pct: number }[];
  tip: string | null;
}

export function trainingLink(records: InBodyRecord[], logs: WorkoutLog[], statuses?: ReturnType<typeof goalStatuses>): TrainingLink | null {
  const sorted = [...records].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const last = sorted[sorted.length - 1];
  if (!last) return null;
  // 기간: 직전 측정 ~ 최근 측정 (측정이 1번이면 최근 4주)
  const prev = sorted[sorted.length - 2];
  const to = last.measured_at > todayStr() ? todayStr() : last.measured_at;
  let from = prev ? prev.measured_at : addDays(to, -28);
  if (daysBetween(from, to) < 7) from = addDays(to, -28);
  const len = Math.max(7, daysBetween(from, to));
  const inRange = (a: string, b: string) => logs.filter((l) => l.date > a && l.date <= b);
  const cur = inRange(from, to);
  const before = inRange(addDays(from, -len), from);
  const weeks = len / 7;
  const days = new Set(cur.map((l) => l.date)).size;
  const prevDays = new Set(before.map((l) => l.date)).size;
  const vol = cur.reduce((a, l) => a + setVolume(l.sets), 0);
  const prevVol = before.reduce((a, l) => a + setVolume(l.sets), 0);
  const sets = (r: Routine) => cur.filter((l) => l.routine === r).reduce((a, l) => a + l.sets.length, 0);
  const total = ROUTINES.reduce((a, r) => a + sets(r), 0);
  const share = ROUTINES.map((routine) => ({ routine, pct: total ? Math.round((sets(routine) / total) * 100) : 0 }));
  const dpw = r1(days / weeks);

  let tip: string | null = null;
  const legs = share.find((s) => s.routine === '하체')!.pct;
  const muscleSlow = statuses?.muscle && (statuses.muscle.pace === 'behind' || statuses.muscle.pace === 'wrong');
  const fatSlow = statuses?.fat && (statuses.fat.pace === 'behind' || statuses.fat.pace === 'wrong');
  if (!cur.length) tip = '이 기간에 운동 기록이 없어요. 기록을 남기면 몸 변화와 함께 볼 수 있어요.';
  else if (dpw < 3) tip = `주 ${dpw}일이에요. 주 3일 이상이면 근육·체지방 모두 변화가 빨라져요.`;
  else if (muscleSlow && legs < 20) tip = '근육 목표가 느려요. 큰 근육인 하체 운동을 주 1회 더 하면 도움이 돼요.';
  else if (muscleSlow) tip = '근육 목표가 느려요. 주요 종목의 무게나 횟수를 조금씩 늘려 보세요.';
  else if (fatSlow) tip = '체지방 목표가 느려요. 체지방은 식단 영향이 커요. 운동 후 유산소 20분도 도움이 돼요.';

  return {
    from,
    to,
    daysPerWeek: dpw,
    prevDaysPerWeek: before.length ? r1(prevDays / weeks) : null,
    volumeChange: prevVol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : null,
    share,
    tip,
  };
}
