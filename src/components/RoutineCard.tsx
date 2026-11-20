import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, Sparkles } from 'lucide-react';
import { recommendToday, type Recommendation } from '../lib/recommend';
import { askAiRoutine, type AiPlan } from '../lib/aiRoutine';
import { setVolume, setsLabel, streakOf } from '../lib/analysis';
import { useAuth } from '../lib/auth';
import { todayStr } from '../lib/date';
import { draftKey, getDraft } from '../lib/drafts';
import type { InBodyRecord } from '../lib/inbody';
import type { CustomExercise, Routine, WorkoutLog } from '../lib/types';
import type { ExerciseTarget } from './ExerciseSheet';
import Sheet from './Sheet';
import { AnatomyPair } from './Anatomy';
import { PoseTile } from './Pose';
import { exerciseInfo, mergeMuscles, MUSCLE_LABEL } from '../data/muscles';
import LoginPanel from './LoginPanel';

interface Props {
  logs: WorkoutLog[];
  custom: CustomExercise[];
  inbody: InBodyRecord[];
  onOpen: (t: ExerciseTarget) => void;
  onOther: (routine: Routine) => void;
  toast: (m: string) => void;
  /** 값이 바뀌면 AI 추천 시트를 엶 (실험실에서 넘어올 때) */
  aiSignal: number;
}

