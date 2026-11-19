/**
 * 오늘의 추천 루틴 (무료 · 휴대폰 안에서 계산)
 * 1) 분할: 가장 오래 쉰 부위
 * 2) 종목: 그 부위에서 최근 자주 한 종목 (부족하면 기본 종목으로 채움)
 * 3) 목표: 지난 기록 + 점진적 과부하 규칙
 */
import { ROUTINES, ROUTINE_EXERCISES } from '../data/exercises';
import { progressStatus, topReps, topWeight } from './analysis';
import { todayStr } from './date';
import type { Routine, WorkoutLog, WorkoutSet } from './types';

export interface RecItem {
  exercise: string;
  sets: WorkoutSet[];
  note: string;
  fresh: boolean; // 처음 하는 종목
}
export interface Recommendation {
  routine: Routine;
  reason: string;
  items: RecItem[];
}

const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

/** 무게 단위: 가벼운(덤벨·고립) 종목은 1kg, 그 외 2.5kg */
const step = (w: number) => (w < 20 ? 1 : 2.5);

function target(history: WorkoutLog[]): { sets: WorkoutSet[]; note: string } {
  const last = history[0];
  const w = topWeight(last.sets);
  const r = topReps(last.sets);
  const n = Math.max(3, Math.min(5, last.sets.length));
  const status = progressStatus(history);

  if (r >= 12) {
    const nw = w + step(w);
    return { sets: Array.from({ length: n }, () => ({ weight: nw, reps: 8 })), note: `지난번 ${w}kg × ${r}회 → ${nw}kg로 올려 8회 목표` };
  }
  if (status === 'stall') {
    return {
      sets: Array.from({ length: n }, (_, i) => ({ weight: w, reps: Math.min(r + 2, 15), ...(i === n - 1 ? { drops: [{ weight: Math.round(w * 0.7 * 2) / 2, reps: 8 }] } : {}) })),
      note: `${w}kg에서 3회 정체 → 횟수 +2, 마지막 세트 드롭`,
    };
  }
  return { sets: Array.from({ length: n }, () => ({ weight: w, reps: r + 1 })), note: `지난번 ${w}kg × ${r}회 → 같은 무게 ${r + 1}회 목표` };
}

export function recommendToday(logs: WorkoutLog[], customByRoutine: Partial<Record<Routine, string[]>> = {}): Recommendation {
  const today = todayStr();

  // 1) 분할 고르기: 마지막으로 한 날이 가장 오래된 부위 (한 번도 안 했으면 최우선)
  const lastDay = (r: Routine) => logs.find((l) => l.routine === r)?.date ?? null;
  const ranked = [...ROUTINES].sort((a, b) => {
    const da = lastDay(a), db = lastDay(b);
    if (da === db) return 0;
    if (!da) return -1;
    if (!db) return 1;
    return da.localeCompare(db);
  });
  // 오늘 이미 한 부위는 뒤로
  const routine = ranked.find((r) => lastDay(r) !== today) ?? ranked[0];
  const ld = lastDay(routine);
  const reason = !logs.length
    ? '첫 운동이에요. 가볍게 무게를 찾아보세요.'
    : !ld
      ? `${routine}은(는) 아직 기록이 없어요.`
      : `${routine}을(를) ${daysBetween(ld, today)}일째 쉬었어요. 가장 오래 쉰 부위예요.`;

  // 2) 종목: 최근 60일 그 부위에서 한 횟수 순
  const since = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return todayStr(d);
  })();
  const freq = new Map<string, number>();
  logs.filter((l) => l.routine === routine && l.date >= since).forEach((l) => freq.set(l.exercise, (freq.get(l.exercise) ?? 0) + 1));
  const picked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 5);
  for (const e of [...(customByRoutine[routine] ?? []), ...ROUTINE_EXERCISES[routine]]) {
    if (picked.length >= 4) break;
    if (!picked.includes(e)) picked.push(e);
  }

  // 3) 목표
  const items: RecItem[] = picked.map((exercise) => {
    const history = logs.filter((l) => l.exercise === exercise);
    if (!history.length) {
      return { exercise, sets: [{ weight: 0, reps: 12 }, { weight: 0, reps: 10 }, { weight: 0, reps: 10 }], note: '처음 하는 종목: 10~12회가 버거운 무게를 찾아보세요', fresh: true };
    }
    return { exercise, ...target(history), fresh: false };
  });

  return { routine, reason, items };
}
