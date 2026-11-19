/** 로컬 시간대 기준 yyyy-MM-dd (toISOString은 UTC라 한국 오전 9시 전엔 전날로 찍힘) */
export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowStr(): string {
  const d = new Date();
  return `${todayStr(d)} ${d.toTimeString().slice(0, 8)}`;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export function prettyDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  if (!y) return s;
  const dt = new Date(y, m - 1, d);
  return `${m}.${d} (${WEEK[dt.getDay()]})`;
}
