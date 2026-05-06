'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

interface DailyMetric {
  date: string;
  conversations: number;
  useful_conversations: number;
  thumbs_up: number;
  thumbs_down: number;
  cost_usd: number;
  reels_published: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/metrics/daily')
      .then((r) => r.json())
      .then((j) => setData(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const today = data[data.length - 1];
  const totalConv = data.reduce((s, d) => s + d.conversations, 0);
  const totalCost = data.reduce((s, d) => s + Number(d.cost_usd), 0);
  const usefulPct = totalConv > 0
    ? Math.round((data.reduce((s, d) => s + d.useful_conversations, 0) / totalConv) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-900">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <Card label="Conversaciones hoy" value={today?.conversations ?? 0} />
        <Card label="Costo hoy (USD)" value={`$${(Number(today?.cost_usd ?? 0)).toFixed(2)}`} />
        <Card label="Útiles 30d" value={`${usefulPct}%`} />
        <Card label="Costo total 30d" value={`$${totalCost.toFixed(2)}`} />
      </div>

      {loading ? (
        <div className="text-slate-500">Cargando…</div>
      ) : data.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          Aún no hay métricas. Cuando lleguen las primeras conversaciones, aparecerán aquí.
        </div>
      ) : (
        <>
          <Section title="Conversaciones por día (30d)">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="conversations" stroke="#1f60d6" strokeWidth={2} />
                <Line type="monotone" dataKey="useful_conversations" stroke="#11b07a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Section>
          <Section title="Costo Claude por día (USD)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="cost_usd" fill="#1f60d6" />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-brand-900 mt-1">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">{title}</h2>
      {children}
    </div>
  );
}
