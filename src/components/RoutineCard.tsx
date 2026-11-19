import { useMemo, useState } from 'react';
import { Check, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { recommendToday, type Recommendation } from '../lib/recommend';
import { askAiRoutine, type AiPlan } from '../lib/aiRoutine';
import { useAuth } from '../lib/auth';
import { todayStr } from '../lib/date';
import type { InBodyRecord } from '../lib/inbody';
import type { CustomExercise, Routine, WorkoutLog, WorkoutSet } from '../lib/types';
import Sheet from './Sheet';
import LoginPanel from './LoginPanel';

export interface PickTarget {
  routine: Routine;
  exercise: string;
  sets?: WorkoutSet[];
}

interface Props {
  logs: WorkoutLog[];
  custom: CustomExercise[];
  inbody: InBodyRecord[];
  onPick: (t: PickTarget) => void;
  toast: (m: string) => void;
}

const setsLabel = (sets: WorkoutSet[]) => {
  if (!sets.length) return '';
  const top = sets[0];
  const same = sets.every((s) => s.weight === top.weight && s.reps === top.reps);
  if (top.weight === 0) return `무게 찾기 · ${sets.length}세트`;
  return same ? `${top.weight}kg × ${top.reps} · ${sets.length}세트` : sets.map((s) => `${s.weight}×${s.reps}`).join(' / ');
};

export default function RoutineCard({ logs, custom, inbody, onPick, toast }: Props) {
  const { session } = useAuth();
  const [sheet, setSheet] = useState(false);
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<AiPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const base: Recommendation = useMemo(() => {
    const byRoutine: Partial<Record<Routine, string[]>> = {};
    custom.forEach((c) => (byRoutine[c.routine] = [...(byRoutine[c.routine] ?? []), c.exercise]));
    return recommendToday(logs, byRoutine);
  }, [logs, custom]);

  const doneToday = useMemo(() => new Set(logs.filter((l) => l.date === todayStr()).map((l) => l.exercise)), [logs]);

  const plan = ai
    ? { routine: ai.routine, reason: ai.summary, items: ai.items.map((i) => ({ exercise: i.exercise, sets: i.sets, note: i.tip })) }
    : { routine: base.routine, reason: base.reason, items: base.items };
  const doneCount = plan.items.filter((i) => doneToday.has(i.exercise)).length;

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

  return (
    <section aria-label="오늘의 추천 루틴">
      <div className="flex items-end justify-between">
        <h2 className="section-label">{ai ? 'AI 추천 루틴' : '오늘의 추천 루틴'}</h2>
        {ai ? (
          <button onClick={() => setAi(null)} className="tap h-9 px-1 pb-2 text-[14px] text-sub">기본 추천 보기</button>
        ) : (
          <button onClick={() => setSheet(true)} className="tap h-9 px-1 pb-2 text-[14px] font-semibold text-accent flex items-center gap-1">
            <Sparkles aria-hidden className="w-4 h-4" strokeWidth={2} /> AI에게 자세히 묻기
          </button>
        )}
      </div>
      <div className="group-card">
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[22px] font-bold">{plan.routine}</span>
            <span className="text-[13px] text-sub">
              <span className="num text-ink text-[16px]">{doneCount}</span>/{plan.items.length} 완료
            </span>
          </div>
          <p className="text-[14px] text-sub leading-relaxed mt-0.5">{plan.reason}</p>
          {ai?.warmup && <p className="text-[13px] text-sub mt-1.5">준비운동 · {ai.warmup}</p>}
          {ai?.caution && <p className="text-[13px] text-down mt-1">주의 · {ai.caution}</p>}
        </div>
        {plan.items.map((it) => {
          const done = doneToday.has(it.exercise);
          return (
            <button
              key={it.exercise}
              onClick={() => onPick({ routine: plan.routine, exercise: it.exercise, sets: it.sets })}
              className="tap row w-full gap-3 py-2.5 text-left shadow-[inset_0_1px_0_var(--sep)]"
            >
              <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${done ? 'bg-accent text-onaccent' : 'shadow-[inset_0_0_0_1.5px_var(--sep)]'}`}>
                {done && <Check aria-label="완료" className="w-3.5 h-3.5" strokeWidth={3} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-[16px] font-semibold truncate ${done ? 'text-sub line-through' : ''}`}>{it.exercise}</span>
                <span className="block text-[13px] text-sub truncate">{it.note}</span>
              </span>
              <span className="num text-[15px] text-ink/80 shrink-0 text-right">{setsLabel(it.sets)}</span>
              <ChevronRight aria-hidden className="w-4 h-4 text-sub/60 shrink-0" />
            </button>
          );
        })}
      </div>

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
    </section>
  );
}
