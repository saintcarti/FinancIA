'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/dashboard');
      else setLoading(false);
    });
  }, [router]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` }
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  if (loading) return <div className="p-12 text-center text-slate-500">Cargando…</div>;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-50 to-white">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 border border-brand-100">
        <h1 className="text-2xl font-bold text-brand-900 mb-2">FinancIA Chile</h1>
        <p className="text-slate-600 mb-6">Panel de operación. Acceso solo para equipo autorizado.</p>
        {sent ? (
          <div className="bg-accent-500/10 border border-accent-500/30 rounded-lg p-4 text-sm text-slate-700">
            Te enviamos un enlace mágico a <strong>{email}</strong>. Revisa tu correo.
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@dominio.cl"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg transition"
            >
              Enviar enlace mágico
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
