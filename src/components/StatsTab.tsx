import { useAuth } from '../lib/auth';
import type { InBodyRecord } from '../lib/inbody';
import type { WorkoutLog } from '../lib/types';
import Segmented from './Segmented';
import Dashboard from './Dashboard';
import InBodySection from './InBodySection';
import BodyInsights from './BodyInsights';
import type { BodyGoal } from '../lib/body';
import LoginPanel from './LoginPanel';
import NicknameForm from './NicknameForm';

export type StatsSub = 'workout' | 'inbody';

interface Props {
  sub: StatsSub;
  onSub: (s: StatsSub) => void;
  logs: WorkoutLog[];
  inbody: InBodyRecord[];
  reloadInBody: () => void;
  toast: (m: string) => void;
  goal: BodyGoal | null;
  saveGoal: (g: BodyGoal | null) => Promise<void>;
}

export default function StatsTab({ sub, onSub, logs, inbody, reloadInBody, toast, goal, saveGoal }: Props) {
  const { ready, session, handle } = useAuth();
  return (
    <div className="space-y-6">
      <Segmented<StatsSub> label="분석 메뉴" value={sub} onChange={onSub} options={[{ id: 'workout', label: '운동' }, { id: 'inbody', label: '인바디' }]} />
      {sub === 'workout' ? (
        <Dashboard logs={logs} />
      ) : !ready ? null : !session ? (
        <LoginPanel reason="인바디 결과지를 올리면 휴대폰에서 바로 수치를 읽어 기록해요(무료). 기록은 계정에 저장되니 로그인해 주세요." />
      ) : !handle ? (
        <NicknameForm />
      ) : (
        <>
          <BodyInsights records={inbody} logs={logs} goal={goal} saveGoal={saveGoal} />
          <InBodySection toast={toast} records={inbody} reload={reloadInBody} />
        </>
      )}
    </div>
  );
}
