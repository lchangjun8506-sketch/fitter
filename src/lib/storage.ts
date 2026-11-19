import type { CustomExercise, NewLog, WorkoutLog } from './types';
import { nowStr } from './date';
import { DEMO_LOGS } from '../data/demo';

/**
 * 저장소 추상화.
 * UI는 이 인터페이스만 알기 때문에, 나중에 Supabase/Firebase로 옮길 때
 * 이 파일에 Repo 구현 하나만 추가하면 됩니다.
 */
export interface Repo {
  readonly kind: 'local' | 'sheets';
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

const SHEETS_URL = import.meta.env.VITE_SHEETS_API_URL as string | undefined;
export const repo: Repo = SHEETS_URL ? new SheetsRepo(SHEETS_URL) : new LocalRepo();
