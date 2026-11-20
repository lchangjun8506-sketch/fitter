import type { PoseKey } from '../data/muscles';

/**
 * 운동 자세 그림 (막대 인형, 직접 그림). viewBox 0 0 100 100
 * 몸 = 현재 글자색, 무게(원판·덤벨) = 강조색, 기구 = 회색
 */
const L = (d: string) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
const H = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="6.5" fill="currentColor"/>`;
const PL = (x: number, y: number, r = 8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="rgb(var(--accent))"/>`;
const DB = (x: number, y: number, v = false) =>
  v ? `<rect x="${x - 3.5}" y="${y - 6}" width="7" height="12" rx="2" fill="rgb(var(--accent))"/>` : `<rect x="${x - 6}" y="${y - 3.5}" width="12" height="7" rx="2" fill="rgb(var(--accent))"/>`;
const EQ = (d: string) => `<path d="${d}" fill="none" stroke="rgb(var(--sub))" stroke-opacity=".55" stroke-width="3.5" stroke-linecap="round"/>`;
const BAR = (x1: number, x2: number, y: number) => `<rect x="${x1}" y="${y - 2}" width="${x2 - x1}" height="4" rx="2" fill="currentColor"/>${PL(x1, y, 7)}${PL(x2, y, 7)}`;
const STAND = (x = 50) => `${H(x, 20)}${L(`M${x} 28 L${x} 60 M${x} 60 L${x - 7} 90 M${x} 60 L${x + 7} 90`)}`;

