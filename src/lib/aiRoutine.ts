import { supabase } from './supabase';
import { topReps, topWeight } from './analysis';
import { todayStr } from './date';
import type { InBodyRecord } from './inbody';
import type { Recommendation } from './recommend';
import type { Routine, WorkoutLog, WorkoutSet } from './types';

export interface AiPlan {
  routine: Routine;
  title: string;
  summary: string;
  warmup: string;
  items: { exercise: string; sets: WorkoutSet[]; tip: string }[];
  caution: string | null;
}

/** AI에 보낼 요약: 원본 기록 전체가 아니라 종목별 최근 4회 핵심 수치만 (비용·개인정보 최소화) */
function summarize(logs: WorkoutLog[], inbody: InBodyRecord[], baseline: Recommendation, request: string) {
  const since = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    return todayStr(d);
  })();
  const byEx = new Map<string, { routine: string; sessions: string[] }>();
  for (const l of logs) {
    if (l.date < since) continue;
    const e = byEx.get(l.exercise) ?? { routine: l.routine, sessions: [] };
    if (e.sessions.length < 4) e.sessions.push(`${l.date} ${topWeight(l.sets)}kg×${topReps(l.sets)} ${l.sets.length}세트`);
    byEx.set(l.exercise, e);
  }
  const lastByRoutine: Record<string, string | null> = {};
  for (const r of ['가슴·삼두', '등·이두', '어깨', '하체']) lastByRoutine[r] = logs.find((l) => l.routine === r)?.date ?? null;
  const pick = (r?: InBodyRecord) =>
    r && { date: r.measured_at, weight: r.weight, skeletal_muscle: r.skeletal_muscle, body_fat_pct: r.body_fat_pct, inbody_score: r.inbody_score };
  return {
    today: todayStr(),
    request: request.trim().slice(0, 200) || null,
    last_trained_by_routine: lastByRoutine,
    exercises: Object.fromEntries(byEx),
    inbody_latest: pick(inbody[0]) ?? null,
    inbody_previous: pick(inbody[1]) ?? null,
    baseline: { routine: baseline.routine, items: baseline.items.map((i) => `${i.exercise}: ${i.note}`) },
  };
}

export async function askAiRoutine(logs: WorkoutLog[], inbody: InBodyRecord[], baseline: Recommendation, request: string): Promise<AiPlan> {
  if (!supabase) throw new Error('로그인 기능이 설정되지 않았어요');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('AI 추천은 로그인 후 쓸 수 있어요');
  const res = await fetch('/api/routine', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(summarize(logs, inbody, baseline, request)),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `AI 추천 실패 (${res.status})`);
  return body.plan as AiPlan;
}
