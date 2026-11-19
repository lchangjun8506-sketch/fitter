import { useEffect, useMemo, useState } from 'react';
import { ChartNoAxesColumn, Dumbbell, ListOrdered, Loader2 } from 'lucide-react';
import { useWorkout } from './lib/useWorkout';
import { todayStr } from './lib/date';
import RestTimer from './components/RestTimer';
import LogForm from './components/LogForm';
import HistoryList from './components/HistoryList';
import Dashboard from './components/Dashboard';
import AddExerciseSheet from './components/AddExerciseSheet';
import Toast from './components/Toast';
import Splash from './components/Splash';
import type { CustomExercise, Routine, WorkoutLog } from './lib/types';

type Tab = 'log' | 'history' | 'stats';
const TABS: { id: Tab; label: string; Icon: typeof Dumbbell }[] = [
  { id: 'log', label: '기록', Icon: Dumbbell },
  { id: 'history', label: '히스토리', Icon: ListOrdered },
  { id: 'stats', label: '분석', Icon: ChartNoAxesColumn },
];
const TITLES: Record<Tab, string> = { log: '오늘의 운동', history: '히스토리', stats: '분석' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const todayLabel = () => {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
};

export default function App() {
  const w = useWorkout();
  const [tab, setTab] = useState<Tab>('log');
  const [editing, setEditing] = useState<WorkoutLog | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; routine: Routine }>({ open: false, routine: '가슴·삼두' });
  const [pending, setPending] = useState<CustomExercise | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
    <>
    <Splash onDone={() => setReady(true)} />
    <div className="min-h-screen pb-[calc(88px+env(safe-area-inset-bottom))]">
      <div className={ready ? 'app-enter' : 'opacity-0'}>
      <header className="max-w-md mx-auto px-5 pt-[max(env(safe-area-inset-top),20px)] pb-5">
        <div className="flex items-center gap-2 h-5">
          <p className="caption">{tab === 'log' ? todayLabel() : `총 ${w.logs.length}개 기록`}</p>
          {w.loading && <Loader2 aria-label="불러오는 중" className="w-3.5 h-3.5 animate-spin text-sub" />}
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em]">{TITLES[tab]}</h1>
          {tab === 'log' && (
            <p className="caption pb-1.5">
              오늘 <span className="num text-ink text-[17px]">{todayCount}</span> 종목
            </p>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 space-y-6">
        {w.error && (
          <div role="alert" className="group-card px-4 py-3 text-[15px] text-down">
            데이터를 불러오지 못했어요: {w.error}
          </div>
        )}

        <div className={tab === 'log' ? 'space-y-6' : 'hidden'}>
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
                setToast(id ? '수정했습니다' : '저장했습니다');
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
              setToast('삭제했습니다');
            }}
          />
        )}

        {tab === 'stats' && <Dashboard logs={w.logs} />}
      </main>
      </div>

      <nav aria-label="주 메뉴" className={`${ready ? 'app-fade' : 'opacity-0'} fixed bottom-0 inset-x-0 z-50 bg-bg/85 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_var(--sep)] pb-[env(safe-area-inset-bottom)]`}>
        <div className="max-w-md mx-auto grid grid-cols-3 h-[56px]">
          {TABS.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                onClick={() => go(id)}
                aria-current={on ? 'page' : undefined}
                className={`tap flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-200 ${on ? 'text-accent' : 'text-sub'}`}
              >
                <Icon aria-hidden className="w-6 h-6" strokeWidth={on ? 2.25 : 1.75} />
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
          setToast(`${exercise} 추가됨`);
        }}
      />
      <Toast msg={toast} />
    </div>
    </>
  );
}
