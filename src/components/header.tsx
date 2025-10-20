
"use client";

import { useAuth, useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronDown, User as UserIcon, Instagram, Menu, Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import Link from 'next/link';
import { ModeToggle } from './mode-toggle';
import { cn } from '@/lib/utils';
import React from 'react';

const NavLink = ({ href, children, onNavigate }: { href: string, children: React.ReactNode, onNavigate?: () => void }) => {
    const pathname = usePathname();
    const isActive = pathname.startsWith(href);
    return (
        <Link 
            href={href} 
            onClick={onNavigate}
            className={cn("transition-colors hover:text-foreground/80", isActive ? 'text-foreground' : 'text-muted-foreground')}
        >
            {children}
        </Link>
    )
}

export function Header() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

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
  
  const verwaltungPaths = ["/mannschaften", "/mitglieder", "/admin/news", "/umfragen", "/mannschaftskasse"];
  const isVerwaltungActive = verwaltungPaths.some(p => pathname.startsWith(p));


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <div className="flex items-center gap-2 md:gap-6 flex-1">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Menü öffnen</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left">
                <nav className="grid gap-6 text-lg font-medium mt-8">
                     <Link href="/" className="flex items-center gap-2 mb-4" onClick={() => setIsMobileMenuOpen(false)}>
                        <span className="font-bold text-lg">TSV Bayer Leverkusen</span>
                    </Link>
                    <NavLink href="/kalender" onNavigate={() => setIsMobileMenuOpen(false)}>Kalender</NavLink>
                    <NavLink href="/chat" onNavigate={() => setIsMobileMenuOpen(false)}>Chat</NavLink>
                    <p className="text-muted-foreground">Verwaltung</p>
                    <div className="grid gap-4 pl-4 text-base">
                        <NavLink href="/aktuelles" onNavigate={() => setIsMobileMenuOpen(false)}>Newsverwaltung</NavLink>
                        <NavLink href="/mannschaften" onNavigate={() => setIsMobileMenuOpen(false)}>Mannschaften</NavLink>
                        <NavLink href="/mitglieder" onNavigate={() => setIsMobileMenuOpen(false)}>Mitglieder</NavLink>
                        <NavLink href="/admin/news" onNavigate={() => setIsMobileMenuOpen(false)}>News bearbeiten</NavLink>
                        <NavLink href="/umfragen" onNavigate={() => setIsMobileMenuOpen(false)}>Umfragen</NavLink>
                        <NavLink href="/termine" onNavigate={() => setIsMobileMenuOpen(false)}>Termine</NavLink>
                        <NavLink href="/mannschaftskasse" onNavigate={() => setIsMobileMenuOpen(false)}>Mannschaftskasse</NavLink>
                    </div>
                </nav>
            </SheetContent>
          </Sheet>
          <Link href="/" className="hidden md:flex items-center gap-2">
             <span className="font-bold text-lg">TSV Bayer Leverkusen</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center justify-center gap-6 text-sm font-medium flex-1">
          <Link 
            href="/kalender" 
            className={cn("transition-colors hover:text-foreground/80", pathname.startsWith('/kalender') ? 'text-foreground' : 'text-muted-foreground')}
            >
            Kalender
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
                <Link href="/aktuelles">Newsverwaltung</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/mannschaften">Mannschaften</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/mitglieder">Mitglieder</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/news">News bearbeiten</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/umfragen">Umfragen</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/termine">Termine</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/mannschaftskasse">Mannschaftskasse</Link>
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
                <span className="hidden sm:inline">{user?.displayName || 'Benutzer'}</span>
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
