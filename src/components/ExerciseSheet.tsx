import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Minus, Plus, Trash2, X } from 'lucide-react';
import { coachingTip, estimate1RM, setVolume, weightStep } from '../lib/analysis';
import { prettyDate, todayStr } from '../lib/date';
import { draftKey, getDraft, setDraft, type DraftRow } from '../lib/drafts';
import { useRest } from '../lib/rest';
import type { NewLog, Routine, WorkoutLog, WorkoutSet } from '../lib/types';
import RestPill from './RestTimer';
import { pushEnabled, pushSupport } from '../lib/push';
import { supabase } from '../lib/supabase';
import { exerciseInfo, MUSCLE_LABEL } from '../data/muscles';
import { AnatomyPair } from './Anatomy';
import { PoseTile } from './Pose';

export interface ExerciseTarget {
  routine: Routine;
  exercise: string;
  /** 추천 목표 세트 (무게 0 = 무게 찾기) */
  sets?: WorkoutSet[];
  /** 추천 이유 한 줄 */
  note?: string;
  /** 있으면 이 기록을 수정 */
  editing?: WorkoutLog;
}

interface Props {
  open: boolean;
  target: ExerciseTarget | null;
  logs: WorkoutLog[];
  busy: boolean;
  onClose: () => void;
  onSave: (log: NewLog, id?: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  /** 워치 알림 설정 화면으로 */
  onOpenAlerts: () => void;
}

type Row = DraftRow;

const toRows = (sets: WorkoutSet[]): Row[] =>
  sets.map((s) => ({
    weight: s.weight ? String(s.weight) : '',
    reps: String(s.reps),
    drops: (s.drops ?? []).map((d) => ({ weight: String(d.weight), reps: String(d.reps) })),
  }));

const DEFAULT_ROWS: Row[] = toRows([{ weight: 0, reps: 10 }, { weight: 0, reps: 10 }, { weight: 0, reps: 10 }]);

/** 일부 키패드는 소수점이 쉼표(,)로 입력됨 */
const num = (v: string) => parseFloat(v.replace(',', '.'));
const fmt = (n: number) => String(Math.round(n * 100) / 100);

function toSets(rows: Row[]): WorkoutSet[] {
  const out: WorkoutSet[] = [];
  for (const r of rows) {
    const w = num(r.weight || '0'), n = parseInt(r.reps);
    if (isNaN(w) || isNaN(n) || n <= 0) continue;
    const drops = r.drops.map((d) => ({ weight: num(d.weight), reps: parseInt(d.reps) })).filter((d) => !isNaN(d.weight) && !isNaN(d.reps));
    out.push(drops.length ? { weight: w, reps: n, drops } : { weight: w, reps: n });
  }
  return out;
}

/** −/+ 버튼 + 가운데 숫자(누르면 직접 입력) */
function Stepper({ label, unit, value, onChange, kind }: { label: string; unit: string; value: string; onChange: (v: string) => void; kind: 'weight' | 'reps' }) {
  const n = kind === 'weight' ? num(value || '0') || 0 : parseInt(value) || 0;
  const bump = (dir: 1 | -1) => {
    const step = kind === 'weight' ? weightStep(n, dir) : 1;
    onChange(fmt(Math.max(0, n + dir * step)));
  };
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[12px] font-semibold text-sub mb-1.5 px-1">{label}</div>
      <div className="flex items-center h-14 rounded-[14px] bg-fill">
        <button onClick={() => bump(-1)} aria-label={`${label} 줄이기`} className="tap w-12 h-14 grid place-items-center shrink-0 text-sub">
          <Minus aria-hidden className="w-5 h-5" strokeWidth={2} />
        </button>
        <input
          aria-label={label}
          inputMode={kind === 'weight' ? 'decimal' : 'numeric'}
          pattern={kind === 'reps' ? '[0-9]*' : undefined}
          autoComplete="off"
          value={value}
          placeholder="0"
          onFocus={(e) => e.target.select()}
          onChange={(e) => onChange(e.target.value)}
          className="num flex-1 min-w-0 w-full bg-transparent text-center text-[28px] leading-none placeholder:text-sub/50 focus:outline-none"
        />
        <button onClick={() => bump(1)} aria-label={`${label} 늘리기`} className="tap w-12 h-14 grid place-items-center shrink-0 text-sub">
          <Plus aria-hidden className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
      <div className="sr-only">{unit}</div>
    </div>
  );
}

