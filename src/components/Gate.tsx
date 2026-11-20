import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { LoginButtons } from './LoginPanel';

/**
 * 시작 화면 겸 로그인 관문.
 *  intro   : 가운데 FIT/TER 등장
 *  signin  : 같은 글자가 위로 올라가 작아지고, 아래에서 로그인 버튼이 올라옴 (한 화면처럼 이어짐)
 *  leaving : 로그인 확인 → 관문이 사라지며 앱이 떠오름
 *  open    : 앱 사용 중 (관문 없음). 로그아웃하면 다시 intro → signin
 * 로그인 기능(Supabase)이 설정되지 않은 환경에서는 intro 뒤 바로 앱으로.
 */
type Phase = 'wait' | 'intro' | 'signin' | 'leaving' | 'open';

const KEY = 'fitter.splashShown';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const seenThisSession = () => {
  try {
    return !!sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
};

export default function Gate({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { enabled, ready, session } = useAuth();
  // 같은 세션에서 새로고침했으면 인트로 생략
  const [phase, setPhase] = useState<Phase>(() => (seenThisSession() ? 'intro' : 'wait'));
  const [introDone, setIntroDone] = useState(() => seenThisSession());
  const [instant, setInstant] = useState(() => seenThisSession()); // 애니메이션 없이 바로 배치
  const allowed = !enabled || !!session;
  const wasOpen = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const auth = useRef<HTMLElement>(null);

  // 로그인 영역(버튼 묶음 + 아래 여백) 높이의 절반만큼 올리면 남은 공간의 정가운데
  useLayoutEffect(() => {
    const measure = () => {
      const el = auth.current, box = root.current;
      if (!el || !box) return;
      const fromBottom = box.clientHeight - el.offsetTop;
      box.style.setProperty('--lift', `${Math.round(fromBottom / 2)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  // 폰트 준비 후 인트로 시작 (글꼴이 바뀌며 깜빡이지 않게)
  useEffect(() => {
    if (phase !== 'wait') return;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* noop */
    }
    const timeout = new Promise((r) => setTimeout(r, 600));
    Promise.race([document.fonts?.ready ?? Promise.resolve(), timeout]).then(() => setPhase('intro'));
  }, [phase]);

  // 인트로 최소 노출 시간
  useEffect(() => {
    if (phase !== 'intro' || introDone) return;
    const t = setTimeout(() => setIntroDone(true), reduced() ? 500 : 1300);
    return () => clearTimeout(t);
  }, [phase, introDone]);

  // 상태 결정
  useEffect(() => {
    if (phase === 'intro' && introDone && ready) setPhase(allowed ? 'leaving' : 'signin');
    else if (phase === 'signin' && allowed) setPhase('leaving');
    else if (phase === 'open' && ready && !allowed) {
      // 로그아웃: 앱을 덮고 처음 화면부터 다시
      setInstant(false);
      setIntroDone(false);
      setPhase('intro');
    }
  }, [phase, introDone, ready, allowed]);

  useEffect(() => {
    if (phase === 'leaving') {
      const t = setTimeout(() => setPhase('open'), reduced() ? 100 : 450);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // 앱에 알림: leaving부터 앱이 함께 떠오르도록(크로스페이드)
  const open = phase === 'leaving' || phase === 'open';
  useEffect(() => {
    if (open !== wasOpen.current) {
      wasOpen.current = open;
      onOpenChange(open);
    }
  }, [open, onOpenChange]);

  // 첫 배치 이후에는 애니메이션 다시 켜기
  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  if (phase === 'open') return null;

  return (
    <div
      ref={root}
      className={`gate fixed inset-0 z-[100] bg-[#F4F4F4] text-[#263238] ${phase === 'leaving' ? 'gate-leaving' : ''} ${phase === 'signin' ? 'gate-signin' : ''} ${instant ? 'gate-instant' : ''}`}
      onClick={() => phase === 'intro' && setIntroDone(true)}
    >
      {/* 바깥: 위치·이동(로그인 단계에서 위로) / 안쪽: 등장 애니메이션 — 둘 다 transform을 써서 층을 나눔 */}
      <div className="gate-mark" aria-hidden>
        <div className={`relative ${phase === 'wait' ? 'opacity-0' : 'splash-in'}`}>
          <span className={`gate-tag ${phase === 'wait' ? 'scale-x-0' : 'splash-tag'}`} />
          <div>FIT</div>
          <div>TER</div>
        </div>
      </div>

      <section ref={auth} className="gate-auth" aria-hidden={phase !== 'signin'} aria-label="로그인">
        <div className="text-center mb-2">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">로그인</h1>
          <p className="mt-1.5 text-[15px] text-[#5F6B71]">카카오 또는 구글 계정으로 시작하세요.</p>
        </div>
        <LoginButtons />
        <p className="text-center text-[12px] text-[#5F6B71]">운동 기록은 계정에 저장돼요</p>
      </section>
    </div>
  );
}
