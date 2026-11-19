import { useEffect, useMemo, useState } from 'react';
import { Calculator, Disc3, Loader2, Sparkles, Swords, Watch } from 'lucide-react';
import { disablePush, enablePush, pushEnabled, pushSupport, scheduleRestPush } from '../lib/push';
import { estimate1RM, weightStep } from '../lib/analysis';
import type { WorkoutLog } from '../lib/types';
import BattleTab from './BattleTab';

export type LabSub = 'home' | 'battle' | '1rm' | 'plates' | 'alerts';
export const LAB_TITLES: Record<LabSub, string> = { home: '실험실', battle: '친구 대결', '1rm': '1RM 계산기', plates: '원판 계산기', alerts: '워치 휴식 알림' };

interface Props {
  sub: LabSub;
  onSub: (s: LabSub) => void;
  onAskAi: () => void;
  logs: WorkoutLog[];
  customExercises: string[];
  toast: (m: string) => void;
}

const TILES: { id: Exclude<LabSub, 'home'> | 'ai'; title: string; desc: string; Icon: typeof Swords; badge: string }[] = [
  { id: 'battle', title: '친구 대결', desc: '연속 운동 순위 · 1:1 볼륨 챌린지', Icon: Swords, badge: '사용 중' },
  { id: 'ai', title: 'AI 루틴 코치', desc: '내 기록·인바디로 오늘 루틴 추천', Icon: Sparkles, badge: '사용 중' },
  { id: '1rm', title: '1RM 계산기', desc: '무게 × 횟수로 최대 중량과 % 표', Icon: Calculator, badge: '새 기능' },
  { id: 'plates', title: '원판 계산기', desc: '목표 무게에 끼울 원판 조합', Icon: Disc3, badge: '새 기능' },
  { id: 'alerts', title: '워치 휴식 알림', desc: '휴식이 끝나면 애플워치·잠금화면으로 알림', Icon: Watch, badge: '새 기능' },
];

export default function LabTab({ sub, onSub, onAskAi, logs, customExercises, toast }: Props) {
  if (sub === 'battle') return <BattleTab toast={toast} customExercises={customExercises} />;
  if (sub === '1rm') return <OneRm logs={logs} />;
  if (sub === 'plates') return <Plates />;
  if (sub === 'alerts') return <Alerts toast={toast} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {TILES.map(({ id, title, desc, Icon, badge }) => (
          // 개수가 홀수면 마지막 카드는 한 줄 전체
          <button
            key={id}
            onClick={() => (id === 'ai' ? onAskAi() : onSub(id))}
            className={`tap group-card text-left p-4 min-h-[150px] flex flex-col justify-between ${TILES.length % 2 && id === TILES[TILES.length - 1].id ? 'col-span-2 min-h-0' : ''}`}
          >
            <span>
              <span className="w-10 h-10 rounded-[12px] bg-accent/10 text-accent grid place-items-center mb-3">
                <Icon aria-hidden className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="block text-[17px] font-bold">{title}</span>
              <span className="block text-[13px] text-sub leading-snug mt-1">{desc}</span>
            </span>
            <span className={`self-start mt-3 text-[11px] font-bold px-2 py-1 rounded-[6px] ${badge === '사용 중' ? 'bg-up/10 text-up' : 'bg-fill text-sub'}`}>{badge}</span>
          </button>
        ))}
      </div>
      <p className="px-1 text-[13px] text-sub leading-relaxed">실험실 기능은 계속 바뀔 수 있어요. 자리 잡은 기능은 아래 탭으로 옮겨요.</p>
    </div>
  );
}

/* ── 공용: 큰 −/+ 입력 ── */
function Big({ label, unit, value, onChange, kind }: { label: string; unit: string; value: number; onChange: (n: number) => void; kind: 'weight' | 'reps' }) {
  const [text, setText] = useState<string | null>(null);
  const bump = (dir: 1 | -1) => onChange(Math.max(0, Math.round((value + dir * (kind === 'weight' ? weightStep(value, dir) : 1)) * 100) / 100));
  return (
    <div className="flex-1 min-w-0">
      <div className="caption px-1 mb-1.5">{label}</div>
      <div className="flex items-center h-16 rounded-[16px] bg-card">
        <button onClick={() => bump(-1)} aria-label={`${label} 줄이기`} className="tap w-12 h-16 text-[26px] text-sub shrink-0">−</button>
        <input
          aria-label={label}
          inputMode={kind === 'weight' ? 'decimal' : 'numeric'}
          value={text ?? String(value)}
          onFocus={(e) => {
            setText(String(value));
            e.target.select();
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value.replace(',', '.'));
            if (!isNaN(n)) onChange(n);
          }}
          onBlur={() => setText(null)}
          className="num flex-1 min-w-0 w-full bg-transparent text-center text-[32px] focus:outline-none"
        />
        <button onClick={() => bump(1)} aria-label={`${label} 늘리기`} className="tap w-12 h-16 text-[26px] text-sub shrink-0">+</button>
      </div>
      <div className="text-center caption mt-1">{unit}</div>
    </div>
  );
}

