/**
 * POST /api/inbody
 * 인바디 결과지(사진 또는 PDF)를 Claude로 판독해 체성분 수치를 JSON으로 돌려준다.
 * 저장은 하지 않는다. 사용자가 화면에서 값을 확인·수정한 뒤 앱이 직접 저장한다.
 *
 * 필요한 Vercel 환경 변수:
 *   ANTHROPIC_API_KEY                         Claude API 키 (서버 전용, VITE_ 접두사 금지)
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 로그인 사용자 확인용 (앱과 공유)
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';

export const maxDuration = 60;

const DAILY_LIMIT = 10;
const MAX_BASE64 = 4_000_000; // Vercel 요청 본문 4.5MB 제한 안쪽
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

const num = z.number().nullable();
const InBodySchema = z.object({
  is_inbody_sheet: z.boolean().describe('체성분 분석 결과지(인바디 등)가 맞으면 true'),
  measured_at: z.string().nullable().describe('측정일 YYYY-MM-DD. 결과지에 없으면 null'),
  weight: num.describe('체중 kg'),
  skeletal_muscle: num.describe('골격근량 kg'),
  body_fat_mass: num.describe('체지방량 kg'),
  body_fat_pct: num.describe('체지방률 %'),
  bmi: num.describe('BMI kg/m²'),
  bmr: num.describe('기초대사량 kcal'),
  visceral_fat_level: num.describe('내장지방레벨'),
  inbody_score: num.describe('인바디 점수'),
  notes: z.string().nullable().describe('읽기 어려웠던 항목 등 짧은 메모. 없으면 null'),
});
export type InBodyReading = z.infer<typeof InBodySchema>;

const SYSTEM = `You read Korean body composition result sheets (InBody and similar devices) and return the measured values.
Rules:
- Copy numbers exactly as printed for the CURRENT measurement. Ignore history graphs, previous results, and standard/normal ranges.
- Use the units named in the schema. If a value is not printed or not legible, return null rather than estimating.
- If the image or PDF is not a body composition result sheet, set is_inbody_sheet to false and every value to null.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const supabaseUrl = () => process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey = () => process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

/** Supabase 토큰으로 사용자 확인 + 오늘 저장한 인바디 개수 */
async function checkUser(token: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const url = supabaseUrl(), key = supabaseKey();
  if (!url || !key) return { ok: false, status: 500, error: '서버에 Supabase 설정이 없어요' };
  const headers = { apikey: key, authorization: `Bearer ${token}` };
  const user = await fetch(`${url}/auth/v1/user`, { headers });
  if (!user.ok) return { ok: false, status: 401, error: '로그인이 필요해요' };

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const count = await fetch(`${url}/rest/v1/inbody_records?select=id&created_at=gte.${since}`, {
    headers: { ...headers, prefer: 'count=exact', range: '0-0' },
  });
  const total = Number(count.headers.get('content-range')?.split('/')[1] ?? 0);
  if (total >= DAILY_LIMIT) return { ok: false, status: 429, error: `하루 ${DAILY_LIMIT}장까지 분석할 수 있어요` };
  return { ok: true };
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: '서버에 ANTHROPIC_API_KEY가 없어요' });

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: '로그인이 필요해요' });
  const auth = await checkUser(token);
  if (!auth.ok) return json(auth.status, { error: auth.error });

  let body: { data?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: '잘못된 요청이에요' });
  }
  const { data, mediaType } = body;
  if (!data || !mediaType || !(MEDIA_TYPES as readonly string[]).includes(mediaType)) {
    return json(400, { error: '사진(JPG·PNG) 또는 PDF만 올릴 수 있어요' });
  }
  if (data.length > MAX_BASE64) return json(413, { error: '파일이 너무 커요 (최대 약 3MB)' });

  const source =
    mediaType === 'application/pdf'
      ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } as const)
      : ({
          type: 'image',
          source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data },
        } as const);

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // 안전 분류기가 드물게 거절하면 서버가 자동으로 대체 모델로 재시도
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(InBodySchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: [source, { type: 'text', text: '이 결과지의 현재 측정값을 읽어 주세요.' }] }],
    });

    if (message.stop_reason === 'refusal') return json(422, { error: '이 파일은 분석할 수 없어요' });
    const reading = message.parsed_output;
    if (!reading) return json(502, { error: '결과를 읽지 못했어요. 더 선명한 사진으로 다시 시도해 주세요' });
    if (!reading.is_inbody_sheet) return json(422, { error: '인바디 결과지가 아닌 것 같아요' });
    return json(200, { reading });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: '잠시 후 다시 시도해 주세요' });
    if (e instanceof Anthropic.BadRequestError) return json(400, { error: '파일을 읽을 수 없어요' });
    if (e instanceof Anthropic.APIError) return json(502, { error: `분석 서버 오류 (${e.status})` });
    throw e;
  }
}
