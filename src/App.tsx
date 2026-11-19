import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartNoAxesColumn, ChevronLeft, CircleUserRound, Dumbbell, FlaskConical, Loader2 } from 'lucide-react';
import { useWorkout } from './lib/useWorkout';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { CloudRepo, deviceRepo } from './lib/storage';
import LabTab, { LAB_TITLES, type LabSub } from './components/LabTab';
import MyTab, { type MySub } from './components/MyTab';
import StatsTab, { type StatsSub } from './components/StatsTab';
import TodayPanel from './components/RoutineCard';
import ExerciseSheet, { type ExerciseTarget } from './components/ExerciseSheet';
import ExercisePicker from './components/ExercisePicker';
import { useInBody } from './lib/useInBody';
import { useBodyGoal } from './lib/body';
import RestPill from './components/RestTimer';
import { useRest } from './lib/rest';
import AddExerciseSheet from './components/AddExerciseSheet';
import Toast from './components/Toast';
import Gate from './components/Gate';
import { todayStr } from './lib/date';
import type { Routine } from './lib/types';

type Tab = 'log' | 'stats' | 'lab' | 'me';
const TABS: { id: Tab; label: string; Icon: typeof Dumbbell }[] = [
  { id: 'log', label: '기록', Icon: Dumbbell },
  { id: 'stats', label: '분석', Icon: ChartNoAxesColumn },
  { id: 'lab', label: '실험실', Icon: FlaskConical },
  { id: 'me', label: 'MY', Icon: CircleUserRound },
];
const TITLES: Record<Tab, string> = { log: '오늘의 운동', stats: '분석', lab: '실험실', me: 'MY' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const TAB_IDS: Tab[] = ['log', 'stats', 'lab', 'me'];
const LAB_SUBS: LabSub[] = ['battle', '1rm', 'alerts'];

/** 주소: #stats, #stats/inbody, #lab, #lab/battle|1rm|alerts, #me, #me/history (예전 #history → MY·히스토리, #battle → 실험실·대결) */
interface Route { tab: Tab; stats: StatsSub; me: MySub; lab: LabSub }
const parseHash = (hash: string): Route => {
  const [t, sub] = hash.replace(/^#/, '').split('/');
  const base: Route = { tab: 'log', stats: 'workout', me: 'dash', lab: 'home' };
  if (t === 'history') return { ...base, tab: 'me', me: 'history' };
  if (t === 'battle') return { ...base, tab: 'lab', lab: 'battle' };
  const tab = TAB_IDS.includes(t as Tab) ? (t as Tab) : 'log';
  return {
    tab,
    stats: tab === 'stats' && sub === 'inbody' ? 'inbody' : 'workout',
    me: tab === 'me' && sub === 'history' ? 'history' : 'dash',
    lab: tab === 'lab' && LAB_SUBS.includes(sub as LabSub) ? (sub as LabSub) : 'home',
  };
};
const toHash = (r: Route) =>
  r.tab === 'log'
    ? ''
    : r.tab === 'stats' && r.stats === 'inbody'
      ? '#stats/inbody'
      : r.tab === 'me' && r.me === 'history'
        ? '#me/history'
        : r.tab === 'lab' && r.lab !== 'home'
          ? `#lab/${r.lab}`
          : `#${r.tab}`;

/** 화면 위에 뜨는 시트 (한 번에 하나, 뒤로가기로 닫힘) */
type Overlay = { kind: 'none' } | { kind: 'picker'; routine: Routine } | { kind: 'add'; routine: Routine } | { kind: 'exercise' };

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
  const body = useBodyGoal(auth.session);
  const [route, setRoute] = useState<Route>(initialRoute);
  const tab = route.tab;
  const [typing, setTyping] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [target, setTarget] = useState<ExerciseTarget | null>(null);
  const [lastRoutine, setLastRoutine] = useState<Routine>('가슴·삼두');
  const [aiSignal, setAiSignal] = useState(0);
  const rest = useRest();
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
      setOverlay({ kind: 'none' });
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

  // 시트 열기: 처음 열 때만 히스토리에 한 칸 (시트끼리 바뀔 땐 그대로)
  const show = (o: Overlay) => {
    if (!history.state?.sheet) history.pushState({ sheet: true }, '');
    if (o.kind === 'picker' || o.kind === 'add') setLastRoutine(o.routine);
    setOverlay(o);
  };
  const closeOverlay = () => {
    if (history.state?.sheet) history.back(); // popstate에서 닫힘
    else setOverlay({ kind: 'none' });
  };
  const openExercise = (t: ExerciseTarget) => {
    setTarget(t);
    show({ kind: 'exercise' });
  };

  // 관문(시작·로그인 화면)이 덮고 있는 동안 앱은 포커스·스크린리더에서도 막음
  const appRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    appRef.current?.toggleAttribute('inert', !ready);
  }, [ready]);
  const onGateChange = useCallback((open: boolean) => {
    setReady(open);
    // 로그아웃 후 다시 로그인하면 기록 탭부터
    if (!open && auth.ready && !auth.session) {
      history.replaceState(null, '', location.pathname + location.search);
      setRoute(parseHash(''));
      setOverlay({ kind: 'none' });
      setTarget(null);
    }
  }, [auth.ready, auth.session]);


  const navigate = (next: Route) => {
    const h = toHash(next);
    if (h !== toHash(route)) history.pushState(null, '', h || location.pathname + location.search);
    setRoute(next);
    window.scrollTo({ top: 0 });
  };
  // 탭을 다시 누르면 그 탭의 첫 화면으로
  const go = (t: Tab) => navigate(t === route.tab ? { ...route, lab: 'home' } : { ...route, tab: t });
  const pillShown = ready && overlay.kind !== 'exercise' && (rest.running || rest.done);
  const labSubPage = tab === 'lab' && route.lab !== 'home';

  return (
    <>
    <Gate onOpenChange={onGateChange} />
    <div ref={appRef} className={`min-h-[100dvh] ${pillShown ? 'pb-[calc(152px+env(safe-area-inset-bottom))]' : 'pb-[calc(88px+env(safe-area-inset-bottom))]'}`}>
      <div className={ready ? 'app-enter' : 'opacity-0'}>
      <header className="max-w-md mx-auto px-5 pt-[max(env(safe-area-inset-top),20px)] pb-5">
        <div className="flex items-center gap-2 h-9 -mb-2">
          {labSubPage ? (
            <button onClick={() => navigate({ ...route, lab: 'home' })} className="tap -ml-1.5 h-9 flex items-center gap-0.5 text-[15px] font-medium text-accent">
              <ChevronLeft aria-hidden className="w-5 h-5" strokeWidth={2.25} /> 실험실
            </button>
          ) : (
            <p className="caption">{tab === 'log' ? todayLabel() : tab === 'stats' ? `총 ${w.logs.length}개 기록` : tab === 'lab' ? '새로 시도하는 기능' : auth.handle ?? (auth.session ? '닉네임을 정해 주세요' : '로그인 전')}</p>
          )}
          {w.loading && <Loader2 aria-label="불러오는 중" className="w-3.5 h-3.5 animate-spin text-sub" />}
        </div>
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em]">{tab === 'lab' ? LAB_TITLES[route.lab] : TITLES[tab]}</h1>
      </header>

      <main className="max-w-md mx-auto px-4 space-y-6">
        {w.error && (
          <div role="alert" className="group-card px-4 py-3 text-[15px] text-down">
            데이터를 불러오지 못했어요: {w.error}
          </div>
        )}

        {/* 기록 화면은 항상 붙여 둠 (실험실 → AI 코치로 넘어올 때 시트를 바로 열 수 있게) */}
        <div className={tab === 'log' ? '' : 'hidden'}>
          <TodayPanel
            logs={w.logs}
            custom={w.custom}
            inbody={inbody.records}
            onOpen={openExercise}
            onOther={(routine) => show({ kind: 'picker', routine })}
            toast={setToast}
            aiSignal={aiSignal}
          />
        </div>

        {tab === 'lab' && (
          <LabTab
            sub={route.lab}
            onSub={(lab) => navigate({ ...route, lab })}
            onAskAi={() => {
              navigate({ ...route, tab: 'log' });
              setAiSignal((n) => n + 1);
            }}
            logs={w.logs}
            customExercises={w.custom.map((c) => c.exercise)}
            toast={setToast}
          />
        )}

        {tab === 'stats' && (
          <StatsTab
            sub={route.stats}
            onSub={(stats) => navigate({ ...route, stats })}
            logs={w.logs}
            inbody={inbody.records}
            reloadInBody={inbody.reload}
            toast={setToast}
            goal={body.goal}
            saveGoal={async (g) => {
              await body.save(g);
              setToast(g ? '목표를 저장했어요' : '목표를 지웠어요');
            }}
          />
        )}

        {tab === 'me' && (
          <MyTab
            sub={route.me}
            onSub={(me) => navigate({ ...route, me })}
            logs={w.logs}
            custom={w.custom}
            inbody={inbody.records}
            goal={body.goal}
            cloud={cloud}
            toast={setToast}
            onImported={() => w.refresh()}
            onEdit={(log) => openExercise({ routine: log.routine, exercise: log.exercise, editing: log })}
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

      {/* 휴식 중엔 어느 탭에서든 아래에 작게 */}
      {pillShown && (
        <div className={`fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none ${typing ? 'hidden' : ''}`} style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))' }}>
          <div className="pointer-events-auto">
            <RestPill floating />
          </div>
        </div>
      )}

      <ExercisePicker
        open={overlay.kind === 'picker'}
        initialRoutine={lastRoutine}
        logs={w.logs}
        custom={w.custom}
        onClose={closeOverlay}
        onPick={(routine, exercise) => {
          const log = w.logs.find((l) => l.date === todayStr() && l.exercise === exercise);
          setTarget(log ? { routine, exercise, editing: log } : { routine, exercise });
          setOverlay({ kind: 'exercise' });
        }}
        onAdd={(routine) => show({ kind: 'add', routine })}
      />
      <AddExerciseSheet
        open={overlay.kind === 'add'}
        initialRoutine={lastRoutine}
        onClose={closeOverlay}
        onSubmit={async (routine, exercise) => {
          await w.addCustom({ routine, exercise });
          setToast(`${exercise} 추가됨`);
          setTarget({ routine, exercise });
          setOverlay({ kind: 'exercise' });
        }}
      />
      <ExerciseSheet
        open={overlay.kind === 'exercise'}
        target={target}
        logs={w.logs}
        busy={w.loading}
        onClose={closeOverlay}
        onOpenAlerts={() => {
          setOverlay({ kind: 'none' });
          navigate({ ...route, tab: 'lab', lab: 'alerts' });
        }}
        onDelete={async (id) => {
          if (!confirm('이 기록을 삭제할까요?')) return;
          await w.remove(id);
          setToast('삭제했습니다');
          closeOverlay();
        }}
        onSave={async (log, id) => {
          try {
            if (id && target?.editing) await w.update({ ...target.editing, ...log });
            else await w.add(log);
            setToast(id ? '수정했습니다' : '저장했습니다');
            closeOverlay();
            return true;
          } catch (e) {
            setToast(`저장 실패: ${(e as Error).message}`);
            return false;
          }
        }}
      />
      <Toast msg={toast} />
    </div>
    </>
  );
}
