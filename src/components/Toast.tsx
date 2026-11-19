export default function Toast({ msg }: { msg: string | null }) {
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] px-4 py-2.5 rounded-full bg-lime text-black text-sm font-bold shadow-[0_8px_30px_rgba(212,255,58,.35)] transition-all duration-300 ${
        msg ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      {msg}
    </div>
  );
}
