'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/supabase';

interface Reel {
  id: string;
  topic: string;
  caption: string;
  asset_url: string;
  ig_media_id: string | null;
  published_at: string | null;
}

export default function ReelsPage() {
  const [items, setItems] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  async function load() {
    const j = await apiFetch('/api/admin/reels').then((r) => r.json());
    setItems(j.reels ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function regenerate() {
    setRegenerating(true);
    await apiFetch('/api/admin/reels/regenerate', {
      method: 'POST',
      body: JSON.stringify({ publish: false })
    });
    setRegenerating(false);
    setTimeout(load, 3000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-900">Reels</h1>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
        >
          {regenerating ? 'Encolando…' : 'Generar Reel ahora'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {loading && <div className="col-span-3 text-slate-500">Cargando…</div>}
        {items.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="aspect-[9/16] bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
              {r.asset_url ? (
                <video src={r.asset_url} controls className="w-full h-full object-cover" />
              ) : (
                'Sin video'
              )}
            </div>
            <div className="p-3">
              <div className="text-sm font-medium text-slate-900 truncate">{r.topic}</div>
              <div className="text-xs text-slate-500 mt-1">
                {r.published_at ? `Publicado ${new Date(r.published_at).toLocaleDateString('es-CL')}` : 'Borrador'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
