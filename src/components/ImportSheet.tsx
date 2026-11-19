import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { buildImport, type ImportPreview } from '../lib/importSheet';
import type { CloudRepo } from '../lib/storage';
import { errText } from '../lib/supabase';
import { prettyDate } from '../lib/date';
import type { CustomExercise, WorkoutLog } from '../lib/types';
import Sheet from './Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  cloud: CloudRepo;
  logs: WorkoutLog[];
  custom: CustomExercise[];
  onDone: () => void;
  toast: (m: string) => void;
}

/** 예전 구글 시트(운동기록_DB) CSV → 계정으로 가져오기 */
export default function ImportSheet({ open, onClose, cloud, logs, custom, onDone, toast }: Props) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const close = () => {
    setPreview(null);
    setFileName('');
    onClose();
  };

  const onPick = async (f?: File) => {
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      toast('엑셀 파일은 안 돼요. 구글 시트에서 CSV로 내려받아 주세요');
      return;
    }
    setFileName(f.name);
    setPreview(buildImport(await f.text(), logs, custom));
    if (input.current) input.current.value = '';
  };

  const run = async () => {
    if (!preview?.logs.length) return;
    setBusy(true);
    try {
      for (const c of preview.newExercises) await cloud.addCustom(c);
      await cloud.importLogs(preview.logs);
      toast(`${preview.logs.length}개 기록을 가져왔어요`);
      onDone();
      close();
    } catch (e) {
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const n = preview?.logs.length ?? 0;
  return (
    <Sheet open={open} title="예전 기록 가져오기" onClose={close} action={{ label: busy ? '가져오는 중' : '가져오기', disabled: busy || n === 0, onClick: run }}>
      <div className="group-card !bg-elevcard px-4 py-3.5 text-[14px] leading-relaxed">
        <p className="font-semibold">구글 시트에서 CSV로 내려받기</p>
        <ol className="list-decimal pl-5 mt-1 text-sub space-y-0.5">
          <li>예전 시트에서 아래 탭 <b className="text-ink">운동기록_DB</b>를 여세요</li>
          <li>메뉴 <b className="text-ink">파일 → 다운로드 → 쉼표로 구분된 값(.csv)</b></li>
          <li>받은 파일을 아래에서 선택하세요</li>
        </ol>
      </div>

      <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      <button onClick={() => input.current?.click()} className="tap w-full group-card !bg-elevcard row gap-3 min-h-[60px] text-left">
        <span className="w-10 h-10 rounded-full bg-accent/10 text-accent grid place-items-center shrink-0">
          <FileUp aria-hidden className="w-5 h-5" strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold truncate">{fileName || 'CSV 파일 선택'}</span>
          <span className="block text-[13px] text-sub">이미 있는 기록은 자동으로 건너뛰어요</span>
        </span>
      </button>

      {preview && (
        <div className="group-card !bg-elevcard">
          <div className="row justify-between">
            <span className="text-[16px]">가져올 기록</span>
            <span className="num text-[22px] text-accent">{n}</span>
          </div>
          {preview.from && (
            <div className="row justify-between">
              <span className="text-[16px]">기간</span>
              <span className="text-[15px] text-sub">{prettyDate(preview.from)} ~ {prettyDate(preview.to!)}</span>
            </div>
          )}
          <div className="row justify-between">
            <span className="text-[16px]">이미 있어서 건너뜀</span>
            <span className="num text-[18px]">{preview.duplicates}</span>
          </div>
          {preview.newExercises.length > 0 && (
            <div className="px-4 py-3 shadow-[inset_0_1px_0_var(--sep)]">
              <div className="text-[16px]">내 종목에 추가 <span className="num text-[18px] ml-1">{preview.newExercises.length}</span></div>
              <p className="text-[13px] text-sub mt-0.5">{preview.newExercises.map((e) => e.exercise).join(', ')}</p>
            </div>
          )}
          {preview.skipped.length > 0 && (
            <div className="px-4 py-3 shadow-[inset_0_1px_0_var(--sep)]">
              <div className="text-[16px] text-down">읽을 수 없는 줄 {preview.skipped.length}개</div>
              <p className="text-[13px] text-sub mt-0.5">{preview.skipped.slice(0, 3).map((s) => `${s.line}번째 줄: ${s.reason}`).join(' · ')}{preview.skipped.length > 3 ? ' …' : ''}</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
