'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/supabase';

interface Reg {
  id: string;
  title: string;
  source_url: string;
  document_type: string;
  effective_date: string | null;
  last_indexed_at: string;
}

export default function RegulationsPage() {
  const [items, setItems] = useState<Reg[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const j = await apiFetch(`/api/admin/regulations${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then((r) => r.json());
    setItems(j.regulations ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [q]);

  async function reingest() {
    await apiFetch('/api/admin/regulations/reingest', { method: 'POST' });
    setTimeout(load, 5000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-900">Normativa indexada</h1>
        <button
          onClick={reingest}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Re-ingestar
        </button>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por título..."
        className="w-full border border-slate-200 rounded-lg px-4 py-2 mb-4"
      />
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Título</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Indexado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
            {items.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{r.title}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{r.document_type}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{new Date(r.last_indexed_at).toLocaleDateString('es-CL')}</td>
                <td className="px-4 py-3 text-sm">
                  <a href={r.source_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Fuente ↗</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
