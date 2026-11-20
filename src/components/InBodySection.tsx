import { useRef, useState } from 'react';
import { FileText, Loader2, ScanLine, Trash2 } from 'lucide-react';
import { INBODY_FIELDS, deleteInBody, openInBodyFile, prepareFile, saveInBody, type InBodyRecord, type InBodyValues } from '../lib/inbody';
import { scanInBody } from '../lib/inbodyScan';
import { errText } from '../lib/supabase';
import { prettyDate, todayStr } from '../lib/date';
import Sheet from './Sheet';

type Draft = Record<keyof InBodyValues, string>;
const toDraft = (v: InBodyValues): Draft => {
  const d = { measured_at: v.measured_at && /^\d{4}-\d{2}-\d{2}$/.test(v.measured_at) ? v.measured_at : todayStr() } as Draft;
  for (const f of INBODY_FIELDS) d[f.key] = v[f.key] == null ? '' : String(v[f.key]);
  return d;
};
const fromDraft = (d: Draft): InBodyValues & { measured_at: string } => {
  const out = { measured_at: d.measured_at } as InBodyValues & { measured_at: string };
  for (const f of INBODY_FIELDS) {
    const n = parseFloat(d[f.key].replace(',', '.'));
    out[f.key] = Number.isFinite(n) ? n : null;
  }
  return out;
};

