import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Share, UserPlus, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { social, type BoardRow, type Challenge, type FriendRequest } from '../lib/social';
import { errText } from '../lib/supabase';
import { ROUTINE_EXERCISES } from '../data/exercises';
import { todayStr } from '../lib/date';
import LoginPanel from './LoginPanel';
import NicknameForm from './NicknameForm';
import Sheet from './Sheet';

const PERIODS = [3, 7, 14];

export async function shareHandle(handle: string, toast: (m: string) => void) {
  const text = `FITTER에서 같이 운동해요. 내 아이디: ${handle}`;
  try {
    if (navigator.share) await navigator.share({ text, url: location.origin });
    else {
      await navigator.clipboard.writeText(handle);
      toast('아이디를 복사했어요');
    }
  } catch {
    /* 공유 취소 */
  }
}

function daysLeft(end: string) {
  const [y, m, d] = end.split('-').map(Number);
  const [ty, tm, td] = todayStr().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

function ChallengeCard({ c, onRespond, onCancel }: { c: Challenge; onRespond: (a: boolean) => void; onCancel: () => void }) {
  const what = c.exercise ?? '전체 볼륨';
  if (c.status === 'pending') {
    return (
      <div className="px-4 py-3.5">
        <div className="text-[15px]">
          <b className="font-semibold">{c.opponent_handle}</b>
          {c.i_am_creator ? '에게 보낸 도전장' : '님의 도전장'}
        </div>
        <div className="text-[13px] text-sub mt-0.5">{what} · {c.days}일 동안 볼륨 많이 쌓기</div>
        {c.i_am_creator ? (
          <div className="flex justify-between items-center mt-2">
            <span className="text-[13px] text-sub">상대가 수락하면 시작돼요</span>
            <button onClick={onCancel} className="tap h-9 px-2 -mr-2 text-[14px] text-sub">취소</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => onRespond(false)} className="tap h-11 rounded-[10px] bg-fill text-[15px] font-semibold">거절</button>
            <button onClick={() => onRespond(true)} className="tap h-11 rounded-[10px] bg-accent text-onaccent text-[15px] font-semibold">수락</button>
          </div>
        )}
      </div>
    );
  }
  const total = c.my_score + c.their_score || 1;
  const left = c.end_date ? daysLeft(c.end_date) : 0;
  const result = c.finished ? (c.my_score > c.their_score ? '승리' : c.my_score < c.their_score ? '패배' : '무승부') : null;
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">vs {c.opponent_handle}</span>
        <span className={`text-[13px] font-semibold ${result === '승리' ? 'text-accent' : 'text-sub'}`}>
          {result ?? (left === 0 ? '오늘 마감' : `D-${left}`)}
        </span>
      </div>
      <div className="text-[13px] text-sub mt-0.5">{what} · {c.days}일</div>
      <div className="flex items-end justify-between mt-2">
        <div><div className="text-[12px] text-sub">나</div><div className="num text-[26px] leading-none">{c.my_score.toLocaleString()}</div></div>
        <div className="text-right"><div className="text-[12px] text-sub">상대</div><div className="num text-[26px] leading-none text-sub">{c.their_score.toLocaleString()}</div></div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-fill overflow-hidden" role="img" aria-label={`나 ${c.my_score}, 상대 ${c.their_score}`}>
        <div className="h-full bg-accent rounded-full transition-[width] duration-500" style={{ width: `${(c.my_score / total) * 100}%` }} />
      </div>
    </div>
  );
}

