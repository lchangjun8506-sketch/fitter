import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Share } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { pendingLocal, type CloudRepo } from '../lib/storage';
import { errText } from '../lib/supabase';
import { setVolume, streakOf } from '../lib/analysis';
import { prettyDate, todayStr } from '../lib/date';
import type { InBodyRecord } from '../lib/inbody';
import { goalStatuses, monthDay, type BodyGoal } from '../lib/body';
import { GoalBar } from './BodyInsights';
import type { CustomExercise, WorkoutLog } from '../lib/types';
import ImportSheet from './ImportSheet';
import Segmented from './Segmented';
import HistoryList from './HistoryList';
import LoginPanel from './LoginPanel';
import NicknameForm from './NicknameForm';
import { shareHandle } from './BattleTab';

export type MySub = 'home' | 'history';
export const MY_TITLES: Record<MySub, string> = { home: 'MY', history: '운동 기록' };

interface Props {
  sub: MySub;
  onSub: (s: MySub) => void;
  logs: WorkoutLog[];
  custom: CustomExercise[];
  inbody: InBodyRecord[];
  goal: BodyGoal | null;
  cloud: CloudRepo | null;
  toast: (m: string) => void;
  onImported: () => void;
  onEdit: (log: WorkoutLog) => void;
  onDelete: (id: string) => void;
  onOpenInBody: () => void;
}

const WEEK = ['월', '화', '수', '목', '금', '토', '일'];

