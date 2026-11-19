/**
 * 인바디 결과지 판독 (무료 · 휴대폰 안에서 처리, 사진이 서버로 가지 않음)
 *  1) 글자가 들어 있는 PDF(인바디 앱/LookinBody에서 받은 파일) → 글자를 그대로 읽음
 *  2) 사진 · 스캔 PDF → 글자 인식(OCR, tesseract.js)
 * 읽은 글에서 "체중", "골격근량" 같은 이름 옆의 숫자를 찾아 값으로 씀.
 * 인식은 틀릴 수 있으므로 화면에서 사용자가 꼭 확인·수정한다.
 */
import type { InBodyValues } from './inbody';

type NumKey = Exclude<keyof InBodyValues, 'measured_at'>;

/** 글자 사이 공백을 허용하는 정규식 조각 ("체 중" 처럼 OCR이 띄워 읽는 경우) */
const sp = (word: string) => [...word].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');

/** 항목별 이름과 사람 몸에서 나올 수 있는 범위 (범위 밖 숫자는 버림) */
const RULES: { key: NumKey; labels: string[]; min: number; max: number }[] = [
  { key: 'skeletal_muscle', labels: [sp('골격근량'), 'SMM'], min: 5, max: 80 },
  { key: 'body_fat_mass', labels: [sp('체지방량'), 'BFM'], min: 1, max: 150 },
  { key: 'body_fat_pct', labels: [sp('체지방률'), sp('체지방율'), 'PBF'], min: 2, max: 70 },
  { key: 'bmi', labels: ['B\\s*M\\s*[I1l]', sp('신체질량지수')], min: 10, max: 60 }, // OCR이 I를 1·l로 읽는 경우
  { key: 'bmr', labels: [sp('기초대사량')], min: 700, max: 4000 },
  { key: 'visceral_fat_level', labels: [sp('내장지방레벨'), sp('내장지방')], min: 1, max: 30 },
  { key: 'inbody_score', labels: [`InBody\\s*${sp('점수')}`, sp('인바디점수')], min: 20, max: 110 },
  // "적정체중·표준체중·목표체중·체중조절"은 제외
  { key: 'weight', labels: [`(?<![적정표준목표])${sp('체중')}(?!\\s*조\\s*절)`, 'Weight'], min: 25, max: 250 },
];

const NUM = /\d{1,4}(?:\.\d)?/g;

const ALL_LABELS = new RegExp(RULES.flatMap((r) => r.labels).join('|'), 'i');

/** 이름 뒤 같은 줄에서 첫 '현재 값' 숫자. 괄호 속 단위·정상범위 "55.8~75.4"는 건너뛰고, 다음 항목 이름이 나오면 멈춤 */
function valueIn(rest: string, min: number, max: number): number | null {
  const next = rest.search(ALL_LABELS);
  const seg = (next >= 0 ? rest.slice(0, next) : rest)
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*[~∼-]\s*\d+(?:\.\d+)?/g, ' ');
  for (const m of seg.matchAll(NUM)) {
    const v = parseFloat(m[0]);
    if (v >= min && v <= max) return v;
    // OCR이 소수점을 빠뜨린 경우: "236" → 23.6
    if (!m[0].includes('.') && v / 10 >= min && v / 10 <= max) return v / 10;
  }
  return null;
}

/** 서로 맞지 않는 값 바로잡기 + 정의로 계산되는 값 채우기 */
function reconcile(v: InBodyValues): string[] {
  const notes: string[] = [];
  const w = v.weight;
  if (w) {
    // 체지방량·골격근량이 체중보다 크면 소수점 빠짐 (121 → 12.1)
    for (const k of ['body_fat_mass', 'skeletal_muscle'] as const) {
      const x = v[k];
      if (x != null && x > w * 0.8 && Number.isInteger(x) && x / 10 >= 1) v[k] = x / 10;
    }
    // 체지방률 = 체지방량 ÷ 체중 (인바디 정의)
    if (v.body_fat_pct == null && v.body_fat_mass != null) {
      v.body_fat_pct = Math.round((v.body_fat_mass / w) * 1000) / 10;
      notes.push('체지방률');
    }
  }
  return notes;
}

