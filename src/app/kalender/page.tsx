

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { de } from 'date-fns/locale';
import { useFirestore, useCollection, useUser, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, orderBy, doc, setDoc, serverTimestamp, onSnapshot, addDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { Loader2, CalendarIcon, Clock, MapPin, Repeat, Check, XIcon, Users, HelpCircle, Ban, CheckCircle2, Edit, Trash2 } from 'lucide-react';
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  isWithinInterval,
  isSameMonth,
  startOfDay,
  add,
  differenceInDays,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


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
  // ... other fields from Event might be here
}

interface DisplayEvent extends Event {
  displayDate: Date;
  isCancelled?: boolean;
}

interface EventResponse {
    id: string;
    eventId: string;
    userId: string;
    eventDate: Timestamp;
    status: 'attending' | 'declined' | 'uncertain';
    respondedAt: Timestamp;
}


interface TeamCategory {
  id: string;
  name: string;
  order: number;
}

interface Team {
  id: string;
  name: string;
  categoryId: string;
}

interface UserData {
    adminRechte?: boolean;
    teamIds?: string[];
}


interface GroupMember {
  id: string;
  vorname?: string;
  nachname?: string;
  teamIds?: string[];
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


const getRecurrenceText = (recurrence?: string) => {
  switch (recurrence) {
    case 'weekly':
      return 'Wöchentlich';
    case 'biweekly':
      return 'Alle 2 Wochen';
    case 'monthly':
      return 'Monatlich';
    default:
      return null;
  }
};


const EventCard = ({ event, allUsers, locations, eventTitles, currentUserTeamIds, canEdit, onReactivate, onCancel }: { event: DisplayEvent; allUsers: GroupMember[], locations: Location[], eventTitles: EventTitle[], currentUserTeamIds: string[], canEdit: boolean, onCancel: (event: DisplayEvent) => void, onReactivate: (event: DisplayEvent) => void; }) => {
    const { user } = useUser();
    const firestore = useFirestore();

    const responsesQuery = useMemo(() => {
        if (!event.id || !firestore) return null;
        return query(collection(firestore, 'event_responses'), where('eventId', '==', event.id))
    }, [firestore, event.id]);

    const { data: allResponses, isLoading: responsesLoading } = useCollection<EventResponse>(responsesQuery);
    
    const responsesForThisInstance = useMemo(() => {
        if (!allResponses) return [];
        return allResponses.filter(r => 
            r.eventDate && isSameDay(r.eventDate.toDate(), event.displayDate)
        );
    }, [allResponses, event.displayDate]);
    
    const userResponse = useMemo(() => {
         return responsesForThisInstance.find(r => r.userId === user?.uid);
    }, [responsesForThisInstance, user]);

    const isRsvpVisible = useMemo(() => {
        if (!event.targetTeamIds || event.targetTeamIds.length === 0) {
            return true; // Event is for everyone
        }
        return event.targetTeamIds.some(teamId => currentUserTeamIds.includes(teamId));
    }, [event.targetTeamIds, currentUserTeamIds]);


    const recurrenceText = getRecurrenceText(event.recurrence);
    
    const startDate = event.displayDate;
    
    const endDate = useMemo(() => {
        if (!event.endTime) return undefined;

        const originalEndDate = event.endTime.toDate();
        const displayStartDate = event.displayDate;

        // Clone the start date to avoid modifying it
        const newEndDate = new Date(displayStartDate.getTime());

        // Set the time from the original end date
        newEndDate.setHours(originalEndDate.getHours());
        newEndDate.setMinutes(originalEndDate.getMinutes());
        newEndDate.setSeconds(originalEndDate.getSeconds());

        // Handle day overflow if end time is on the next day
        const daysDifference = differenceInDays(originalEndDate, event.date.toDate());
        if (daysDifference > 0) {
          newEndDate.setDate(newEndDate.getDate() + daysDifference);
        }

        return newEndDate;
    }, [event.date, event.endTime, event.displayDate]);


    let timeString;
    if (event.isAllDay) {
        timeString = "Ganztägig";
    } else if (endDate) {
        timeString = `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')} Uhr`;
    } else {
        timeString = `${format(startDate, 'HH:mm')} Uhr`;
    }

    const attendingCount = responsesForThisInstance.filter(r => r.status === 'attending').length || 0;
    const declinedCount = responsesForThisInstance.filter(r => r.status === 'declined').length || 0;
    const uncertainCount = responsesForThisInstance.filter(r => r.status === 'uncertain').length || 0;

    const getResponderName = (userId: string) => {
      const responder = allUsers.find(u => u.id === userId);
      return responder ? `${responder.vorname || ''} ${responder.nachname || ''}`.trim() : 'Unbekannt';
    };

    const attendees = useMemo(() => {
        return responsesForThisInstance
            .filter(r => r.status === 'attending')
            .map(r => getResponderName(r.userId))
            .sort();
    }, [responsesForThisInstance, allUsers]);

    const decliners = useMemo(() => {
        return responsesForThisInstance
            .filter(r => r.status === 'declined')
            .map(r => getResponderName(r.userId))
            .sort();
    }, [responsesForThisInstance, allUsers]);
    
    const uncertains = useMemo(() => {
        return responsesForThisInstance
            .filter(r => r.status === 'uncertain')
            .map(r => getResponderName(r.userId))
            .sort();
    }, [responsesForThisInstance, allUsers]);


    const handleRsvp = (status: 'attending' | 'declined' | 'uncertain') => {
        if (!user || !firestore) return;

        const responseCollectionRef = collection(firestore, 'event_responses');
        
        if (userResponse && userResponse.status === status) {
            // User is toggling off their current status, so delete the response
            const responseRef = doc(responseCollectionRef, userResponse.id);
            deleteDoc(responseRef)
                .catch(serverError => {
                    const permissionError = new FirestorePermissionError({
                        path: responseRef.path,
                        operation: 'delete',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
            return;
        }

        // Set or update the response
        const eventDateAsTimestamp = Timestamp.fromDate(startOfDay(event.displayDate));
        const responseDocId = userResponse?.id || doc(responseCollectionRef).id;
        
        const data: Omit<EventResponse, 'id'| 'respondedAt'> & { respondedAt: any } = {
            userId: user.uid,
            status: status,
            respondedAt: serverTimestamp(),
            eventDate: eventDateAsTimestamp,
            eventId: event.id,
        };
        
        const responseRef = doc(responseCollectionRef, responseDocId);

        setDoc(responseRef, data, { merge: true })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: responseRef.path,
                    operation: 'write',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };
    
    const location = locations.find(l => l.id === event.locationId);
    const isRecurring = event.recurrence && event.recurrence !== 'none';

    return (
        <Card key={`${event.id}-${event.displayDate.toISOString()}`} className={cn(event.isCancelled && "bg-destructive/10 border-destructive/30")}>
            <CardHeader>
               <div className="flex justify-between items-start">
                    <CardTitle className={cn(event.isCancelled && "text-destructive")}>
                        {event.isCancelled ? 'ABGESAGT: ' : ''}{eventTitles.find(t => t.id === event.titleId)?.name || 'Unbenannter Termin'}
                    </CardTitle>
                    {canEdit && (
                        <div className="flex items-center">
                            {isRecurring && (
                                event.isCancelled ? (
                                    <Button variant="ghost" size="icon" className="hover:bg-green-500/10 hover:text-green-600" onClick={() => onReactivate(event)}>
                                        <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="hover:bg-amber-500/10 hover:text-amber-600"><Ban className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Nur diesen Termin absagen?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird nur dieser eine Termin am {format(event.displayDate, "dd.MM.yyyy")} abgesagt. Die Serie bleibt bestehen.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onCancel(event)} className="bg-amber-500 hover:bg-amber-600">Ja, nur diesen Termin absagen</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )
                            )}
                        </div>
                    )}
                </div>
                 <div className="text-sm text-muted-foreground flex items-center gap-x-4 gap-y-1 pt-1">
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>{timeString}</span>
                    </div>
                    {location && (
                        <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            {location.name ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="hover:underline cursor-pointer">{location.name}</button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-3">
                                        <div>{location.address}</div>
                                        <div>{location.city}</div>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <span>{location.address}, {location.city}</span>
                            )}
                        </div>
                    )}
                    {recurrenceText && (
                        <Badge variant="outline" className="flex items-center gap-1.5 w-fit mt-1 sm:mt-0">
                            <Repeat className="h-3 w-3" />
                            <span>{recurrenceText}</span>
                        </Badge>
                    )}
                </div>
            </CardHeader>
            {(!event.isCancelled && (event.description || event.meetingPoint)) && (
                <CardContent className="space-y-2">
                    {event.meetingPoint && <p className="text-sm"><span className="font-semibold">Treffpunkt:</span> {event.meetingPoint}</p>}
                    {event.description && <p className="text-sm whitespace-pre-wrap">{event.description}</p>}
                </CardContent>
            )}
             {!event.isCancelled && (
                <CardFooter className="flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
                 <Popover>
                    <PopoverTrigger asChild>
                         <Button variant="link" className="p-0 h-auto text-muted-foreground" disabled={responsesLoading || (attendingCount === 0 && declinedCount === 0 && uncertainCount === 0)}>
                             {responsesLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                            <span className="flex gap-2">
                                <span className="text-green-600">{attendingCount} Zusagen</span>
                                <span className="text-red-600">{declinedCount} Absagen</span>
                                {uncertainCount > 0 && <span className="text-yellow-600">{uncertainCount} Unsicher</span>}
                            </span>
                         </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-sm mb-2">Zusagen ({attendees.length})</h4>
                                {attendees.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {attendees.map((name, i) => <li key={i}>{name}</li>)}
                                    </ul>
                                ) : <p className="text-xs text-muted-foreground">Noch keine Zusagen.</p>}
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm mb-2">Unsicher ({uncertains.length})</h4>
                                {uncertains.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {uncertains.map((name, i) => <li key={i}>{name}</li>)}
                                    </ul>
                                ) : <p className="text-xs text-muted-foreground">Keine unsicheren Antworten.</p>}
                            </div>
                             <div>
                                <h4 className="font-semibold text-sm mb-2">Absagen ({decliners.length})</h4>
                                {decliners.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {decliners.map((name, i) => <li key={i}>{name}</li>)}
                                    </ul>
                                ) : <p className="text-xs text-muted-foreground">Noch keine Absagen.</p>}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

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
                    <Button 
                        size="sm"
                        variant={userResponse?.status === 'declined' ? 'destructive' : 'outline'}
                        onClick={() => handleRsvp('declined')}
                    >
                        <XIcon className="mr-2 h-4 w-4" />
                        Absagen
                    </Button>
                </div>}
                </CardFooter>
             )}
        </Card>
    );
};


