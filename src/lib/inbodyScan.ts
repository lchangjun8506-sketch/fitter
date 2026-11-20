/**
 * 인바디 결과지 AI 스캔 (Google Gemini, 서버 /api/inbody-scan 경유)
 * 사진은 긴 변 1600px JPEG로 줄여 보냄. PDF는 그대로(3MB 이하).
 * 읽은 값은 화면에서 사용자가 꼭 확인·수정한 뒤 저장한다.
 */
import type { InBodyValues } from './inbody';
import { INBODY_FIELDS } from './inbody';
import { supabase } from './supabase';

const MAX_PDF = 3 * 1024 * 1024;

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('파일을 읽지 못했어요'));
    r.readAsDataURL(blob);
  });

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('이 사진 형식은 읽을 수 없어요. JPG나 PNG로 올려 주세요');
  });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('사진 변환 실패'))), 'image/jpeg', 0.85));
}

/** 서로 맞지 않는 값 바로잡기 + 정의로 계산되는 값 채우기 */
export function reconcile(v: InBodyValues): string[] {
  const notes: string[] = [];
  const w = v.weight;
  if (w) {
    // 체지방량·골격근량이 체중보다 크면 소수점 빠짐 (121 → 12.1)
    for (const k of ['body_fat_mass', 'skeletal_muscle'] as const) {
      const x = v[k];
      if (x != null && x > w * 0.8 && Number.isInteger(x) && x / 10 >= 1) v[k] = x / 10;
    }
    // 체지방률 = 체지방량 ÷ 체중, 체지방량 = 체중 × 체지방률 (인바디 정의)
    if (v.body_fat_pct == null && v.body_fat_mass != null) {
      v.body_fat_pct = Math.round((v.body_fat_mass / w) * 1000) / 10;
      notes.push('체지방률');
    } else if (v.body_fat_mass == null && v.body_fat_pct != null) {
      v.body_fat_mass = Math.round(w * v.body_fat_pct) / 100;
      notes.push('체지방량');
    }
  }
  return notes;
}

export interface ScanResult {
  values: InBodyValues;
  found: number;
  derived: string[];
}

export async function scanInBody(file: File): Promise<ScanResult> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf && file.size > MAX_PDF) throw new Error('PDF가 너무 커요 (3MB 이하로 올려 주세요)');
  const blob = isPdf ? file : await shrinkImage(file);
  const data = await toBase64(blob);

  const { data: s } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!s.session) throw new Error('로그인이 필요해요');

  let res: Response;
  try {
    res = await fetch('/api/inbody-scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session.access_token}` },
      body: JSON.stringify({ mime: isPdf ? 'application/pdf' : 'image/jpeg', data }),
    });
  } catch {
    throw new Error('인터넷 연결을 확인해 주세요');
  }
  const body = (await res.json().catch(() => ({}))) as { values?: InBodyValues; error?: string };
  if (!res.ok || !body.values) throw new Error(body.error ?? 'AI가 결과지를 읽지 못했어요');

  const values = body.values;
  const derived = reconcile(values);
  const found = INBODY_FIELDS.filter((f) => values[f.key] != null).length;
  return { values, found, derived };
}
