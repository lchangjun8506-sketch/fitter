interface Props<T extends string> {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}

/** iOS 세그먼트 컨트롤 (화면 안의 하위 탭) */
export default function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="tablist" aria-label={label} className="grid bg-fill rounded-[12px] p-[3px]" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={`h-10 rounded-[9px] text-[15px] transition-all duration-200 ease-apple ${on ? 'bg-seg font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'font-medium text-sub'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
