export default function Toast({ msg }: { msg: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] px-4 py-2.5 rounded-full bg-ink text-onink text-[14px] font-semibold transition-all duration-200 ease-apple ${
        msg ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      {msg}
    </div>
  );
}
