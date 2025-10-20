
'use client';

import { useUser, useAuth, useFirestore, useCollection, useDoc, errorEmitter } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Newspaper, CalendarDays, Users, Loader2, Clock, MapPin, User as UserIcon } from 'lucide-react';
import { Header } from '@/components/header';
import Link from 'next/link';
import { collection, query, where, Timestamp, orderBy, doc, setDoc, serverTimestamp, deleteDoc, FieldValue } from 'firebase/firestore';
import { format, isSameDay, add, isFuture, addWeeks, addMonths, differenceInDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Check, HelpCircle, XIcon } from 'lucide-react';
import { FirestorePermissionError } from '@/firebase/errors';

// START: Data Interfaces
interface Event {
  id: string;
  titleId: string;
  date: Timestamp;
  endTime?: Timestamp;
  isAllDay?: boolean;
  recurrence?: 'none' | 'weekly' | 'biweekly' | 'monthly';
  recurrenceEndDate?: Timestamp;
  targetTeamIds?: string[];
  rsvpDeadline?: Timestamp;
  locationId?: string;
  meetingPoint?: string;
  description?: string;
  createdBy: string;
  createdAt: Timestamp;
}

interface EventOverride {
  id: string;
  eventId: string;
  originalDate: Timestamp;
  isCancelled?: boolean;
  cancellationReason?: string;
}

interface DisplayEvent extends Event {
  displayDate: Date;
  isCancelled?: boolean;
  cancellationReason?: string;
}

interface EventResponse {
    id: string;
    eventId: string;
    userId: string;
    eventDate: Timestamp;
    status: 'attending' | 'declined' | 'uncertain';
    reason?: string;
    respondedAt: Timestamp;
    teamId?: string;
}