function findDate(text: string): string | null {
  const re = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;
  for (const m of text.matchAll(re)) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // OCR이 점을 빠뜨린 "2026.1110" 형태
  const m = text.match(/(20\d{2})\s*[.\-/]\s*(\d{2})(\d{2})(?!\d)/);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const clean = (t: string) =>
  t
    .normalize('NFKC')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2') // 1,650 → 1650
    .replace(/(\d)\s*,\s*(\d)(?!\d{2})/g, '$1.$2') // 72,4 → 72.4 (쉼표 소수점)
    .replace(/[|]/g, ' ')
    .replace(/[ \t]+/g, ' ');

/** 결과지 글(줄 단위) → 값. found = 읽어낸 항목 수 */
export function parseInBodyText(raw: string): { values: InBodyValues; found: number; derived: string[] } {
  const rows = clean(raw).split('\n').map((r) => r.trim()).filter(Boolean);
  const all = rows.join(' ');
  const values = { measured_at: findDate(all) } as InBodyValues;
  let found = 0;

  for (const rule of RULES) {
    values[rule.key] = null;
    // 인바디 점수는 "82/100점" 모양이 가장 확실
    if (rule.key === 'inbody_score') {
      const m = all.match(/(\d{2,3})\s*\/\s*100(?!\d)/);
      if (m && +m[1] <= 100) {
        values.inbody_score = +m[1];
        found++;
        continue;
      }
    }
    const re = new RegExp(rule.labels.join('|'), 'gi');
    search: for (let i = 0; i < rows.length; i++) {
      for (const m of rows[i].matchAll(re)) {
        // 같은 줄에서 찾고, 없으면 바로 아랫줄(이름 아래에 값이 있는 표)
        const v =
          valueIn(rows[i].slice(m.index! + m[0].length), rule.min, rule.max) ??
          (i + 1 < rows.length ? valueIn(rows[i + 1], rule.min, rule.max) : null);
        if (v != null) {
          values[rule.key] = v;
          found++;
          break search;
        }
      }
    }
  }
  const derived = reconcile(values);
  return { values, found: found + derived.length, derived };
}

/** 위치가 있는 글 조각들 → 같은 높이끼리 한 줄로 (표의 한 행이 한 줄이 되도록) */
interface Token { s: string; x: number; cy: number; h: number }
export function tokensToText(tokens: Token[]): string {
  const sorted = tokens.filter((t) => t.s.trim()).sort((a, b) => a.cy - b.cy);
  const rows: { cy: number; h: number; items: Token[] }[] = [];
  for (const t of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(t.cy - row.cy) < Math.max(t.h, row.h) * 0.55) {
      row.items.push(t);
      row.cy = (row.cy * (row.items.length - 1) + t.cy) / row.items.length;
    } else rows.push({ cy: t.cy, h: t.h, items: [t] });
  }
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((t) => t.s).join(' ')).join('\n');
}

/* ───────────── PDF ───────────── */

async function loadPdf(data: ArrayBuffer) {
  // legacy 빌드: 구형 iOS 사파리(17.3 이하)에서도 동작
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs.getDocument({ data }).promise;
}

/** PDF 안의 글자를 줄 단위로 */
async function pdfText(doc: Awaited<ReturnType<typeof loadPdf>>): Promise<string> {
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const tokens: Token[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const h = Math.abs(item.transform[3]) || item.height || 10;
      tokens.push({ s: item.str, x: item.transform[4], cy: -(item.transform[5] + h / 2), h });
    }
    pages.push(tokensToText(tokens));
  }
  return pages.join('\n');
}

async function pdfPageToCanvas(doc: Awaited<ReturnType<typeof loadPdf>>): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, 2200 / base.width) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
  return canvas;
}

/* ───────────── 사진 ───────────── */

/** 인식이 잘 되도록 긴 변 1600~2400px로 맞춤 (흑백·대비 보정은 표 칸을 지워서 오히려 손해) */
async function imageToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('이 사진 형식은 읽을 수 없어요. JPG나 PNG로 올려 주세요');
  });
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = long > 2400 ? 2400 / long : long < 1600 ? 1600 / long : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function ocr(canvas: HTMLCanvasElement, onProgress: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const base = `${location.origin}/ocr`;
  const worker = await createWorker(['kor', 'eng'], 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/`,
    langPath: `${base}/lang`,
    gzip: true,
    logger: (m) => {
      // 0~40%: 인식 데이터 준비(첫 회만 오래 걸림), 40~100%: 글자 인식
      if (m.status === 'recognizing text') onProgress(0.4 + m.progress * 0.6);
      else if (m.status.startsWith('loading')) onProgress(Math.min(0.4, m.progress * 0.4));
    },
  });
  try {
    // 11 = 흩어진 글 조각을 모두 찾기. 표의 칸이 빠지지 않고, 아래에서 위치로 줄을 다시 묶음
    await worker.setParameters({ tessedit_pageseg_mode: '11' as never });
    const { data } = await worker.recognize(canvas, { rotateAuto: true }, { blocks: true, text: true });
    const words = data.words ?? [];
    if (!words.length) return data.text;
    return tokensToText(words.map((w) => ({ s: w.text, x: w.bbox.x0, cy: (w.bbox.y0 + w.bbox.y1) / 2, h: w.bbox.y1 - w.bbox.y0 })));
  } finally {
    await worker.terminate();
  }
}

export interface ReadResult {
  values: InBodyValues;
  found: number;
  derived: string[];
  method: 'pdf-text' | 'ocr';
}

export async function readInBody(file: File, onProgress: (p: number) => void): Promise<ReadResult> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    if (file.size > 15_000_000) throw new Error('PDF가 너무 커요 (15MB 이하)');
    const doc = await loadPdf(await file.arrayBuffer());
    const parsed = parseInBodyText(await pdfText(doc));
    if (parsed.found >= 2) return { ...parsed, method: 'pdf-text' };
    // 글자가 없는 스캔 PDF → 그림으로 바꿔 OCR
    const text = await ocr(await pdfPageToCanvas(doc), onProgress);
    return { ...parseInBodyText(text), method: 'ocr' };
  }
  const text = await ocr(await imageToCanvas(file), onProgress);
  return { ...parseInBodyText(text), method: 'ocr' };
}
