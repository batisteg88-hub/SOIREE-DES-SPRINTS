'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user, auth } = useFirebase();

  // If already logged in, go to home
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.toUpperCase() === 'NAGEPRO') {
      setIsLoggingIn(true);
      try {
        // Use real anonymous auth to provide a valid token for Firestore rules
        await signInAnonymously(auth);
        
        localStorage.setItem('nagepro_access_granted', 'true');
        toast({
          title: "Accès autorisé",
          description: "Bienvenue sur NagePro Hybrid.",
        });
        
        // Navigation is handled by the useEffect above once auth state updates
      } catch (error: any) {
        console.error("Login error:", error);
        toast({
          variant: "destructive",
          title: "Erreur d'authentification",
          description: "Impossible de se connecter aux services de données.",
        });
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      toast({
        variant: "destructive",
        title: "Code incorrect",
        description: "Le code d'accès saisi est invalide.",
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-primary">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 bg-primary rounded-xl flex items-center justify-center font-black text-white text-xl mb-2">NP</div>
          <CardTitle className="text-2xl font-black uppercase tracking-tight">NagePro <span className="text-primary">Hybrid</span></CardTitle>
          <CardDescription>Entrez votre code d'accès pour accéder aux données de performance.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Code d'accès"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-xl font-mono tracking-[0.5em] h-12 focus-visible:ring-primary"
                autoFocus
                disabled={isLoggingIn}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold uppercase tracking-wider"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Connexion..." : "Déverrouiller"}
            </Button>
          </form>
          <p className="text-center text-[10px] text-muted-foreground mt-6 uppercase font-bold tracking-widest">
            Système d'Analyse CSS Bi-Phase
          </p>
        </CardContent>
      </Card>
    </div>
  );
}