const round25 = (n: number) => Math.round(n / 2.5) * 2.5;

/* ── 1RM 계산기 (Epley) ── */
function OneRm({ logs }: { logs: WorkoutLog[] }) {
  const [w, setW] = useState(60);
  const [r, setR] = useState(8);
  const one = r > 0 && w > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0;

  // 내 기록에서 불러오기: 종목별 최고 추정 1RM 세트
  const mine = useMemo(() => {
    const best = new Map<string, { w: number; r: number; e: number }>();
    for (const l of logs)
      for (const s of l.sets) {
        const e = estimate1RM([s]);
        if (e > (best.get(l.exercise)?.e ?? 0)) best.set(l.exercise, { w: s.weight, r: s.reps, e });
      }
    return [...best.entries()].sort((a, b) => b[1].e - a[1].e).slice(0, 6);
  }, [logs]);

  const rows = [100, 95, 90, 85, 80, 75, 70, 65, 60].map((p) => ({ p, w: round25((one * p) / 100), reps: p === 100 ? 1 : Math.round(30 * (100 / p - 1)) }));

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Big label="들어 올린 무게" unit="kg" kind="weight" value={w} onChange={setW} />
        <Big label="횟수" unit="회" kind="reps" value={r} onChange={(n) => setR(Math.round(n))} />
      </div>
      {mine.length > 0 && (
        <div>
          <h2 className="section-label">내 기록에서 불러오기</h2>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {mine.map(([ex, b]) => (
              <button key={ex} onClick={() => { setW(b.w); setR(b.r); }} className="tap shrink-0 h-10 px-3.5 rounded-full bg-card text-[14px] font-medium">
                {ex} <span className="text-sub">{b.w}×{b.r}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <section className="group-card px-4 py-4" aria-label="추정 1RM">
        <div className="caption">추정 최대 중량 (1RM)</div>
        <div className="num text-[56px] leading-none mt-2">
          {Math.round(one * 10) / 10}
          <span className="font-sans text-[18px] text-sub ml-1">kg</span>
        </div>
        <p className="text-[13px] text-sub mt-2">Epley 공식 추정치예요. 10회가 넘으면 오차가 커져요.</p>
      </section>
      <section>
        <h2 className="section-label">강도별 무게 · 2.5kg 단위</h2>
        <div className="group-card">
          {rows.map((x) => (
            <div key={x.p} className="row justify-between">
              <span className="num text-[18px] w-14">{x.p}%</span>
              <span className="num text-[22px] flex-1">
                {x.w}
                <span className="font-sans text-[13px] text-sub ml-0.5">kg</span>
              </span>
              <span className="text-[14px] text-sub">약 {x.reps}회</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── 원판 계산기 ── */
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATE_STYLE: Record<number, { h: number; w: number; c: string }> = {
  25: { h: 112, w: 20, c: 'bg-accent' },
  20: { h: 112, w: 18, c: 'bg-[#2563EB]' },
  15: { h: 100, w: 16, c: 'bg-[#CA8A04]' },
  10: { h: 88, w: 14, c: 'bg-up' },
  5: { h: 70, w: 12, c: 'bg-ink' },
  2.5: { h: 58, w: 10, c: 'bg-sub' },
  1.25: { h: 48, w: 8, c: 'bg-sub/60' },
};
const BARS = [
  { w: 20, label: '바벨 20' },
  { w: 15, label: '여성용 15' },
  { w: 10, label: 'EZ바 10' },
  { w: 0, label: '머신 0' },
];

function Plates() {
  const [target, setTarget] = useState(100);
  const [bar, setBar] = useState(20);

  const { side, rest } = useMemo(() => {
    let left = Math.max(0, (target - bar) / 2);
    const out: number[] = [];
    for (const p of PLATES)
      while (left + 1e-9 >= p) {
        out.push(p);
        left -= p;
      }
    return { side: out, rest: Math.round(left * 2 * 100) / 100 };
  }, [target, bar]);

  const grouped = PLATES.map((p) => ({ p, n: side.filter((x) => x === p).length })).filter((g) => g.n);

  return (
    <div className="space-y-6">
      <Big label="목표 무게 (전체)" unit="kg" kind="weight" value={target} onChange={setTarget} />
      <div>
        <h2 className="section-label">바 무게</h2>
        <div className="grid grid-cols-4 bg-fill rounded-[12px] p-[3px]" role="radiogroup" aria-label="바 무게">
          {BARS.map((b) => (
            <button
              key={b.w}
              role="radio"
              aria-checked={bar === b.w}
              onClick={() => setBar(b.w)}
              className={`h-11 rounded-[9px] text-[14px] transition-all ${bar === b.w ? 'bg-seg font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'font-medium text-sub'}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <section className="group-card px-4 py-5" aria-label="한쪽 원판">
        <div className="caption">한쪽에 끼울 원판</div>
        {/* 바 그림: 가운데 손잡이 → 바깥으로 무거운 원판부터 */}
        <div className="flex items-center h-[124px] mt-3" aria-hidden>
          <div className="w-10 h-3 rounded-l-full bg-sub/40" />
          <div className="w-2 h-8 rounded-sm bg-sub/60" />
          {side.map((p, i) => (
            <div key={i} className={`${PLATE_STYLE[p].c} rounded-[3px] mx-[1px] shrink-0`} style={{ height: PLATE_STYLE[p].h, width: PLATE_STYLE[p].w }} />
          ))}
          <div className="flex-1 h-3 rounded-r-full bg-sub/40" />
        </div>
        {grouped.length ? (
          <p className="text-[20px] font-bold mt-3">
            {grouped.map((g) => `${g.p}kg${g.n > 1 ? ` × ${g.n}` : ''}`).join(' · ')}
          </p>
        ) : (
          <p className="text-[17px] font-semibold mt-3 text-sub">원판 없이 바만</p>
        )}
        {rest > 0 && <p className="text-[14px] text-down mt-1">{rest}kg은 원판으로 맞출 수 없어요. 가장 가까운 무게는 {target - rest}kg예요.</p>}
        {target < bar && <p className="text-[14px] text-down mt-1">목표가 바 무게보다 가벼워요.</p>}
      </section>
      <p className="px-1 text-[13px] text-sub">원판: 25 · 20 · 15 · 10 · 5 · 2.5 · 1.25kg 기준</p>
    </div>
  );
}

/* ── 워치 휴식 알림 ── */
function Alerts({ toast }: { toast: (m: string) => void }) {
  const [on, setOn] = useState(pushEnabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const support = pushSupport();
  useEffect(() => {
    const f = () => setOn(pushEnabled());
    window.addEventListener('fitter-push', f);
    return () => window.removeEventListener('fitter-push', f);
  }, []);

  const toggle = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (on) {
        await disablePush();
        toast('알림을 껐어요');
      } else {
        await enablePush();
        toast('알림을 켰어요');
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    const r = await scheduleRestPush(10, true);
    toast(r === null ? '알림을 먼저 켜 주세요' : '10초 뒤에 알림이 와요. 지금 화면을 잠가 보세요');
  };

  const steps =
    support === 'ios-install'
      ? ['Safari 아래 공유 버튼 → "홈 화면에 추가"', '홈 화면의 FITTER 아이콘으로 다시 열기', '이 화면에서 "알림 켜기"']
      : ['아래 "알림 켜기" → 알림 허용', '"10초 테스트"를 누르고 바로 화면 잠그기', '워치가 울리면 준비 끝'];

  return (
    <div className="space-y-6">
      <section className="group-card">
        <div className="row justify-between min-h-[64px]">
          <span>
            <span className="block text-[17px] font-semibold">휴식 끝 알림</span>
            <span className="block text-[13px] text-sub">{on ? '켜짐 · 이 기기로 알려 줘요' : '꺼짐'}</span>
          </span>
          <button
            role="switch"
            aria-checked={on}
            aria-label="휴식 끝 알림"
            disabled={busy || support === 'unsupported'}
            onClick={toggle}
            className={`relative w-[52px] h-[32px] rounded-full transition-colors shrink-0 disabled:opacity-40 ${on ? 'bg-up' : 'bg-fill'}`}
          >
            <span className={`absolute top-[2px] left-[2px] w-7 h-7 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
            {busy && <Loader2 aria-hidden className="absolute -left-7 top-1.5 w-5 h-5 animate-spin text-sub" />}
          </button>
        </div>
        {on && (
          <button onClick={test} className="tap row w-full text-[17px] font-medium text-accent">10초 테스트</button>
        )}
      </section>
      {err && <p role="alert" className="px-1 -mt-3 text-[14px] text-down leading-relaxed">{err}</p>}
      {support === 'unsupported' && <p className="px-1 -mt-3 text-[14px] text-down">이 브라우저는 알림을 지원하지 않아요.</p>}

      <section>
        <h2 className="section-label">설정 순서</h2>
        <ol className="group-card">
          {steps.map((s, i) => (
            <li key={s} className="row gap-3 text-[15px]">
              <span className="num w-6 h-6 rounded-full bg-fill grid place-items-center text-[13px] shrink-0">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="px-1 space-y-2 text-[13px] text-sub leading-relaxed">
        <p>세트를 완료하면 휴식 타이머와 함께 알림이 예약돼요. 타이머를 멈추거나 다시 시작하면 이전 알림은 취소돼요.</p>
        <p>애플워치는 <b className="text-ink font-semibold">아이폰이 잠겨 있을 때</b> 알림을 받아요. 화면이 켜져 있으면 폰에 떠요. 몇 초 늦을 수 있어요.</p>
        <p>iOS 16.4 이상, 마지막으로 알림을 켠 기기 한 대로만 보내요.</p>
      </section>
    </div>
  );
}
