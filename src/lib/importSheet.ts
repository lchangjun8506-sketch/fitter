/**
 * 예전 구글 시트(운동기록_DB)에서 내려받은 CSV → 운동 기록
 * 열: ID, 날짜, 분할 루틴, 운동 종목, 세트 정보(JSON), 작성 시각, [메모]
 */
import { ROUTINES, ROUTINE_EXERCISES } from '../data/exercises';
import type { CustomExercise, NewLog, Routine, WorkoutLog, WorkoutSet } from './types';

export type ImportLog = NewLog & { createdAt?: string };

export interface ImportPreview {
  logs: ImportLog[];
  newExercises: CustomExercise[];
  duplicates: number;
  skipped: { line: number; reason: string }[];
  from: string | null;
  to: string | null;
}

/** 따옴표·줄바꿈·"" 이스케이프를 지원하는 CSV 파서 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** "2026-11-04", "2026. 11. 4", "2026/11/04" → 2026-11-04 */
function normDate(v: string): string | null {
  const m = v.trim().match(/^(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [m[1], +m[2], +m[3]];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "2026-11-04 21:46:11" (한국 시간) → ISO */
function normTime(v: string): string | undefined {
  const m = v.trim().match(/^(20\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return undefined;
  const p = (n: string | undefined) => String(Number(n ?? 0)).padStart(2, '0');
  return `${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4])}:${m[5]}:${p(m[6])}+09:00`;
}

function normSets(v: string): WorkoutSet[] | null {
  try {
    const arr = JSON.parse(v);
    if (!Array.isArray(arr) || !arr.length) return null;
    const sets: WorkoutSet[] = [];
    for (const s of arr) {
      const weight = Number(s?.weight), reps = Number(s?.reps);
      if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
      const drops = Array.isArray(s.drops)
        ? s.drops.map((d: { weight: unknown; reps: unknown }) => ({ weight: Number(d.weight), reps: Number(d.reps) })).filter((d: WorkoutSet) => Number.isFinite(d.weight) && Number.isFinite(d.reps))
        : [];
      sets.push(drops.length ? { weight, reps, drops } : { weight, reps });
    }
    return sets;
  } catch {
    return null;
  }
}

/** 같은 기록인지 비교용 키 (세트 안 속성 순서 무관) */
export const logKey = (l: { date: string; exercise: string; sets: WorkoutSet[] }) =>
  `${l.date}|${l.exercise.trim()}|${l.sets.map((s) => `${s.weight}x${s.reps}${(s.drops ?? []).map((d) => `>${d.weight}x${d.reps}`).join('')}`).join(',')}`;

export function buildImport(text: string, existing: WorkoutLog[], custom: CustomExercise[]): ImportPreview {
  const rows = parseCsv(text);
  const skipped: ImportPreview['skipped'] = [];
  if (!rows.length) return { logs: [], newExercises: [], duplicates: 0, skipped: [{ line: 0, reason: '빈 파일이에요' }], from: null, to: null };

  // 머리글로 열 위치 찾기 (없으면 예전 시트 기본 순서)
  const head = rows[0].map((h) => h.replace(/\s/g, ''));
  const hasHeader = head.some((h) => /날짜|운동종목|세트/.test(h));
  const col = (names: string[], fallback: number) => {
    const i = head.findIndex((h) => names.some((n) => h.includes(n)));
    return hasHeader && i >= 0 ? i : fallback;
  };
  const C = { date: col(['날짜'], 1), routine: col(['분할', '루틴'], 2), exercise: col(['운동종목', '종목'], 3), sets: col(['세트'], 4), created: col(['작성', '시각'], 5), memo: col(['메모'], 6) };

  const seen = new Set(existing.map(logKey));
  const known = new Set<string>([...ROUTINES.flatMap((r) => ROUTINE_EXERCISES[r].map((e) => `${r}|${e}`)), ...custom.map((c) => `${c.routine}|${c.exercise}`)]);
  const newEx = new Map<string, CustomExercise>();
  const logs: ImportLog[] = [];
  let duplicates = 0;

  rows.slice(hasHeader ? 1 : 0).forEach((r, idx) => {
    const line = idx + (hasHeader ? 2 : 1);
    const date = normDate(r[C.date] ?? '');
    const routine = (r[C.routine] ?? '').trim().replace(/[ㆍ・·.]/g, '·') as Routine;
    const exercise = (r[C.exercise] ?? '').trim();
    const sets = normSets(r[C.sets] ?? '');
    if (!date) return skipped.push({ line, reason: '날짜를 읽을 수 없음' });
    if (!ROUTINES.includes(routine)) return skipped.push({ line, reason: `알 수 없는 루틴 "${r[C.routine] ?? ''}"` });
    if (!exercise) return skipped.push({ line, reason: '종목 없음' });
    if (!sets) return skipped.push({ line, reason: '세트 정보를 읽을 수 없음' });

    const log: ImportLog = { date, routine, exercise, sets, memo: (r[C.memo] ?? '').trim() || undefined, createdAt: normTime(r[C.created] ?? '') };
    const key = logKey(log);
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);
    logs.push(log);
    if (!known.has(`${routine}|${exercise}`)) newEx.set(`${routine}|${exercise}`, { routine, exercise });
  });

  const dates = logs.map((l) => l.date).sort();
  return { logs, newExercises: [...newEx.values()], duplicates, skipped, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
}
