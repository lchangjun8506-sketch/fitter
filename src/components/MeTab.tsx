import { useState } from 'react';
import { Share } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { pendingLocal, type CloudRepo } from '../lib/storage';
import { errText } from '../lib/supabase';
import LoginPanel from './LoginPanel';
import NicknameForm from './NicknameForm';
import InBodySection from './InBodySection';
import { shareHandle } from './BattleTab';

export default function MeTab({ toast, cloud, onImported }: { toast: (m: string) => void; cloud: CloudRepo | null; onImported: () => void }) {
  const { ready, session, handle, signOut } = useAuth();
  const [editNick, setEditNick] = useState(false);
  const [localCount, setLocalCount] = useState(() => pendingLocal.logs().length);
  const [moving, setMoving] = useState(false);

  if (!ready) return null;
  if (!session) return <LoginPanel reason="로그인하면 기록이 서버에 저장되고, 인바디 결과지를 올려 체성분 변화를 볼 수 있어요." />;
  if (!handle || editNick) return <NicknameForm current={handle ?? undefined} onDone={() => setEditNick(false)} />;

  const provider = session.user.app_metadata?.provider as string | undefined;

  return (
    <div className="space-y-6">
      <section className="group-card">
        <div className="row justify-between py-3">
          <div className="min-w-0">
            <div className="text-[22px] font-bold truncate">{handle}</div>
            <div className="text-[13px] text-sub">{{ kakao: '카카오', google: 'Google', apple: 'Apple' }[provider ?? ''] ?? ''} 계정으로 로그인됨</div>
          </div>
          <button onClick={() => shareHandle(handle, toast)} aria-label="아이디 공유" className="tap w-11 h-11 -mr-2 grid place-items-center text-accent">
            <Share aria-hidden className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
        <button onClick={() => setEditNick(true)} className="tap row w-full text-[16px]">닉네임 변경</button>
      </section>

      {localCount > 0 && cloud && (
        <section className="group-card px-4 py-3.5 space-y-3">
          <p className="text-[15px] leading-relaxed">로그인 전에 이 기기에 저장한 운동 기록 <b className="font-semibold">{localCount}개</b>가 있어요. 계정으로 옮길까요?</p>
          <button
            disabled={moving}
            onClick={async () => {
              setMoving(true);
              try {
                await cloud.importLogs(pendingLocal.logs());
                for (const c of pendingLocal.custom()) await cloud.addCustom(c);
                pendingLocal.clear();
                setLocalCount(0);
                toast('기록을 계정으로 옮겼어요');
                onImported();
              } catch (e) {
                toast(errText(e));
              } finally {
                setMoving(false);
              }
            }}
            className="tap w-full h-11 rounded-[10px] bg-accent text-onaccent text-[15px] font-semibold disabled:opacity-50"
          >
            {moving ? '옮기는 중…' : '계정으로 옮기기'}
          </button>
        </section>
      )}

      <InBodySection toast={toast} />

      <section className="group-card">
        <button onClick={() => confirm('로그아웃할까요?') && signOut()} className="tap row w-full text-[16px] text-down">로그아웃</button>
      </section>
    </div>
  );
}
