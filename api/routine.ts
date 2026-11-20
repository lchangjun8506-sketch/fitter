/**
 * POST /api/routine
 * 사용자의 최근 운동 요약 + 인바디 + 규칙 기반 추천을 받아 Google Gemini가 오늘의 루틴을 짜 준다.
 * 사용자가 "AI에게 묻기"를 누를 때만 호출, 계정당 하루 5회.
 *
 * 필요한 Vercel 환경 변수: GEMINI_API_KEY (서버 전용), VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */
import { checkUser, geminiJson, json } from './_gemini.js';

export const maxDuration = 120;

const DAILY_LIMIT = 5;
const MAX_INPUT = 20_000;
const ROUTINES = ['가슴·삼두', '등·이두', '어깨', '하체'] as const;
const REP_STEPS = [8, 10, 12, 15];
/** 가장 가까운 횟수 단계로 맞춤 (AI가 다른 숫자를 내도 8·10·12·15로) */
/** 실제 기구 단위로 반올림: 20kg 미만 1kg, 이상 2.5kg */
const snapWeight = (w: number) => (w <= 0 ? 0 : w < 20 ? Math.round(w) : Math.round(w / 2.5) * 2.5);
const snapReps = (r: number) => REP_STEPS.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));

const SCHEMA = {
  type: 'object',
  properties: {
    routine: { type: 'string', enum: ROUTINES, description: '오늘의 분할' },
    title: { type: 'string', description: '한 줄 제목, 20자 이내' },
    summary: { type: 'string', description: '왜 이 루틴인지 2~3문장. 사용자 기록의 숫자를 근거로' },
    warmup: { type: 'string', description: '준비운동 한 문장' },
    items: {
      type: 'array',
      description: '종목 목록. 기본 4~6개, 사용자가 개수를 요청하면 정확히 그 개수(최대 10개)',
      items: {
        type: 'object',
        properties: {
          exercise: { type: 'string', description: '종목명 (사용자가 하던 이름 그대로, 새 종목은 한국어 일반 명칭)' },
          sets: {
            type: 'array',
            description: '세트별 목표. 기본 3~5세트, 사용자가 세트 수를 요청하면 그 수(최대 8세트)',
            items: { type: 'object', properties: { weight: { type: 'number' }, reps: { type: 'integer', enum: [8, 10, 12, 15], description: '8, 10, 12, 15 중 하나' } }, required: ['weight', 'reps'] },
          },
          tip: { type: 'string', description: '이 종목 목표의 근거나 자세 팁 한 문장' },
        },
        required: ['exercise', 'sets', 'tip'],
      },
    },
    caution: { type: ['string', 'null'], description: '부상·정체·과훈련 주의점. 없으면 null' },
  },
  required: ['routine', 'title', 'summary', 'warmup', 'items', 'caution'],
};

const SYSTEM = `당신은 한국어로 답하는 웨이트 트레이닝 코치입니다. 사용자는 4분할(가슴·삼두 / 등·이두 / 어깨 / 하체)로 운동하는 초보~중급자입니다.
주어진 운동 기록 요약, 인바디, 규칙 기반 추천(baseline)을 보고 오늘의 루틴을 짜세요.
원칙:
- 목표 횟수(reps)는 반드시 8, 10, 12, 15 중 하나만 쓰세요. 지난 횟수의 다음 단계로 올리고(8→10→12→15), 15를 채웠으면 무게를 올리고 8회로 돌아가세요.
- 무게는 실제 기구 단위로: 20kg 미만은 1kg 단위, 20kg 이상은 2.5kg 단위. 증량할 때도 한 단계(1kg 또는 2.5kg)만 올리세요.
- 오래 쉰 부위, 정체된 종목, 인바디(골격근·체지방 변화)를 근거로 삼고, summary에 실제 숫자를 인용하세요.
- 덤벨 무게는 한 손 기준입니다. 처음 하는 종목은 weight 0으로 두고 tip에 무게 찾는 법을 적으세요.
- 사용자의 요청(request)이 있으면 위 원칙과 기본값보다 우선합니다. 종목 수·세트 수·시간·부위·제외할 종목을 요청하면 그대로 지키세요.
  예: "7개로 늘려줘" → items를 정확히 7개로. "등 하고 싶어요" → routine을 등·이두로.
- 통증을 언급하면 그 부위를 피하고 caution에 적으세요.
- 의학적 진단은 하지 마세요. 짧고 담백하게, 이모지 없이.`;

type Plan = { routine: string; title: string; summary: string; warmup: string; items: { exercise: string; sets: { weight: number; reps: number }[]; tip: string }[]; caution: string | null };

export async function POST(request: Request): Promise<Response> {
  if (!process.env.GEMINI_API_KEY) return json(503, { error: 'AI 기능이 아직 설정되지 않았어요' });
  const user = await checkUser(request, 'routine', DAILY_LIMIT);
  if (!user.ok) return json(user.status, { error: user.status === 429 ? `AI 추천은 하루 ${DAILY_LIMIT}번까지예요` : user.error });

  const raw = await request.text();
  if (raw.length > MAX_INPUT) return json(413, { error: '기록이 너무 많아요' });
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return json(400, { error: '잘못된 요청이에요' });
  }

  const r = await geminiJson({
    system: SYSTEM,
    schema: SCHEMA,
    temperature: 0.4,
    parts: [{ text: `다음은 내 운동 데이터예요. 오늘 루틴을 짜 주세요.\n\n${JSON.stringify(input)}` }],
  });
  if (!r.ok) return json(r.status, { error: r.status === 502 ? '추천을 만들지 못했어요. 다시 시도해 주세요' : r.error });

  // 형식 확인 (앱이 그대로 그릴 수 있게)
  const p = r.data as Plan;
  const valid =
    p && (ROUTINES as readonly string[]).includes(p.routine) && typeof p.summary === 'string' && Array.isArray(p.items) && p.items.length > 0 &&
    p.items.every((i) => typeof i.exercise === 'string' && Array.isArray(i.sets) && i.sets.every((s) => typeof s.weight === 'number' && typeof s.reps === 'number'));
  if (!valid) return json(502, { error: '추천을 만들지 못했어요. 다시 시도해 주세요' });
  p.items = p.items.slice(0, 10).map((i) => ({ ...i, tip: i.tip ?? '', sets: i.sets.slice(0, 8).map((s) => ({ weight: snapWeight(s.weight), reps: snapReps(s.reps) })) }));
  p.caution = p.caution || null;

  await user.record();
  return json(200, { plan: p });
}
