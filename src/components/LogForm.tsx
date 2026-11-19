import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Minus, Plus, X } from 'lucide-react';
import { ROUTINES, ROUTINE_EXERCISES } from '../data/exercises';
import { coachingTip, estimate1RM, setVolume } from '../lib/analysis';
import { todayStr } from '../lib/date';
import type { CustomExercise, NewLog, Routine, WorkoutLog, WorkoutSet } from '../lib/types';

type Row = { weight: string; reps: string; drops: { weight: string; reps: string }[] };

const toRows = (sets: WorkoutSet[]): Row[] =>
  sets.map((s) => ({
    weight: String(s.weight),
    reps: String(s.reps),
    drops: (s.drops ?? []).map((d) => ({ weight: String(d.weight), reps: String(d.reps) })),
  }));

const DEFAULT_ROWS: Row[] = toRows([{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }, { weight: 60, reps: 8 }]);

function toSets(rows: Row[]): WorkoutSet[] {
  const out: WorkoutSet[] = [];
  for (const r of rows) {
    const w = parseFloat(r.weight), n = parseInt(r.reps);
    if (isNaN(w) || isNaN(n)) continue;
    const drops = r.drops
      .map((d) => ({ weight: parseFloat(d.weight), reps: parseInt(d.reps) }))
      .filter((d) => !isNaN(d.weight) && !isNaN(d.reps));
    out.push(drops.length ? { weight: w, reps: n, drops } : { weight: w, reps: n });
  }
  return out;
}

interface Props {
  logs: WorkoutLog[];
  custom: CustomExercise[];
  editing: WorkoutLog | null;
  busy: boolean;
  onSave: (log: NewLog, id?: string) => void;
  onCancelEdit: () => void;
  onOpenAddExercise: (routine: Routine) => void;
  pendingExercise: CustomExercise | null;
}

