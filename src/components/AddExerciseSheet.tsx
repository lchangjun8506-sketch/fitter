import { useEffect, useState } from 'react';
import { ROUTINES, ROUTINE_META } from '../data/exercises';
import type { Routine } from '../lib/types';

interface Props {
  open: boolean;
  initialRoutine: Routine;
  onClose: () => void;
  onSubmit: (routine: Routine, name: string) => void;
}

export default function AddExerciseSheet({ open, initialRoutine, onClose, onSubmit }: Props) {
  const [routine, setRoutine] = useState(initialRoutine);
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setRoutine(initialRoutine);
      setName('');
    }
  }, [open, initialRoutine]);

  return (
    <div className={`fixed inset-0 z-[70] transition-[visibility] duration-300 ${open ? 'visible' : 'invisible pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md bg-surface border-t border-line rounded-t-[2rem] p-5 pb-8 space-y-4 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-white/20" />
        <h3 className="text-lg font-extrabold">새 종목 추가</h3>
        <div className="flex gap-2 flex-wrap">
          {ROUTINES.map((r) => (
            <button
              key={r}
              onClick={() => setRoutine(r)}
              className={`chip ${routine === r ? 'bg-lime text-black border-lime' : 'bg-raised border-line text-white/80'}`}
            >
              {ROUTINE_META[r].emoji} {r}
            </button>
          ))}
        </div>
        <input
          autoFocus={open}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 체스트 플라이 머신"
          className="field w-full p-3.5 text-sm font-semibold"
        />
        <button
          disabled={!name.trim()}
          onClick={() => onSubmit(routine, name.trim())}
          className="press w-full h-12 rounded-2xl bg-lime text-black font-extrabold disabled:opacity-40"
        >
          추가하기
        </button>
      </div>
    </div>
  );
}
