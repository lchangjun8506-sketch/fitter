/**
 * 저장 전 진행 중인 세트 (시트를 닫았다 열어도, 새로고침해도 유지)
 * 키: 날짜|종목
 */
export interface DraftRow {
  weight: string;
  reps: string;
  drops: { weight: string; reps: string }[];
}
export interface Draft {
  rows: DraftRow[];
  done: number;
  memo: string;
}

const KEY = 'fitter.drafts';

const readAll = (): Record<string, Draft> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
};
const writeAll = (v: Record<string, Draft>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* noop */
  }
};

export const draftKey = (date: string, exercise: string) => `${date}|${exercise}`;

export function getDraft(key: string): Draft | null {
  return readAll()[key] ?? null;
}

export function setDraft(key: string, d: Draft | null) {
  const all = readAll();
  // 오늘 이전 것은 정리
  const today = key.split('|')[0];
  for (const k of Object.keys(all)) if (k.split('|')[0] < today) delete all[k];
  if (d && d.done > 0) all[key] = d;
  else delete all[key];
  writeAll(all);
  window.dispatchEvent(new Event('fitter-drafts'));
}
