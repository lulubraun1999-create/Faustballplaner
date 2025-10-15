
"use client";

import { useAuth, useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronDown, User as UserIcon, Instagram } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from 'next/link';
import { ModeToggle } from './mode-toggle';
import { cn } from '@/lib/utils';

export function Header() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
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
  
  const verwaltungPaths = ["/mannschaften", "/mitglieder", "/admin/news", "/umfragen", "/termine"];
  const isVerwaltungActive = verwaltungPaths.some(p => pathname.startsWith(p));


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <div className="flex items-center gap-6 flex-1">
          <Link href="/" className="flex items-center gap-2">
             <span className="font-bold text-lg">TSV Bayer Leverkusen</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center justify-center gap-4 text-sm font-medium flex-1">
          <Link 
            href="/aktuelles" 
            className={cn("transition-colors hover:text-foreground/80", pathname === '/aktuelles' ? 'text-foreground' : 'text-muted-foreground')}
          >
            Aktuelles
          </Link>
          <Link 
            href="/chat" 
            className={cn("transition-colors hover:text-foreground/80", pathname === '/chat' ? 'text-foreground' : 'text-muted-foreground')}
            >
            Chat
          </Link>
           <DropdownMenu>
            <DropdownMenuTrigger className={cn(
                "flex items-center gap-1 transition-colors hover:text-foreground/80 focus:outline-none",
                isVerwaltungActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
            )}>
              Verwaltung
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link href="/mannschaften">Mannschaften</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/mitglieder">Mitglieder</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/news">News</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/umfragen">Umfragen</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/termine">Termine</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center justify-end gap-2 flex-1">
            <ModeToggle />
            <a href="https://www.instagram.com/tsvbayer04_faustball" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon">
                <Instagram className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Instagram</span>
              </Button>
            </a>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                {user?.displayName || 'Benutzer'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/profile-settings">Profileinstellungen</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4"/>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
