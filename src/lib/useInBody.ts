import { useCallback, useEffect, useState } from 'react';
import { listInBody, type InBodyRecord } from './inbody';

/** 로그인했을 때만 인바디 기록을 불러옴 (MY 대시보드·분석·AI 추천이 함께 씀) */
export function useInBody(userId: string | undefined) {
  const [records, setRecords] = useState<InBodyRecord[]>([]);
  const reload = useCallback(() => {
    if (!userId) return setRecords([]);
    listInBody().then(setRecords).catch(() => setRecords([]));
  }, [userId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { records, reload };
}
