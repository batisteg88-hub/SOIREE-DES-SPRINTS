'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Page de programme supprimée. 
 * Redirige automatiquement vers l'accueil.
 */
export default function ProgrammePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400 animate-pulse font-bold uppercase tracking-widest text-xs">
        Redirection vers l'accueil...
      </p>
    </div>
  );
}