export default function BattleTab({ toast, customExercises }: { toast: (m: string) => void; customExercises: string[] }) {
  const { ready, session, handle } = useAuth();
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [reqs, setReqs] = useState<FriendRequest[]>([]);
  const [chs, setChs] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [friendInput, setFriendInput] = useState('');
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState<{ friend: string | null; exercise: string | null; days: number }>({ friend: null, exercise: null, days: 7 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r, c] = await Promise.all([social.board(), social.requests(), social.challenges()]);
      setBoard(b);
      setReqs(r);
      setChs(c);
      setErr(null);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && handle) load();
  }, [session, handle, load]);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast(done);
      await load();
    } catch (e) {
      toast(errText(e));
    }
  };

  const friends = board.filter((b) => !b.is_me);
  const exerciseOptions = useMemo(
    () => [...new Set([...Object.values(ROUTINE_EXERCISES).flat(), ...customExercises])],
    [customExercises],
  );

  if (!ready) return null;
  if (!session) return <LoginPanel reason="친구와 연속 운동 기록을 겨루고 1:1 도전장을 주고받으려면 로그인해 주세요." />;
  if (!handle) return <NicknameForm />;

  return (
    <div className="space-y-6">
      {/* 내 아이디 */}
      <section className="group-card row justify-between">
        <div>
          <div className="caption">내 아이디</div>
          <div className="text-[19px] font-bold">{handle}</div>
        </div>
        <div className="flex -mr-2">
          <button onClick={() => navigator.clipboard?.writeText(handle).then(() => toast('복사했어요'))} aria-label="아이디 복사" className="tap w-11 h-11 grid place-items-center text-sub">
            <Copy aria-hidden className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <button onClick={() => shareHandle(handle, toast)} aria-label="아이디 공유" className="tap w-11 h-11 grid place-items-center text-accent">
            <Share aria-hidden className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      </section>

      {/* 친구 추가 */}
      <section>
        <h2 className="section-label">친구 추가</h2>
        <form
          className="group-card flex items-center pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            const h = friendInput.trim();
            if (!h) return;
            run(async () => {
              const r = await social.addFriend(h);
              setFriendInput('');
              toast(r === 'accepted' ? '친구가 됐어요' : '친구 신청을 보냈어요');
            });
          }}
        >
          <input value={friendInput} onChange={(e) => setFriendInput(e.target.value)} aria-label="친구 아이디" placeholder="친구 아이디 (예: 차앵-0164)" autoCapitalize="off" autoCorrect="off" enterKeyHint="send"
            className="flex-1 min-w-0 bg-transparent px-4 h-[52px] text-[16px] placeholder:text-sub/70 focus:outline-none" />
          <button type="submit" aria-label="친구 신청" disabled={!friendInput.trim()} className="tap w-11 h-11 grid place-items-center text-accent disabled:text-sub/40">
            <UserPlus aria-hidden className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </form>
        {reqs.length > 0 && (
          <div className="group-card mt-3">
            {reqs.map((r) => (
              <div key={r.id} className="row justify-between gap-2">
                <span className="text-[15px] truncate"><b className="font-semibold">{r.handle}</b>{r.incoming ? '님의 친구 신청' : ' · 수락 대기 중'}</span>
                {r.incoming && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => run(() => social.respondFriend(r.id, false))} className="tap h-9 px-3 rounded-full bg-fill text-[14px] font-semibold">거절</button>
                    <button onClick={() => run(() => social.respondFriend(r.id, true), '친구가 됐어요')} className="tap h-9 px-3 rounded-full bg-accent text-onaccent text-[14px] font-semibold">수락</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {err && <div role="alert" className="group-card px-4 py-3 text-[15px] text-down">{err}</div>}

      {/* 1:1 챌린지 */}
      <section>
        <div className="flex items-end justify-between">
          <h2 className="section-label">1:1 챌린지</h2>
          <button
            disabled={!friends.length}
            onClick={() => {
              setPick({ friend: friends[0]?.user_id ?? null, exercise: null, days: 7 });
              setSheet(true);
            }}
            className="tap h-9 px-1 pb-2 text-[15px] font-semibold text-accent disabled:text-sub/50"
          >
            도전장 보내기
          </button>
        </div>
        {chs.length === 0 ? (
          <p className="group-card px-4 py-5 text-[15px] text-sub">
            {friends.length ? '진행 중인 챌린지가 없어요. 친구에게 도전장을 보내 보세요.' : '친구를 추가하면 도전장을 보낼 수 있어요.'}
          </p>
        ) : (
          <div className="group-card divide-y divide-[color:var(--sep)]">
            {chs.map((c) => (
              <ChallengeCard key={c.id} c={c}
                onRespond={(a) => run(() => social.respondChallenge(c.id, a), a ? '챌린지 시작!' : undefined)}
                onCancel={() => run(() => social.cancelChallenge(c.id))} />
            ))}
          </div>
        )}
      </section>

      {/* 출석 스트릭 */}
      <section>
        <h2 className="section-label">연속 운동 순위</h2>
        <div className="group-card">
          {board.map((b, i) => (
            <div key={b.user_id} className={`row gap-3 py-2.5 ${b.is_me ? 'bg-accent/[0.06]' : ''}`}>
              <span className={`num w-6 text-[20px] ${i === 0 && b.streak > 0 ? 'text-accent' : 'text-sub'}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-semibold truncate">{b.handle}{b.is_me && <span className="text-sub font-normal"> (나)</span>}</div>
                <div className="text-[13px] text-sub">최근 7일 중 {b.days_7}일 운동</div>
              </div>
              <div className="text-right">
                <span className="num text-[28px] leading-none">{b.streak}</span>
                <span className="text-[13px] text-sub ml-0.5">일 연속</span>
              </div>
              {!b.is_me && b.friendship_id && (
                <button aria-label={`${b.handle} 친구 삭제`} onClick={() => confirm(`${b.handle}님을 친구에서 삭제할까요?`) && run(() => social.removeFriend(b.friendship_id!))}
                  className="tap w-11 h-11 -mr-3 grid place-items-center text-sub/60">
                  <X aria-hidden className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}
        </div>
        {loading && <p className="text-center text-[13px] text-sub mt-3">불러오는 중…</p>}
      </section>

      <Sheet
        open={sheet}
        title="도전장 보내기"
        onClose={() => setSheet(false)}
        action={{
          label: '보내기',
          disabled: !pick.friend,
          onClick: () => {
            setSheet(false);
            run(() => social.createChallenge(pick.friend!, pick.exercise, pick.days), '도전장을 보냈어요');
          },
        }}
      >
        <div>
          <h4 className="section-label">상대</h4>
          <div className="group-card !bg-elevcard" role="radiogroup">
            {friends.map((f) => (
              <button key={f.user_id} role="radio" aria-checked={pick.friend === f.user_id} onClick={() => setPick((p) => ({ ...p, friend: f.user_id }))}
                className="tap row w-full justify-between text-[17px]">
                {f.handle}
                {pick.friend === f.user_id && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h4 className="section-label">기간</h4>
          <div className="grid grid-cols-3 bg-fill rounded-[12px] p-[3px]" role="radiogroup">
            {PERIODS.map((d) => (
              <button key={d} role="radio" aria-checked={pick.days === d} onClick={() => setPick((p) => ({ ...p, days: d }))}
                className={`h-10 rounded-[9px] text-[15px] transition-all ${pick.days === d ? 'bg-seg font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-sub'}`}>
                {d}일
              </button>
            ))}
          </div>
        </div>
        <div>
          <h4 className="section-label">종목 · 기간 동안 쌓은 볼륨으로 승부</h4>
          <div className="group-card !bg-elevcard">
            <label className="row relative justify-between">
              <span className="text-[17px]">{pick.exercise ?? '전체 종목 합산'}</span>
              <span className="text-[15px] text-sub">변경</span>
              <select aria-label="챌린지 종목" value={pick.exercise ?? ''} onChange={(e) => setPick((p) => ({ ...p, exercise: e.target.value || null }))}
                className="absolute inset-0 opacity-0 w-full text-[16px]">
                <option value="">전체 종목 합산</option>
                {exerciseOptions.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
