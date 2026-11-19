import { useCallback, useEffect, useState } from 'react';
import type { Repo } from './storage';
import { sortLogs } from './analysis';
import type { CustomExercise, NewLog, WorkoutLog } from './types';

export function useWorkout(repo: Repo) {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [custom, setCustom] = useState<CustomExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([repo.listLogs(), repo.listCustom()]);
      setLogs(sortLogs(l));
      setCustom(c);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const wrap = <A extends unknown[]>(fn: (...a: A) => Promise<unknown>) =>
    async (...a: A) => {
      setLoading(true);
      try {
        await fn(...a);
        await refresh();
      } finally {
        setLoading(false);
      }
    };

  return {
    logs,
    custom,
    loading,
    error,
    mode: repo.kind,
    refresh,
    add: wrap((log: NewLog) => repo.addLog(log)),
    update: wrap((log: WorkoutLog) => repo.updateLog(log)),
    remove: wrap((id: string) => repo.deleteLog(id)),
    addCustom: wrap((c: CustomExercise) => repo.addCustom(c)),
  };
}
