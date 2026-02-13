import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Strategy Kernel',
  description: 'Personal data reactor — unified life records for strategy, growth, and self-knowledge',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