const POSES: Record<PoseKey, string> = {
  bench: `${EQ('M12 72 L72 72 M22 74 L22 90 M64 74 L64 90')}${H(20, 61)}${L('M27 64 L60 64 L74 76 L74 90')}${L('M40 63 L40 36')}${PL(40, 30, 9)}`,
  incline: `${EQ('M22 86 L44 46 M44 74 L72 74 M30 86 L30 92 M64 76 L64 92')}${H(36, 40)}${L('M40 48 L50 70 L66 72 L72 90')}${L('M44 54 L56 34')}${PL(58, 29, 9)}`,
  fly: `${EQ('M12 72 L72 72 M22 74 L22 90 M64 74 L64 90')}${H(20, 61)}${L('M27 64 L60 64 L74 76 L74 90')}${L('M40 63 L26 48 M40 63 L54 48')}${DB(24, 46, true)}${DB(56, 46, true)}`,
  dip: `${EQ('M20 46 L20 92 M80 46 L80 92 M14 46 L30 46 M70 46 L86 46')}${H(50, 30)}${L('M50 38 L50 64 L44 78 L50 90 M50 42 L30 46 M50 42 L70 46')}`,
  pushdown: `${EQ('M70 0 L70 44')}${STAND(46)}${L('M46 34 L52 52 L64 62')}<rect x="58" y="60" width="14" height="5" rx="2" fill="rgb(var(--accent))"/>`,
  lyingext: `${EQ('M12 72 L72 72 M22 74 L22 90 M64 74 L64 90')}${H(20, 61)}${L('M27 64 L60 64 L74 76 L74 90')}${L('M36 63 L30 40 L18 46')}${BAR(10, 26, 46)}`,
  overheadext: `${STAND()}${L('M50 34 L42 14 L56 26')}${DB(58, 28)}`,
  kickback: `${EQ('M60 70 L90 70 M66 72 L66 90')}${H(22, 36)}${L('M29 40 L62 50 L60 70 L56 90 M38 44 L40 64 M40 46 L54 40 L74 40')}${DB(78, 40)}`,
  machinepress: `${EQ('M30 40 L30 82 L56 82 M56 82 L56 92 M78 30 L78 92')}${H(36, 30)}${L('M36 38 L38 64 L60 66 L62 90 M38 44 L56 46 L74 46')}<rect x="72" y="40" width="6" height="12" rx="2" fill="rgb(var(--accent))"/>`,
  hinge: `${H(24, 36)}${L('M31 40 L62 50 L60 70 L58 90 M33 43 L35 72')}${PL(36, 78, 9)}`,
  row: `${H(26, 34)}${L('M33 38 L64 48 L60 70 L58 90 M66 50 L72 70 L74 90 M38 42 L44 56 L42 66')}${PL(44, 70, 8)}`,
  seatedrow: `${EQ('M88 30 L88 92 M20 82 L60 82')}${H(30, 34)}${L('M30 42 L32 70 L62 72 L74 72 M32 48 L50 56 L66 54')}<line x1="66" y1="54" x2="88" y2="54" stroke="rgb(var(--sub))" stroke-opacity=".55" stroke-width="2"/><rect x="62" y="50" width="6" height="9" rx="2" fill="rgb(var(--accent))"/>`,
  pulldown: `${EQ('M50 0 L50 8 M36 68 L64 68')}<rect x="22" y="8" width="56" height="4" rx="2" fill="currentColor"/>${H(50, 34)}${L('M50 42 L50 66 L70 66 L70 86 M50 46 L34 30 L28 12 M50 46 L66 30 L72 12')}`,
  pullup: `<rect x="16" y="6" width="68" height="4" rx="2" fill="rgb(var(--sub))" opacity=".55"/>${H(50, 26)}${L('M50 34 L50 62 L46 76 L54 90 M50 36 L34 24 L30 8 M50 36 L66 24 L70 8')}`,
  straightpull: `${EQ('M78 0 L78 30')}${H(36, 30)}${L('M38 38 L44 62 L40 90 M44 62 L50 90 M40 42 L58 64')}<rect x="52" y="62" width="14" height="5" rx="2" fill="rgb(var(--accent))"/>`,
  curl: `${STAND(46)}${L('M46 34 L52 56 L66 44')}${DB(68, 42, true)}`,
  ohp: `${H(50, 20)}${L('M50 28 L50 60 M50 60 L43 90 M50 60 L57 90 M50 34 L36 30 L36 12 M50 34 L64 30 L64 12')}${BAR(22, 78, 11)}`,
  lateral: `${STAND()}${L('M50 34 L22 38 M50 34 L78 38')}${DB(18, 38)}${DB(82, 38)}`,
  frontraise: `${STAND(40)}${L('M40 34 L72 32')}${DB(76, 32, true)}`,
  reardelt: `${H(26, 40)}${L('M33 44 L62 50 L60 70 L58 90 M40 46 L34 66 M42 46 L52 66')}${DB(32, 70, true)}${DB(54, 70, true)}`,
  facepull: `${EQ('M96 10 L96 60 M96 22 L66 24')}${STAND(40)}${L('M42 34 L56 30 L52 20 M42 36 L62 32 L60 24')}<rect x="54" y="19" width="12" height="5" rx="2" fill="rgb(var(--accent))"/>`,
  shrug: `${H(50, 18)}${L('M50 26 L50 60 M50 60 L43 90 M50 60 L57 90 M50 30 L36 34 L32 58 M50 30 L64 34 L68 58')}${DB(32, 62, true)}${DB(68, 62, true)}`,
  squat: `${H(40, 22)}${L('M44 30 L56 56 L36 62 L40 88 M56 56 L58 88 M46 34 L32 40')}${PL(45, 30, 8)}`,
  legpress: `${EQ('M14 88 L58 88 M20 88 L32 60 M74 20 L92 50')}${H(28, 52)}${L('M32 60 L48 80 L66 58 L82 36')}<rect x="76" y="26" width="18" height="6" rx="2" fill="rgb(var(--accent))" transform="rotate(-30 85 29)"/>`,
  legext: `${EQ('M22 40 L22 74 L56 74 M56 74 L56 92')}${H(30, 30)}${L('M30 38 L32 68 L56 68 L80 58')}<circle cx="80" cy="60" r="5" fill="rgb(var(--accent))"/>`,
  legcurl: `${EQ('M10 66 L70 66 M20 68 L20 90 M62 68 L62 90')}${H(14, 54)}${L('M20 58 L52 60 L70 60 L78 42')}<circle cx="78" cy="40" r="5" fill="rgb(var(--accent))"/>`,
  hipmachine: `${EQ('M30 40 L30 80 L60 80 M60 80 L60 92')}${H(38, 30)}${L('M38 38 L40 72 L62 72 L60 92 M40 72 L74 64 L76 90')}<rect x="70" y="58" width="6" height="12" rx="2" fill="rgb(var(--accent))"/>`,
  hipthrust: `${EQ('M10 52 L30 52 M18 54 L18 90')}${H(18, 42)}${L('M24 48 L60 46 L70 66 L68 90 M60 46 L58 46')}${PL(52, 38, 8)}`,
  calf: `${EQ('M30 90 L62 90')}${H(46, 16)}${L('M46 24 L46 56 L42 82 L44 86 M46 56 L50 82 L52 86 M46 30 L34 50 M46 30 L58 50')}${DB(34, 54, true)}${DB(58, 54, true)}`,
  lunge: `${H(44, 18)}${L('M44 26 L46 56 L66 64 L66 90 M46 56 L30 72 L18 88 M44 32 L36 52 M44 32 L54 52')}${DB(36, 56, true)}${DB(54, 56, true)}`,
};

export default function Pose({ pose, size = 44, className = '' }: { pose: PoseKey; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`text-ink ${className}`} aria-hidden dangerouslySetInnerHTML={{ __html: POSES[pose] }} />
  );
}

/** 목록용 정사각 칸 */
export function PoseTile({ pose, size = 52 }: { pose: PoseKey; size?: number }) {
  return (
    <span className="grid place-items-center rounded-[14px] bg-fill shrink-0" style={{ width: size, height: size }}>
      <Pose pose={pose} size={size * 0.82} />
    </span>
  );
}
