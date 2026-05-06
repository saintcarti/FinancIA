'use client';
import { useEffect, useState } from 'react';
import { apiFetch, supabase } from '@/lib/supabase';

interface EvalRun {
  id: string;
  ran_at: string;
  total_questions: number;
  passed: number;
  avg_latency_ms: number;
  avg_cost_usd: string;
}

export default function EvalsPage() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('eval_runs')
      .select('id, ran_at, total_questions, passed, avg_latency_ms, avg_cost_usd')
      .order('ran_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setRuns((data ?? []) as EvalRun[]);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-6">Eval runs</h1>
      <p className="text-sm text-slate-600 mb-6">
        Resultados de la suite de evaluación del agente. Corre con <code className="bg-slate-100 px-1 rounded">npm run eval:rag</code>.
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Pass rate</th>
              <th className="px-4 py-3 text-left">Latency p50</th>
              <th className="px-4 py-3 text-left">Costo total</th>
              <th className="px-4 py-3 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
            {!loading && runs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                Aún no hay corridas. Ejecuta <code>npm run eval:rag</code> en el backend.
              </td></tr>
            )}
            {runs.map((r) => {
              const rate = (r.passed / r.total_questions) * 100;
              const color = rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-600' : 'text-red-600';
              return (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">{new Date(r.ran_at).toLocaleString('es-CL')}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${color}`}>
                    {r.passed}/{r.total_questions} ({rate.toFixed(0)}%)
                  </td>
                  <td className="px-4 py-3 text-sm">{r.avg_latency_ms}ms</td>
                  <td className="px-4 py-3 text-sm">${(Number(r.avg_cost_usd) * r.total_questions).toFixed(3)}</td>
                  <td className="px-4 py-3 text-sm">{r.total_questions}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