interface GroupMember {
  id: string;
  vorname?: string;
  nachname?: string;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface EventTitle {
  id: string;
  name: string;
}

interface UserData {
    teamIds?: string[];
}
// END: Data Interfaces


// START: EventCard Component
const EventCard = ({ event, allUsers, locations, eventTitles, currentUserTeamIds }: { event: DisplayEvent; allUsers: GroupMember[], locations: Location[], eventTitles: EventTitle[], currentUserTeamIds: string[] }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
    const [declineReason, setDeclineReason] = useState('');

    const eventDateIdentifier = format(event.displayDate, 'yyyy-MM-dd');
    const userResponseRef = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        // Construct a predictable ID for the response document
        const responseId = `${event.id}_${eventDateIdentifier}_${user.uid}`;
        return doc(firestore, 'event_responses', responseId);
    }, [firestore, user?.uid, event.id, eventDateIdentifier]);

    const { data: userResponse, isLoading: isUserResponseLoading } = useDoc<EventResponse>(userResponseRef);

    const responsesQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'event_responses'), where('eventId', '==', event.id), where('eventDate', '==', Timestamp.fromDate(startOfDay(event.displayDate))));
    }, [firestore, event.id, event.displayDate]);
    
    const { data: responsesForThisInstance, isLoading: areResponsesLoading } = useCollection<EventResponse>(responsesQuery);


    const isRsvpVisible = useMemo(() => {
        if (!event.targetTeamIds || event.targetTeamIds.length === 0) {
            return true; 
        }
        return event.targetTeamIds.some(teamId => currentUserTeamIds.includes(teamId));
    }, [event.targetTeamIds, currentUserTeamIds]);
    
    const startDate = event.displayDate;
    
    const endDate = useMemo(() => {
        if (!event.endTime) return undefined;
        const originalEndDate = event.endTime.toDate();
        const newEndDate = new Date(startDate);
        newEndDate.setHours(originalEndDate.getHours(), originalEndDate.getMinutes(), originalEndDate.getSeconds());
        const daysDifference = differenceInDays(originalEndDate, event.date.toDate());
        if (daysDifference > 0) {
            newEndDate.setDate(newEndDate.getDate() + daysDifference);
        }
        return newEndDate;
    }, [event.date, event.endTime, startDate]);


    let timeString;
    if (event.isAllDay) {
        timeString = "Ganztägig";
    } else if (endDate) {
        timeString = `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')} Uhr`;
    } else {
        timeString = `${format(startDate, 'HH:mm')} Uhr`;
    }

    const attendingCount = responsesForThisInstance?.filter(r => r.status === 'attending').length || 0;

    const handleRsvp = (status: 'attending' | 'declined' | 'uncertain', reason?: string) => {
        if (!user || !firestore || !userResponseRef) return;

        if (status === 'declined' && reason === undefined) {
            setIsDeclineDialogOpen(true);
            return;
        }
        
        if (userResponse && userResponse.status === status && status !== 'declined') {
            deleteDoc(userResponseRef).catch(console.error);
            return;
        }
        
        const eventDateAsTimestamp = Timestamp.fromDate(startOfDay(event.displayDate));
        
        const data: Omit<EventResponse, 'id'> & { respondedAt: FieldValue } = {
            userId: user.uid,
            status: status,
            respondedAt: serverTimestamp(),
            eventDate: eventDateAsTimestamp,
            eventId: event.id,
            reason: status === 'declined' ? reason : '',
            teamId: event.targetTeamIds && event.targetTeamIds.length > 0 ? event.targetTeamIds[0] : 'public'
        };
        
        setDoc(userResponseRef, data, { merge: true }).catch(console.error);

        if (isDeclineDialogOpen) {
            setIsDeclineDialogOpen(false);
            setDeclineReason('');
        }
    };
    
    const location = locations.find(l => l.id === event.locationId);

    return (
        <Card key={`${event.id}-${event.displayDate.toISOString()}`} className={cn(event.isCancelled && "bg-destructive/10 border-destructive/30")}>
            <CardHeader>
               <div className="flex justify-between items-start">
                    <CardTitle className={cn("text-lg", event.isCancelled && "text-destructive")}>
                        {event.isCancelled ? 'ABGESAGT: ' : ''}{eventTitles.find(t => t.id === event.titleId)?.name || 'Unbenannter Termin'}
                    </CardTitle>
                </div>
                 <CardDescription className="text-base font-semibold text-foreground">{format(event.displayDate, 'eeee, dd. MMMM yyyy', { locale: de })}</CardDescription>
                 <div className="text-sm text-muted-foreground flex items-center gap-x-4 gap-y-1 pt-1">
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>{timeString}</span>
                    </div>
                    {location && (
                        <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span>{location.name}</span>
                        </div>
                    )}
                </div>
                 {event.isCancelled && event.cancellationReason && (
                    <p className="text-destructive text-sm mt-2 font-semibold">Grund: {event.cancellationReason}</p>
                )}
            </CardHeader>
            {(event.description || event.meetingPoint) && !event.isCancelled && (
                <CardContent>
                    {event.meetingPoint && <p className="text-sm"><span className="font-semibold">Treffpunkt:</span> {event.meetingPoint}</p>}
                    {event.description && <p className="text-sm whitespace-pre-wrap">{event.description}</p>}
                </CardContent>
            )}
            {!event.isCancelled && (
                <CardFooter className="flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
                 <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {areResponsesLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : `${attendingCount} Zusagen`}
                 </div>

                {isRsvpVisible && <div className="flex items-center gap-2">
                    <Button 
                        size="sm"
                        variant={userResponse?.status === 'attending' ? 'default' : 'outline'}
                        onClick={() => handleRsvp('attending')}
                        className={cn(userResponse?.status === 'attending' && 'bg-green-600 hover:bg-green-700')}
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Zusagen
                    </Button>
                     <Button 
                        size="sm"
                        variant={userResponse?.status === 'uncertain' ? 'secondary' : 'outline'}
                        onClick={() => handleRsvp('uncertain')}
                        className={cn(userResponse?.status === 'uncertain' && 'bg-yellow-500 hover:bg-yellow-600 text-black')}
                    >
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Unsicher
                    </Button>
                    <Dialog open={isDeclineDialogOpen} onOpenChange={setIsDeclineDialogOpen}>
                        <DialogTrigger asChild>
                            <Button 
                                size="sm"
                                variant={userResponse?.status === 'declined' ? 'destructive' : 'outline'}
                                onClick={() => handleRsvp('declined')}
                            >
                                <XIcon className="mr-2 h-4 w-4" />
                                Absagen
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Absagegrund</DialogTitle>
                                <DialogDescription>Bitte gib einen Grund für deine Absage an. Dies hilft den Trainern bei der Planung.</DialogDescription>
                            </DialogHeader>
                            <Textarea 
                                placeholder="z.B. Krank, Urlaub, etc."
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                            />
                            <DialogFooter>
                                 <DialogClose asChild>
                                    <Button variant="outline">Abbrechen</Button>
                                </DialogClose>
                                <Button variant="destructive" onClick={() => handleRsvp('declined', declineReason)}>Absage bestätigen</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>}
                </CardFooter>
             )}
        </Card>
    );
};
// END: EventCard Component

