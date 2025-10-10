'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Newspaper,
  Trophy,
  Users,
  Sparkles,
  MessagesSquare,
  PanelLeft,
} from 'lucide-react';

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import React from 'react';

const navItems = [
  { href: '/', label: 'News Feed', icon: Newspaper },
  { href: '/matches', label: 'Match Center', icon: Trophy },
  { href: '/squad', label: 'Player Squad', icon: Users },
  { href: '/highlights', label: 'AI Highlights', icon: Sparkles },
  { href: '/forum', label: 'Fan Forum', icon: MessagesSquare },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center p-1">
              <svg role="img" viewBox="0 0 24 24" className="h-full w-full" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round">
                  <path d="M12 5V19" />
                  <path d="M5 12H19" />
              </svg>
            </div>
            <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">
              Werkself Hub
            </span>
          </Link>
          <div className="md:hidden">
            <SidebarTrigger asChild>
              <Button variant="ghost" size="icon">
                <PanelLeft />
              </Button>
            </SidebarTrigger>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
