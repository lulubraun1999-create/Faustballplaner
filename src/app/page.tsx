
"use client";

import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        router.push('/login');
      } else if (!user.emailVerified) {
        auth.signOut();
        toast({
          variant: 'destructive',
          title: 'E-Mail nicht verifiziert',
          description: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um sich anzumelden.',
        });
        router.push('/login');
      }
    }
  }, [user, isUserLoading, router, auth, toast]);

  const handleLogout = async () => {
    await auth.signOut();
    toast({
      title: "Abgemeldet",
      description: "Sie wurden erfolgreich abgemeldet.",
    });
    router.push('/login');
  };

  if (isUserLoading || !user || !user.emailVerified) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <main className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Willkommen!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Sie sind erfolgreich angemeldet.
        </p>
        <Button onClick={handleLogout}>Abmelden</Button>
      </main>
    </div>
  );
}
