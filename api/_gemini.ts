/**
 * Google Gemini 호출 공용 (파일 이름이 _로 시작하면 Vercel이 주소로 열지 않음)
 * 기본 모델이 붐비면(503·429) 가벼운 모델로 한 번 더 시도.
 * 키: GEMINI_API_KEY (서버 전용), 모델: GEMINI_MODEL (선택)
 */
export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export type GeminiResult =
  | { ok: true; data: unknown; model: string }
  | { ok: false; status: number; error: string };

export async function geminiJson(opts: { parts: Part[]; schema: object; system?: string; temperature?: number }): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: 'AI 기능이 아직 설정되지 않았어요' };
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.6-flash', 'gemini-3.5-flash-lite'])];
  let res: Response | null = null;
  let model = models[0];
  for (model of models) {
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
          contents: [{ role: 'user', parts: opts.parts }],
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: opts.schema, temperature: opts.temperature ?? 0 },
        }),
      });
    } catch {
      res = null;
      continue;
    }
    if (res.status !== 503 && res.status !== 429) break;
  }
  if (!res) return { ok: false, status: 502, error: 'AI 서버에 연결하지 못했어요' };
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('gemini', model, res.status, detail.slice(0, 500));
    if (res.status === 429 || res.status === 503) return { ok: false, status: 503, error: 'AI가 잠시 붐벼요. 조금 뒤에 다시 시도해 주세요' };
    return { ok: false, status: 502, error: 'AI가 답하지 못했어요' };
  }
  const out = (await res.json()) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] };
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
