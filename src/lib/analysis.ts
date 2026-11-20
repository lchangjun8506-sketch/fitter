import type { WorkoutLog, WorkoutSet } from './types';
import { todayStr } from './date';

/** 추천 횟수 단계: 8 → 10 → 12 → 15 (15를 채우면 무게를 올리고 8부터) */
export const REP_STEPS = [8, 10, 12, 15] as const;
/** r보다 큰 다음 단계 (15 이상이면 null = 증량할 차례) */
export const nextRepStep = (r: number): number | null => REP_STEPS.find((s) => s > r) ?? null;
/** 가장 가까운 단계로 맞춤 */
export const snapReps = (r: number) => REP_STEPS.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));

export function setVolume(sets: WorkoutSet[]): number {
  return sets.reduce(
    (sum, s) => sum + s.weight * s.reps + (s.drops ?? []).reduce((a, d) => a + d.weight * d.reps, 0),
    0,
  );
}

/** Epley 공식, 가장 무거운 세트 기준 */
export function estimate1RM(sets: WorkoutSet[]): number {
  let best = { w: 0, r: 0 };
  for (const s of sets) if (s.weight > best.w) best = { w: s.weight, r: s.reps };
  return best.w > 0 ? Math.round(best.w * (1 + best.r / 30)) : 0;
}

export const topWeight = (sets: WorkoutSet[]) => Math.max(0, ...sets.map((s) => s.weight || 0));
export const topReps = (sets: WorkoutSet[]) => Math.max(0, ...sets.map((s) => s.reps || 0));

/** 최신순 정렬 (날짜 → 작성시각) */
export function sortLogs(logs: WorkoutLog[]): WorkoutLog[] {
  return [...logs].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
  );
}

export type Status = 'progress' | 'stall' | 'hold' | 'new';

export function progressStatus(history: WorkoutLog[]): Status {
  const [latest, prev] = history;
  if (!latest || !prev) return 'new';
  const lw = topWeight(latest.sets), pw = topWeight(prev.sets);
  const lr = topReps(latest.sets), pr = topReps(prev.sets);
  if (lw > pw || (lw === pw && lr > pr)) return 'progress';
  if (history.length >= 3 && history.slice(0, 3).every((h) => topWeight(h.sets) === lw)) return 'stall';
  return 'hold';
}

export interface Tip {
  tone: 'up' | 'warn' | 'keep';
  title: string;
  desc: string;
}

export function coachingTip(history: WorkoutLog[]): Tip | null {
  const last = history[0];
  if (!last) return null;
  const w = topWeight(last.sets);
  const r = topReps(last.sets);
  const next = nextRepStep(r);
  if (next == null)
    return { tone: 'up', title: '증량할 차례입니다', desc: `지난 기록 ${w}kg × ${r}회. 무게를 올려 8회부터 시작해 보세요.` };
  if (progressStatus(history) === 'stall')
    return { tone: 'warn', title: '3회 연속 같은 무게', desc: `${next}회를 목표로 하고 마지막 세트에 드롭세트를 더해 보세요.` };
  return { tone: 'keep', title: `같은 무게로 ${next}회`, desc: `지난 기록 ${w}kg × ${r}회. 8·10·12·15회 순서로 올려요.` };
}

export const dayStr = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return todayStr(d);
};

/** 연속 운동 일수 (오늘 또는 어제까지 이어진 경우) */
export function streakOf(logs: WorkoutLog[]) {
  const days = new Set(logs.map((l) => l.date));
  const start = days.has(dayStr(0)) ? 0 : days.has(dayStr(-1)) ? -1 : null;
  if (start === null) return 0;
  let n = 0;
  while (days.has(dayStr(start - n))) n++;
  return n;
}

/** 무게 조절 단위: 20kg 미만(덤벨·고립)은 1kg, 그 이상은 2.5kg */
export const weightStep = (w: number, dir: 1 | -1) => (dir > 0 ? (w < 20 ? 1 : 2.5) : w <= 20 ? 1 : 2.5);

/** 세트 요약: "40kg × 9 · 3세트" 또는 "40×9 / 35×10" */
export const setsLabel = (sets: WorkoutSet[]) => {
  if (!sets.length) return '';
  const top = sets[0];
  const same = sets.every((s) => s.weight === top.weight && s.reps === top.reps);
  if (top.weight === 0) return `무게 찾기 · ${sets.length}세트`;
  return same ? `${top.weight}kg × ${top.reps} · ${sets.length}세트` : sets.map((s) => `${s.weight}×${s.reps}`).join(' / ');
};
