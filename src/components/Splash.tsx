import { useEffect, useState } from 'react';

type Phase = 'wait' | 'in' | 'out' | 'done';

const KEY = 'fitter.splashShown';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 실행 시 한 번만: 검은 화면에 FITTER 워드마크 → 앱 화면으로 페이드 전환. 탭하면 건너뜀 */
export default function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>(() => {
    try {
      return sessionStorage.getItem(KEY) ? 'done' : 'wait';
    } catch {
      return 'wait';
    }
  });

  useEffect(() => {
    // 스플래시가 사라지기 시작할 때 앱이 함께 떠오르도록(크로스페이드)
    if (phase === 'out' || phase === 'done') {
      onDone();
      return;
    }
    if (phase !== 'wait') return;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* noop */
    }
    // 폰트가 준비된 뒤 등장시켜 글꼴이 바뀌며 깜빡이지 않게
    const fontTimeout = new Promise((r) => setTimeout(r, 600));
    Promise.race([document.fonts?.ready ?? Promise.resolve(), fontTimeout]).then(() => setPhase('in'));
  }, [phase, onDone]);

  useEffect(() => {
    if (phase === 'in') {
      const t = setTimeout(() => setPhase('out'), reduced() ? 600 : 1300);
      return () => clearTimeout(t);
    }
    if (phase === 'out') {
      const t = setTimeout(() => setPhase('done'), reduced() ? 150 : 450);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      onClick={() => setPhase('out')}
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-[#F2ECDF] transition-opacity duration-[450ms] ease-apple ${phase === 'out' ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className={`relative font-display text-[#141414] text-[96px] leading-[0.86] ${phase === 'wait' ? 'opacity-0' : 'splash-in'}`}>
        <span className={`absolute -right-12 -top-5 w-9 h-[14px] rounded-[2px] bg-[#DA2E22] ${phase === 'wait' ? 'scale-x-0' : 'splash-tag'}`} />
        <div>FIT</div>
        <div>TER</div>
      </div>
    </div>
  );
}
