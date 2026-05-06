'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LogOut, MessageSquare, BarChart3, Film, FileText } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/dashboard/conversations', label: 'Conversaciones', icon: MessageSquare },
  { href: '/dashboard/reels', label: 'Reels', icon: Film },
  { href: '/dashboard/regulations', label: 'Normativa', icon: FileText }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/'); return; }
      setEmail(data.session.user.email ?? null);
    });
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-slate-200 bg-white p-4 flex flex-col">
        <h1 className="text-lg font-bold text-brand-900 mb-6 px-2">FinancIA · Admin</h1>
        <nav className="space-y-1 flex-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ' +
                  (active
                    ? 'bg-brand-50 text-brand-900 font-medium'
                    : 'text-slate-700 hover:bg-slate-100')
                }
              >
                <Icon size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="text-xs text-slate-500 truncate px-2 mb-2">{email}</div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
