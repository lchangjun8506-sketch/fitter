import { useId } from 'react';
import type { Muscle } from '../data/muscles';

/**
 * 해부도 스타일 인체 (정면/후면). 왼쪽 절반을 그리고 거울 복사.
 * 직접 그린 도형 (외부 그림 사용 안 함). viewBox 0 0 200 460, 가운데 x=100
 */
type Part = [Muscle | 'neck' | 'hands' | 'feet' | 'knees', string];

const BASE =
  'M100 6 C84 6 77 20 78 38 C78 50 82 60 88 66 L86 76 C74 82 60 86 50 92 C38 98 32 112 32 128 C28 150 26 175 28 196 C24 220 20 245 22 268 C20 280 24 296 34 298 C42 296 44 284 42 270 C46 248 52 226 56 202 C60 186 62 170 64 152 C66 176 70 200 72 224 C66 240 62 262 62 290 C62 318 66 336 70 350 C64 372 62 396 66 420 C64 430 60 440 64 446 L86 448 C90 440 88 428 86 418 C90 396 92 374 90 352 C94 330 98 300 100 262 Z';

const ARM_F = 'M33 196 C28 214 25 236 26 260 C30 266 38 266 42 262 C46 240 52 220 56 200 C50 204 42 204 33 196 Z';
const HAND = 'M26 264 C22 274 24 290 32 296 C40 296 44 286 42 266 C38 270 30 270 26 264 Z';
const NECK = 'M89 58 C90 66 90 72 88 78 L100 82 L100 62 C95 62 92 61 89 58 Z';

const FRONT: Part[] = [
  ['neck', NECK],
  ['traps', 'M88 74 C80 80 68 84 58 90 C68 92 78 90 86 86 C92 84 96 82 100 82 L100 80 C96 78 92 76 88 74 Z'],
  ['delts', 'M57 91 C44 95 36 106 35 122 C35 134 38 144 44 150 C48 136 56 124 64 114 C70 106 76 98 84 92 C76 90 66 90 57 91 Z'],
  ['chest', 'M100 88 C92 88 86 90 82 94 C74 102 68 112 64 124 C68 136 78 142 92 142 C96 142 99 141 100 140 Z'],
  ['biceps', 'M45 152 C40 164 38 178 40 192 C44 200 52 200 56 194 C60 180 62 160 63 134 C56 138 50 144 45 152 Z'],
  ['triceps', 'M35 128 C31 146 30 168 33 190 L39 193 C37 178 39 164 44 152 C39 146 36 138 35 128 Z'],
  ['forearms', ARM_F],
  ['hands', HAND],
  ['abs', 'M100 146 L88 146 C86 170 86 196 88 222 C92 232 96 238 100 240 Z'],
  ['obliques', 'M66 130 C66 156 70 182 74 206 C78 214 82 220 86 224 C84 196 84 170 86 146 C78 144 70 140 66 130 Z'],
  ['quads', 'M74 230 C66 254 62 284 64 312 C66 330 72 342 80 346 C88 342 92 330 92 314 C94 290 96 266 96 250 C90 244 82 238 74 230 Z'],
  ['adductors', 'M96 252 C95 276 93 300 92 320 C96 310 99 290 100 266 L100 250 Z'],
  ['knees', 'M70 344 C68 352 70 358 76 360 C84 360 90 354 90 344 C84 348 76 348 70 344 Z'],
  ['calves', 'M70 356 C64 374 62 396 66 418 L80 420 C84 404 88 386 88 364 C84 356 76 352 70 356 Z'],
  ['feet', 'M66 424 C62 432 58 442 64 448 L86 450 C88 440 86 430 82 424 Z'],
];
const BACK: Part[] = [
  ['neck', NECK],
  ['traps', 'M100 64 C94 72 86 80 74 86 C66 90 60 92 58 94 C72 98 84 104 92 118 C96 128 98 140 100 150 Z'],
  ['delts', 'M57 93 C44 96 36 106 35 120 C35 132 38 142 44 148 C48 132 56 118 66 108 C72 102 78 98 84 96 C76 93 66 92 57 93 Z'],
  ['lats', 'M68 110 C66 128 66 150 72 172 C78 190 88 204 98 212 L100 212 L100 156 C94 140 88 124 80 114 C76 110 72 108 68 110 Z'],
  ['triceps', 'M44 150 C38 162 36 178 38 194 C44 200 52 198 56 192 C60 176 62 158 64 132 C56 136 50 142 44 150 Z'],
  ['triceps', 'M35 124 C31 144 30 166 33 190 L38 194 C36 178 38 162 43 150 C38 144 36 134 35 124 Z'],
  ['forearms', ARM_F],
  ['hands', HAND],
  ['lowerBack', 'M74 178 C76 196 80 214 88 228 C92 232 96 234 100 234 L100 216 C90 210 80 196 74 178 Z'],
  ['glutes', 'M72 228 C64 240 62 256 66 270 C74 280 88 280 98 274 C100 262 100 246 100 236 C90 236 80 234 72 228 Z'],
  ['hamstrings', 'M66 276 C64 296 66 318 70 338 C76 346 86 346 92 338 C94 318 96 298 98 280 C88 284 76 284 66 276 Z'],
  ['knees', 'M68 340 C66 346 68 350 74 352 C82 352 88 348 90 340 C84 344 74 344 68 340 Z'],
  ['calves', 'M68 352 C62 368 62 388 66 404 C70 412 78 414 84 408 C88 392 90 372 88 356 C82 348 74 348 68 352 Z'],
  ['feet', 'M68 414 C64 428 60 440 64 448 L86 450 C88 438 86 424 84 412 C78 418 72 418 68 414 Z'],
];
const FIBER = {
  front: 'M88 168 L100 168 M87 192 L100 192 M88 214 L100 214 M48 112 C52 120 52 132 50 140 M74 118 C82 126 90 132 100 134 M82 250 C78 280 78 310 82 338',
  back: 'M60 104 C52 116 48 128 46 140 M86 140 C82 156 84 176 92 192 M82 300 L82 334 M76 372 C78 384 80 394 80 402',
};