// START: NextMatchDay Component
function NextMatchDay() {
    const firestore = useFirestore();
    const { user, isUserLoading: isAuthLoading } = useUser();
    
    const userDocRef = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);
    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserData>(userDocRef);

    // Data fetching
    const eventsQuery = useMemo(() => firestore ? query(collection(firestore, 'events')) : null, [firestore]);
    const { data: events, isLoading: eventsLoading } = useCollection<Event>(eventsQuery);

    const overridesQuery = useMemo(() => firestore ? collection(firestore, 'event_overrides') : null, [firestore]);
    const { data: overrides, isLoading: overridesLoading } = useCollection<EventOverride>(overridesQuery);

    const locationsQuery = useMemo(() => firestore ? collection(firestore, 'locations') : null, [firestore]);
    const { data: locations, isLoading: locationsLoading } = useCollection<Location>(locationsQuery);

    const titlesQuery = useMemo(() => firestore ? collection(firestore, 'event_titles') : null, [firestore]);
    const { data: eventTitles, isLoading: titlesLoading } = useCollection<EventTitle>(titlesQuery);

    const usersQuery = useMemo(() => firestore ? collection(firestore, 'group_members') : null, [firestore]);
    const { data: allUsers, isLoading: usersLoading } = useCollection<GroupMember>(usersQuery);

    const isUserLoading = isAuthLoading || isUserDocLoading;

    const nextMatchDay = useMemo(() => {
        if (!events || !overrides || !eventTitles) return null;

        const spieltagTitleId = eventTitles.find(t => t.name.toLowerCase() === 'spieltag')?.id;
        if (!spieltagTitleId) return null;

        const now = new Date();
        const futureLimit = add(now, { years: 1 });

        const matchDayEvents = events.filter(event => event.titleId === spieltagTitleId);
        const allOccurrences: DisplayEvent[] = [];

        for (const event of matchDayEvents) {
            const originalStartDate = event.date.toDate();
            
            if (event.recurrence === 'none' || !event.recurrence) {
                if (isFuture(originalStartDate)) {
                     const override = overrides.find(o => o.eventId === event.id && isSameDay(o.originalDate.toDate(), originalStartDate));
                     if (!override || !override.isCancelled) {
                        allOccurrences.push({ ...event, displayDate: originalStartDate, isCancelled: override?.isCancelled, cancellationReason: override?.cancellationReason });
                     }
                }
                continue;
            }

            let currentDate = originalStartDate;
            const recurrenceEndDate = event.recurrenceEndDate?.toDate();
            let limit = 100; 
            
            if(currentDate < now) {
                 switch (event.recurrence) {
                    case 'weekly':
                         currentDate = addWeeks(currentDate, Math.ceil(differenceInDays(now, currentDate) / 7));
                         break;
                    case 'biweekly':
                         currentDate = addWeeks(currentDate, Math.ceil(differenceInDays(now, currentDate) / 14) * 2);
                         break;
                    case 'monthly':
                        let monthDiff = (now.getFullYear() - currentDate.getFullYear()) * 12 + now.getMonth() - currentDate.getMonth();
                        if (now.getDate() > currentDate.getDate()) monthDiff++;
                        currentDate = addMonths(currentDate, monthDiff);
                         break;
                }
            }

            while (currentDate < futureLimit && limit > 0) {
                 if (recurrenceEndDate && currentDate > recurrenceEndDate) {
                    break;
                }
                
                if(isFuture(currentDate)) {
                    const override = overrides.find(o => o.eventId === event.id && isSameDay(o.originalDate.toDate(), currentDate));
                    if (!override || !override.isCancelled) {
                       allOccurrences.push({ ...event, displayDate: currentDate, isCancelled: override?.isCancelled, cancellationReason: override?.cancellationReason });
                    }
                }

                switch (event.recurrence) {
                    case 'weekly': currentDate = addWeeks(currentDate, 1); break;
                    case 'biweekly': currentDate = addWeeks(currentDate, 2); break;
                    case 'monthly': currentDate = addMonths(currentDate, 1); break;
                    default: limit = 0; break;
                }
                limit--;
            }
        }
        
        return allOccurrences
            .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime())
            .slice(0, 1)[0] || null;

    }, [events, overrides, eventTitles]);

    const isLoading = isUserLoading || eventsLoading || overridesLoading || locationsLoading || titlesLoading || usersLoading;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!nextMatchDay) {
         return null;
    }
    
    return (
        <div className="grid gap-4">
             <h2 className="text-2xl font-bold tracking-tight">Nächster Spieltag</h2>
              <div className="border-primary border-2 rounded-lg">
                <EventCard
                    event={nextMatchDay}
                    allUsers={allUsers || []}
                    locations={locations || []}
                    eventTitles={eventTitles || []}
                    currentUserTeamIds={userData?.teamIds || []}
                />
             </div>
        </div>
    );
}
// END: NextMatchDay Component


