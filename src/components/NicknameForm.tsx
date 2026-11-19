import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { errText } from '../lib/supabase';

export default function NicknameForm({ current, onDone }: { current?: string; onDone?: () => void }) {
  const { claimNickname } = useAuth();
  const [nick, setNick] = useState(current?.split('-')[0] ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^[가-힣A-Za-z0-9_]{2,12}$/.test(nick.trim());

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[20px] font-bold">닉네임 정하기</h2>
        <p className="text-[14px] text-sub mt-1">닉네임 뒤에 숫자 4자리가 붙어 나만의 아이디가 돼요. 예: 차앵-0164</p>
      </div>
      <div className="group-card flex items-center pr-4">
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          aria-label="닉네임"
          placeholder="한글·영문·숫자 2~12자"
          maxLength={12}
          autoComplete="nickname"
          className="flex-1 min-w-0 bg-transparent px-4 h-[52px] text-[17px] placeholder:text-sub/70 focus:outline-none"
        />
        <span className="num text-[20px] text-sub">-0000</span>
      </div>
      {err && <p role="alert" className="px-1 text-[14px] text-down">{err}</p>}
      <button
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await claimNickname(nick.trim());
            onDone?.();
          } catch (e) {
            setErr(errText(e));
          } finally {
            setBusy(false);
          }
        }}
        className="tap w-full h-[52px] rounded-[14px] bg-accent text-onaccent text-[17px] font-semibold disabled:opacity-30"
      >
        {busy ? '확인 중…' : current ? '변경하기' : '아이디 만들기'}
      </button>
    </section>
  );
}
