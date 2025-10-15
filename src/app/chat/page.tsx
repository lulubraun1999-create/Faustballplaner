
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';

interface UserData {
  adminRechte?: boolean;
  teamIds?: string[];
  vorname?: string;
  nachname?: string;
}

interface Team {
  id: string;
  name: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Timestamp;
}

interface ChatRoom {
  id: string;
  name: string;
}

const getInitials = (name: string) => {
  const nameParts = name.split(' ');
  if (nameParts.length > 1) {
    return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ChatPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [activeRoom, setActiveRoom] = useState<ChatRoom>({ id: 'general', name: 'Alle' });
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const currentUserDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: currentUserData, isLoading: isUserLoading } = useDoc<UserData>(currentUserDocRef);
  const { data: teams, isLoading: areTeamsLoading } = useCollection<Team>(useMemoFirebase(() => firestore ? collection(firestore, 'teams') : null, [firestore]));

  const chatRooms = useMemo(() => {
    const rooms: ChatRoom[] = [{ id: 'general', name: 'Alle' }];
    if (currentUserData?.adminRechte) {
      rooms.push({ id: 'trainers', name: 'Trainer & Betreuer' });
    }
    if (teams && currentUserData?.teamIds) {
      const userTeams = teams
        .filter(team => currentUserData.teamIds?.includes(team.id))
        .map(team => ({ id: team.id, name: team.name }));
      rooms.push(...userTeams);
    }
    return rooms;
  }, [currentUserData, teams]);
  
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !activeRoom) return null;
    return query(collection(firestore, 'chat_rooms', activeRoom.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, activeRoom]);

  const { data: messages, isLoading: areMessagesLoading } = useCollection<ChatMessage>(messagesQuery);
  
   useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!firestore || !user || !newMessage.trim()) return;
    setIsSending(true);

    const messageData = {
      userId: user.uid,
      username: `${currentUserData?.vorname || ''} ${currentUserData?.nachname || ''}`.trim() || user.displayName || 'Unbekannt',
      message: newMessage,
      timestamp: serverTimestamp(),
      roomId: activeRoom.id,
    };
    
    try {
        await addDoc(collection(firestore, 'chat_rooms', activeRoom.id, 'messages'), messageData);
        setNewMessage('');
    } catch(error: any) {
        toast({
            variant: 'destructive',
            title: 'Fehler beim Senden',
            description: error.message
        });
    } finally {
        setIsSending(false);
    }
  };

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    return messages.reduce((acc, message) => {
      if (!message.timestamp) return acc;
      const date = message.timestamp.toDate();
      let dayLabel;
      if (isToday(date)) {
        dayLabel = 'Heute';
      } else if (isYesterday(date)) {
        dayLabel = 'Gestern';
      } else {
        dayLabel = format(date, 'eeee, dd. MMMM yyyy', { locale: de });
      }
      
      if (!acc[dayLabel]) {
        acc[dayLabel] = [];
      }
      acc[dayLabel].push(message);
      return acc;
    }, {} as Record<string, ChatMessage[]>);
  };
  
  const groupedMessages = messages ? groupMessagesByDate(messages) : {};

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col md:grid md:grid-cols-[280px_1fr] h-[calc(100vh-4rem)]">
        <aside className="border-r flex flex-col">
           <div className="p-4 border-b">
             <h2 className="text-xl font-bold tracking-tight">Chaträume</h2>
           </div>
           <nav className="flex flex-col gap-1 p-4">
             {isUserLoading || areTeamsLoading ? (
               <div className="flex justify-center items-center p-4">
                 <Loader2 className="animate-spin h-6 w-6 text-primary" />
               </div>
             ) : (
                chatRooms.map(room => (
                  <Button
                    key={room.id}
                    variant={activeRoom.id === room.id ? 'secondary' : 'ghost'}
                    className="justify-start"
                    onClick={() => setActiveRoom(room)}
                  >
                    {room.id === 'trainers' && <Users className="mr-2 h-4 w-4" />}
                    {room.name}
                  </Button>
                ))
             )}
           </nav>
        </aside>

        <section className="flex flex-col h-full">
            <Card className="flex-1 flex flex-col rounded-none border-0 md:border-l">
                <CardHeader className="border-b">
                    <CardTitle>{activeRoom.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="space-y-6">
                        {areMessagesLoading && <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}
                        {!areMessagesLoading && Object.keys(groupedMessages).length === 0 && (
                            <p className="text-center text-muted-foreground pt-8">Noch keine Nachrichten in diesem Raum.</p>
                        )}
                        {Object.entries(groupedMessages).map(([day, dayMessages]) => (
                            <div key={day} className="relative">
                                <div className="sticky top-2 z-10 flex justify-center my-4">
                                    <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-semibold text-muted-foreground">{day.toUpperCase()}</span>
                                </div>
                                <div className="space-y-4">
                                {dayMessages.map(msg => {
                                    const isCurrentUser = msg.userId === user?.uid;
                                    return (
                                    <div key={msg.id} className={cn("flex items-end gap-2", isCurrentUser && "justify-end")}>
                                        {!isCurrentUser && (
                                            <div className="rounded-full bg-muted h-8 w-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                {getInitials(msg.username)}
                                            </div>
                                        )}
                                        <div className={cn("p-3 rounded-lg max-w-sm md:max-w-md", isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                            {!isCurrentUser && <p className="font-bold text-sm">{msg.username}</p>}
                                            <p className="whitespace-pre-wrap">{msg.message}</p>
                                            <p className={cn("text-xs mt-1", isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground")}>{msg.timestamp ? format(msg.timestamp.toDate(), 'HH:mm') : ''}</p>
                                        </div>
                                         {isCurrentUser && (
                                            <div className="rounded-full bg-primary text-primary-foreground h-8 w-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                {getInitials(msg.username)}
                                            </div>
                                        )}
                                    </div>
                                    )
                                })}
                                </div>
                            </div>
                        ))}
                         <div ref={messagesEndRef} />
                    </div>
                </CardContent>
                <CardFooter className="p-4 border-t">
                    <form className="flex w-full items-center space-x-2" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                        <Input 
                            type="text" 
                            placeholder="Nachricht schreiben..." 
                            className="flex-1" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={isSending}
                        />
                        <Button type="submit" size="icon" disabled={isSending || !newMessage.trim()}>
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </section>
      </main>
    </div>
  );
}

    