/** 기록 탭 첫 화면: 오늘 현황 숫자 3개 + 오늘 할 종목 체크리스트 */
export default function TodayPanel({ logs, custom, inbody, onOpen, onOther, toast, aiSignal }: Props) {
  const { session } = useAuth();
  const [sheet, setSheet] = useState(false);
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<AiPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, bump] = useState(0);

  // 진행 중(임시 저장) 표시 갱신
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener('fitter-drafts', on);
    return () => window.removeEventListener('fitter-drafts', on);
  }, []);

  const firstSignal = useRef(aiSignal);
  useEffect(() => {
    if (aiSignal !== firstSignal.current) setSheet(true);
  }, [aiSignal]);

  const base: Recommendation = useMemo(() => {
    const byRoutine: Partial<Record<Routine, string[]>> = {};
    custom.forEach((c) => (byRoutine[c.routine] = [...(byRoutine[c.routine] ?? []), c.exercise]));
    return recommendToday(logs, byRoutine);
  }, [logs, custom]);

  const today = todayStr();
  const todayLogs = useMemo(() => logs.filter((l) => l.date === today), [logs, today]);
  // 종목별 오늘 마지막 기록
  const doneMap = useMemo(() => {
    const m = new Map<string, WorkoutLog>();
    todayLogs.forEach((l) => !m.has(l.exercise) && m.set(l.exercise, l));
    return m;
  }, [todayLogs]);

  const plan = ai
    ? { routine: ai.routine, reason: ai.summary, items: ai.items.map((i) => ({ exercise: i.exercise, sets: i.sets, note: i.tip })) }
    : { routine: base.routine, reason: base.reason, items: base.items };
  const doneCount = plan.items.filter((i) => doneMap.has(i.exercise)).length;
  const extra = [...doneMap.values()].filter((l) => !plan.items.some((i) => i.exercise === l.exercise));

  const volume = todayLogs.reduce((a, l) => a + setVolume(l.sets), 0);
  const streak = useMemo(() => streakOf(logs), [logs]);

  const ask = async () => {
    setBusy(true);
    setErr(null);
    try {
      const p = await askAiRoutine(logs, inbody, base, request);
      setAi(p);
      setSheet(false);
      toast('AI 추천 루틴으로 바꿨어요');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const Item = ({ exercise, routine, sub, log, onClick }: { exercise: string; routine: Routine; sub: string; log?: WorkoutLog; onClick: () => void }) => {
    const draft = !log ? getDraft(draftKey(today, exercise)) : null;
    const info = exerciseInfo(exercise, routine);
    return (
      <button onClick={onClick} className="tap flex items-center w-full gap-3 px-3 py-2.5 text-left [&+*]:shadow-[inset_0_1px_0_var(--sep)]">
        <PoseTile pose={info.pose} size={52} />
        <span className="flex-1 min-w-0">
          <span className={`block text-[16px] font-bold truncate ${log ? 'text-sub' : ''}`}>{exercise}</span>
          <span className="flex items-center gap-1.5 mt-1 min-w-0">
            <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-[5px] bg-accent/10 text-accentfg">{info.focus}</span>
            <span className="text-[12px] text-sub truncate">
              {log ? `${setsLabel(log.sets)} 완료` : draft ? <span className="text-accentfg font-semibold">진행 중 · {draft.done}/{draft.rows.length}세트</span> : sub}
            </span>
          </span>
        </span>
        <span aria-label={log ? '완료' : draft ? '진행 중' : '안 함'} className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${log ? 'bg-accent text-onaccent' : draft ? 'shadow-[inset_0_0_0_2px_rgb(var(--accent))]' : 'shadow-[inset_0_0_0_2px_var(--sep)]'}`}>
          {log && <Check aria-hidden className="w-4 h-4" strokeWidth={3} />}
        </span>
      </button>
    );
  };

  const vol = volume >= 1000 ? { v: (volume / 1000).toFixed(1), u: 't' } : { v: String(volume), u: 'kg' };
  const muscles = mergeMuscles(plan.items.map((i) => exerciseInfo(i.exercise, plan.routine)));

  // 이번 주 (월~일)
  const week = useMemo(() => {
    const trained = new Set(logs.map((l) => l.date));
    const d = new Date();
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return ['월', '화', '수', '목', '금', '토', '일'].map((label, i) => {
      const x = new Date(mon);
      x.setDate(mon.getDate() + i);
      const ds = todayStr(x);
      return { label, day: x.getDate(), done: trained.has(ds), today: ds === today, future: ds > today };
    });
  }, [logs, today]);

  return (
    <div className="space-y-5">
      <section aria-label="이번 주" className="grid grid-cols-7 gap-1 -mt-1">
        {week.map((w) => (
          <div key={w.label} className="flex flex-col items-center gap-1.5">
            <span className={`text-[11px] font-semibold ${w.today ? 'text-accentfg' : 'text-sub'}`}>{w.label}</span>
            <span
              aria-label={`${w.label} ${w.day}일${w.done ? ' 운동함' : ''}`}
              className={`num w-9 h-9 rounded-full grid place-items-center text-[15px] ${
                w.today ? (w.done ? 'bg-accent text-onaccent' : 'shadow-[inset_0_0_0_2px_rgb(var(--accent))] text-accentfg') : w.done ? 'bg-ink text-onink' : w.future ? 'text-sub/50' : 'bg-card'
              }`}
            >
              {w.day}
            </span>
          </div>
        ))}
      </section>

      <section aria-label="오늘의 추천 루틴" className="group-card">
        <div className="flex items-center gap-2 pl-4 pr-3 pt-3.5 pb-2">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-accentfg">{ai ? 'AI 추천 루틴' : '추천 루틴'}</div>
            <div className="text-[28px] font-extrabold tracking-[-0.02em] leading-tight mt-0.5">{plan.routine}</div>
            <p className="text-[13px] text-sub leading-snug mt-1.5 line-clamp-3">{plan.reason}</p>
            <p className="text-[13px] font-semibold mt-2">{plan.items.length}종목</p>
          </div>
          <AnatomyPair primary={muscles.primary} secondary={muscles.secondary} height={150} label={`오늘 쓰는 근육: ${muscles.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}`} />
        </div>
        <div className="grid grid-cols-3 shadow-[inset_0_1px_0_var(--sep)]" aria-label="오늘 현황">
          {[
            { k: '완료', v: String(doneCount), u: `/${plan.items.length}` },
            { k: '볼륨', ...vol },
            { k: '연속', v: String(streak), u: '일' },
          ].map((s, i) => (
            <div key={s.k} className={`px-4 py-3 ${i ? 'shadow-[inset_1px_0_0_var(--sep)]' : ''}`}>
              <div className="caption">{s.k}</div>
              <div className="num text-[26px] leading-none mt-1">
                {s.v}
                <span className="font-sans text-[13px] text-sub ml-0.5">{s.u}</span>
              </div>
            </div>
          ))}
        </div>
        {ai?.warmup && <p className="px-4 pb-1 text-[13px] text-sub">준비운동 · {ai.warmup}</p>}
        {ai?.caution && <p className="px-4 pb-3 text-[13px] text-down">주의 · {ai.caution}</p>}
      </section>

      <section aria-label="종목">
        <div className="flex items-end justify-between">
          <h2 className="section-label !text-[15px] !text-ink !font-bold">종목</h2>
          {ai ? (
            <button onClick={() => setAi(null)} className="tap h-11 px-1 pb-2 text-[14px] text-sub">기본 추천 보기</button>
          ) : (
            <button onClick={() => setSheet(true)} className="tap h-11 px-1 pb-2 text-[14px] font-semibold text-accentfg flex items-center gap-1">
              <Sparkles aria-hidden className="w-4 h-4" strokeWidth={2} /> AI에게 묻기
            </button>
          )}
        </div>
        <div className="group-card">
          {plan.items.map((it) => (
            <Item
              key={it.exercise}
              exercise={it.exercise}
              routine={plan.routine}
              sub={`목표 ${setsLabel(it.sets)}`}
              log={doneMap.get(it.exercise)}
              onClick={() => {
                const log = doneMap.get(it.exercise);
                onOpen(log ? { routine: log.routine, exercise: log.exercise, editing: log } : { routine: plan.routine, exercise: it.exercise, sets: it.sets, note: it.note });
              }}
            />
          ))}
        </div>
      </section>

      {extra.length > 0 && (
        <section aria-label="오늘 더 한 종목">
          <h2 className="section-label">오늘 더 한 종목</h2>
          <div className="group-card">
            {extra.map((l) => (
              <Item key={l.id} exercise={l.exercise} routine={l.routine} sub="" log={l} onClick={() => onOpen({ routine: l.routine, exercise: l.exercise, editing: l })} />
            ))}
          </div>
        </section>
      )}

      <button
        onClick={() => onOther(plan.routine)}
        className="tap w-full h-[54px] rounded-[16px] shadow-[inset_0_0_0_1.5px_var(--sep)] text-[16px] font-semibold flex items-center justify-center gap-1.5"
      >
        <Plus aria-hidden className="w-5 h-5" strokeWidth={2} /> 다른 종목 기록
      </button>

      <Sheet
        open={sheet}
        title="AI 루틴 추천"
        onClose={() => setSheet(false)}
        action={session ? { label: busy ? '짜는 중' : '추천 받기', disabled: busy, onClick: ask } : undefined}
      >
        {!session ? (
          <LoginPanel reason="AI 추천은 로그인 후 쓸 수 있어요. 내 기록과 인바디를 바탕으로 오늘 루틴을 짜 드려요." />
        ) : (
          <>
            <p className="px-1 text-[14px] text-sub leading-relaxed">
              최근 45일 운동 기록과 인바디를 바탕으로 AI가 오늘 루틴과 이유를 알려 줘요. 하루 5번까지 쓸 수 있어요.
            </p>
            <div>
              <h4 className="section-label">요청사항 (선택)</h4>
              <div className="group-card !bg-elevcard">
                <textarea
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  aria-label="AI 요청사항"
                  maxLength={200}
                  rows={3}
                  placeholder="예: 40분밖에 없어요 / 왼쪽 어깨가 조금 아파요 / 오늘은 등 하고 싶어요"
                  className="w-full bg-transparent px-4 py-3 text-[16px] leading-relaxed placeholder:text-sub/70 focus:outline-none resize-none"
                />
              </div>
            </div>
            {busy && (
              <p className="flex items-center gap-2 px-1 text-[14px] text-sub">
                <Loader2 aria-hidden className="w-4 h-4 animate-spin" /> 기록을 살펴보고 루틴을 짜는 중이에요…
              </p>
            )}
            {err && <p role="alert" className="px-1 text-[14px] text-down">{err}</p>}
          </>
        )}
      </Sheet>
    </div>
  );
}
