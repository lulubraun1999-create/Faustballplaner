
"use client";

import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Newspaper, CalendarDays, Users, MessageSquare } from 'lucide-react';
import { Header } from '@/components/header';
import Link from 'next/link';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && !auth) {
        return;
    }
    if (!isUserLoading) {
      if (!user) {
        router.push('/login');
      } else if (!user.emailVerified) {
        if(auth) {
            auth.signOut();
        }
        toast({
          variant: 'destructive',
          title: 'E-Mail nicht verifiziert',
          description: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um sich anzumelden.',
        });
        router.push('/login');
      }
    }
  }, [user, isUserLoading, router, auth]);

  if (isUserLoading || !user || !user.emailVerified) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-primary"></div>
        <p className="mt-4 text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto grid max-w-6xl gap-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:border-primary/80 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Aktuelle Nachrichten</CardTitle>
                <Newspaper className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Bleiben Sie auf dem Laufenden.
                </p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/aktuelles">Zu den News</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/80 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Termine</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Infos zu vergangenen und zukünftigen Spielen.
                </p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/termine">Zu den Terminen</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/80 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Kader</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Lernen Sie die Mannschaften besser kennen.
                </p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/mannschaften">Zu den Kadern</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
         
        </div>
      </main>
    </div>
  );
}
