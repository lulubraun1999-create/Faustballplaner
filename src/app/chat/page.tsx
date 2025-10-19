
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useUser, useCollection, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, Timestamp, doc, deleteDoc, where, getDocs, setDoc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Users, Trash2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

interface UserChatStatus {
    lastSeen: Timestamp;
}

const getInitials = (name: string) => {
  if (!name) return '??';
  const nameParts = name.split(' ');
  if (nameParts.length > 1 && nameParts[0] && nameParts[nameParts.length - 1]) {
    return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const ChatRoomButton = ({ room, activeRoom, setActiveRoom, unreadCount }: { room: ChatRoom, activeRoom: ChatRoom | null, setActiveRoom: (room: ChatRoom) => void, unreadCount: number }) => {
    return (
        <Button
            variant={activeRoom?.id === room.id ? 'secondary' : 'ghost'}
            className="justify-between w-full"
            onClick={() => setActiveRoom(room)}
        >
            <div className="flex items-center gap-2">
                {room.id === 'trainers' && <Users className="mr-2 h-4 w-4" />}
                <span>{room.name}</span>
            </div>
            {unreadCount > 0 && (
                <Badge className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
            )}
        </Button>
    )
}

export default function ChatPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});


  const currentUserDocRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: currentUserData, isLoading: isUserLoading } = useDoc<UserData>(currentUserDocRef);
  
  const teamsQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'teams');
  }, [firestore]);
  const { data: teams, isLoading: areTeamsLoading } = useCollection<Team>(teamsQuery);
  
  const chatRooms = useMemo(() => {
    const rooms: ChatRoom[] = [{ id: 'general', name: 'Alle' }];
    if (currentUserData?.adminRechte) {
      rooms.push({ id: 'trainers', name: 'Trainer & Betreuer' });
    }
    if (teams && currentUserData?.teamIds) {
      const userTeams = teams
        .filter(team => currentUserData.teamIds?.includes(team.id))
        .map(team => ({ id: team.id, name: team.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      rooms.push(...userTeams);
    }
    return rooms;
  }, [currentUserData, teams]);

  useEffect(() => {
    if (chatRooms.length > 0 && !activeRoom) {
      setActiveRoom(chatRooms[0]);
    }
  }, [chatRooms, activeRoom]);

  useEffect(() => {
    if (!firestore || !user || chatRooms.length <= 1) return;

    const unsubscribes: (() => void)[] = [];

    const fetchAndListen = async () => {
        for (const room of chatRooms) {
            // "general" room has public read access, no specific permission check needed here for unread count
            if (room.id === 'general') {
                setUnreadCounts(prev => ({...prev, [room.id]: 0})); // Assume 0 or implement different logic
                continue;
            };

            try {
                const statusRef = doc(firestore, 'users', user.uid, 'chat_status', room.id);
                const statusSnapshot = await getDocs(query(collection(firestore, 'users', user.uid, 'chat_status'), where('__name__', '==', room.id)));
                const lastSeen = statusSnapshot.docs.length > 0 ? (statusSnapshot.docs[0].data() as UserChatStatus).lastSeen : new Timestamp(0, 0);
                
                const messagesRef = collection(firestore, 'chat_rooms', room.id, 'messages');
                const q = query(messagesRef, where('timestamp', '>', lastSeen), where('userId', '!=', user.uid));
                
                const unsubscribe = onSnapshot(q, (snapshot) => {
                     setUnreadCounts(prevCounts => ({
                        ...prevCounts,
                        [room.id]: snapshot.size,
                    }));
                }, (error) => {
                    console.error(`Error listening to unread count for room ${room.id}:`, error);
                });
                unsubscribes.push(unsubscribe);

            } catch (error) {
                console.error(`Error processing room ${room.id}:`, error);
                setUnreadCounts(prev => ({...prev, [room.id]: 0}));
            }
        }
    };

    fetchAndListen();

    return () => unsubscribes.forEach(unsub => unsub());
  }, [firestore, user, chatRooms]);


  useEffect(() => {
    if(!firestore || !user || !activeRoom) return;

    const statusRef = doc(firestore, 'users', user.uid, 'chat_status', activeRoom.id);
    setDoc(statusRef, { lastSeen: serverTimestamp() }, { merge: true });
    // Also reset the local unread count for the active room
    setUnreadCounts(prev => ({...prev, [activeRoom.id]: 0}));

  }, [firestore, user, activeRoom]);

  
  const messagesQuery = useMemo(() => {
    if (!firestore || !activeRoom) return null;
    return query(collection(firestore, 'chat_rooms', activeRoom.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, activeRoom]);

  const { data: messages, isLoading: areMessagesLoading } = useCollection<ChatMessage>(messagesQuery);
  
   useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!firestore || !user || !newMessage.trim() || !activeRoom) return;
    setIsSending(true);

    const messageData = {
      userId: user.uid,
      username: `${currentUserData?.vorname || ''} ${currentUserData?.nachname || ''}`.trim() || user.displayName || 'Unbekannt',
      message: newMessage,
      timestamp: serverTimestamp(),
      roomId: activeRoom.id,
    };
    
    const messagesCollection = collection(firestore, 'chat_rooms', activeRoom.id, 'messages');

    addDoc(messagesCollection, messageData)
        .then(() => {
            setNewMessage('');
        })
        .catch((serverError) => {
             const permissionError = new FirestorePermissionError({
                path: messagesCollection.path,
                operation: 'create',
                requestResourceData: messageData,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsSending(false);
        });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!firestore || !activeRoom || !user) return;
    
    const messageToDelete = messages?.find(m => m.id === messageId);
    if (!messageToDelete || messageToDelete.userId !== user.uid) {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Sie können nur Ihre eigenen Nachrichten löschen.",
        });
        return;
    }

    const messageRef = doc(firestore, 'chat_rooms', activeRoom.id, 'messages', messageId);
    
    deleteDoc(messageRef)
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: messageRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  }

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
        <aside className={cn("border-r flex-col", activeRoom ? "hidden md:flex" : "flex")}>
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
                  <ChatRoomButton
                      key={room.id}
                      room={room}
                      activeRoom={activeRoom}
                      setActiveRoom={setActiveRoom}
                      unreadCount={unreadCounts[room.id] || 0}
                  />
                ))
             )}
           </nav>
        </aside>

        <section className={cn("flex-col h-full", activeRoom ? "flex" : "hidden md:flex")}>
            <Card className="flex-1 flex flex-col rounded-none border-0 md:border-l">
                <CardHeader className="border-b flex-row items-center gap-4">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveRoom(null)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <CardTitle>{activeRoom?.name || 'Lade...'}</CardTitle>
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
                                    <div key={msg.id} className={cn("flex items-end gap-2 group", isCurrentUser && "justify-end")}>
                                        {!isCurrentUser && (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <div className="rounded-full bg-muted h-8 w-8 flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-pointer">
                                                        {getInitials(msg.username)}
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-2">
                                                    <p className="text-sm font-semibold">{msg.username}</p>
                                                </PopoverContent>
                                            </Popover>
                                        )}

                                        {isCurrentUser && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive-foreground hover:bg-destructive/80 hover:text-destructive-foreground"
                                                onClick={() => handleDeleteMessage(msg.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}

                                        <div className={cn("p-3 rounded-lg max-w-sm md:max-w-md", isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                            {!isCurrentUser && <p className="font-bold text-sm">{msg.username}</p>}
                                            <p className="whitespace-pre-wrap">{msg.message}</p>
                                            <p className={cn("text-xs mt-1", isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground")}>{msg.timestamp ? format(msg.timestamp.toDate(), 'HH:mm') : ''}</p>
                                        </div>
                                         {isCurrentUser && (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <div className="rounded-full bg-primary text-primary-foreground h-8 w-8 flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-pointer">
                                                        {getInitials(msg.username)}
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-2">
                                                    <p className="text-sm font-semibold">{msg.username}</p>
                                                </PopoverContent>
                                            </Popover>
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

    