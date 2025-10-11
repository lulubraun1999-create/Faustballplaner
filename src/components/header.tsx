
"use client";

import { useAuth, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LogOut, Moon, ChevronDown, User as UserIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from 'next/link';
import Image from 'next/image';

export function Header() {
  const auth = useAuth();
  const { user } = useUser();
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
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <div className="flex items-center gap-6 flex-1">
          <Link href="/" className="flex items-center gap-2">
             <span className="font-bold text-lg">TSV Bayer Leverkusen</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center justify-center gap-4 text-sm font-medium flex-1">
          <Link href="/aktuelles" className="text-foreground transition-colors hover:text-foreground/80">
            Aktuelles
          </Link>
          <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground/80">
            Chat
          </Link>
           <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground/80 focus:outline-none">
              Verwaltung
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Gruppen</DropdownMenuItem>
              <DropdownMenuItem>Mitglieder</DropdownMenuItem>
              <DropdownMenuItem>News</DropdownMenuItem>
              <DropdownMenuItem>Umfragen</DropdownMenuItem>
              <DropdownMenuItem>Termine</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center justify-end gap-4 flex-1">
           <Button variant="ghost" size="icon">
             <Moon className="h-5 w-5" />
           </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                {user?.displayName || 'Benutzer'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mein Konto</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profil</DropdownMenuItem>
              <DropdownMenuItem>Einstellungen</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4"/>
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
