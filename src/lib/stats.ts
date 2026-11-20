/** 분석 탭 요약 계산 (휴대폰 안에서) */
import { exerciseInfo, type Muscle } from '../data/muscles';
import { dayStr, estimate1RM, setVolume } from './analysis';
import type { WorkoutLog } from './types';

const vol = (ls: WorkoutLog[]) => ls.reduce((a, l) => a + setVolume(l.sets), 0);

/** 월요일 시작 주 단위 볼륨 (오래된 → 최근), 이번 주는 오늘까지 */
export function weeklyVolume(logs: WorkoutLog[], weeks = 8) {
  const dow = (new Date().getDay() + 6) % 7;
  return Array.from({ length: weeks }, (_, i) => {
    const k = weeks - 1 - i;
    const start = dayStr(-dow - 7 * k), end = dayStr(-dow - 7 * k + 6);
    const ls = logs.filter((l) => l.date >= start && l.date <= end);
    return { start, end, vol: vol(ls), days: new Set(ls.map((l) => l.date)).size, sets: ls.reduce((a, l) => a + l.sets.length, 0) };
  });
}

/** 이번 주(월~오늘) vs 지난주 같은 요일까지 */
export function weekCompare(logs: WorkoutLog[]) {
  const dow = (new Date().getDay() + 6) % 7;
  const tv = vol(logs.filter((l) => l.date >= dayStr(-dow)));
  const lv = vol(logs.filter((l) => l.date >= dayStr(-dow - 7) && l.date <= dayStr(-7)));
  return { tv, lv, delta: lv ? Math.round(((tv - lv) / lv) * 100) : null };
}

export const GROUPS: { name: string; muscles: Muscle[] }[] = [
  { name: '가슴', muscles: ['chest'] },
  { name: '등', muscles: ['lats', 'traps', 'lowerBack'] },
  { name: '어깨', muscles: ['delts'] },
  { name: '팔', muscles: ['biceps', 'triceps', 'forearms'] },
  { name: '하체', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'] },
];

/** 최근 N일 근육별 자극 (주동근 세트 1, 보조 0.5) → 0~1 */
export function muscleLoad(logs: WorkoutLog[], days = 14) {
  const since = dayStr(-(days - 1));
  const raw: Partial<Record<Muscle, number>> = {};
  for (const l of logs) {
    if (l.date < since) continue;
    const info = exerciseInfo(l.exercise, l.routine);
    const n = l.sets.length;
    info.primary.forEach((m) => (raw[m] = (raw[m] ?? 0) + n));
    info.secondary.forEach((m) => (raw[m] = (raw[m] ?? 0) + n * 0.5));
  }
  const max = Math.max(0, ...Object.values(raw).map(Number));
  const heat: Partial<Record<Muscle, number>> = {};
  for (const [m, v] of Object.entries(raw)) heat[m as Muscle] = max ? Number(v) / max : 0;
  const groups = GROUPS.map((g) => ({ name: g.name, sets: Math.round(g.muscles.reduce((a, m) => a + (raw[m] ?? 0), 0)) }));
  const sorted = [...groups].sort((a, b) => b.sets - a.sets);
  return { heat, groups, most: sorted[0]?.sets ? sorted[0] : null, least: sorted[sorted.length - 1], total: groups.reduce((a, g) => a + g.sets, 0) };
}

/** 최근 30일 신기록 (추정 1RM이 그 전 최고보다 높아진 종목) */
export function recentPRs(logs: WorkoutLog[], days = 30) {
  const since = dayStr(-(days - 1));
  const byEx = new Map<string, { before: number; recent: number; date: string }>();
  for (const l of logs) {
    const e = byEx.get(l.exercise) ?? { before: 0, recent: 0, date: '' };
    const rm = estimate1RM(l.sets);
    if (l.date >= since) {
      if (rm > e.recent) {
        e.recent = rm;
        e.date = l.date;
      }
    } else e.before = Math.max(e.before, rm);
    byEx.set(l.exercise, e);
  }
  return [...byEx.entries()]
    .filter(([, v]) => v.before > 0 && v.recent > v.before)
    .map(([ex, v]) => ({ ex, from: v.before, to: v.recent, date: v.date }))
    .sort((a, b) => b.to / b.from - a.to / a.from);
}
