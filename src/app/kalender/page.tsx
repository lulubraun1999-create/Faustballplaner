

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { de } from 'date-fns/locale';
import { useFirestore, useCollection, useUser, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, orderBy, doc, setDoc, serverTimestamp, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { Loader2, CalendarIcon, Clock, MapPin, Repeat, Check, XIcon, Users, HelpCircle } from 'lucide-react';
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

interface DisplayEvent extends Event {
  displayDate: Date;
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


const EventCard = ({ event, allUsers, locations, eventTitles }: { event: DisplayEvent; allUsers: GroupMember[], locations: Location[], eventTitles: EventTitle[] }) => {
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


    const recurrenceText = getRecurrenceText(event.recurrence);
    
    const getAdjustedDate = (baseDate: Date, timeSourceDate: Date): Date => {
      const newDate = new Date(baseDate);
      newDate.setHours(timeSourceDate.getHours(), timeSourceDate.getMinutes(), timeSourceDate.getSeconds(), timeSourceDate.getMilliseconds());
      return newDate;
    }
    
    const startDate = event.displayDate;
    
    const endDate = useMemo(() => {
        if (!event.endTime) return undefined;
        const originalEndDate = event.endTime.toDate();
        let adjustedEndDate = getAdjustedDate(startDate, originalEndDate);

        // Handle overnight events
        if (adjustedEndDate < startDate) {
            adjustedEndDate = add(adjustedEndDate, { days: 1 });
        }
        
        // Handle multi-day events by checking the date part of original start and end
        const originalStartDate = event.date.toDate();
        const dateDiff = differenceInDays(originalEndDate, originalStartDate);
        if (dateDiff > 0) {
            adjustedEndDate = add(adjustedEndDate, { days: dateDiff });
        }
        
        return adjustedEndDate;
    }, [event.date, event.endTime, startDate]);


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

    return (
        <Card key={`${event.id}-${event.displayDate.toISOString()}`}>
            <CardHeader>
                <CardTitle>{eventTitles.find(t => t.id === event.titleId)?.name || 'Unbenannter Termin'}</CardTitle>
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
            {(event.description || event.meetingPoint) && (
                <CardContent className="space-y-2">
                    {event.meetingPoint && <p className="text-sm"><span className="font-semibold">Treffpunkt:</span> {event.meetingPoint}</p>}
                    {event.description && <p className="text-sm whitespace-pre-wrap">{event.description}</p>}
                </CardContent>
            )}
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

                <div className="flex items-center gap-2">
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
                </div>
            </CardFooter>
        </Card>
    );
};


export default function KalenderPage() {
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

  const groupMembersQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'group_members');
  }, [firestore]);


  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
  const { data: eventsData, isLoading: eventsLoading, error } = useCollection<Event>(eventsQuery);
  const { data: allUsers, isLoading: usersLoading } = useCollection<GroupMember>(groupMembersQuery);
  const { data: locations, isLoading: locationsLoading } = useCollection<Location>(locationsQuery);
  const { data: eventTitles, isLoading: eventTitlesLoading } = useCollection<EventTitle>(eventTitlesQuery);
  

  const isLoading = categoriesLoading || teamsLoading || eventsLoading || usersLoading || locationsLoading || eventTitlesLoading;

 const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    }));
  }, [categories, teams]);


 const allVisibleEvents = useMemo(() => {
    if (!eventsData) return [];

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
          visibleEvents.push({ ...event, displayDate: originalStartDate });
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
             const displayDate = new Date(currentDate);
             const finalEvent = { ...event, displayDate };

              if (event.endTime) {
                const originalEndDate = event.endTime.toDate();
                const daysDiff = differenceInDays(originalEndDate, event.date.toDate());
                const adjustedEndDateTime = add(displayDate, {
                  hours: originalEndDate.getHours(),
                  minutes: originalEndDate.getMinutes(),
                  seconds: originalEndDate.getSeconds(),
                  days: daysDiff,
                });
                finalEvent.endTime = Timestamp.fromDate(adjustedEndDateTime);
              }
              
              if (event.rsvpDeadline) {
                const originalRsvpDate = event.rsvpDeadline.toDate();
                const daysDiff = differenceInDays(event.date.toDate(), originalRsvpDate);
                const adjustedRsvpDateTime = add(displayDate, {
                  hours: originalRsvpDate.getHours(),
                  minutes: originalRsvpDate.getMinutes(),
                  seconds: originalRsvpDate.getSeconds(),
                  days: -daysDiff,
                });
                 finalEvent.rsvpDeadline = Timestamp.fromDate(adjustedRsvpDateTime);
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
  }, [eventsData, currentMonth, selectedTeamIds, selectedTitleIds]);

  const eventDates = useMemo(() => {
    return allVisibleEvents.map(event => event.displayDate);
  }, [allVisibleEvents]);
  
  const selectedEvents = useMemo(() => {
     if (!selectedDate) return [];
     return allVisibleEvents
      .filter(event => isSameDay(event.displayDate, selectedDate))
      .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime());
  }, [selectedDate, allVisibleEvents]);


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
                        modifiers={{ event: eventDates, today: new Date() }}
                        modifiersClassNames={{
                            event: 'bg-primary/20 text-primary-foreground rounded-full',
                            selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90',
                            today: 'bg-destructive text-destructive-foreground',
                        }}
                        components={{
                            DayContent: ({ date, activeModifiers }) => (
                                <div className="relative h-full w-full flex items-center justify-center">
                                <span className={cn(activeModifiers.today && "font-bold text-destructive-foreground")}>{format(date, 'd')}</span>
                                {activeModifiers.event && <div className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                                </div>
                            )
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
                               <EventCard event={event} allUsers={allUsers || []} locations={locations || []} eventTitles={eventTitles || []} key={`${event.id}-${event.displayDate.toISOString()}`} />
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





