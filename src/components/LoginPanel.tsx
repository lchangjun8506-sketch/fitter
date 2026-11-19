import { useState } from 'react';
import { useAuth, type Provider } from '../lib/auth';
import { errText } from '../lib/supabase';

/** 각 회사 로고 가이드에 맞춘 버튼 색 (카카오 노랑, 애플 검정, 구글 흰색) */
const BUTTONS: { id: Provider; label: string; cls: string; logo: JSX.Element }[] = [
  {
    id: 'kakao',
    label: '카카오로 계속하기',
    cls: 'bg-[#FEE500] text-[#191919]',
    logo: (
      <svg aria-hidden viewBox="0 0 24 24" className="w-5 h-5"><path fill="#191919" d="M12 3C6.48 3 2 6.5 2 10.82c0 2.8 1.88 5.25 4.7 6.63l-.95 3.48c-.08.3.26.54.52.37l4.15-2.74c.52.06 1.05.1 1.58.1 5.52 0 10-3.5 10-7.84S17.52 3 12 3z" /></svg>
    ),
  },
  {
    id: 'google',
    label: 'Google로 계속하기',
    cls: 'bg-white text-[#1F1F1F] shadow-[inset_0_0_0_1px_#747775]',
    logo: (
      <svg aria-hidden viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
    ),
  },
  {
    id: 'apple',
    label: 'Apple로 계속하기',
    cls: 'bg-black text-white dark:bg-white dark:text-black',
    logo: (
      <svg aria-hidden viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M16.37 12.53c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.53zM14.18 6.06c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23z" /></svg>
    ),
  },
];

export default function LoginPanel({ reason }: { reason: string }) {
  const { enabled, signIn } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);

  if (!enabled) {
    return (
      <div className="group-card px-4 py-5 text-[15px] text-sub leading-relaxed">
        서버가 아직 연결되지 않았어요. 관리자가 Supabase 설정을 마치면 로그인할 수 있어요.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <p className="px-1 text-[15px] text-sub leading-relaxed">{reason}</p>
      {BUTTONS.map((b) => (
        <button
          key={b.id}
          disabled={!!busy}
          onClick={async () => {
            setErr(null);
            setBusy(b.id);
            try {
              await signIn(b.id); // 로그인 페이지로 이동
            } catch (e) {
              setErr(errText(e));
              setBusy(null);
            }
          }}
          className={`tap w-full h-[52px] rounded-[12px] flex items-center justify-center gap-2 text-[16px] font-semibold disabled:opacity-60 ${b.cls}`}
        >
          {b.logo}
          {busy === b.id ? '이동 중…' : b.label}
        </button>
      ))}
      {err && <p role="alert" className="px-1 text-[14px] text-down">{err}</p>}
      <p className="px-1 text-[12px] text-sub">로그인하면 운동 기록이 서버에 안전하게 저장되고, 휴대폰을 바꿔도 이어서 쓸 수 있어요.</p>
    </section>
  );
}
