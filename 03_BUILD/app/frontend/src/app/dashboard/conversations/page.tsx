'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/supabase';

interface Conv {
  id: string;
  channel: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  satisfaction: string;
  topics: string[];
  flagged: boolean;
}

export default function ConversationsPage() {
  const [items, setItems] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');

  useEffect(() => {
    const q = filter === 'flagged' ? '?flagged=true' : '';
    apiFetch(`/api/admin/conversations${q}`)
      .then((r) => r.json())
      .then((j) => setItems(j.conversations ?? []))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-900">Conversaciones</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('flagged')}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'flagged' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`}
          >
            Solo flagged
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Canal</th>
              <th className="px-4 py-3 text-left">Última actividad</th>
              <th className="px-4 py-3 text-left">Mensajes</th>
              <th className="px-4 py-3 text-left">Satisfacción</th>
              <th className="px-4 py-3 text-left">Temas</th>
              <th className="px-4 py-3 text-left">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Sin conversaciones aún.</td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs ${c.channel === 'instagram' ? 'bg-pink-100 text-pink-700' : 'bg-green-100 text-green-700'}`}>
                    {c.channel}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{new Date(c.last_message_at).toLocaleString('es-CL')}</td>
                <td className="px-4 py-3 text-sm">{c.message_count}</td>
                <td className="px-4 py-3 text-sm">
                  {c.satisfaction === 'thumbs_up' && '👍'}
                  {c.satisfaction === 'thumbs_down' && '👎'}
                  {c.satisfaction === 'none' && '—'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{(c.topics ?? []).join(', ')}</td>
                <td className="px-4 py-3 text-sm">
                  <Link href={`/dashboard/conversations/${c.id}`} className="text-brand-600 hover:underline">Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
