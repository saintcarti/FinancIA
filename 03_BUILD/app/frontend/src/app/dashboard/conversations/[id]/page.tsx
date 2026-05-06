'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/supabase';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [cost, setCost] = useState(0);
  const [override, setOverride] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const j = await apiFetch(`/api/admin/conversations/${id}`).then((r) => r.json());
    setMsgs(j.messages ?? []);
    setCost(j.total_cost_usd ?? 0);
  }

  useEffect(() => { void load(); }, [id]);

  async function send() {
    if (!override.trim()) return;
    setSending(true);
    setStatus(null);
    const r = await apiFetch(`/api/admin/conversations/${id}/override`, {
      method: 'POST',
      body: JSON.stringify({ message: override })
    });
    if (r.ok) {
      setStatus('Mensaje enviado. Bot pausado por 24h en esta conversación.');
      setOverride('');
      void load();
    } else {
      setStatus('Error al enviar.');
    }
    setSending(false);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-900">Conversación</h1>
        <span className="text-sm text-slate-500">Costo total: ${cost.toFixed(4)}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 max-h-[60vh] overflow-auto">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-slate-100 text-slate-900 rounded-bl-sm'
              }`}
            >
              {m.content}
              <div className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-brand-100' : 'text-slate-500'}`}>
                {new Date(m.created_at).toLocaleString('es-CL')}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <div className="text-sm font-medium text-amber-900">Override manual (humano)</div>
        <textarea
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder="Escribe la respuesta humana. Pausará el bot 24h."
          className="w-full border border-amber-200 rounded-lg p-2 text-sm"
          rows={3}
        />
        <button
          onClick={send}
          disabled={sending}
          className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {sending ? 'Enviando…' : 'Enviar como humano'}
        </button>
        {status && <div className="text-xs text-amber-900">{status}</div>}
      </div>
    </div>
  );
}
