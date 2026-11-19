import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ROUTINES } from '../data/exercises';
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
    <div role="dialog" aria-modal="true" aria-label="종목 추가" className={`fixed inset-0 z-[70] transition-[visibility] duration-300 ${open ? 'visible' : 'invisible pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/50 dark:bg-black/70 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md bg-elev rounded-t-[14px] px-4 pt-2 pb-[max(env(safe-area-inset-bottom),24px)] transition-transform duration-300 ease-apple ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-9 h-[5px] rounded-full bg-sub/40" />
        <div className="flex items-center justify-between h-14">
          <button onClick={onClose} className="tap h-11 px-1 text-[17px] text-sub">취소</button>
          <h3 className="text-[17px] font-semibold">종목 추가</h3>
          <button disabled={!name.trim()} onClick={() => onSubmit(routine, name.trim())} className="tap h-11 px-1 text-[17px] font-semibold disabled:text-sub/50">
            추가
          </button>
        </div>
        <div className="space-y-6 pt-2">
          <div className="group-card !bg-elevcard">
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="종목명" placeholder="종목명"
              className="w-full bg-transparent px-4 h-[52px] text-[17px] placeholder:text-sub/70 focus:outline-none" />
          </div>
          <div>
            <h4 className="section-label">분할 루틴</h4>
            <div className="group-card !bg-elevcard" role="radiogroup">
              {ROUTINES.map((r) => (
                <button key={r} role="radio" aria-checked={routine === r} onClick={() => setRoutine(r)} className="tap row w-full justify-between text-[17px]">
                  {r}
                  {routine === r && <Check aria-hidden className="w-5 h-5" strokeWidth={2.25} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