// START: UpcomingEvents Component
function UpcomingEvents() {
    const firestore = useFirestore();
    const { user, isUserLoading: isAuthLoading } = useUser();

    const userDocRef = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);
    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserData>(userDocRef);

    // Data fetching
    const eventsQuery = useMemo(() => firestore ? query(collection(firestore, 'events')) : null, [firestore]);
    const { data: events, isLoading: eventsLoading } = useCollection<Event>(eventsQuery);

    const overridesQuery = useMemo(() => firestore ? collection(firestore, 'event_overrides') : null, [firestore]);
    const { data: overrides, isLoading: overridesLoading } = useCollection<EventOverride>(overridesQuery);

    const usersQuery = useMemo(() => firestore ? collection(firestore, 'group_members') : null, [firestore]);
    const { data: allUsers, isLoading: usersLoading } = useCollection<GroupMember>(usersQuery);

    const locationsQuery = useMemo(() => firestore ? collection(firestore, 'locations') : null, [firestore]);
    const { data: locations, isLoading: locationsLoading } = useCollection<Location>(locationsQuery);

    const titlesQuery = useMemo(() => firestore ? collection(firestore, 'event_titles') : null, [firestore]);
    const { data: eventTitles, isLoading: titlesLoading } = useCollection<EventTitle>(titlesQuery);
    
    const isUserLoading = isAuthLoading || isUserDocLoading;

    const upcomingEvents = useMemo(() => {
        if (!events || !overrides || !userData || !eventTitles) return [];

        const userTeamIds = userData.teamIds || [];
        const now = new Date();
        const futureLimit = add(now, { months: 6 }); 
        
        const relevantEvents = events.filter(event => {
            const isPublic = !event.targetTeamIds || event.targetTeamIds.length === 0;
            const isInUserTeam = event.targetTeamIds?.some(id => userTeamIds.includes(id));
            return isPublic || isInUserTeam;
        });

        const allOccurrences: DisplayEvent[] = [];

        for (const event of relevantEvents) {
            const originalStartDate = event.date.toDate();
            
            if (event.recurrence === 'none' || !event.recurrence) {
                if (isFuture(originalStartDate)) {
                     const override = overrides.find(o => o.eventId === event.id && isSameDay(o.originalDate.toDate(), originalStartDate));
                     if (!override || !override.isCancelled) {
                        allOccurrences.push({ ...event, displayDate: originalStartDate, isCancelled: override?.isCancelled, cancellationReason: override?.cancellationReason });
                     }
                }
                continue;
            }

            let currentDate = originalStartDate;
             if(currentDate < now) {
                 switch (event.recurrence) {
                    case 'weekly':
                         currentDate = addWeeks(currentDate, Math.ceil(differenceInDays(now, currentDate) / 7));
                         break;
                    case 'biweekly':
                         currentDate = addWeeks(currentDate, Math.ceil(differenceInDays(now, currentDate) / 14) * 2);
                         break;
                    case 'monthly':
                        let monthDiff = (now.getFullYear() - currentDate.getFullYear()) * 12 + now.getMonth() - currentDate.getMonth();
                        if (now.getDate() > currentDate.getDate()) monthDiff++;
                        currentDate = addMonths(currentDate, monthDiff);
                         break;
                }
            }
            
            const recurrenceEndDate = event.recurrenceEndDate?.toDate();
            let limit = 100; 

            while (currentDate < futureLimit && limit > 0) {
                 if (recurrenceEndDate && currentDate > recurrenceEndDate) {
                    break;
                }
                
                if(isFuture(currentDate)) {
                    const override = overrides.find(o => o.eventId === event.id && isSameDay(o.originalDate.toDate(), currentDate));
                    if (!override || !override.isCancelled) {
                       allOccurrences.push({ ...event, displayDate: currentDate, isCancelled: override?.isCancelled, cancellationReason: override?.cancellationReason });
                    }
                }

                switch (event.recurrence) {
                    case 'weekly': currentDate = addWeeks(currentDate, 1); break;
                    case 'biweekly': currentDate = addWeeks(currentDate, 2); break;
                    case 'monthly': currentDate = addMonths(currentDate, 1); break;
                    default: limit = 0; break;
                }
                limit--;
            }
        }
        
        return allOccurrences
            .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime())
            .slice(0, 3);

    }, [events, overrides, userData, eventTitles]);

    const isLoading = isUserLoading || eventsLoading || overridesLoading || usersLoading || locationsLoading || titlesLoading;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (upcomingEvents.length === 0) {
         return (
            <Card>
                <CardContent className="p-8">
                    <p className="text-muted-foreground text-center">Keine anstehenden Termine gefunden.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid gap-4">
             <h2 className="text-2xl font-bold tracking-tight">Nächste Termine</h2>
            {upcomingEvents.map(event => (
                <EventCard
                    key={`${event.id}-${event.displayDate.toISOString()}`}
                    event={event}
                    allUsers={allUsers || []}
                    locations={locations || []}
                    eventTitles={eventTitles || []}
                    currentUserTeamIds={userData?.teamIds || []}
                />
            ))}
        </div>
    );
}
// END: UpcomingEvents Component


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
                  Verwalte und sehe alle anstehenden Termine.
                </p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/kalender">Zum Kalender</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/80 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Mannschaften</CardTitle>
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
          
          <NextMatchDay />
          <UpcomingEvents />
         
        </div>
      </main>
    </div>
  );
}
