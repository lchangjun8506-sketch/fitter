import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  children: ReactNode;
}

/** iOS 스타일 하단 시트: 취소 / 제목 / 확인. body에 바로 붙여 탭 바·애니메이션 영역 위에 뜨게 함 */
export default function Sheet({ open, title, onClose, action, children }: Props) {
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className={`fixed inset-0 z-[70] transition-[visibility] duration-300 ${open ? 'visible' : 'invisible pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/50 dark:bg-black/70 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md max-h-[88dvh] overflow-y-auto overscroll-contain bg-elev rounded-t-[14px] px-4 pt-2 pb-[max(env(safe-area-inset-bottom),24px)] transition-transform duration-300 ease-apple ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-9 h-[5px] rounded-full bg-sub/40" />
        <div className="flex items-center justify-between h-14 sticky top-0 bg-elev z-10">
          <button onClick={onClose} className="tap h-11 min-w-[44px] px-1 text-left text-[17px] text-sub">취소</button>
          <h3 className="text-[17px] font-semibold">{title}</h3>
          {action ? (
            <button disabled={action.disabled} onClick={action.onClick} className="tap h-11 min-w-[44px] px-1 text-right text-[17px] font-semibold text-accent disabled:text-sub/50">
              {action.label}
            </button>
          ) : (
            <span className="min-w-[44px]" />
          )}
        </div>
        <div className="space-y-6 pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