export default function LogForm({ logs, custom, editing, busy, onSave, onCancelEdit, onOpenAddExercise, pendingExercise }: Props) {
  const [date, setDate] = useState(todayStr());
  const [routine, setRoutine] = useState<Routine>('가슴·삼두');
  const [exercise, setExercise] = useState(ROUTINE_EXERCISES['가슴·삼두'][0]);
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [memo, setMemo] = useState('');

  const options = useMemo(() => {
    const mine = custom.filter((c) => c.routine === routine).map((c) => c.exercise);
    return [...new Set([...ROUTINE_EXERCISES[routine], ...mine])];
  }, [routine, custom]);

  const recent = useMemo(() => {
    const r = [...new Set(logs.filter((l) => l.routine === routine).map((l) => l.exercise))].slice(0, 4);
    return r.length ? r : ROUTINE_EXERCISES[routine].slice(0, 3);
  }, [logs, routine]);

  const history = useMemo(() => logs.filter((l) => l.exercise === exercise && l.id !== editing?.id), [logs, exercise, editing]);
  const tip = coachingTip(history);
  const sets = toSets(rows);

  // 사용자가 종목을 고르면 지난 기록으로 자동 채움 (수정 모드에선 덮어쓰지 않음)
  const pickExercise = (ex: string, r: Routine = routine) => {
    setRoutine(r);
    setExercise(ex);
    const last = logs.find((l) => l.exercise === ex);
    setRows(last ? toRows(last.sets) : DEFAULT_ROWS);
  };

  const pickRoutine = (r: Routine) => {
    const first = [...ROUTINE_EXERCISES[r]][0];
    const lastInRoutine = logs.find((l) => l.routine === r)?.exercise;
    pickExercise(lastInRoutine ?? first, r);
  };

  // 첫 로딩 시 최근 기록으로 채우기
  useEffect(() => {
    if (!editing && logs.length) pickExercise(exercise);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs.length === 0]);

  useEffect(() => {
    if (editing) {
      setDate(editing.date);
      setRoutine(editing.routine);
      setExercise(editing.exercise);
      setRows(toRows(editing.sets));
      setMemo(editing.memo ?? '');
    }
  }, [editing]);

  useEffect(() => {
    if (pendingExercise) pickExercise(pendingExercise.exercise, pendingExercise.routine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingExercise]);

  const reset = () => {
    setDate(todayStr());
    setMemo('');
    pickExercise(exercise);
  };

  const patch = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const submit = () => {
    if (!sets.length) return;
    onSave({ date, routine, exercise, sets, memo: memo.trim() || undefined }, editing?.id);
    if (!editing) reset();
  };

  const loadLast = () => {
    if (history[0]) setRows(toRows(history[0].sets));
  };
  const copyFirst = () => setRows((rs) => rs.map((r, i) => (i === 0 ? r : { ...r, weight: rs[0].weight, reps: rs[0].reps })));

  const volume = setVolume(sets);

  return (
    <div className="space-y-6">
      {editing && (
        <div className="group-card row justify-between">
          <span className="text-[15px] font-semibold">기록 수정 중</span>
          <button onClick={onCancelEdit} className="tap h-11 -mr-2 px-2 text-[15px] text-sub">취소</button>
        </div>
      )}

      {/* 분할 루틴: 세그먼트 컨트롤 */}
      <div role="tablist" aria-label="분할 루틴" className="grid grid-cols-4 bg-fill rounded-[12px] p-[3px]">
        {ROUTINES.map((r) => {
          const on = r === routine;
          return (
            <button
              key={r}
              role="tab"
              aria-selected={on}
              onClick={() => pickRoutine(r)}
              className={`h-10 rounded-[9px] text-[14px] transition-all duration-200 ease-apple ${on ? 'bg-seg font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'font-medium text-sub'}`}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* 종목 */}
      <section>
        <div className="group-card">
          <label className="row relative gap-3 min-h-[64px]">
            <span className="sr-only">운동 종목</span>
            <select value={exercise} onChange={(e) => pickExercise(e.target.value)} className="absolute inset-0 opacity-0 w-full cursor-pointer">
              {options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <span className="flex-1 text-[22px] font-bold tracking-[-0.02em] truncate">{exercise}</span>
            <ChevronDown aria-hidden className="w-5 h-5 text-sub shrink-0" strokeWidth={1.75} />
          </label>
          <div className="row justify-between">
            <span className="text-[15px]">날짜</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-[16px] text-sub text-right focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-4 px-4">
          {recent.map((ex) => (
            <button
              key={ex}
              onClick={() => pickExercise(ex)}
              aria-pressed={ex === exercise}
              className={`tap shrink-0 h-9 px-3.5 rounded-full text-[14px] font-medium transition-colors ${ex === exercise ? 'bg-ink text-onink' : 'bg-card text-ink'}`}
            >
              {ex}
            </button>
          ))}
          <button onClick={() => onOpenAddExercise(routine)} className="tap shrink-0 h-9 px-3.5 rounded-full text-[14px] font-medium text-sub shadow-[inset_0_0_0_1px_var(--sep)] flex items-center gap-1">
            <Plus aria-hidden className="w-4 h-4" strokeWidth={2} /> 종목 추가
          </button>
        </div>
        {tip && (
          <p className="mt-4 px-4 border-l-[3px] border-accent text-[14px] leading-relaxed">
            <span className={`font-semibold ${tip.tone === 'warn' ? 'text-down' : ''}`}>{tip.title}</span>
            <span className="text-sub"> · {tip.desc}</span>
          </p>
        )}
      </section>

      {/* 요약 수치 */}
      <section aria-label="현재 입력 요약" className="grid grid-cols-2 group-card">
        <div className="px-4 py-3.5">
          <div className="caption">총 볼륨</div>
          <div className="num text-[32px] leading-none mt-1.5">
            {volume.toLocaleString()}<span className="text-[17px] text-sub ml-1">KG</span>
          </div>
        </div>
        <div className="px-4 py-3.5 shadow-[inset_1px_0_0_var(--sep)]">
          <div className="caption">추정 1RM</div>
          <div className="num text-[32px] leading-none mt-1.5">
            {estimate1RM(sets)}<span className="text-[17px] text-sub ml-1">KG</span>
          </div>
        </div>
      </section>

      {/* 세트 */}
      <section>
        <div className="flex items-end justify-between">
          <h2 className="section-label">세트 · 덤벨은 한 손 기준</h2>
          <div className="flex pb-1 -mr-2">
            <button onClick={loadLast} disabled={!history.length} className="tap h-9 px-2 text-[14px] font-medium disabled:text-sub/50">지난 기록</button>
            <button onClick={copyFirst} className="tap h-9 px-2 text-[14px] font-medium">1세트 복사</button>
          </div>
        </div>
        <div className="group-card">
          <div className="grid grid-cols-[40px_1fr_1fr_88px] items-center px-4 h-9 text-[12px] font-semibold text-sub">
            <span>SET</span><span className="text-center">KG</span><span className="text-center">REPS</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="shadow-[inset_0_1px_0_var(--sep)]">
              <div className="grid grid-cols-[40px_1fr_1fr_88px] items-center px-4 h-[60px] gap-2">
                <span className="num text-[22px] text-sub">{i + 1}</span>
                <input aria-label={`${i + 1}세트 무게`} inputMode="decimal" value={r.weight} onChange={(e) => patch(i, { weight: e.target.value })} placeholder="0"
                  className="num min-w-0 h-11 rounded-[10px] bg-fill text-center text-[24px] placeholder:text-sub/50 focus:outline-none focus:ring-2 focus:ring-ink" />
                <input aria-label={`${i + 1}세트 횟수`} inputMode="numeric" value={r.reps} onChange={(e) => patch(i, { reps: e.target.value })} placeholder="0"
                  className="num min-w-0 h-11 rounded-[10px] bg-fill text-center text-[24px] placeholder:text-sub/50 focus:outline-none focus:ring-2 focus:ring-ink" />
                <div className="flex justify-end -mr-2">
                  <button onClick={() => patch(i, { drops: [...r.drops, { weight: '', reps: '' }] })} className="tap h-11 px-1.5 text-[13px] font-semibold text-sub">드롭</button>
                  <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`${i + 1}세트 삭제`} className="tap w-11 h-11 grid place-items-center text-sub">
                    <Minus aria-hidden className="w-5 h-5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
              {r.drops.map((d, k) => (
                <div key={k} className="grid grid-cols-[40px_1fr_1fr_88px] items-center px-4 h-12 gap-2">
                  <span className="text-[12px] font-semibold text-sub">DROP</span>
                  <input aria-label="드롭 무게" inputMode="decimal" value={d.weight} placeholder="0"
                    onChange={(e) => patch(i, { drops: r.drops.map((x, m) => (m === k ? { ...x, weight: e.target.value } : x)) })}
                    className="num min-w-0 h-9 rounded-[8px] bg-fill/60 text-center text-[19px] placeholder:text-sub/50 focus:outline-none focus:ring-2 focus:ring-ink" />
                  <input aria-label="드롭 횟수" inputMode="numeric" value={d.reps} placeholder="0"
                    onChange={(e) => patch(i, { drops: r.drops.map((x, m) => (m === k ? { ...x, reps: e.target.value } : x)) })}
                    className="num min-w-0 h-9 rounded-[8px] bg-fill/60 text-center text-[19px] placeholder:text-sub/50 focus:outline-none focus:ring-2 focus:ring-ink" />
                  <div className="flex justify-end -mr-2">
                    <button onClick={() => patch(i, { drops: r.drops.filter((_, m) => m !== k) })} aria-label="드롭세트 삭제" className="tap w-11 h-11 grid place-items-center text-sub">
                      <X aria-hidden className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <button
            onClick={() => setRows((rs) => [...rs, rs.length ? { ...rs[rs.length - 1], drops: [] } : { weight: '', reps: '', drops: [] }])}
            className="tap row w-full gap-2 text-[16px] font-medium shadow-[inset_0_1px_0_var(--sep)]"
          >
            <Plus aria-hidden className="w-5 h-5" strokeWidth={2} /> 세트 추가
          </button>
        </div>
      </section>

      <section>
        <h2 className="section-label">메모</h2>
        <div className="group-card">
          <input value={memo} onChange={(e) => setMemo(e.target.value)} aria-label="메모" placeholder="컨디션, 자세, 통증 등"
            className="w-full bg-transparent px-4 h-[52px] text-[16px] placeholder:text-sub/70 focus:outline-none" />
        </div>
      </section>

      <button
        onClick={submit}
        disabled={!sets.length || busy}
        className="tap w-full h-[54px] rounded-[14px] bg-accent text-onaccent text-[17px] font-semibold disabled:opacity-30"
      >
        {editing ? '수정 완료' : '저장'}
      </button>
    </div>
  );
}
