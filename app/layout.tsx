import type { Metadata } from 'next';
import './globals.css';
import FullscreenShortcut from './fullscreen-shortcut';

export const metadata: Metadata = {
  title: 'JAVA_linguo · Impara Java con teoria e laboratorio',
  description: 'Corso open source di Java con lezioni universitarie, verifiche ed esecuzione del codice in una sandbox Docker locale.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>
        <FullscreenShortcut />
        {children}
      </body>
    </html>
  );
}
