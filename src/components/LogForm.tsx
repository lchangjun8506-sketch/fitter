import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Copy, History, Lightbulb, Plus, Trash2, TrendingUp, TriangleAlert, X, Zap } from 'lucide-react';
import { ROUTINES, ROUTINE_EXERCISES, ROUTINE_META } from '../data/exercises';
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

  const tipStyle =
    tip?.tone === 'up'
      ? { box: 'bg-lime/10 border-lime/30', icon: <TrendingUp className="w-4 h-4" />, iconBg: 'bg-lime text-black' }
      : tip?.tone === 'warn'
        ? { box: 'bg-coral/10 border-coral/30', icon: <TriangleAlert className="w-4 h-4" />, iconBg: 'bg-coral text-black' }
        : { box: 'bg-violet/10 border-violet/30', icon: <Lightbulb className="w-4 h-4" />, iconBg: 'bg-violet text-black' };

  return (
    <div className="space-y-3">
      {editing && (
        <div className="flex items-center justify-between rounded-2xl bg-violet/15 border border-violet/40 px-4 py-2.5">
          <span className="text-sm font-bold text-violet">✏️ 기록 수정 중</span>
          <button onClick={onCancelEdit} className="press text-xs font-bold text-white/70 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> 취소
          </button>
        </div>
      )}

      {/* 루틴 */}
      <div className="grid grid-cols-4 gap-2">
        {ROUTINES.map((r) => {
          const on = r === routine;
          return (
            <button
              key={r}
              onClick={() => pickRoutine(r)}
              className={`press rounded-3xl py-3 flex flex-col items-center gap-1 border ${
                on ? 'bg-lime text-black border-lime shadow-[0_6px_24px_rgba(212,255,58,.25)]' : 'bg-surface border-line text-white/70'
              }`}
            >
              <span className="text-xl leading-none">{ROUTINE_META[r].emoji}</span>
              <span className="text-[12px] font-bold">{ROUTINE_META[r].short}</span>
            </button>
          );
        })}
      </div>

      <section className="card p-4 space-y-4">
        {/* 종목 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="label">종목</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field px-3 py-1.5 text-xs font-semibold" />
          </div>
          <div className="relative">
            <select
              value={exercise}
              onChange={(e) => pickExercise(e.target.value)}
              className="field w-full appearance-none p-4 pr-10 text-lg font-extrabold"
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-mute pointer-events-none" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {recent.map((ex) => (
              <button
                key={ex}
                onClick={() => pickExercise(ex)}
                className={`chip whitespace-nowrap flex items-center gap-1 ${
                  ex === exercise ? 'bg-white text-black border-white' : 'bg-raised border-line text-white/80'
                }`}
              >
                <Zap className="w-3 h-3" />
                {ex}
              </button>
            ))}
            <button onClick={() => onOpenAddExercise(routine)} className="chip whitespace-nowrap border-dashed border-white/25 text-white/60 flex items-center gap-1">
              <Plus className="w-3 h-3" /> 종목 추가
            </button>
          </div>
          <p className="text-[11px] text-mute">💡 덤벨은 한 손 무게 기준으로 기록해요</p>
        </div>

        {tip && (
          <div className={`rounded-2xl border p-3 flex gap-3 ${tipStyle.box}`}>
            <div className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${tipStyle.iconBg}`}>{tipStyle.icon}</div>
            <div>
              <div className="text-sm font-extrabold">{tip.title}</div>
              <p className="text-xs text-white/70 mt-0.5 leading-snug">{tip.desc}</p>
            </div>
          </div>
        )}

        {/* 실시간 스탯 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-raised p-3">
            <div className="label">총 볼륨</div>
            <div className="text-2xl font-black tabular-nums mt-1">
              {setVolume(sets).toLocaleString()}
              <span className="text-sm text-mute font-bold ml-0.5">kg</span>
            </div>
          </div>
          <div className="rounded-2xl bg-raised p-3">
            <div className="label">추정 1RM</div>
            <div className="text-2xl font-black tabular-nums mt-1 text-lime">
              {estimate1RM(sets)}
              <span className="text-sm text-mute font-bold ml-0.5">kg</span>
            </div>
          </div>
        </div>

        {/* 세트 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="label">세트</span>
            <div className="flex gap-1.5">
              <button onClick={loadLast} disabled={!history.length} className="chip bg-raised border-line text-white/80 flex items-center gap-1 disabled:opacity-40">
                <History className="w-3 h-3" /> 지난 기록
              </button>
              <button onClick={copyFirst} className="chip bg-raised border-line text-white/80 flex items-center gap-1">
                <Copy className="w-3 h-3" /> 1세트 복사
              </button>
            </div>
          </div>

          {rows.map((r, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-11 grid place-items-center rounded-xl bg-white/5 text-sm font-black text-lime shrink-0">{i + 1}</span>
                <label className="field flex-1 min-w-0 flex items-center px-2.5 h-11">
                  <input inputMode="decimal" value={r.weight} onChange={(e) => patch(i, { weight: e.target.value })} placeholder="0" className="w-full min-w-0 bg-transparent text-base font-extrabold text-center outline-none tabular-nums" />
                  <span className="text-xs text-mute font-bold">kg</span>
                </label>
                <span className="text-mute text-sm">×</span>
                <label className="field flex-1 min-w-0 flex items-center px-2.5 h-11">
                  <input inputMode="numeric" value={r.reps} onChange={(e) => patch(i, { reps: e.target.value })} placeholder="0" className="w-full min-w-0 bg-transparent text-base font-extrabold text-center outline-none tabular-nums" />
                  <span className="text-xs text-mute font-bold">회</span>
                </label>
                <button
                  onClick={() => patch(i, { drops: [...r.drops, { weight: '', reps: '' }] })}
                  className="press h-11 px-2 rounded-xl bg-violet/15 text-violet text-[11px] font-extrabold shrink-0"
                >
                  DROP
                </button>
                <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`${i + 1}세트 삭제`} className="press h-11 w-8 grid place-items-center text-white/30 hover:text-coral shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {r.drops.map((d, k) => (
                <div key={k} className="flex items-center gap-2 pl-10 pr-10">
                  <span className="text-[11px] font-bold text-violet shrink-0">↳</span>
                  <input
                    inputMode="decimal"
                    value={d.weight}
                    onChange={(e) => patch(i, { drops: r.drops.map((x, m) => (m === k ? { ...x, weight: e.target.value } : x)) })}
                    placeholder="kg"
                    className="field flex-1 min-w-0 w-0 h-9 text-sm font-bold text-center border-violet/30"
                  />
                  <input
                    inputMode="numeric"
                    value={d.reps}
                    onChange={(e) => patch(i, { drops: r.drops.map((x, m) => (m === k ? { ...x, reps: e.target.value } : x)) })}
                    placeholder="회"
                    className="field flex-1 min-w-0 w-0 h-9 text-sm font-bold text-center border-violet/30"
                  />
                  <button onClick={() => patch(i, { drops: r.drops.filter((_, m) => m !== k) })} aria-label="드롭세트 삭제" className="text-white/30">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={() => setRows((rs) => [...rs, rs.length ? { ...rs[rs.length - 1], drops: [] } : { weight: '', reps: '', drops: [] }])}
            className="press w-full h-11 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-white/60 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> 세트 추가
          </button>
        </div>

        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="오늘 컨디션은? (선택)" className="field w-full p-3.5 text-sm" />
      </section>

      <button
        onClick={submit}
        disabled={!sets.length || busy}
        className="press w-full h-14 rounded-3xl bg-lime text-black text-base font-black shadow-[0_10px_30px_rgba(212,255,58,.3)] disabled:opacity-40"
      >
        {editing ? '수정 완료' : '기록 저장 💪'}
      </button>
    </div>
  );
}
