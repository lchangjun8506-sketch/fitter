import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { ROUTINES, ROUTINE_EXERCISES } from '../data/exercises';
import type { CustomExercise, Routine, WorkoutLog } from '../lib/types';
import Sheet from './Sheet';
import Segmented from './Segmented';
import { PoseTile } from './Pose';
import { exerciseInfo } from '../data/muscles';

interface Props {
  open: boolean;
  initialRoutine: Routine;
  logs: WorkoutLog[];
  custom: CustomExercise[];
  onClose: () => void;
  onPick: (routine: Routine, exercise: string) => void;
  onAdd: (routine: Routine) => void;
}

/** 추천에 없는 종목 고르기: 부위 → 종목 (최근에 한 순서 먼저) */
export default function ExercisePicker({ open, initialRoutine, logs, custom, onClose, onPick, onAdd }: Props) {
  const [routine, setRoutine] = useState(initialRoutine);
  useEffect(() => {
    if (open) setRoutine(initialRoutine);
  }, [open, initialRoutine]);

  const list = useMemo(() => {
    const recent = [...new Set(logs.filter((l) => l.routine === routine).map((l) => l.exercise))];
    const all = [...ROUTINE_EXERCISES[routine], ...custom.filter((c) => c.routine === routine).map((c) => c.exercise)];
    const last = new Map(recent.map((e) => [e, logs.find((l) => l.exercise === e)!.date]));
    return { recent: recent.slice(0, 5), rest: [...new Set(all)].filter((e) => !recent.slice(0, 5).includes(e)), last };
  }, [routine, logs, custom]);

  const Row = ({ e }: { e: string }) => (
    <button onClick={() => onPick(routine, e)} className="tap flex items-center w-full gap-3 px-3 py-2 text-left [&+*]:shadow-[inset_0_1px_0_var(--sep)]">
      <PoseTile pose={exerciseInfo(e, routine).pose} size={44} />
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold truncate">{e}</span>
        <span className="block text-[12px] text-sub truncate">{exerciseInfo(e, routine).focus}</span>
      </span>
      {list.last.get(e) && <span className="text-[13px] text-sub shrink-0">{list.last.get(e)!.slice(5).replace('-', '.')}</span>}
      <ChevronRight aria-hidden className="w-5 h-5 text-sub/60 shrink-0" />
    </button>
  );

  return (
    <Sheet open={open} title="종목 선택" onClose={onClose}>
      <Segmented label="부위" value={routine} onChange={setRoutine} options={ROUTINES.map((r) => ({ id: r, label: r }))} />
      {list.recent.length > 0 && (
        <div>
          <h4 className="section-label">최근에 한 종목</h4>
          <div className="group-card !bg-elevcard">
            {list.recent.map((e) => <Row key={e} e={e} />)}
          </div>
        </div>
      )}
      <div>
        <h4 className="section-label">{list.recent.length ? '다른 종목' : '종목'}</h4>
        <div className="group-card !bg-elevcard">
          {list.rest.map((e) => <Row key={e} e={e} />)}
          <button onClick={() => onAdd(routine)} className="tap row w-full gap-2 text-[17px] font-medium text-accentfg shadow-[inset_0_1px_0_var(--sep)]">
            <Plus aria-hidden className="w-5 h-5" strokeWidth={2} /> 새 종목 만들기
          </button>
        </div>
      </div>
    </Sheet>
  );
}
