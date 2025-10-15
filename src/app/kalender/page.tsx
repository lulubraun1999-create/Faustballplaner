
'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { de } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp, or, orderBy } from 'firebase/firestore';
import { Loader2, CalendarIcon, Clock, MapPin, Repeat } from 'lucide-react';
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  isWithinInterval,
  isSameMonth,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


interface Event {
  id: string;
  title: string;
  date: Timestamp;
  endTime?: Timestamp;
  isAllDay?: boolean;
  recurrence?: 'none' | 'weekly' | 'biweekly' | 'monthly';
  targetTeamIds?: string[];
  rsvpDeadline?: Timestamp;
  location?: string;
  meetingPoint?: string;
  description?: string;
  createdBy: string;
  createdAt: Timestamp;
}

interface DisplayEvent extends Event {
  displayDate: Date;
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

export default function KalenderPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  
  const firestore = useFirestore();

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'team_categories'), orderBy('order'));
  }, [firestore]);

  const teamsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'teams'));
  }, [firestore]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Fetch all events. Filtering based on recurrence will be handled client-side.
    return query(collection(firestore, 'events'));
  }, [firestore]);

  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
  const { data: events, isLoading: eventsLoading, error } = useCollection<Event>(eventsQuery);
  
  const isLoading = categoriesLoading || teamsLoading || eventsLoading;

 const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id).sort((a,b) => a.name.localeCompare(b.name))
    }));
  }, [categories, teams]);


 const allVisibleEvents = useMemo(() => {
    if (!events) return [];

    const filteredByTeam = events.filter(event => {
        if (selectedTeamId === 'all') return true;
        // Show events that are not targeted to any specific team (public events).
        if (!event.targetTeamIds || event.targetTeamIds.length === 0) return true;
        // Show events targeted to the selected team.
        return event.targetTeamIds.includes(selectedTeamId);
    });

    const visibleEvents: DisplayEvent[] = [];
    const interval = { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) };

    for (const event of filteredByTeam) {
      const originalStartDate = event.date.toDate();

      if (event.recurrence === 'none' || !event.recurrence) {
        if (isWithinInterval(originalStartDate, interval)) {
          visibleEvents.push({ ...event, displayDate: originalStartDate });
        }
        continue;
      }

      let currentDate = originalStartDate;
      
      if (event.recurrence === 'weekly' || event.recurrence === 'biweekly') {
        const step = event.recurrence === 'weekly' ? 1 : 2;
        // Fast-forward to the current view interval
        if (currentDate < interval.start) {
            const weeksDiff = Math.floor((interval.start.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            const stepsToSkip = Math.floor(weeksDiff / step);
            if (stepsToSkip > 0) {
              currentDate = addWeeks(currentDate, stepsToSkip * step);
            }
        }
         while (currentDate < interval.start) {
             currentDate = addWeeks(currentDate, step);
         }
        while (currentDate <= interval.end) {
            visibleEvents.push({ ...event, displayDate: currentDate });
            currentDate = addWeeks(currentDate, step);
        }
      } else if (event.recurrence === 'monthly') {
         if (currentDate < interval.start) {
             const monthDiff = (interval.start.getFullYear() - currentDate.getFullYear()) * 12 + (interval.start.getMonth() - currentDate.getMonth());
             if (monthDiff > 0) {
                currentDate = addMonths(currentDate, monthDiff);
             }
         }
         while(currentDate < interval.start) {
            currentDate = addMonths(currentDate, 1);
         }
        while (currentDate <= interval.end) {
            if (isSameMonth(currentDate, interval.start)) {
                visibleEvents.push({ ...event, displayDate: currentDate });
            }
            currentDate = addMonths(currentDate, 1);
        }
      }
    }
    return visibleEvents;
  }, [events, currentMonth, selectedTeamId]);

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
                         <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                           <SelectTrigger>
                             <SelectValue placeholder="Mannschaft auswählen..." />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="all">Alle Mannschaften</SelectItem>
                             {groupedTeams.map(category => (
                               <SelectGroup key={category.id}>
                                 <SelectLabel>{category.name}</SelectLabel>
                                 {category.teams.map(team => (
                                   <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                 ))}
                               </SelectGroup>
                             ))}
                           </SelectContent>
                         </Select>
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
                        modifiers={{ event: eventDates }}
                        modifiersClassNames={{
                            event: 'bg-primary/20 text-primary-foreground rounded-full',
                            selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90',
                        }}
                        components={{
                            DayContent: ({ date, activeModifiers }) => (
                                <div className="relative h-full w-full flex items-center justify-center">
                                <span className={cn(activeModifiers.today && "font-bold")}>{format(date, 'd')}</span>
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
                            selectedEvents.map(event => {
                                const recurrenceText = getRecurrenceText(event.recurrence);
                                const startDate = event.displayDate;
                                const endDate = event.endTime?.toDate();

                                let timeString;
                                if (event.isAllDay) {
                                    timeString = "Ganztägig";
                                } else if (endDate) {
                                    timeString = `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')} Uhr`;
                                } else {
                                    timeString = `${format(startDate, 'HH:mm')} Uhr`;
                                }

                                return (
                                    <Card key={`${event.id}-${event.displayDate.toISOString()}`}>
                                        <CardHeader>
                                            <CardTitle>{event.title}</CardTitle>
                                            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-4 w-4" />
                                                    <span>{timeString}</span>
                                                </div>
                                                {event.location && (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="h-4 w-4" />
                                                        <span>{event.location}</span>
                                                    </div>
                                                )}
                                                {recurrenceText && (
                                                    <Badge variant="outline" className="flex items-center gap-1.5">
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
                                    </Card>
                                )
                            })
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

    