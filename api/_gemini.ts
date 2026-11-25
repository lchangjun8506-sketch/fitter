/**
 * Google Gemini 호출 공용 (파일 이름이 _로 시작하면 Vercel이 주소로 열지 않음)
 * 무료 등급에서 일반 Flash 모델이 자주 붐벼서, 빠른 Lite 모델부터 차례로 시도.
 * 붐비면(503·429·500) 바로 다음 모델로, 15초 안에 답하지 않으면 끊고 다음 모델로.
 * 실패할 때마다 잠깐 쉬고(점점 길게) 최대 12번, 전체 95초 안에서 계속 (실패 이유는 로그에 남김).
 * 키: GEMINI_API_KEY (서버 전용), 모델: GEMINI_MODEL (선택)
 */
export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export type GeminiResult =
  | { ok: true; data: unknown; model: string }
  | { ok: false; status: number; error: string };

/** 실패 뒤 쉬는 시간: 한 바퀴째 0.5초, 두 바퀴째 1.5초, 세 바퀴째 3초 (Gemini에 몰아서 보내지 않게) */
const pause = (attempt: number) => new Promise((r) => setTimeout(r, [500, 1_500, 3_000][Math.min(2, Math.floor(attempt / 4))]));

export async function geminiJson(opts: { parts: Part[]; schema: object; system?: string; temperature?: number; budgetMs?: number }): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: 'AI 기능이 아직 설정되지 않았어요' };
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.6-flash'])];
  const payload = JSON.stringify({
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: opts.schema, temperature: opts.temperature ?? 0 },
  });
  // 무료 등급은 순간적으로 503·무응답이 잦음 → 정해진 시간(95초) 안에서 모델을 돌아가며 계속 시도
  const deadline = Date.now() + (opts.budgetMs ?? 95_000);
  let res: Response | null = null;
  let bodyText = '';
  let model = models[0];
  let lastProblem = '';
  const MAX_ATTEMPTS = 12; // 모델 4개 × 3바퀴
  for (let attempt = 0; attempt < MAX_ATTEMPTS && Date.now() < deadline - 3_000; attempt++) {
    model = models[attempt % models.length];
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.min(15_000, deadline - Date.now()));
    const t0 = Date.now();
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        signal: ac.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: payload,
      });
      bodyText = await res.text(); // 본문까지 시간 안에 받기
    } catch {
      res = null;
      lastProblem = 'timeout';
      console.warn('gemini attempt', attempt + 1, model, 'timeout', `${Date.now() - t0}ms`);
      await pause(attempt);
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (![429, 500, 503].includes(res.status)) break;
    lastProblem = String(res.status);
    console.warn('gemini attempt', attempt + 1, model, res.status, `${Date.now() - t0}ms`, bodyText.slice(0, 120).replace(/\s+/g, ' '));
    await pause(attempt);
  }
  if (!res || [429, 500, 503].includes(res.status)) {
    console.error('gemini gave up', lastProblem);
    return { ok: false, status: 503, error: 'AI가 지금 많이 붐벼요. 잠시 뒤 다시 시도해 주세요' };
  }
  if (!res.ok) {
    console.error('gemini', model, res.status, bodyText.slice(0, 500));
    return { ok: false, status: 502, error: 'AI가 답하지 못했어요' };
  }
  let out: { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] };
  try {
    out = JSON.parse(bodyText);
  } catch {
    return { ok: false, status: 502, error: 'AI 응답을 이해하지 못했어요' };
  }
  const c = out.candidates?.[0];
  if (c?.finishReason === 'SAFETY' || c?.finishReason === 'PROHIBITED_CONTENT') return { ok: false, status: 422, error: '이 요청에는 답할 수 없어요' };
  const text = c?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    return { ok: true, data: JSON.parse(text), model };
  } catch {
    return { ok: false, status: 502, error: 'AI 응답을 이해하지 못했어요' };
  }
}

/** Supabase 로그인 확인 + ai_usage로 하루 사용 횟수 제한 (표가 없으면 제한 없이 진행) */
export async function checkUser(request: Request, kind: string, limit: number) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false as const, status: 500, error: '서버에 Supabase 설정이 없어요' };
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false as const, status: 401, error: '로그인이 필요해요' };
  const headers = { apikey: key, authorization: `Bearer ${token}` };
  const user = await fetch(`${url}/auth/v1/user`, { headers });
  if (!user.ok) return { ok: false as const, status: 401, error: '로그인이 필요해요' };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const usage = await fetch(`${url}/rest/v1/ai_usage?select=id&kind=eq.${kind}&created_at=gte.${since}`, { headers: { ...headers, prefer: 'count=exact', range: '0-0' } });
  const tracked = usage.ok;
  if (tracked && Number(usage.headers.get('content-range')?.split('/')[1] ?? 0) >= limit) return { ok: false as const, status: 429, error: `하루 ${limit}번까지 쓸 수 있어요` };
  return {
    ok: true as const,
    record: () =>
      tracked
        ? fetch(`${url}/rest/v1/ai_usage`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ kind }) }).then(() => {}, () => {})
        : Promise.resolve(),
  };
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