interface Props {
  view: 'front' | 'back';
  primary?: Muscle[];
  secondary?: Muscle[];
  /** 0~1: 부위별 진하기 (히트맵) */
  heat?: Partial<Record<Muscle, number>>;
  height?: number;
  className?: string;
  label?: string;
}

export default function Anatomy({ view, primary = [], secondary = [], heat, height = 200, className = '', label }: Props) {
  const id = useId().replace(/:/g, '');
  const parts = view === 'front' ? FRONT : BACK;
  const half = parts.map(([k, d], i) => {
    const m = k as Muscle;
    const h = heat?.[m];
    return (
      <g key={i}>
        <path d={d} fill={primary.includes(m) ? `url(#${id}p)` : secondary.includes(m) ? `url(#${id}s)` : `url(#${id}n)`} stroke="#94A0A6" strokeWidth="1.1" strokeLinejoin="round" />
        {h != null && h > 0 && <path d={d} fill={`url(#${id}p)`} opacity={0.15 + h * 0.85} />}
      </g>
    );
  });
  const side = (
    <>
      <path d={BASE} fill="#AEB8BD" />
      {half}
      <path d={FIBER[view]} stroke="#94A0A6" strokeWidth=".7" fill="none" opacity=".8" />
    </>
  );
  return (
    <svg viewBox="0 0 200 460" height={height} width={(height * 200) / 460} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={`${id}n`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7F9FA" />
          <stop offset="1" stopColor="#D3DADD" />
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF9A3C" />
          <stop offset="1" stopColor="#F05A00" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE7B8" />
          <stop offset="1" stopColor="#FFC857" />
        </linearGradient>
      </defs>
      <g>{side}</g>
      <g transform="translate(200 0) scale(-1 1)">{side}</g>
      <ellipse cx="100" cy="35" rx="20" ry="27" fill={`url(#${id}n)`} stroke="#94A0A6" strokeWidth="1.1" />
    </svg>
  );
}

/** 정면+후면 한 쌍 */
export function AnatomyPair({ primary = [], secondary = [], heat, height = 160, label }: Omit<Props, 'view'>) {
  return (
    <div className="flex items-end gap-1 shrink-0" role="img" aria-label={label}>
      <Anatomy view="front" primary={primary} secondary={secondary} heat={heat} height={height} />
      <Anatomy view="back" primary={primary} secondary={secondary} heat={heat} height={height} />
    </div>
  );
}
