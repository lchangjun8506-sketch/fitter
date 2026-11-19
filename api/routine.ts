/**
 * POST /api/routine
 * 사용자의 최근 운동 요약 + 인바디 + 규칙 기반 추천을 받아 Claude가 오늘의 루틴을 짜 준다.
 * 사용자가 "AI에게 자세히 묻기"를 누를 때만 호출 (호출당 약 1~2원, 계정당 하루 5회).
 *
 * 필요한 Vercel 환경 변수:
 *   ANTHROPIC_API_KEY                          서버 전용 (VITE_ 접두사 금지)
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  로그인 확인·사용량 기록용 (앱과 공유)
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';

export const maxDuration = 60;

const DAILY_LIMIT = 5;
const MAX_INPUT = 20_000;
const ROUTINES = ['가슴·삼두', '등·이두', '어깨', '하체'] as const;

const PlanSchema = z.object({
  routine: z.enum(ROUTINES).describe('오늘의 분할'),
  title: z.string().describe('한 줄 제목, 20자 이내'),
  summary: z.string().describe('왜 이 루틴인지 2~3문장. 사용자 기록의 숫자를 근거로'),
  warmup: z.string().describe('준비운동 한 문장'),
  items: z
    .array(
      z.object({
        exercise: z.string().describe('종목명 (사용자가 하던 이름 그대로, 새 종목은 한국어 일반 명칭)'),
        sets: z.array(z.object({ weight: z.number(), reps: z.number().int() })).describe('세트별 목표, 3~5세트'),
        tip: z.string().describe('이 종목 목표의 근거나 자세 팁 한 문장'),
      }),
    )
    .describe('4~6개 종목'),
  caution: z.string().nullable().describe('부상·정체·과훈련 주의점. 없으면 null'),
});
export type AiPlan = z.infer<typeof PlanSchema>;

const SYSTEM = `당신은 한국어로 답하는 웨이트 트레이닝 코치입니다. 사용자는 4분할(가슴·삼두 / 등·이두 / 어깨 / 하체)로 운동하는 초보~중급자입니다.
주어진 운동 기록 요약, 인바디, 규칙 기반 추천(baseline)을 보고 오늘의 루틴을 짜세요.
원칙:
- 점진적 과부하: 지난 기록보다 무게 또는 횟수를 조금만 올리세요. 한 번에 무게를 5% 넘게 올리지 마세요.
- 오래 쉰 부위, 정체된 종목, 인바디(골격근·체지방 변화)를 근거로 삼고, summary에 실제 숫자를 인용하세요.
- 덤벨 무게는 한 손 기준입니다. 처음 하는 종목은 weight 0으로 두고 tip에 무게 찾는 법을 적으세요.
- 사용자의 요청(request)이 있으면 우선 반영하세요. 통증을 언급하면 그 부위를 피하고 caution에 적으세요.
- 의학적 진단은 하지 마세요. 짧고 담백하게, 이모지 없이.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const sbUrl = () => process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const sbKey = () => process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

async function checkQuota(token: string) {
  const url = sbUrl(), key = sbKey();
  if (!url || !key) return { ok: false as const, status: 500, error: '서버에 Supabase 설정이 없어요' };
  const headers = { apikey: key, authorization: `Bearer ${token}` };
  const user = await fetch(`${url}/auth/v1/user`, { headers });
  if (!user.ok) return { ok: false as const, status: 401, error: '로그인이 필요해요' };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const res = await fetch(`${url}/rest/v1/ai_usage?select=id&created_at=gte.${since}`, {
    headers: { ...headers, prefer: 'count=exact', range: '0-0' },
  });
  if (!res.ok) return { ok: false as const, status: 500, error: '사용량 표(ai_usage)가 없어요. 0003 SQL을 실행해 주세요' };
  const used = Number(res.headers.get('content-range')?.split('/')[1] ?? 0);
  if (used >= DAILY_LIMIT) return { ok: false as const, status: 429, error: `AI 추천은 하루 ${DAILY_LIMIT}번까지예요` };
  return { ok: true as const, record: () => fetch(`${url}/rest/v1/ai_usage`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'routine' }) }) };
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'AI 기능이 아직 설정되지 않았어요' });
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: '로그인이 필요해요' });
  const quota = await checkQuota(token);
  if (!quota.ok) return json(quota.status, { error: quota.error });

  const raw = await request.text();
  if (raw.length > MAX_INPUT) return json(413, { error: '기록이 너무 많아요' });
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return json(400, { error: '잘못된 요청이에요' });
  }

  const client = new Anthropic();
  try {
    const message = await client.messages.parse({
      model: 'claude-haiku-5-5',
      max_tokens: 8000,
      output_config: { effort: 'low', format: zodOutputFormat(PlanSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `다음은 내 운동 데이터예요. 오늘 루틴을 짜 주세요.\n\n${JSON.stringify(input)}` }],
    });
    if (message.stop_reason === 'refusal') return json(422, { error: '이 요청은 추천할 수 없어요' });
    if (!message.parsed_output) return json(502, { error: '추천을 만들지 못했어요. 다시 시도해 주세요' });
    await quota.record();
    return json(200, { plan: message.parsed_output });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: '잠시 후 다시 시도해 주세요' });
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: 'AI 키 설정을 확인해 주세요' });
    if (e instanceof Anthropic.APIError) return json(502, { error: `AI 서버 오류 (${e.status})` });
    throw e;
  }
}
