
'use client';

import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function ChatPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col p-4 md:p-8">
        <div className="mx-auto max-w-2xl w-full flex flex-col flex-1">
           <Card className="flex-1 flex flex-col">
            <CardHeader>
                <CardTitle>Chat</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
                 <div className="space-y-4">
                    {/* Placeholder for messages */}
                    <div className="flex items-end gap-2">
                        <div className="rounded-full bg-muted h-8 w-8 flex items-center justify-center text-sm font-bold">MB</div>
                        <div className="p-3 rounded-lg bg-muted max-w-xs">
                            <p className="font-bold text-sm">Max Mustermann</p>
                            <p>Hallo zusammen!</p>
                        </div>
                    </div>
                     <div className="flex items-end gap-2 justify-end">
                        <div className="p-3 rounded-lg bg-primary text-primary-foreground max-w-xs">
                            <p className="font-bold text-sm">Sie</p>
                            <p>Hey! Wie geht's?</p>
                        </div>
                        <div className="rounded-full bg-primary text-primary-foreground h-8 w-8 flex items-center justify-center text-sm font-bold">DU</div>
                    </div>
                     <p className="text-center text-xs text-muted-foreground">Chat-Funktionalität wird in Kürze implementiert.</p>
                </div>
            </CardContent>
            <CardFooter>
                 <div className="flex w-full items-center space-x-2">
                    <Input type="text" placeholder="Nachricht schreiben..." className="flex-1" disabled/>
                    <Button type="submit" size="icon" disabled>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
           </Card>
        </div>
      </main>
    </div>
  );
}
