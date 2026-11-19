import { useEffect, useMemo, useState } from 'react';
import { ChartNoAxesColumn, CircleUserRound, Dumbbell, Loader2, Swords } from 'lucide-react';
import { useWorkout } from './lib/useWorkout';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { CloudRepo, deviceRepo } from './lib/storage';
import BattleTab from './components/BattleTab';
import MyTab, { type MySub } from './components/MyTab';
import StatsTab, { type StatsSub } from './components/StatsTab';
import RoutineCard, { type PickTarget } from './components/RoutineCard';
import { useInBody } from './lib/useInBody';
import { todayStr } from './lib/date';
import RestTimer from './components/RestTimer';
import LogForm from './components/LogForm';
import AddExerciseSheet from './components/AddExerciseSheet';
import Toast from './components/Toast';
import Splash from './components/Splash';
import type { Routine, WorkoutLog } from './lib/types';

type Tab = 'log' | 'battle' | 'stats' | 'me';
const TABS: { id: Tab; label: string; Icon: typeof Dumbbell }[] = [
  { id: 'log', label: '기록', Icon: Dumbbell },
  { id: 'battle', label: '대결', Icon: Swords },
  { id: 'stats', label: '분석', Icon: ChartNoAxesColumn },
  { id: 'me', label: 'MY', Icon: CircleUserRound },
];
const TITLES: Record<Tab, string> = { log: '오늘의 운동', battle: '대결', stats: '분석', me: 'MY' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const TAB_IDS: Tab[] = ['log', 'battle', 'stats', 'me'];

/** 주소: #battle, #stats, #stats/inbody, #me, #me/history (예전 #history → MY·히스토리) */
interface Route { tab: Tab; stats: StatsSub; me: MySub }
const parseHash = (hash: string): Route => {
  const [t, sub] = hash.replace(/^#/, '').split('/');
  if (t === 'history') return { tab: 'me', stats: 'workout', me: 'history' };
  const tab = TAB_IDS.includes(t as Tab) ? (t as Tab) : 'log';
  return { tab, stats: tab === 'stats' && sub === 'inbody' ? 'inbody' : 'workout', me: tab === 'me' && sub === 'history' ? 'history' : 'dash' };
};
const toHash = (r: Route) =>
  r.tab === 'log' ? '' : r.tab === 'stats' && r.stats === 'inbody' ? '#stats/inbody' : r.tab === 'me' && r.me === 'history' ? '#me/history' : `#${r.tab}`;

// 소셜 로그인에서 돌아왔으면 로그인 전에 보던 화면으로
const initialRoute = (): Route => {
  try {
    const saved = sessionStorage.getItem('fitter.returnHash');
    if (saved !== null && new URLSearchParams(location.search).has('code')) {
      sessionStorage.removeItem('fitter.returnHash');
      // 주소(?code=)는 건드리지 않음 → Supabase가 그대로 읽어 로그인 처리
      return parseHash(saved);
    }
  } catch {
    /* noop */
  }
  return parseHash(location.hash);
};
const todayLabel = () => {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
};

export default function App() {
  const auth = useAuth();
  // 로그인하면 서버(Supabase), 아니면 이 기기에 저장
  const cloud = useMemo(() => (supabase && auth.session ? new CloudRepo(supabase) : null), [auth.session?.user.id]);
  const w = useWorkout(cloud ?? deviceRepo);
  const inbody = useInBody(auth.session?.user.id);
  const [route, setRoute] = useState<Route>(initialRoute);
  const tab = route.tab;
  const [typing, setTyping] = useState(false);
  const [editing, setEditing] = useState<WorkoutLog | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; routine: Routine }>({ open: false, routine: '가슴·삼두' });
  const [pending, setPending] = useState<PickTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // 안드로이드 뒤로가기 / iOS 스와이프 뒤로: 탭과 시트를 히스토리에 연결해 앱이 바로 꺼지지 않게
  useEffect(() => {
    const onPop = () => {
      setRoute(parseHash(location.hash));
      setSheet((s) => (s.open ? { ...s, open: false } : s));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 키보드가 올라와 있는 동안 하단 탭 바 숨김 (iOS는 키보드 위로 떠오르고, 안드로이드는 화면이 줄어듦)
  useEffect(() => {
    const isField = (el: Element | null) => !!el && el.matches('input:not([type=date]), textarea');
    const onIn = (e: FocusEvent) => isField(e.target as Element) && setTyping(true);
    const onOut = () => setTimeout(() => setTyping(isField(document.activeElement)), 0);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  const openSheet = (routine: Routine) => {
    history.pushState({ sheet: true }, '');
    setSheet({ open: true, routine });
  };
  const closeSheet = () => {
    if (history.state?.sheet) history.back(); // popstate에서 닫힘
    else setSheet((s) => ({ ...s, open: false }));
  };

  const todayCount = useMemo(() => w.logs.filter((l) => l.date === todayStr()).length, [w.logs]);

  const navigate = (next: Route) => {
    const h = toHash(next);
    if (h !== toHash(route)) history.pushState(null, '', h || location.pathname + location.search);
    setRoute(next);
    window.scrollTo({ top: 0 });
  };
  const go = (t: Tab) => navigate({ ...route, tab: t });

  return (
    <>
    <Splash onDone={() => setReady(true)} />
    <div className="min-h-[100dvh] pb-[calc(88px+env(safe-area-inset-bottom))]">
      <div className={ready ? 'app-enter' : 'opacity-0'}>
      <header className="max-w-md mx-auto px-5 pt-[max(env(safe-area-inset-top),20px)] pb-5">
        <div className="flex items-center gap-2 h-5">
          <p className="caption">{tab === 'log' ? todayLabel() : tab === 'stats' ? `총 ${w.logs.length}개 기록` : auth.handle ?? (auth.session ? '닉네임을 정해 주세요' : '로그인 전')}</p>
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
          <RoutineCard logs={w.logs} custom={w.custom} inbody={inbody.records} onPick={(t) => setPending({ ...t })} toast={setToast} />
          <RestTimer />
          <LogForm
            logs={w.logs}
            custom={w.custom}
            editing={editing}
            busy={w.loading}
            pendingExercise={pending}
            onOpenAddExercise={openSheet}
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

        {tab === 'battle' && <BattleTab toast={setToast} customExercises={w.custom.map((c) => c.exercise)} />}

        {tab === 'stats' && (
          <StatsTab
            sub={route.stats}
            onSub={(stats) => navigate({ ...route, stats })}
            logs={w.logs}
            inbody={inbody.records}
            reloadInBody={inbody.reload}
            toast={setToast}
          />
        )}

        {tab === 'me' && (
          <MyTab
            sub={route.me}
            onSub={(me) => navigate({ ...route, me })}
            logs={w.logs}
            inbody={inbody.records}
            cloud={cloud}
            toast={setToast}
            onImported={() => w.refresh()}
            onEdit={(log) => {
              setEditing(log);
              go('log');
            }}
            onDelete={async (id) => {
              if (!confirm('이 기록을 삭제할까요?')) return;
              await w.remove(id);
              setToast('삭제했습니다');
            }}
            onOpenInBody={() => navigate({ ...route, tab: 'stats', stats: 'inbody' })}
          />
        )}
      </main>
      </div>

      <nav aria-label="주 메뉴" className={`${ready ? 'app-fade' : 'opacity-0'} ${typing ? 'hidden' : ''} fixed bottom-0 inset-x-0 z-50 bg-bg/85 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_var(--sep)] pb-[env(safe-area-inset-bottom)]`}>
        <div className="max-w-md mx-auto grid grid-cols-4 h-[56px]">
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
        onClose={closeSheet}
        onSubmit={async (routine, exercise) => {
          closeSheet();
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
