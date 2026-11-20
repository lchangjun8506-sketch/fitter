/**
 * POST /api/inbody-scan  { mime, data(base64) }
 * 인바디(체성분) 결과지 사진·PDF를 Google Gemini로 읽어 수치를 돌려준다.
 * 계정당 하루 10번까지. 결과는 앱에서 사용자가 확인한 뒤에 저장한다.
 *
 * 필요한 Vercel 환경 변수:
 *   GEMINI_API_KEY                              서버 전용 (VITE_ 접두사 금지)
 *   GEMINI_MODEL (선택)                          기본 gemini-3.8-flash
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   로그인 확인·사용량 기록용 (앱과 공유)
 */
export const maxDuration = 60;

const DAILY_LIMIT = 10;
const MAX_BASE64 = 4_000_000; // Vercel 요청 크기 한도(4.5MB) 안쪽
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

type Key = 'weight' | 'skeletal_muscle' | 'body_fat_mass' | 'body_fat_pct' | 'bmi' | 'bmr' | 'visceral_fat_level' | 'inbody_score';
/** 사람 몸에서 나올 수 있는 범위 (밖이면 잘못 읽은 것으로 보고 비움) */
const RANGE: Record<Key, [number, number]> = {
  weight: [25, 250],
  skeletal_muscle: [5, 80],
  body_fat_mass: [1, 150],
  body_fat_pct: [2, 70],
  bmi: [10, 60],
  bmr: [700, 4000],
  visceral_fat_level: [1, 30],
  inbody_score: [20, 110],
};
const num = (description: string) => ({ type: ['number', 'null'], description });
const SCHEMA = {
  type: 'object',
  properties: {
    is_body_composition_sheet: { type: 'boolean', description: '체성분(인바디 등) 결과지가 맞으면 true' },
    measured_at: { type: ['string', 'null'], description: '측정 날짜 YYYY-MM-DD' },
    weight: num('체중 kg'),
    skeletal_muscle: num('골격근량 kg'),
    body_fat_mass: num('체지방량 kg'),
    body_fat_pct: num('체지방률 %'),
    bmi: num('BMI'),
    bmr: num('기초대사량 kcal'),
    visceral_fat_level: num('내장지방레벨'),
    inbody_score: num('인바디 점수 (100점 만점)'),
  },
  required: ['is_body_composition_sheet', 'measured_at', 'weight', 'skeletal_muscle', 'body_fat_mass', 'body_fat_pct', 'bmi', 'bmr', 'visceral_fat_level', 'inbody_score'],
};
const PROMPT = `첨부한 파일은 체성분 분석기(인바디 등) 결과지입니다.
각 항목의 "측정값"만 읽어 JSON으로 답하세요.
- 정상범위, 표준값, 적정체중, 목표값, 체중조절 값은 쓰지 마세요.
- 숫자는 결과지에 적힌 그대로(단위 없이, 소수점 유지) 쓰세요.
- 보이지 않거나 확실하지 않은 항목은 추측하지 말고 null로 두세요.
- 측정 날짜는 YYYY-MM-DD 형식. 없으면 null.
- 체성분 결과지가 아니면 is_body_composition_sheet를 false로 하고 나머지는 null.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const sbUrl = () => process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const sbKey = () => process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(503, { error: 'AI 스캔이 아직 설정되지 않았어요. 직접 입력해 주세요' });
  const url = sbUrl(), key = sbKey();
  if (!url || !key) return json(500, { error: '서버에 Supabase 설정이 없어요' });

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: '로그인이 필요해요' });
  const headers = { apikey: key, authorization: `Bearer ${token}` };
  const user = await fetch(`${url}/auth/v1/user`, { headers });
  if (!user.ok) return json(401, { error: '로그인이 필요해요' });

  let body: { mime?: string; data?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: '잘못된 요청' });
  }
  if (!body.mime || !MIMES.includes(body.mime) || typeof body.data !== 'string' || !body.data) return json(400, { error: '사진(JPG·PNG) 또는 PDF만 읽을 수 있어요' });
  if (body.data.length > MAX_BASE64) return json(413, { error: '파일이 너무 커요 (3MB 이하로 올려 주세요)' });

  // 하루 사용 횟수 (ai_usage 표가 없으면 제한 없이 진행)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const usage = await fetch(`${url}/rest/v1/ai_usage?select=id&kind=eq.inbody&created_at=gte.${since}`, { headers: { ...headers, prefer: 'count=exact', range: '0-0' } });
  const tracked = usage.ok;
  if (tracked && Number(usage.headers.get('content-range')?.split('/')[1] ?? 0) >= DAILY_LIMIT) return json(429, { error: `AI 스캔은 하루 ${DAILY_LIMIT}번까지예요. 직접 입력해 주세요` });

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: body.mime, data: body.data } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SCHEMA, temperature: 0 },
      }),
    });
  } catch {
    return json(502, { error: 'AI 서버에 연결하지 못했어요' });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('gemini', res.status, detail.slice(0, 500));
    if (res.status === 429) return json(429, { error: 'AI 사용량이 많아 잠시 뒤에 다시 시도해 주세요' });
    return json(502, { error: 'AI가 결과지를 읽지 못했어요' });
  }

  const out = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json(502, { error: 'AI 응답을 이해하지 못했어요' });
  }
  if (parsed.is_body_composition_sheet === false) return json(422, { error: '인바디(체성분) 결과지가 아닌 것 같아요' });

  const values: Record<string, number | string | null> = {};
  for (const k of Object.keys(RANGE) as Key[]) {
    const v = typeof parsed[k] === 'number' ? (parsed[k] as number) : null;
    values[k] = v != null && v >= RANGE[k][0] && v <= RANGE[k][1] ? v : null;
  }
  const d = typeof parsed.measured_at === 'string' ? parsed.measured_at : '';
  values.measured_at = /^20\d{2}-\d{2}-\d{2}$/.test(d) ? d : null;

  if (tracked) await fetch(`${url}/rest/v1/ai_usage`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'inbody' }) }).catch(() => {});
  return json(200, { values, model });
}
