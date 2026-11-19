import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomExercise, NewLog, Routine, WorkoutLog } from './types';
import { nowStr } from './date';
import { DEMO_LOGS } from '../data/demo';

/**
 * 저장소 추상화.
 * UI는 이 인터페이스만 알기 때문에, 나중에 Supabase/Firebase로 옮길 때
 * 이 파일에 Repo 구현 하나만 추가하면 됩니다.
 */
export interface Repo {
  readonly kind: 'local' | 'sheets' | 'cloud';
  listLogs(): Promise<WorkoutLog[]>;
  addLog(log: NewLog): Promise<WorkoutLog>;
  updateLog(log: WorkoutLog): Promise<void>;
  deleteLog(id: string): Promise<void>;
  listCustom(): Promise<CustomExercise[]>;
  addCustom(item: CustomExercise): Promise<void>;
}

/* ---------- 1) 브라우저 로컬 저장소 (오프라인/개발용) ---------- */
const LS_LOGS = 'fitter.logs.v2';
const LS_CUSTOM = 'fitter.custom.v2';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 사파리 사생활 보호 모드 등 */
  }
}

class LocalRepo implements Repo {
  readonly kind = 'local' as const;
  constructor() {
    const isDemo = new URLSearchParams(location.search).has('demo');
    if (isDemo && read<WorkoutLog[]>(LS_LOGS, []).length === 0) write(LS_LOGS, DEMO_LOGS);
  }
  async listLogs() {
    return read<WorkoutLog[]>(LS_LOGS, []);
  }
  async addLog(log: NewLog) {
    const created: WorkoutLog = { ...log, id: `LOG_${Date.now()}`, createdAt: nowStr() };
    write(LS_LOGS, [created, ...read<WorkoutLog[]>(LS_LOGS, [])]);
    return created;
  }
  async updateLog(log: WorkoutLog) {
    write(LS_LOGS, read<WorkoutLog[]>(LS_LOGS, []).map((l) => (l.id === log.id ? log : l)));
  }
  async deleteLog(id: string) {
    write(LS_LOGS, read<WorkoutLog[]>(LS_LOGS, []).filter((l) => l.id !== id));
  }
  async listCustom() {
    return read<CustomExercise[]>(LS_CUSTOM, []);
  }
  async addCustom(item: CustomExercise) {
    write(LS_CUSTOM, [...read<CustomExercise[]>(LS_CUSTOM, []), item]);
  }
}

/* ---------- 2) 기존 구글 시트 (Apps Script JSON API) ---------- */
class SheetsRepo implements Repo {
  readonly kind = 'sheets' as const;
  constructor(private url: string) {}

  private async call<T>(action: string, payload?: unknown): Promise<T> {
    // text/plain 으로 보내야 CORS preflight 없이 Apps Script에 도달합니다.
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '서버 오류');
    return json.data as T;
  }
  listLogs() {
    return this.call<WorkoutLog[]>('getLogs');
  }
  addLog(log: NewLog) {
    return this.call<WorkoutLog>('addLog', log);
  }
  async updateLog(log: WorkoutLog) {
    await this.call('updateLog', log);
  }
  async deleteLog(id: string) {
    await this.call('deleteLog', { id });
  }
  listCustom() {
    return this.call<CustomExercise[]>('getCustomExercises');
  }
  async addCustom(item: CustomExercise) {
    await this.call('addCustomExercise', item);
  }
}

/* ---------- 3) Supabase (로그인 계정) ---------- */
type LogRow = { id: string; date: string; routine: string; exercise: string; sets: WorkoutLog['sets']; memo: string | null; created_at: string };
const fromRow = (r: LogRow): WorkoutLog => ({
  id: r.id, date: r.date, routine: r.routine as Routine, exercise: r.exercise, sets: r.sets,
  memo: r.memo ?? undefined, createdAt: r.created_at,
});

export class CloudRepo implements Repo {
  readonly kind = 'cloud' as const;
  constructor(private sb: SupabaseClient) {}
  private ok<T>({ data, error }: { data: T; error: unknown }): T {
    if (error) throw error;
    return data;
  }
  async listLogs() {
    const rows = this.ok(await this.sb.from('workout_logs').select('*').order('date', { ascending: false }).limit(5000));
    return (rows as LogRow[]).map(fromRow);
  }
  async addLog(log: NewLog) {
    const row = this.ok(await this.sb.from('workout_logs')
      .insert({ date: log.date, routine: log.routine, exercise: log.exercise, sets: log.sets, memo: log.memo ?? null })
      .select().single());
    return fromRow(row as LogRow);
  }
  async updateLog(log: WorkoutLog) {
    this.ok(await this.sb.from('workout_logs')
      .update({ date: log.date, routine: log.routine, exercise: log.exercise, sets: log.sets, memo: log.memo ?? null })
      .eq('id', log.id));
  }
  async deleteLog(id: string) {
    this.ok(await this.sb.from('workout_logs').delete().eq('id', id));
  }
  async listCustom() {
    return this.ok(await this.sb.from('custom_exercises').select('routine, exercise')) as CustomExercise[];
  }
  async addCustom(item: CustomExercise) {
    this.ok(await this.sb.from('custom_exercises').upsert(item, { onConflict: 'user_id,routine,exercise', ignoreDuplicates: true }));
  }
  /** 이 기기 기록을 계정으로 한 번에 옮기기 */
  async importLogs(logs: WorkoutLog[]) {
    if (!logs.length) return;
    this.ok(await this.sb.from('workout_logs').insert(
      logs.map((l) => ({ date: l.date, routine: l.routine, exercise: l.exercise, sets: l.sets, memo: l.memo ?? null })),
    ));
  }
}

const SHEETS_URL = import.meta.env.VITE_SHEETS_API_URL as string | undefined;
/** 로그인하지 않았을 때 쓰는 저장소 (이 기기 또는 구글 시트) */
export const deviceRepo: Repo = SHEETS_URL ? new SheetsRepo(SHEETS_URL) : new LocalRepo();

/** 로그인 전 이 기기에 쌓인 기록 (계정 이전용) */
export const pendingLocal = {
  logs: () => read<WorkoutLog[]>(LS_LOGS, []),
  custom: () => read<CustomExercise[]>(LS_CUSTOM, []),
  clear: () => {
    write(LS_LOGS, []);
    write(LS_CUSTOM, []);
  },
};
