import { useMemo, useState } from 'react';
import { ChevronRight, Share } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { pendingLocal, type CloudRepo } from '../lib/storage';
import { errText } from '../lib/supabase';
import { estimate1RM, setVolume } from '../lib/analysis';
import { prettyDate, todayStr } from '../lib/date';
import { ROUTINES } from '../data/exercises';
import type { InBodyRecord } from '../lib/inbody';
import type { CustomExercise, WorkoutLog } from '../lib/types';
import ImportSheet from './ImportSheet';
import Segmented from './Segmented';
import HistoryList from './HistoryList';
import LoginPanel from './LoginPanel';
import NicknameForm from './NicknameForm';
import { shareHandle } from './BattleTab';

export type MySub = 'dash' | 'history';

interface Props {
  sub: MySub;
  onSub: (s: MySub) => void;
  logs: WorkoutLog[];
  custom: CustomExercise[];
  inbody: InBodyRecord[];
  cloud: CloudRepo | null;
  toast: (m: string) => void;
  onImported: () => void;
  onEdit: (log: WorkoutLog) => void;
  onDelete: (id: string) => void;
  onOpenInBody: () => void;
}

const dayStr = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return todayStr(d);
};

function streakOf(logs: WorkoutLog[]) {
  const days = new Set(logs.map((l) => l.date));
  let start = days.has(dayStr(0)) ? 0 : days.has(dayStr(-1)) ? -1 : null;
  if (start === null) return 0;
  let n = 0;
  while (days.has(dayStr(start - n))) n++;
  return n;
}

function Delta({ v, unit = '', goodUp = true }: { v: number | null; unit?: string; goodUp?: boolean }) {
  if (v == null || !Number.isFinite(v)) return null;
  const r = Math.round(v * 10) / 10;
  if (r === 0) return <span className="text-[12px] text-sub">변화 없음</span>;
  const good = goodUp ? r > 0 : r < 0;
  return <span className={`text-[12px] font-semibold ${good ? 'text-up' : 'text-down'}`}>{r > 0 ? '▲' : '▼'} {Math.abs(r)}{unit}</span>;
}

