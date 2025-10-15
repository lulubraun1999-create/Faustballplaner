
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { de } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp, or } from 'firebase/firestore';
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
import { Button } from '@/components/ui/button';

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
  
  const firestore = useFirestore();

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'events'),
      // Fetch events that are either not recurring or could potentially recur into the current month view.
      // This is an approximation; client-side logic will do the heavy lifting for recurrence.
      or(
        where('recurrence', '==', 'none'),
        where('date', '<=', end)
      )
    );
  }, [firestore, end]);

  const { data: events, isLoading: eventsLoading, error } = useCollection<Event>(eventsQuery);

 const allVisibleEvents = useMemo(() => {
    if (!events) return [];

    const visibleEvents: DisplayEvent[] = [];
    const interval = { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) };

    for (const event of events) {
      const originalStartDate = event.date.toDate();

      // Handle non-recurring events
      if (event.recurrence === 'none' || !event.recurrence) {
        if (isWithinInterval(originalStartDate, interval)) {
          visibleEvents.push({ ...event, displayDate: originalStartDate });
        }
        continue;
      }

      // Handle recurring events
      let currentDate = originalStartDate;
      const step = event.recurrence === 'weekly' ? 1 : 2;

      if (event.recurrence === 'weekly' || event.recurrence === 'biweekly') {
        // Move to the first occurrence within or after the start of the month
        while (currentDate < interval.start) {
            currentDate = addWeeks(currentDate, step);
        }
        // Add all occurrences within the month
        while (currentDate <= interval.end) {
            visibleEvents.push({ ...event, displayDate: currentDate });
            currentDate = addWeeks(currentDate, step);
        }
      } else if (event.recurrence === 'monthly') {
         // Move to the first occurrence within or after the start of the month
         while(currentDate < interval.start) {
            currentDate = addMonths(currentDate, 1);
         }
         // Add all occurrences within the month
        while (currentDate <= interval.end) {
            if (isSameMonth(currentDate, interval.start)) {
                visibleEvents.push({ ...event, displayDate: currentDate });
            }
            currentDate = addMonths(currentDate, 1);
        }
      }
    }
    return visibleEvents;
  }, [events, currentMonth]);

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
        <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Kalender</h1>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                        <div className="relative h-full w-full">
                           <span className={cn(activeModifiers.today && "font-bold")}>{format(date, 'd')}</span>
                           {activeModifiers.event && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary" />}
                        </div>
                      )
                    }}
                />
              </CardContent>
            </Card>
            <div className="lg:col-span-1">
             <div className="mb-8">
                <h2 className="text-2xl font-bold">Termine für {selectedDate ? format(selectedDate, 'dd. MMMM yyyy', {locale: de}) : '...'}</h2>
             </div>
             <div className="space-y-4">
                {eventsLoading && <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>}
                {error && <p className="text-destructive">Fehler: {error.message}</p>}
                {!eventsLoading && selectedEvents.length > 0 ? (
                    selectedEvents.map(event => {
                        const recurrenceText = getRecurrenceText(event.recurrence);
                        const startDate = event.displayDate;
                        // For recurring events, endTime needs careful handling if it spans across days, 
                        // but for this implementation we assume endTime is for the same day.
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
                   !eventsLoading && (
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