export default function KalenderPage() {
  const { user } = useUser();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kalenderTeamFilter');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const [selectedTitleIds, setSelectedTitleIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kalenderTitleFilter');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const firestore = useFirestore();
  const { toast } = useToast();

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  
  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  useEffect(() => {
    localStorage.setItem('kalenderTeamFilter', JSON.stringify(selectedTeamIds));
  }, [selectedTeamIds]);

  useEffect(() => {
    localStorage.setItem('kalenderTitleFilter', JSON.stringify(selectedTitleIds));
  }, [selectedTitleIds]);

  const userDocRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserLoading } = useDoc<UserData>(userDocRef);

  const canEditEvents = userData?.adminRechte;


  const categoriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'team_categories'), orderBy('order'));
  }, [firestore]);
  
  const teamsQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'teams');
  }, [firestore]);
  
  const locationsQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'locations');
  }, [firestore]);

  const eventTitlesQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'event_titles');
  }, [firestore]);

  const eventsQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'events');
  }, [firestore]);
  
  const overridesQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'event_overrides');
  }, [firestore]);

  const groupMembersQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'group_members');
  }, [firestore]);


  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
  const { data: eventsData, isLoading: eventsLoading, error } = useCollection<Event>(eventsQuery);
  const { data: overridesData, isLoading: overridesLoading } = useCollection<EventOverride>(overridesQuery);
  const { data: allUsers, isLoading: usersLoading } = useCollection<GroupMember>(groupMembersQuery);
  const { data: locations, isLoading: locationsLoading } = useCollection<Location>(locationsQuery);
  const { data: eventTitles, isLoading: eventTitlesLoading } = useCollection<EventTitle>(eventTitlesQuery);
  
  const currentUserTeamIds = useMemo(() => {
    if (!user || !allUsers) return [];
    const currentUser = allUsers.find(u => u.id === user.uid);
    return currentUser?.teamIds || [];
  }, [user, allUsers]);

  const isLoading = isUserLoading || categoriesLoading || teamsLoading || eventsLoading || usersLoading || locationsLoading || eventTitlesLoading || overridesLoading;

 const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    }));
  }, [categories, teams]);


 const allVisibleEvents = useMemo(() => {
    if (!eventsData || !overridesData) return [];

    const filteredByTeam = eventsData.filter(event => {
        if (selectedTeamIds.length === 0) return true; // Show all if no team filter
        if (!event.targetTeamIds || event.targetTeamIds.length === 0) return true; // Show events for all teams
        return event.targetTeamIds.some(id => selectedTeamIds.includes(id));
    });

    const filteredByTitle = filteredByTeam.filter(event => {
      if (selectedTitleIds.length === 0) return true; // show all if no title filter
      return selectedTitleIds.includes(event.titleId);
    });

    const visibleEvents: DisplayEvent[] = [];
    const interval = { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) };

    for (const event of filteredByTitle) {
      const originalStartDate = event.date.toDate();
      const recurrenceEndDate = event.recurrenceEndDate?.toDate();

      if (event.recurrence === 'none' || !event.recurrence) {
        if (isWithinInterval(originalStartDate, interval)) {
          const override = overridesData.find(o => o.eventId === event.id && isSameDay(o.originalDate.toDate(), originalStartDate));
          const finalEvent = override ? { ...event, ...override, displayDate: override.date?.toDate() || originalStartDate, isCancelled: override.isCancelled } : { ...event, displayDate: originalStartDate };
          visibleEvents.push(finalEvent);
        }
        continue;
      }

      let currentDate = originalStartDate;
      
      if (currentDate < interval.start) {
        let tempDate = new Date(currentDate);
        if (event.recurrence === 'weekly' || event.recurrence === 'biweekly') {
            const weeksDiff = Math.floor((interval.start.getTime() - tempDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            const step = event.recurrence === 'weekly' ? 1 : 2;
            const stepsToSkip = Math.floor(weeksDiff / step);
            if (stepsToSkip > 0) {
              tempDate = addWeeks(tempDate, stepsToSkip * step);
            }
        } else if (event.recurrence === 'monthly') {
             const monthDiff = (interval.start.getFullYear() - tempDate.getFullYear()) * 12 + (interval.start.getMonth() - tempDate.getMonth());
             if (monthDiff > 0) {
                tempDate = addMonths(tempDate, monthDiff -1);
             }
        }
        currentDate = tempDate;
      }


      let limit = 100; // safety break
      while (currentDate <= interval.end && limit > 0) {
        if (recurrenceEndDate && currentDate > recurrenceEndDate) {
            limit = 0; // Stop if the recurrence end date is passed
            continue;
        }

        if (isWithinInterval(currentDate, interval)) {
            const override = overridesData.find(o => o.eventId === event.id && isSameDay(o.originalDate.toDate(), currentDate));
            let finalEvent: DisplayEvent;
            
            if (override) {
                 finalEvent = {
                    ...event,
                    ...override,
                    id: event.id, // Keep original event ID
                    displayDate: override.date?.toDate() || currentDate,
                    isCancelled: override.isCancelled,
                 };
            } else {
                finalEvent = { ...event, displayDate: currentDate };
            }

            if (event.endTime) {
                const originalEndDate = event.endTime.toDate();
                const displayStartDate = finalEvent.displayDate;
                let newEndDate = new Date(displayStartDate.getTime());
                newEndDate.setHours(originalEndDate.getHours(), originalEndDate.getMinutes(), originalEndDate.getSeconds());
                const daysDifference = differenceInDays(originalEndDate, event.date.toDate());
                if(daysDifference > 0) {
                    newEndDate.setDate(newEndDate.getDate() + daysDifference);
                }
                finalEvent.endTime = Timestamp.fromDate(newEndDate);
            }
            
            if (event.rsvpDeadline) {
                const originalRsvpDate = event.rsvpDeadline.toDate();
                const displayStartDate = finalEvent.displayDate;
                let newRsvpDate = new Date(displayStartDate.getTime());
                newRsvpDate.setHours(originalRsvpDate.getHours(), originalRsvpDate.getMinutes(), originalRsvpDate.getSeconds());
                 const daysDifference = differenceInDays(originalRsvpDate, event.date.toDate());
                if(daysDifference !== 0) {
                   newRsvpDate.setDate(newRsvpDate.getDate() + daysDifference);
                }
                finalEvent.rsvpDeadline = Timestamp.fromDate(newRsvpDate);
            }
            visibleEvents.push(finalEvent);
        }

        switch (event.recurrence) {
            case 'weekly':
                currentDate = addWeeks(currentDate, 1);
                break;
            case 'biweekly':
                currentDate = addWeeks(currentDate, 2);
                break;
            case 'monthly':
                currentDate = addMonths(currentDate, 1);
                break;
            default:
                limit = 0;
                break;
        }
        limit--;
      }
    }
    return visibleEvents;
  }, [eventsData, overridesData, currentMonth, selectedTeamIds, selectedTitleIds]);
  
  const eventDates = useMemo(() => {
    return allVisibleEvents.filter(e => !e.isCancelled).map(event => event.displayDate);
  }, [allVisibleEvents]);
  
  const cancelledEventDates = useMemo(() => {
     return allVisibleEvents.filter(e => e.isCancelled).map(event => event.displayDate);
  }, [allVisibleEvents]);
  
  const selectedEvents = useMemo(() => {
     if (!selectedDate) return [];
     return allVisibleEvents
      .filter(event => isSameDay(event.displayDate, selectedDate))
      .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime());
  }, [selectedDate, allVisibleEvents]);

  const handleCancelSingleEvent = async (eventToCancel: DisplayEvent) => {
    if (!firestore || !canEditEvents) return;

    const overrideData = {
        eventId: eventToCancel.id,
        originalDate: Timestamp.fromDate(startOfDay(eventToCancel.displayDate)),
        isCancelled: true,
        updatedAt: serverTimestamp(),
    };
    
    const overridesRef = collection(firestore, 'event_overrides');
    const q = query(overridesRef, where("eventId", "==", eventToCancel.id), where("originalDate", "==", overrideData.originalDate));
    const querySnapshot = await getDocs(q);
    

    try {
        if(!querySnapshot.empty) {
            const existingOverrideId = querySnapshot.docs[0].id;
            await updateDoc(doc(firestore, 'event_overrides', existingOverrideId), { isCancelled: true, updatedAt: serverTimestamp() });
        } else {
            await addDoc(overridesRef, overrideData);
        }
        
        toast({ title: 'Termin abgesagt' });
    } catch (serverError: any) {
        toast({
            variant: "destructive",
            title: "Fehler beim Absagen",
            description: serverError.message
        });
    }
  };

  const handleReactivateSingleEvent = async (eventToReactivate: DisplayEvent) => {
    if (!firestore || !canEditEvents) return;

    const overridesRef = collection(firestore, 'event_overrides');
    const q = query(overridesRef, where("eventId", "==", eventToReactivate.id), where("originalDate", "==", Timestamp.fromDate(startOfDay(eventToReactivate.displayDate))));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const existingOverrideId = querySnapshot.docs[0].id;
      try {
        await updateDoc(doc(firestore, 'event_overrides', existingOverrideId), { isCancelled: false, updatedAt: serverTimestamp() });
        toast({ title: 'Termin reaktiviert' });
      } catch (serverError: any) {
        toast({
          variant: "destructive",
          title: "Fehler beim Reaktivieren",
          description: serverError.message
        });
      }
    }
  };


  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Kalender</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Filter</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {isLoading ? <Loader2 className="animate-spin" /> : (
                         <Accordion type="multiple" className="w-full" defaultValue={['teams', 'titles']}>
                            <AccordionItem value="teams">
                                <AccordionTrigger>Mannschaften</AccordionTrigger>
                                <AccordionContent>
                                    {groupedTeams.map(category => (
                                      <Accordion key={category.id} type="multiple" className="w-full">
                                        <AccordionItem value={`cat-${category.id}`} className="border-b-0">
                                            <AccordionTrigger className="pl-2 hover:no-underline">{category.name}</AccordionTrigger>
                                            <AccordionContent className="pl-4">
                                            {category.teams.map(team => (
                                                <div key={team.id} className="flex items-center space-x-2 p-1">
                                                    <Checkbox
                                                        id={`kalender-team-${team.id}`}
                                                        checked={selectedTeamIds.includes(team.id)}
                                                        onCheckedChange={(checked) => {
                                                            return checked
                                                            ? setSelectedTeamIds([...selectedTeamIds, team.id])
                                                            : setSelectedTeamIds(selectedTeamIds.filter((id) => id !== team.id))
                                                        }}
                                                    />
                                                    <Label htmlFor={`kalender-team-${team.id}`} className="font-normal cursor-pointer">{team.name}</Label>
                                                </div>
                                            ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                       </Accordion>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="titles">
                                <AccordionTrigger>Terminart</AccordionTrigger>
                                <AccordionContent>
                                    {(eventTitles || []).map(title => (
                                        <div key={title.id} className="flex items-center space-x-2 p-1">
                                            <Checkbox
                                                id={`kalender-title-${title.id}`}
                                                checked={selectedTitleIds.includes(title.id)}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                    ? setSelectedTitleIds([...selectedTitleIds, title.id])
                                                    : setSelectedTitleIds(selectedTitleIds.filter((id) => id !== title.id))
                                                }}
                                            />
                                            <Label htmlFor={`kalender-title-${title.id}`} className="font-normal cursor-pointer">{title.name}</Label>
                                        </div>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                       )}
                    </CardContent>
                </Card>

                <div className="md:col-start-2 lg:col-start-2 row-start-1 md:row-start-auto">
                    <Card>
                    <CardContent className="p-0 sm:p-2 flex justify-center">
                        <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        className="rounded-md"
                        locale={de}
                        modifiers={{ event: eventDates, cancelledEvent: cancelledEventDates, today: new Date() }}
                        modifiersClassNames={{
                            event: 'bg-primary/20 text-primary-foreground rounded-full',
                            cancelledEvent: 'bg-destructive/20 text-destructive-foreground rounded-full',
                            selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90',
                            today: 'bg-destructive text-destructive-foreground',
                        }}
                        components={{
                            DayContent: ({ date, activeModifiers }) => {
                                const hasActiveEvent = activeModifiers.event;
                                const hasCancelledEvent = activeModifiers.cancelledEvent;
                                
                                // Show red dot only if there are ONLY cancelled events on that day
                                const showRedDot = hasCancelledEvent && !hasActiveEvent;

                                return (
                                    <div className="relative h-full w-full flex items-center justify-center">
                                        <span className={cn(activeModifiers.today && "font-bold text-destructive-foreground")}>{format(date, 'd')}</span>
                                        {hasActiveEvent && <div className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                                        {showRedDot && <div className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-destructive" />}
                                    </div>
                                )
                            }
                        }}
                        />
                    </CardContent>
                    </Card>
                </div>

                <div className="md:col-start-2 lg:col-start-2">
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold">Termine für {selectedDate ? format(selectedDate, 'dd. MMMM yyyy', {locale: de}) : '...'}</h2>
                    </div>
                    <div className="space-y-4">
                        {isLoading && <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>}
                        {error && <p className="text-destructive">Fehler: {error.message}</p>}
                        {!isLoading && selectedEvents.length > 0 ? (
                            selectedEvents.map(event => (
                               <EventCard 
                                event={event} 
                                allUsers={allUsers || []} 
                                locations={locations || []} 
                                eventTitles={eventTitles || []} 
                                key={`${event.id}-${event.displayDate.toISOString()}`} 
                                currentUserTeamIds={currentUserTeamIds} 
                                canEdit={!!canEditEvents}
                                onCancel={handleCancelSingleEvent}
                                onReactivate={handleReactivateSingleEvent}
                               />
                            ))
                        ) : (
                        !isLoading && (
                            <Card>
                                <CardContent className="p-8">
                                    <p className="text-muted-foreground text-center">Keine Termine für diesen Tag.</p>
                                </CardContent>
                            </Card>
                        )
                        )}
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