/** 한 달 달력: 운동한 날을 볼륨에 따라 진하게 */
function MonthGrid({ year, month, logs, selected, onSelect, compact = false }: { year: number; month: number; logs: WorkoutLog[]; selected?: string | null; onSelect?: (d: string) => void; compact?: boolean }) {
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    logs.forEach((l) => m.set(l.date, (m.get(l.date) ?? 0) + setVolume(l.sets)));
    return m;
  }, [logs]);
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const ds = (d: number) => todayStr(new Date(year, month, d));
  const vols = Array.from({ length: days }, (_, i) => byDay.get(ds(i + 1)) ?? 0);
  const max = Math.max(1, ...vols);
  const today = todayStr();
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEK.map((w) => (
          <span key={w} className="text-center text-[11px] font-semibold text-sub">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => <span key={'b' + i} />)}
        {vols.map((v, i) => {
          const d = ds(i + 1);
          const on = v > 0;
          const style = on ? { backgroundColor: `rgb(var(--accent) / ${0.35 + (v / max) * 0.65})` } : undefined;
          const cls = `aspect-square rounded-[8px] grid place-items-center text-[12px] font-semibold ${on ? 'text-white' : 'bg-fill/70 text-sub'} ${
            d === today ? 'ring-2 ring-ink ring-offset-1 ring-offset-card' : ''
          } ${selected === d ? 'outline outline-2 outline-offset-2 outline-ink' : ''}`;
          return onSelect && !compact ? (
            <button key={d} onClick={() => onSelect(d)} aria-label={`${prettyDate(d)}${on ? ' 운동함' : ''}`} aria-pressed={selected === d} className={`tap ${cls}`} style={style}>
              {i + 1}
            </button>
          ) : (
            <span key={d} className={cls} style={style} aria-hidden>
              {compact ? '' : i + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Home(p: Props) {
  const { session, handle, canImport, signOut } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [editNick, setEditNick] = useState(false);
  const [localCount, setLocalCount] = useState(() => pendingLocal.logs().length);
  const [moving, setMoving] = useState(false);
  const now = new Date();
  const monthLogs = useMemo(() => p.logs.filter((l) => l.date.startsWith(todayStr(now).slice(0, 7))), [p.logs]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthDays = new Set(monthLogs.map((l) => l.date)).size;
  const totalDays = new Set(p.logs.map((l) => l.date)).size;
  const st = useMemo(() => (p.goal && p.inbody.length ? goalStatuses(p.goal, p.inbody) : null), [p.goal, p.inbody]);

  if (!session) return <LoginPanel reason="로그인하면 기록이 서버에 저장되고, 친구와 대결하고 인바디를 기록할 수 있어요." />;
  if (!handle || editNick) return <NicknameForm current={handle ?? undefined} onDone={() => setEditNick(false)} />;
  const provider = session.user.app_metadata?.provider as string | undefined;

  return (
    <div className="space-y-4">
      <section aria-label="프로필" className="flex items-center gap-3 px-1">
        <span className="w-14 h-14 rounded-full bg-ink text-onink grid place-items-center text-[22px] font-extrabold shrink-0">{handle.slice(0, 1)}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[21px] font-extrabold truncate">{handle}</span>
          <span className="block text-[13px] text-sub">
            운동한 날 {totalDays}일 · 연속 {streakOf(p.logs)}일 · {{ kakao: '카카오', google: 'Google' }[provider ?? ''] ?? ''}
          </span>
        </span>
        <button onClick={() => shareHandle(handle, p.toast)} aria-label="아이디 공유" className="tap w-11 h-11 grid place-items-center text-accent">
          <Share aria-hidden className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </section>

      {localCount > 0 && p.cloud && (
        <section className="group-card px-4 py-3.5 space-y-3">
          <p className="text-[15px] leading-relaxed">로그인 전에 이 기기에 저장한 운동 기록 <b className="font-semibold">{localCount}개</b>가 있어요. 계정으로 옮길까요?</p>
          <button
            disabled={moving}
            onClick={async () => {
              setMoving(true);
              try {
                await p.cloud!.importLogs(pendingLocal.logs());
                for (const c of pendingLocal.custom()) await p.cloud!.addCustom(c);
                pendingLocal.clear();
                setLocalCount(0);
                p.toast('기록을 계정으로 옮겼어요');
                p.onImported();
              } catch (e) {
                p.toast(errText(e));
              } finally {
                setMoving(false);
              }
            }}
            className="tap w-full h-11 rounded-[10px] bg-accent text-onaccent text-[15px] font-semibold disabled:opacity-50"
          >
            {moving ? '옮기는 중…' : '계정으로 옮기기'}
          </button>
        </section>
      )}

      <button onClick={() => p.onSub('history')} className="tap w-full group-card text-left px-4 pt-3.5 pb-4" aria-label="운동 기록 전체 보기">
        <span className="flex items-center justify-between">
          <b className="text-[15px]">운동 기록</b>
          <span className="flex items-center text-[13px] font-semibold text-sub">전체 보기<ChevronRight aria-hidden className="w-4 h-4 text-sub/60" /></span>
        </span>
        <span className="block text-[12px] text-sub mt-0.5 mb-3">
          {now.getMonth() + 1}월 · 운동한 날 <b className="text-ink">{monthDays}</b>일
        </span>
        <span className="block max-w-[300px] mx-auto">
          <MonthGrid year={now.getFullYear()} month={now.getMonth()} logs={monthLogs} compact />
        </span>
      </button>

      <button onClick={p.onOpenInBody} className="tap w-full group-card text-left px-4 pt-3.5 pb-3" aria-label="신체 목표와 인바디">
        <span className="flex items-center justify-between">
          <b className="text-[15px]">신체 목표</b>
          <span className="flex items-center text-[13px] font-semibold text-sub">{p.goal ? `${monthDay(p.goal.targetDate)}까지` : '정하기'}<ChevronRight aria-hidden className="w-4 h-4 text-sub/60" /></span>
        </span>
        {st && (st.fat || st.muscle) ? (
          <span className="block mt-1" aria-label="내 목표">
            {st.fat && <GoalBar s={st.fat} color="bg-accent" compact />}
            {st.muscle && <GoalBar s={st.muscle} color="bg-ink" compact />}
          </span>
        ) : (
          <span className="block text-[13px] text-sub mt-1">{p.inbody.length ? '체지방률 줄이기 · 근육 늘리기 목표를 정해 보세요' : '인바디를 올리고 목표를 정해 보세요'}</span>
        )}
      </button>

      <section aria-label="설정" className="group-card">
        <button onClick={p.onOpenInBody} className="tap row w-full justify-between text-[16px]">
          인바디 측정 기록<span className="flex items-center text-[14px] text-sub">{p.inbody.length}회<ChevronRight aria-hidden className="w-4 h-4 text-sub/60" /></span>
        </button>
        <button onClick={() => setEditNick(true)} className="tap row w-full justify-between text-[16px]">
          닉네임 변경<ChevronRight aria-hidden className="w-4 h-4 text-sub/60" />
        </button>
        {p.cloud && canImport && (
          <button onClick={() => setImportOpen(true)} className="tap row w-full justify-between text-[16px]">
            예전 기록 가져오기 (구글 시트)<ChevronRight aria-hidden className="w-4 h-4 text-sub/60" />
          </button>
        )}
        <button onClick={() => confirm('로그아웃할까요?') && signOut()} className="tap row w-full text-[16px] text-down">로그아웃</button>
      </section>
      {p.cloud && canImport && <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} cloud={p.cloud} logs={p.logs} custom={p.custom} onDone={p.onImported} toast={p.toast} />}
    </div>
  );
}

/** 운동 기록: 달력에서 날짜를 고르면 그날 기록 / 목록에서 검색 */
function History({ logs, onEdit, onDelete }: Pick<Props, 'logs' | 'onEdit' | 'onDelete'>) {
  const [mode, setMode] = useState<'cal' | 'list'>('cal');
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState<string | null>(() => logs[0]?.date ?? null);
  const prefix = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`;
  const monthLogs = useMemo(() => logs.filter((l) => l.date.startsWith(prefix)), [logs, prefix]);
  const dayLogs = useMemo(() => (sel ? logs.filter((l) => l.date === sel) : []), [logs, sel]);
  const move = (d: number) => setYm(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const isNow = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const vol = monthLogs.reduce((a, l) => a + setVolume(l.sets), 0);

  return (
    <div className="space-y-5">
      <Segmented label="보기" value={mode} onChange={setMode} options={[{ id: 'cal', label: '달력' }, { id: 'list', label: '전체 목록' }]} />
      {mode === 'list' ? (
        <HistoryList logs={logs} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <>
          <section className="group-card px-4 pt-2 pb-4" aria-label="달력">
            <div className="flex items-center justify-between h-12">
              <button onClick={() => move(-1)} aria-label="이전 달" className="tap w-11 h-11 -ml-2 grid place-items-center"><ChevronLeft aria-hidden className="w-5 h-5" /></button>
              <span className="text-center">
                <b className="text-[17px]">{ym.y}년 {ym.m + 1}월</b>
                <span className="block text-[12px] text-sub">
                  {new Set(monthLogs.map((l) => l.date)).size}일 · {vol >= 1000 ? `${(vol / 1000).toFixed(1)}t` : `${vol}kg`}
                </span>
              </span>
              <button onClick={() => move(1)} disabled={isNow} aria-label="다음 달" className="tap w-11 h-11 -mr-2 grid place-items-center disabled:opacity-30"><ChevronRight aria-hidden className="w-5 h-5" /></button>
            </div>
            <MonthGrid year={ym.y} month={ym.m} logs={monthLogs} selected={sel} onSelect={setSel} />
          </section>
          {sel && (
            <section aria-label={`${prettyDate(sel)} 기록`}>
              {dayLogs.length ? (
                <HistoryList logs={dayLogs} onEdit={onEdit} onDelete={onDelete} search={false} />
              ) : (
                <p className="py-8 text-center text-[15px] text-sub">{prettyDate(sel)}에는 기록이 없어요.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function MyTab(p: Props) {
  return p.sub === 'history' ? <History logs={p.logs} onEdit={p.onEdit} onDelete={p.onDelete} /> : <Home {...p} />;
}
