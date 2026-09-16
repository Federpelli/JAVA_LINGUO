'use client';

import { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app:error-boundary]', error);
  }, [error]);

  return (
    <main className="lesson-loading-screen" role="alert">
      <TriangleAlert aria-hidden="true" />
      <strong>JAVA_linguo ha incontrato un errore</strong>
      <p>I progressi già salvati restano disponibili. Puoi ricaricare questa schermata e continuare.</p>
      <Button onClick={reset}><RefreshCw /> Riprova</Button>
    </main>
  );
}
