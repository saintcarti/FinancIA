import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinancIA Chile — Admin',
  description: 'Panel de operación de FinancIA Chile'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