function Dashboard({ logs, inbody, onOpenInBody }: Pick<Props, 'logs' | 'inbody' | 'onOpenInBody'>) {
  const stats = useMemo(() => {
    // 이번 주(월~오늘) vs 지난주 같은 기간
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 월=0
    const weekStart = dayStr(-dow), lastStart = dayStr(-dow - 7), lastEnd = dayStr(-7);
    const thisWeek = logs.filter((l) => l.date >= weekStart);
    const lastWeek = logs.filter((l) => l.date >= lastStart && l.date <= lastEnd);
    const vol = (ls: WorkoutLog[]) => ls.reduce((a, l) => a + setVolume(l.sets), 0);
    const tv = vol(thisWeek), lv = vol(lastWeek);

    // 최근 14일 부위별 세트 수
    const since14 = dayStr(-13);
    const balance = ROUTINES.map((r) => ({
      routine: r,
      sets: logs.filter((l) => l.routine === r && l.date >= since14).reduce((a, l) => a + l.sets.length, 0),
    }));
    const maxSets = Math.max(1, ...balance.map((b) => b.sets));
    const weakest = [...balance].sort((a, b) => a.sets - b.sets)[0];

    // 최근 30일 신기록(추정 1RM)
    const since30 = dayStr(-29);
    const byEx = new Map<string, { before: number; recent: number }>();
    for (const l of logs) {
      const e = byEx.get(l.exercise) ?? { before: 0, recent: 0 };
      const rm = estimate1RM(l.sets);
      if (l.date >= since30) e.recent = Math.max(e.recent, rm);
      else e.before = Math.max(e.before, rm);
      byEx.set(l.exercise, e);
    }
    const prs = [...byEx.entries()]
      .filter(([, v]) => v.before > 0 && v.recent > v.before)
      .map(([ex, v]) => ({ ex, from: v.before, to: v.recent }))
      .sort((a, b) => b.to / b.from - a.to / a.from)
      .slice(0, 3);

    return {
      days: new Set(thisWeek.map((l) => l.date)).size,
      tv,
      volDelta: lv ? ((tv - lv) / lv) * 100 : null,
      streak: streakOf(logs),
      balance,
      maxSets,
      weakest,
      prs,
    };
  }, [logs]);

  const [latest, prev] = inbody;
  const first = inbody[inbody.length - 1];

  return (
    <div className="space-y-6">
      {/* 이번 주 */}
      <section aria-label="이번 주">
        <h2 className="section-label">이번 주</h2>
        <div className="grid grid-cols-3 group-card">
          <div className="px-4 py-3.5">
            <div className="caption">운동한 날</div>
            <div className="num text-[30px] leading-none mt-1.5">{stats.days}<span className="text-[15px] text-sub ml-0.5">/7</span></div>
          </div>
          <div className="px-4 py-3.5 shadow-[inset_1px_0_0_var(--sep)]">
            <div className="caption">연속</div>
            <div className="num text-[30px] leading-none mt-1.5">{stats.streak}<span className="text-[15px] text-sub ml-0.5">일</span></div>
          </div>
          <div className="px-4 py-3.5 shadow-[inset_1px_0_0_var(--sep)]">
            <div className="caption">볼륨</div>
            <div className="num text-[22px] leading-none mt-2.5">{(stats.tv / 1000).toFixed(1)}<span className="text-[13px] text-sub ml-0.5">t</span></div>
            <Delta v={stats.volDelta} unit="%" />
          </div>
        </div>
        <p className="px-4 pt-1.5 text-[12px] text-sub">볼륨 변화는 지난주 같은 요일까지와 비교해요</p>
      </section>

      {/* 부위 밸런스 */}
      <section aria-label="부위 밸런스">
        <h2 className="section-label">최근 2주 부위 밸런스 · 세트 수</h2>
        <div className="group-card px-4 py-3.5 space-y-2.5">
          {stats.balance.map((b) => (
            <div key={b.routine} className="flex items-center gap-3">
              <span className="w-16 text-[14px] shrink-0">{b.routine}</span>
              <div className="flex-1 h-2.5 rounded-full bg-fill overflow-hidden">
                <div className={`h-full rounded-full ${b.routine === stats.weakest.routine ? 'bg-down/70' : 'bg-accent'}`} style={{ width: `${(b.sets / stats.maxSets) * 100}%` }} />
              </div>
              <span className="num w-8 text-right text-[17px]">{b.sets}</span>
            </div>
          ))}
          {logs.length > 0 && (
            <p className="text-[13px] text-sub pt-1">
              <b className="font-semibold text-ink">{stats.weakest.routine}</b>
              {stats.weakest.sets === 0 ? '을(를) 2주 동안 안 했어요.' : '이(가) 가장 적어요.'} 기록 탭의 추천 루틴을 확인해 보세요.
            </p>
          )}
        </div>
      </section>

      {/* 최근 신기록 */}
      <section aria-label="최근 신기록">
        <h2 className="section-label">최근 30일 신기록 · 추정 1RM</h2>
        <div className="group-card">
          {stats.prs.length === 0 ? (
            <p className="px-4 py-3.5 text-[15px] text-sub">아직 없어요. 같은 종목을 꾸준히 기록하면 여기에 나타나요.</p>
          ) : (
            stats.prs.map((p) => (
              <div key={p.ex} className="row justify-between gap-3">
                <span className="text-[16px] font-semibold truncate">{p.ex}</span>
                <span className="shrink-0 text-[14px] text-sub">
                  {p.from} → <b className="num text-[20px] text-accent">{p.to}</b>kg
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 몸 상태 */}
      <section aria-label="몸 상태">
        <h2 className="section-label">몸 상태 · 인바디</h2>
        <button onClick={onOpenInBody} className="tap w-full group-card text-left">
          {latest ? (
            <>
              <div className="px-4 pt-3.5 flex items-baseline justify-between">
                <span className="text-[13px] text-sub">{prettyDate(latest.measured_at)} 측정 · 지난 측정 대비</span>
                <ChevronRight aria-hidden className="w-4 h-4 text-sub/60" />
              </div>
              <div className="grid grid-cols-3 px-4 pb-3 pt-1">
                {([['weight', '체중', 'kg', false], ['skeletal_muscle', '골격근량', 'kg', true], ['body_fat_pct', '체지방률', '%', false]] as const).map(([k, label, unit, goodUp]) => (
                  <div key={k}>
                    <div className="caption">{label}</div>
                    <div className="num text-[26px] leading-none mt-1">{latest[k] ?? '–'}<span className="text-[13px] text-sub ml-0.5">{unit}</span></div>
                    <Delta v={latest[k] != null && prev?.[k] != null ? latest[k]! - prev[k]! : null} goodUp={goodUp} />
                  </div>
                ))}
              </div>
              {first && first !== latest && latest.skeletal_muscle != null && first.skeletal_muscle != null && (
                <p className="px-4 pb-3.5 text-[13px] text-sub">
                  첫 측정({prettyDate(first.measured_at)})보다 골격근 {latest.skeletal_muscle - first.skeletal_muscle >= 0 ? '+' : ''}
                  {Math.round((latest.skeletal_muscle - first.skeletal_muscle) * 10) / 10}kg
                  {latest.body_fat_pct != null && first.body_fat_pct != null &&
                    `, 체지방률 ${latest.body_fat_pct - first.body_fat_pct >= 0 ? '+' : ''}${Math.round((latest.body_fat_pct - first.body_fat_pct) * 10) / 10}%p`}
                </p>
              )}
            </>
          ) : (
            <div className="row justify-between py-3.5">
              <span>
                <span className="block text-[16px] font-semibold">인바디를 올려 보세요</span>
                <span className="block text-[13px] text-sub">분석 탭에서 결과지 사진·PDF로 기록할 수 있어요</span>
              </span>
              <ChevronRight aria-hidden className="w-4 h-4 text-sub/60" />
            </div>
          )}
        </button>
      </section>
    </div>
  );
}

function Account({ cloud, toast, onImported, logs, custom }: Pick<Props, 'cloud' | 'toast' | 'onImported' | 'logs' | 'custom'>) {
  const { session, handle, signOut } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [editNick, setEditNick] = useState(false);
  const [localCount, setLocalCount] = useState(() => pendingLocal.logs().length);
  const [moving, setMoving] = useState(false);

  if (!session) return <LoginPanel reason="로그인하면 기록이 서버에 저장되고, 친구와 대결하고 인바디를 기록할 수 있어요." />;
  if (!handle || editNick) return <NicknameForm current={handle ?? undefined} onDone={() => setEditNick(false)} />;
  const provider = session.user.app_metadata?.provider as string | undefined;

  return (
    <div className="space-y-6">
      {localCount > 0 && cloud && (
        <section className="group-card px-4 py-3.5 space-y-3">
          <p className="text-[15px] leading-relaxed">로그인 전에 이 기기에 저장한 운동 기록 <b className="font-semibold">{localCount}개</b>가 있어요. 계정으로 옮길까요?</p>
          <button
            disabled={moving}
            onClick={async () => {
              setMoving(true);
              try {
                await cloud.importLogs(pendingLocal.logs());
                for (const c of pendingLocal.custom()) await cloud.addCustom(c);
                pendingLocal.clear();
                setLocalCount(0);
                toast('기록을 계정으로 옮겼어요');
                onImported();
              } catch (e) {
                toast(errText(e));
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
      <section>
        <h2 className="section-label">계정</h2>
        <div className="group-card">
          <div className="row justify-between py-3">
            <div className="min-w-0">
              <div className="text-[18px] font-bold truncate">{handle}</div>
              <div className="text-[13px] text-sub">{{ kakao: '카카오', google: 'Google' }[provider ?? ''] ?? ''} 계정으로 로그인됨</div>
            </div>
            <button onClick={() => shareHandle(handle, toast)} aria-label="아이디 공유" className="tap w-11 h-11 -mr-2 grid place-items-center text-accent">
              <Share aria-hidden className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
          <button onClick={() => setEditNick(true)} className="tap row w-full text-[16px]">닉네임 변경</button>
          {cloud && <button onClick={() => setImportOpen(true)} className="tap row w-full text-[16px]">예전 기록 가져오기 (구글 시트)</button>}
          <button onClick={() => confirm('로그아웃할까요?') && signOut()} className="tap row w-full text-[16px] text-down">로그아웃</button>
        </div>
      </section>
      {cloud && <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} cloud={cloud} logs={logs} custom={custom} onDone={onImported} toast={toast} />}
    </div>
  );
}

export default function MyTab(p: Props) {
  return (
    <div className="space-y-6">
      <Segmented<MySub> label="MY 메뉴" value={p.sub} onChange={p.onSub} options={[{ id: 'dash', label: '대시보드' }, { id: 'history', label: '히스토리' }]} />
      {p.sub === 'dash' ? (
        <>
          <Dashboard logs={p.logs} inbody={p.inbody} onOpenInBody={p.onOpenInBody} />
          <Account cloud={p.cloud} toast={p.toast} onImported={p.onImported} logs={p.logs} custom={p.custom} />
        </>
      ) : (
        <HistoryList logs={p.logs} onEdit={p.onEdit} onDelete={p.onDelete} />
      )}
    </div>
  );
}
