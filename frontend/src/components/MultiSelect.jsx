import React, { useEffect, useRef, useState } from 'react';

export default function MultiSelect({ label, options, selected, onChange, getValue, getLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const valueOf = getValue || ((o) => o);
  const labelOf = getLabel || ((o) => o);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };

  const summary = selected.length === 0
    ? 'All'
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        <span className="font-medium">{summary}</span>
        <span className="float-right text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full max-h-56 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg p-2">
          <button
            type="button"
            className="w-full text-left text-xs text-brand font-semibold px-2 py-1.5 hover:bg-brand-soft rounded"
            onClick={() => onChange([])}
          >
            Clear selection (show all)
          </button>
          {options.map((opt) => {
            const val = valueOf(opt);
            const checked = selected.includes(val);
            return (
              <label key={val} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(val)}
                  className="rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span>{labelOf(opt)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
