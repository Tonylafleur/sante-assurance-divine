import React, { useState, useRef, useEffect } from 'react';
import { Search, X, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

interface CIM10Code {
  code: string;
  libelle: string;
}

interface Props {
  label?: string;
  value?: { code: string; libelle: string } | null;
  onChange: (val: { code: string; libelle: string } | null) => void;
  placeholder?: string;
}

export const CIM10Search: React.FC<Props> = ({
  label = "Code CIM-10",
  value,
  onChange,
  placeholder = "Rechercher par code ou libellé (ex: B50, paludisme...)",
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CIM10Code[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/cim10/search?q=${encodeURIComponent(q)}&limit=15`);
        setResults(res.data.results);
        setOpen(true);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  };

  const select = (item: CIM10Code) => {
    onChange(item);
    setQuery('');
    setOpen(false);
  };

  const clear = () => { onChange(null); setQuery(''); };

  return (
    <div ref={wrapRef} className="relative">
      {label && <label className="label">{label}</label>}

      {value ? (
        <div className="flex items-center gap-2 p-2.5 border border-emerald-300 bg-emerald-50 rounded-xl">
          <CheckCircle size={15} className="text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-mono text-xs font-bold text-emerald-700 mr-2">{value.code}</span>
            <span className="text-sm text-emerald-800 truncate">{value.libelle}</span>
          </div>
          <button type="button" onClick={clear} className="p-0.5 hover:bg-emerald-200 rounded transition-colors">
            <X size={14} className="text-emerald-600" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 pr-4"
            placeholder={placeholder}
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value); }}
            onFocus={() => query.length >= 2 && setOpen(true)}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}

      {open && results.length > 0 && !value && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map(item => (
            <button
              key={item.code}
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors border-b border-slate-50 last:border-0"
              onMouseDown={() => select(item)}
            >
              <span className="font-mono text-xs font-bold text-primary-700 mr-2">{item.code}</span>
              <span className="text-sm text-slate-700">{item.libelle}</span>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3">
          <p className="text-sm text-slate-400 text-center">Aucun résultat pour « {query} »</p>
        </div>
      )}
    </div>
  );
};