function Delta({ now, prev, goodUp }: { now: number | null; prev: number | null; goodUp: boolean }) {
  if (now == null || prev == null) return null;
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return <span className="text-[12px] text-sub">변화 없음</span>;
  const good = goodUp ? d > 0 : d < 0;
  return <span className={`text-[12px] font-semibold ${good ? 'text-up' : 'text-down'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}</span>;
}

interface Props {
  toast: (m: string) => void;
  records: InBodyRecord[];
  reload: () => void;
}

export default function InBodySection({ toast, records, reload: load }: Props) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const file = useRef<{ blob: Blob; ext: string } | undefined>();
  const input = useRef<HTMLInputElement>(null);


  const onPick = async (f: File | undefined) => {
    if (!f) return;
    setScanning(true);
    if (preview) URL.revokeObjectURL(preview);
    try {
      file.current = await prepareFile(f);
      setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
      try {
        const result = await scanInBody(f);
        setNotice(
          result.found === 0
            ? 'AI가 값을 찾지 못했어요. 결과지를 보면서 직접 입력해 주세요.'
            : `AI가 ${result.found}개 항목을 읽었어요. 저장 전에 결과지와 한 번 비교해 주세요.` +
                (result.derived.length ? ` (계산으로 채운 항목: ${result.derived.join('·')})` : ''),
        );
        setDraft(toDraft(result.values));
      } catch (e) {
        // AI가 못 읽어도 올린 파일은 그대로 두고 직접 입력으로
        setNotice(`${errText(e)} 결과지를 보면서 직접 입력해 주세요.`);
        setDraft(toDraft({} as InBodyValues));
      }
    } catch (e) {
      toast(errText(e));
    } finally {
      setScanning(false);
      if (input.current) input.current.value = '';
    }
  };

  const [latest, prev] = records;

  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="section-label">인바디</h2>
        <button
          onClick={() => {
            file.current = undefined;
            setPreview(null);
            setNotice(null);
            setDraft(toDraft({} as InBodyValues));
          }}
          className="tap h-9 px-1 pb-2 text-[14px] text-sub"
        >
          직접 입력
        </button>
      </div>

      <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      <button
        disabled={scanning}
        onClick={() => input.current?.click()}
        className="tap w-full group-card row gap-3 min-h-[64px] text-left disabled:opacity-70"
      >
        <span className="w-10 h-10 rounded-full bg-accent/10 text-accentfg grid place-items-center shrink-0">
          {scanning ? <Loader2 aria-hidden className="w-5 h-5 animate-spin" /> : <ScanLine aria-hidden className="w-5 h-5" strokeWidth={1.75} />}
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-semibold">{scanning ? 'AI가 결과지를 읽는 중이에요' : '결과지 올리기 · AI 스캔'}</span>
          <span className="block text-[13px] text-sub">
            {scanning ? '보통 5~10초 걸려요' : '사진 또는 PDF를 올리면 AI가 수치를 읽어요 · 하루 10번'}
          </span>
        </span>
      </button>
      <p className="px-4 pt-1.5 text-[12px] text-sub leading-relaxed">올린 결과지는 수치를 읽기 위해 Google Gemini로 전송돼요. 원본은 내 계정에만 보관돼요.</p>

      {latest && (
        <div className="group-card mt-3">
          <div className="px-4 pt-3.5 pb-1 flex items-baseline justify-between">
            <span className="text-[13px] text-sub">최근 측정 · {prettyDate(latest.measured_at)}</span>
            {latest.inbody_score != null && <span className="text-[13px] text-sub">점수 <b className="num text-[17px] text-ink">{latest.inbody_score}</b></span>}
          </div>
          <div className="grid grid-cols-3 px-4 pb-3.5">
            {([['weight', '체중', 'kg', false], ['skeletal_muscle', '골격근량', 'kg', true], ['body_fat_pct', '체지방률', '%', false]] as const).map(([k, label, unit, goodUp]) => (
              <div key={k}>
                <div className="caption">{label}</div>
                <div className="num text-[28px] leading-none mt-1">{latest[k] ?? '–'}<span className="text-[14px] text-sub ml-0.5">{unit}</span></div>
                <Delta now={latest[k]} prev={prev?.[k] ?? null} goodUp={goodUp} />
              </div>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="group-card mt-3">
          {records.map((r) => (
            <div key={r.id} className="row gap-2 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold">{prettyDate(r.measured_at)}</div>
                <div className="text-[13px] text-sub truncate">
                  {r.weight ?? '–'}kg · 골격근 {r.skeletal_muscle ?? '–'}kg · 체지방 {r.body_fat_pct ?? '–'}%
                </div>
              </div>
              {r.file_path && (
                <button aria-label="원본 결과지 보기" onClick={() => openInBodyFile(r.file_path!).catch((e) => toast(errText(e)))} className="tap w-11 h-11 grid place-items-center text-sub">
                  <FileText aria-hidden className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </button>
              )}
              <button aria-label="인바디 기록 삭제" onClick={() => confirm('이 인바디 기록을 삭제할까요?') && deleteInBody(r).then(load).catch((e) => toast(errText(e)))} className="tap w-11 h-11 -mr-3 grid place-items-center text-sub">
                <Trash2 aria-hidden className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Sheet
        open={!!draft}
        title="인바디 확인"
        onClose={() => setDraft(null)}
        action={{
          label: saving ? '저장 중' : '저장',
          disabled: saving || !draft?.measured_at,
          onClick: async () => {
            if (!draft) return;
            setSaving(true);
            try {
              await saveInBody(fromDraft(draft), file.current);
              setDraft(null);
              toast('인바디를 저장했어요');
              load();
            } catch (e) {
              toast(errText(e));
            } finally {
              setSaving(false);
            }
          },
        }}
      >
        {draft && (
          <>
            {notice && <p className="px-1 text-[14px] text-sub leading-relaxed">{notice}</p>}
            {preview && (
              <a href={preview} target="_blank" rel="noreferrer" className="block group-card !bg-elevcard">
                <img src={preview} alt="올린 결과지" className="w-full max-h-[40dvh] object-contain" />
              </a>
            )}
            <div className="group-card !bg-elevcard">
              <div className="row justify-between">
                <span className="text-[16px]">측정일</span>
                <input type="date" value={draft.measured_at} onChange={(e) => setDraft({ ...draft, measured_at: e.target.value })} className="bg-transparent text-[16px] text-sub text-right focus:outline-none" />
              </div>
              {INBODY_FIELDS.map((f) => (
                <label key={f.key} className="row justify-between gap-3">
                  <span className="text-[16px] shrink-0">{f.label}</span>
                  <span className="flex items-baseline gap-1 min-w-0">
                    <input inputMode="decimal" value={draft[f.key]} placeholder="–" onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                      className="num w-24 min-w-0 bg-transparent text-right text-[20px] placeholder:text-sub/50 focus:outline-none" />
                    <span className="w-8 text-[13px] text-sub">{f.unit}</span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </Sheet>
    </section>
  );
}
