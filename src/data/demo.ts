import type { WorkoutLog } from '../lib/types';

const s = (weight: number, reps: number) => ({ weight, reps });

export const DEMO_LOGS: WorkoutLog[] = [
  { id: 'D1', date: '2026-11-18', routine: '하체', exercise: '스쿼트', sets: [s(85, 10), s(85, 9), s(85, 8)], createdAt: '2026-11-18 21:00:00' },
  { id: 'D2', date: '2026-11-18', routine: '하체', exercise: '레그 프레스', sets: [s(130, 12), s(130, 12), s(130, 10)], createdAt: '2026-11-18 21:30:00' },
  { id: 'D3', date: '2026-11-17', routine: '가슴·삼두', exercise: '벤치 프레스', sets: [s(62.5, 10), s(62.5, 9), { weight: 62.5, reps: 8, drops: [{ weight: 40, reps: 6 }] }], memo: '컨디션 최고', createdAt: '2026-11-17 20:00:00' },
  { id: 'D4', date: '2026-11-17', routine: '가슴·삼두', exercise: '덤벨 벤치 프레스', sets: [s(20, 10), s(20, 10), s(20, 8)], createdAt: '2026-11-17 20:30:00' },
  { id: 'D5', date: '2026-11-15', routine: '등·이두', exercise: '랫 풀 다운', sets: [s(45, 12), s(45, 12), s(45, 10)], createdAt: '2026-11-15 19:30:00' },
  { id: 'D6', date: '2026-11-14', routine: '하체', exercise: '스쿼트', sets: [s(80, 10), s(80, 10), s(80, 8)], createdAt: '2026-11-14 21:00:00' },
  { id: 'D7', date: '2026-11-13', routine: '가슴·삼두', exercise: '벤치 프레스', sets: [s(60, 10), s(60, 10), s(60, 9)], createdAt: '2026-11-13 20:00:00' },
  { id: 'D8', date: '2026-11-12', routine: '어깨', exercise: '사이드 레터럴 레이즈', sets: [s(8, 15), s(8, 15), s(8, 12)], createdAt: '2026-11-12 21:00:00' },
  { id: 'D9', date: '2026-11-10', routine: '가슴·삼두', exercise: '덤벨 벤치 프레스', sets: [s(20, 10), s(20, 9), s(20, 8)], createdAt: '2026-11-10 20:30:00' },
  { id: 'D10', date: '2026-11-08', routine: '하체', exercise: '레그 프레스', sets: [s(130, 12), s(130, 11), s(130, 10)], createdAt: '2026-11-08 21:30:00' },
  { id: 'D11', date: '2026-11-06', routine: '가슴·삼두', exercise: '덤벨 벤치 프레스', sets: [s(20, 10), s(20, 10), s(20, 8)], createdAt: '2026-11-06 20:30:00' },
];
