import { supabase } from './supabase';

export interface InBodyValues {
  measured_at: string | null;
  weight: number | null;
  skeletal_muscle: number | null;
  body_fat_mass: number | null;
  body_fat_pct: number | null;
  bmi: number | null;
  bmr: number | null;
  visceral_fat_level: number | null;
  inbody_score: number | null;
}
export interface InBodyRecord extends InBodyValues {
  id: string;
  measured_at: string;
  file_path: string | null;
}

export const INBODY_FIELDS: { key: keyof Omit<InBodyValues, 'measured_at'>; label: string; unit: string }[] = [
  { key: 'weight', label: '체중', unit: 'kg' },
  { key: 'skeletal_muscle', label: '골격근량', unit: 'kg' },
  { key: 'body_fat_mass', label: '체지방량', unit: 'kg' },
  { key: 'body_fat_pct', label: '체지방률', unit: '%' },
  { key: 'bmi', label: 'BMI', unit: '' },
  { key: 'bmr', label: '기초대사량', unit: 'kcal' },
  { key: 'visceral_fat_level', label: '내장지방레벨', unit: '' },
  { key: 'inbody_score', label: '인바디 점수', unit: '점' },
];

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * 사진은 긴 변 2000px JPEG로 줄여 올린다 (서버 4.5MB 제한, 업로드 속도).
 * 아이폰 HEIC는 사파리가 사진 선택 시 JPEG로 바꿔 주고, 혹시 남아 있어도 캔버스로 다시 그리면서 JPEG가 된다.
 */
export async function prepareFile(file: File): Promise<{ blob: Blob; mediaType: string; ext: string }> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    if (file.size > 3_000_000) throw new Error('PDF는 3MB 이하만 올릴 수 있어요');
    return { blob: file, mediaType: 'application/pdf', ext: 'pdf' };
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('이 사진 형식은 읽을 수 없어요. JPG나 PNG로 올려 주세요');
  });
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('변환 실패'))), 'image/jpeg', 0.88));
  return { blob, mediaType: 'image/jpeg', ext: 'jpg' };
}

/** 서버(/api/inbody)에서 Claude로 판독 */
export async function scanInBody(blob: Blob, mediaType: string): Promise<InBodyValues> {
  const { data } = await supabase!.auth.getSession();
  const res = await fetch('/api/inbody', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ data: await toBase64(blob), mediaType }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `분석 실패 (${res.status})`);
  return body.reading as InBodyValues;
}

export async function saveInBody(values: InBodyValues & { measured_at: string }, file?: { blob: Blob; ext: string }) {
  const sb = supabase!;
  const { data: u } = await sb.auth.getUser();
  let file_path: string | null = null;
  if (file && u.user) {
    file_path = `${u.user.id}/${Date.now()}.${file.ext}`;
    const up = await sb.storage.from('inbody').upload(file_path, file.blob, { contentType: file.blob.type || undefined });
    if (up.error) file_path = null; // 원본 보관 실패해도 수치는 저장
  }
  const { error } = await sb.from('inbody_records').insert({ ...values, raw: values, file_path });
  if (error) throw error;
}

export async function listInBody(): Promise<InBodyRecord[]> {
  const { data, error } = await supabase!.from('inbody_records')
    .select('id, measured_at, weight, skeletal_muscle, body_fat_mass, body_fat_pct, bmi, bmr, visceral_fat_level, inbody_score, file_path')
    .order('measured_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const out = { ...r } as Record<string, unknown>;
    for (const f of INBODY_FIELDS) out[f.key] = r[f.key] == null ? null : Number(r[f.key]);
    return out as unknown as InBodyRecord;
  });
}

export async function deleteInBody(rec: InBodyRecord) {
  const sb = supabase!;
  if (rec.file_path) await sb.storage.from('inbody').remove([rec.file_path]);
  const { error } = await sb.from('inbody_records').delete().eq('id', rec.id);
  if (error) throw error;
}

export async function openInBodyFile(path: string) {
  const { data, error } = await supabase!.storage.from('inbody').createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, '_blank');
}
