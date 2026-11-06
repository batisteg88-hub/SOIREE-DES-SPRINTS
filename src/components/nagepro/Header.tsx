'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Printer, Home, ClipboardCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { UserNav } from '@/components/auth/UserNav';


export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-lg border-b border-slate-700/50 no-print">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3">
                <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center font-bold">NP</div>
                <h1 className="font-bold tracking-tight text-lg">NagePro <span className="text-sky-400 font-light">HYBRID</span></h1>
            </Link>
            <div className="flex items-center gap-2">
                {pathname !== '/' && (
                    <Link href="/">
                        <Button 
                          variant="outline"
                          size="sm"
                          className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                        >
                            <Home className="mr-2 h-4 w-4"/>
                            Accueil
                        </Button>
                    </Link>
                )}
                {pathname !== '/attendance' && (
                    <Link href="/attendance">
                        <Button 
                          variant="outline"
                          size="sm"
                          className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                        >
                            <ClipboardCheck className="mr-2 h-4 w-4"/>
                            Émargement
                        </Button>
                    </Link>
                )}
                
                <Button 
                  onClick={() => window.print()} 
                  variant="outline"
                  size="sm"
                  className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                >
                    <Printer />
                </Button>

                <UserNav />
            </div>
        </div>
    </header>
  );
}
