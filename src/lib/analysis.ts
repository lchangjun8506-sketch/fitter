import type { WorkoutLog, WorkoutSet } from './types';

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
  if (r >= 12)
    return { tone: 'up', title: '증량할 차례입니다', desc: `지난 기록 ${w}kg × ${r}회. 이번에는 ${w + 2.5}kg로 시작해 보세요.` };
  if (progressStatus(history) === 'stall')
    return { tone: 'warn', title: '3회 연속 같은 무게', desc: '횟수를 2회 늘리거나 마지막 세트에 드롭세트를 더해 보세요.' };
  return { tone: 'keep', title: '같은 무게, 1~2회 더', desc: `지난 기록 ${w}kg × ${r}회.` };
}
