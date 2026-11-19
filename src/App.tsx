import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Dumbbell, Loader2 } from 'lucide-react';
import { useWorkout } from './lib/useWorkout';
import { todayStr } from './lib/date';
import RestTimer from './components/RestTimer';
import LogForm from './components/LogForm';
import HistoryList from './components/HistoryList';
import Dashboard from './components/Dashboard';
import AddExerciseSheet from './components/AddExerciseSheet';
import Toast from './components/Toast';
import type { CustomExercise, Routine, WorkoutLog } from './lib/types';

type Tab = 'log' | 'history' | 'stats';
const TABS: { id: Tab; label: string; Icon: typeof Dumbbell }[] = [
  { id: 'log', label: '기록', Icon: Dumbbell },
  { id: 'history', label: '히스토리', Icon: CalendarDays },
  { id: 'stats', label: '성장', Icon: BarChart3 },
];
const TITLES: Record<Tab, string> = { log: '오늘도 한 세트 더 💪', history: '운동 히스토리', stats: '나의 성장' };

export default function App() {
  const w = useWorkout();
  const [tab, setTab] = useState<Tab>('log');
  const [editing, setEditing] = useState<WorkoutLog | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; routine: Routine }>({ open: false, routine: '가슴·삼두' });
  const [pending, setPending] = useState<CustomExercise | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const todayCount = useMemo(() => w.logs.filter((l) => l.date === todayStr()).length, [w.logs]);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl">
        <div className="max-w-md mx-auto px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black tracking-[0.25em] text-lime">FITTER</div>
            <h1 className="text-[22px] font-black leading-tight">{TITLES[tab]}</h1>
          </div>
          <div className="flex items-center gap-2">
            {w.loading && <Loader2 className="w-5 h-5 animate-spin text-lime" />}
            <div className="px-3 py-1.5 rounded-full bg-surface border border-line text-xs font-bold">
              오늘 <span className="text-lime">{todayCount}</span>종목
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 space-y-3">
        {w.error && (
          <div className="rounded-2xl border border-coral/40 bg-coral/10 p-3 text-xs font-semibold text-coral">
            데이터를 불러오지 못했어요: {w.error}
          </div>
        )}

        <div className={tab === 'log' ? 'space-y-3' : 'hidden'}>
          <RestTimer />
          <LogForm
            logs={w.logs}
            custom={w.custom}
            editing={editing}
            busy={w.loading}
            pendingExercise={pending}
            onOpenAddExercise={(routine) => setSheet({ open: true, routine })}
            onCancelEdit={() => setEditing(null)}
            onSave={async (log, id) => {
              try {
                if (id && editing) await w.update({ ...editing, ...log });
                else await w.add(log);
                setToast(id ? '수정 완료!' : '기록 완료! 오늘도 성장 중 🔥');
                setEditing(null);
              } catch (e) {
                setToast(`저장 실패: ${(e as Error).message}`);
              }
            }}
          />
        </div>

        {tab === 'history' && (
          <HistoryList
            logs={w.logs}
            onEdit={(log) => {
              setEditing(log);
              go('log');
            }}
            onDelete={async (id) => {
              if (!confirm('이 기록을 삭제할까요?')) return;
              await w.remove(id);
              setToast('삭제했어요');
            }}
          />
        )}

        {tab === 'stats' && <Dashboard logs={w.logs} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-50 pb-[max(env(safe-area-inset-bottom),12px)] px-4 pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto h-16 rounded-full bg-surface/90 backdrop-blur-xl border border-line grid grid-cols-3 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,.6)]">
          {TABS.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                onClick={() => go(id)}
                className={`press rounded-full flex items-center justify-center gap-1.5 text-sm font-extrabold transition-colors ${
                  on ? 'bg-lime text-black' : 'text-white/50'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={2.5} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      <AddExerciseSheet
        open={sheet.open}
        initialRoutine={sheet.routine}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        onSubmit={async (routine, exercise) => {
          setSheet((s) => ({ ...s, open: false }));
          await w.addCustom({ routine, exercise });
          setPending({ routine, exercise });
          setToast(`'${exercise}' 추가 완료`);
        }}
      />
      <Toast msg={toast} />
    </div>
  );
}