export default function ExerciseSheet({ open, target, logs, busy, onClose, onSave, onDelete, onOpenAlerts }: Props) {
  const rest = useRest();
  const editing = target?.editing;
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [done, setDone] = useState(0);
  const [cur, setCur] = useState(0);
  const [memo, setMemo] = useState('');
  const [memoOpen, setMemoOpen] = useState(false);
  const key = useRef('');
  const justLoaded = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  // 열릴 때 채우기: 수정 → 그 기록 / 진행 중 → 이어서 / 추천 목표 → 지난 기록 → 빈 세트
  useEffect(() => {
    if (!open || !target) return;
    justLoaded.current = true; // 이번 렌더의 상태는 이전 종목 값 → 임시 저장 건너뜀
    scroller.current?.scrollTo({ top: 0 });
    if (target.editing) {
      const e = target.editing;
      key.current = '';
      setDate(e.date);
      setRows(toRows(e.sets));
      setDone(e.sets.length);
      setCur(-1);
      setMemo(e.memo ?? '');
      setMemoOpen(!!e.memo);
      return;
    }
    const d = todayStr();
    key.current = draftKey(d, target.exercise);
    setDate(d);
    const draft = getDraft(key.current);
    if (draft) {
      setRows(draft.rows);
      setDone(draft.done);
      setCur(draft.done < draft.rows.length ? draft.done : -1);
      setMemo(draft.memo);
      setMemoOpen(!!draft.memo);
      return;
    }
    const last = logs.find((l) => l.exercise === target.exercise);
    setRows(target.sets?.length ? toRows(target.sets) : last ? toRows(last.sets) : DEFAULT_ROWS);
    setDone(0);
    setCur(0);
    setMemo('');
    setMemoOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  // 진행 상황을 임시 저장 (수정 모드 제외)
  useEffect(() => {
    if (justLoaded.current) {
      justLoaded.current = false;
      return;
    }
    if (!open || editing || !key.current) return;
    setDraft(key.current, { rows, done, memo });
  }, [open, editing, rows, done, memo]);

  const history = useMemo(() => (target ? logs.filter((l) => l.exercise === target.exercise && l.id !== editing?.id) : []), [logs, target, editing]);
  const tip = coachingTip(history);
  const info = target ? exerciseInfo(target.exercise, target.routine) : null;
  const hint = target?.note ?? (tip ? `${tip.title} · ${tip.desc}` : '처음 하는 종목이에요. 10~12회가 버거운 무게를 찾아보세요.');

  const patch = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const allDone = done >= rows.length;
  const finished = toSets(rows.slice(0, Math.max(done, editing ? rows.length : 0)));
  const shown = toSets(rows);

  const addSet = () => {
    setRows((rs) => [...rs, rs.length ? { ...rs[rs.length - 1], drops: [] } : { weight: '', reps: '10', drops: [] }]);
    if (allDone) setCur(rows.length);
  };
  const removeSet = (i: number) => {
    setRows((rs) => rs.filter((_, j) => j !== i));
    if (i < done) setDone((d) => d - 1);
    setCur((c) => (c === i ? -1 : c > i ? c - 1 : c));
  };

  const save = async (sets: WorkoutSet[]) => {
    if (!target || !sets.length) return;
    const ok = await onSave({ date, routine: target.routine, exercise: target.exercise, sets, memo: memo.trim() || undefined }, editing?.id);
    if (ok && key.current) setDraft(key.current, null);
  };

  // 큰 버튼: 지금 세트 완료(+휴식 시작) → 마지막엔 저장
  const primary = () => {
    if (editing) return save(shown);
    if (allDone) return save(shown);
    const r = rows[done];
    if (!r || !(parseInt(r.reps) > 0)) return;
    const next = done + 1;
    setDone(next);
    setCur(next < rows.length ? next : -1);
    navigator.vibrate?.(30);
    rest.start();
  };
  const primaryLabel = editing ? '수정 완료' : allDone ? '저장' : `${done + 1}세트 완료`;
  const primaryDisabled = busy || (editing || allDone ? !shown.length : !(parseInt(rows[done]?.reps) > 0));

  const vol = setVolume(finished.length ? finished : shown);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={target?.exercise ?? '세트 입력'} className={`fixed inset-0 z-[80] transition-[visibility] duration-300 ${open ? 'visible' : 'invisible pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/50 dark:bg-black/70 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`absolute inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),12px)] mx-auto max-w-md flex flex-col bg-bg rounded-t-[16px] transition-transform duration-300 ease-apple ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* 머리: 닫기 / 날짜 / 중간 저장 */}
        <div className="px-4 pt-2 shrink-0">
          <div className="mx-auto w-9 h-[5px] rounded-full bg-sub/40" />
          <div className="flex items-center justify-between h-12">
            <button onClick={onClose} className="tap h-11 min-w-[44px] -ml-1 px-1 text-left text-[17px] text-sub">닫기</button>
            <label className="relative tap h-11 px-2 grid place-items-center text-[14px] text-sub">
              {target?.routine} · {date === todayStr() ? '오늘' : prettyDate(date)}
              <input type="date" aria-label="날짜" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0 text-[16px]" />
            </label>
            {!editing && done > 0 && !allDone ? (
              <button onClick={() => save(finished)} disabled={busy} className="tap h-11 min-w-[44px] -mr-1 px-1 text-right text-[17px] font-semibold text-accentfg">
                저장
              </button>
            ) : editing ? (
              <button
                onClick={() => editing && onDelete(editing.id)}
                aria-label="이 기록 삭제"
                className="tap w-11 h-11 -mr-2 grid place-items-center text-sub"
              >
                <Trash2 aria-hidden className="w-5 h-5" strokeWidth={1.75} />
              </button>
            ) : (
              <span className="min-w-[44px]" />
            )}
          </div>
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {info && (
            <section aria-label="자세와 쓰는 근육" className="group-card flex items-center gap-3 px-3.5 py-3">
              <PoseTile pose={info.pose} size={84} />
              <AnatomyPair primary={info.primary} secondary={info.secondary} height={104} label={`주동근 ${info.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}`} />
              <div className="flex-1 min-w-0 text-[12px] leading-snug space-y-1.5">
                <div>
                  <div className="flex items-center gap-1 font-bold"><i aria-hidden className="w-2.5 h-2.5 rounded-[3px] bg-[#F05A00]" />주동근</div>
                  <div className="text-sub">{info.primary.map((m) => MUSCLE_LABEL[m]).join(' · ')}</div>
                </div>
                {info.secondary.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 font-bold"><i aria-hidden className="w-2.5 h-2.5 rounded-[3px] bg-amber" />보조</div>
                    <div className="text-sub">{info.secondary.map((m) => MUSCLE_LABEL[m]).join(' · ')}</div>
                  </div>
                )}
              </div>
            </section>
          )}
          <h2 className="text-[28px] font-bold tracking-[-0.02em] leading-tight mt-4">{target?.exercise}</h2>
          {info?.cue && <p className="text-[14px] leading-relaxed mt-1">{info.cue}</p>}
          <p className="text-[14px] text-sub leading-relaxed mt-0.5">{hint}</p>

          <div className="group-card mt-5">
            {rows.map((r, i) => {
              const isDone = i < done;
              const active = i === cur;
              if (active) {
                return (
                  <div key={i} className="px-4 pt-3 pb-4 bg-accent/[0.05] shadow-[inset_3px_0_0_rgb(var(--accent))] [&+*]:shadow-[inset_0_1px_0_var(--sep)]">
                    <div className="flex items-center justify-between h-11">
                      <span className="text-[15px] font-bold">
                        <span className="num text-[20px] mr-1.5">{i + 1}</span>세트{isDone && <span className="ml-1.5 text-[13px] font-medium text-sub">완료함 · 고치는 중</span>}
                      </span>
                      <div className="flex -mr-2">
                        <button onClick={() => patch(i, { drops: [...r.drops, { weight: r.weight ? fmt(Math.round(num(r.weight) * 0.7 * 2) / 2) : '', reps: '8' }] })} className="tap h-11 min-w-[44px] px-2 text-[14px] font-semibold text-sub">
                          + 드롭
                        </button>
                        {rows.length > 1 && (
                          <button onClick={() => removeSet(i)} className="tap h-11 min-w-[44px] px-2 text-[14px] font-semibold text-sub">삭제</button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <Stepper label={`${i + 1}세트 무게`} unit="kg" kind="weight" value={r.weight} onChange={(v) => patch(i, { weight: v })} />
                      <Stepper label={`${i + 1}세트 횟수`} unit="회" kind="reps" value={r.reps} onChange={(v) => patch(i, { reps: v })} />
                    </div>
                    {r.drops.map((d, k) => (
                      <div key={k} className="flex items-center gap-2 mt-2">
                        <span className="w-12 text-[12px] font-semibold text-sub">드롭</span>
                        <input aria-label="드롭 무게" inputMode="decimal" value={d.weight} placeholder="0" onChange={(e) => patch(i, { drops: r.drops.map((x, m) => (m === k ? { ...x, weight: e.target.value } : x)) })}
                          className="num flex-1 min-w-0 h-11 rounded-[10px] bg-fill text-center text-[20px] placeholder:text-sub/50 focus:outline-none focus:ring-2 focus:ring-ink" />
                        <span className="text-sub text-[13px]">kg ×</span>
                        <input aria-label="드롭 횟수" inputMode="numeric" pattern="[0-9]*" value={d.reps} placeholder="0" onChange={(e) => patch(i, { drops: r.drops.map((x, m) => (m === k ? { ...x, reps: e.target.value } : x)) })}
                          className="num flex-1 min-w-0 h-11 rounded-[10px] bg-fill text-center text-[20px] placeholder:text-sub/50 focus:outline-none focus:ring-2 focus:ring-ink" />
                        <button onClick={() => patch(i, { drops: r.drops.filter((_, m) => m !== k) })} aria-label="드롭세트 삭제" className="tap w-11 h-11 grid place-items-center text-sub">
                          <X aria-hidden className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <button
                  key={i}
                  onClick={() => setCur(i)}
                  aria-label={`${i + 1}세트 ${r.weight || 0}kg ${r.reps}회${isDone ? ' 완료' : ''}, 눌러서 고치기`}
                  className="tap row w-full gap-3 min-h-[56px] text-left [&+*]:shadow-[inset_0_1px_0_var(--sep)]"
                >
                  <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${isDone ? 'bg-accent text-onaccent' : 'shadow-[inset_0_0_0_1.5px_var(--sep)] text-sub'}`}>
                    {isDone ? <Check aria-hidden className="w-4 h-4" strokeWidth={3} /> : <span className="num text-[15px]">{i + 1}</span>}
                  </span>
                  <span className={`num text-[22px] flex-1 ${isDone ? '' : 'text-sub'}`}>
                    {r.weight || 0}
                    <span className="font-sans text-[13px] text-sub ml-0.5 mr-2">kg</span>× {r.reps}
                    <span className="font-sans text-[13px] text-sub ml-0.5">회</span>
                    {r.drops.length > 0 && <span className="font-sans text-[13px] text-sub ml-2">+드롭 {r.drops.length}</span>}
                  </span>
                </button>
              );
            })}
            <button onClick={addSet} className="tap row w-full gap-2 text-[16px] font-medium text-sub shadow-[inset_0_1px_0_var(--sep)]">
              <Plus aria-hidden className="w-5 h-5" strokeWidth={2} /> 세트 추가
            </button>
          </div>
          <p className="px-1 mt-2 text-[12px] text-sub">덤벨은 한 손 무게로 적어요.</p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <RestPill />
            {!memoOpen && (
              <button onClick={() => setMemoOpen(true)} className="tap h-11 px-1 text-[15px] font-medium text-sub">메모 추가</button>
            )}
          </div>
          {open && !!supabase && !pushEnabled() && pushSupport() !== 'unsupported' && (
            <button onClick={onOpenAlerts} className="tap mt-2 h-11 px-1 text-[14px] font-medium text-sub flex items-center gap-1">
              애플워치로 휴식 끝 알림 받기 <span aria-hidden className="text-sub/60">›</span>
            </button>
          )}
          {memoOpen && (
            <div className="group-card mt-4">
              <input value={memo} onChange={(e) => setMemo(e.target.value)} aria-label="메모" placeholder="컨디션, 자세, 통증 등"
                className="w-full bg-transparent px-4 h-[52px] text-[16px] placeholder:text-sub/70 focus:outline-none" />
            </div>
          )}
        </div>

        {/* 엄지 영역: 큰 버튼 하나 */}
        <div className="shrink-0 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] bg-bg shadow-[0_-1px_0_var(--sep)]">
          <button onClick={primary} disabled={primaryDisabled} className="tap w-full h-[56px] rounded-[16px] bg-accent text-onaccent text-[18px] font-bold disabled:opacity-30">
            {primaryLabel}
          </button>
          <p className="text-center text-[13px] text-sub mt-2" aria-label="현재 입력 요약">
            볼륨 <span className="num text-ink text-[15px]">{vol.toLocaleString()}</span>kg · 추정 1RM <span className="num text-ink text-[15px]">{estimate1RM(finished.length ? finished : shown)}</span>kg
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
