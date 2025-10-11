
"use client";

import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function Header() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if(auth) {
      await auth.signOut();
      toast({
        title: "Abgemeldet",
        description: "Sie wurden erfolgreich abgemeldet.",
      });
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <span className="font-bold">Werkself Hub</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-end">
            <Button onClick={handleLogout} variant="ghost" size="sm">
                <LogOut className="mr-2 h-4 w-4"/>
                Abmelden
            </Button>
        </div>
      </div>
    </header>
  );
}
