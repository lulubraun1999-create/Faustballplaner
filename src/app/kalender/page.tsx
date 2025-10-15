
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { de } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { Loader2, CalendarIcon, Clock, MapPin, Repeat } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


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

export default function KalenderPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);

  const firestore = useFirestore();

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'events'), orderBy('date', 'asc'));
  }, [firestore]);

  const { data: events, isLoading: eventsLoading, error } = useCollection<Event>(eventsQuery);

  const eventDates = useMemo(() => {
    if (!events) return [];
    return events.map(event => event.date.toDate());
  }, [events]);

  useEffect(() => {
    if (date && events) {
      const eventsForSelectedDay = events.filter(event => isSameDay(event.date.toDate(), date));
      setSelectedEvents(eventsForSelectedDay);
    } else {
      setSelectedEvents([]);
    }
  }, [date, events]);

  const getRecurrenceText = (recurrence?: string) => {
    switch (recurrence) {
      case 'weekly': return 'Wöchentlich';
      case 'biweekly': return 'Alle 2 Wochen';
      case 'monthly': return 'Monatlich';
      default: return null;
    }
  };


  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto grid max-w-4xl grid-cols-1 md:grid-cols-2 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Kalender</h1>
            </div>
            <Card>
              <CardContent className="p-0 sm:p-2 flex justify-center">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-md"
                  locale={de}
                   modifiers={{ event: eventDates }}
                   modifiersClassNames={{
                    event: 'bg-primary/20 text-primary-foreground rounded-md',
                   }}
                />
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-1">
             <div className="mb-8">
                <h2 className="text-2xl font-bold">Termine für {date ? format(date, 'dd. MMMM yyyy', {locale: de}) : ''}</h2>
             </div>
             <div className="space-y-4">
                {eventsLoading && <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>}
                {error && <p className="text-destructive">Fehler: {error.message}</p>}
                {!eventsLoading && selectedEvents.length > 0 ? (
                    selectedEvents.map(event => {
                        const recurrenceText = getRecurrenceText(event.recurrence);
                        const startDate = event.date.toDate();
                        const endDate = event.endTime?.toDate();

                        let timeString;
                        if (event.isAllDay) {
                            timeString = "Ganztägig";
                        } else if (endDate && !isSameDay(startDate, endDate)) {
                             timeString = `${format(startDate, 'HH:mm')} Uhr - ${format(endDate, 'dd.MM HH:mm')} Uhr`;
                        } else if (endDate) {
                            timeString = `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')} Uhr`;
                        } else {
                            timeString = `${format(startDate, 'HH:mm')} Uhr`;
                        }

                        return (
                             <Card key={event.id}>
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
                                        {event.meetingPoint && <p><span className="font-semibold">Treffpunkt:</span> {event.meetingPoint}</p>}
                                        {event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
                                    </CardContent>
                                )}
                            </Card>
                        )
                    })
                ) : (
                   !eventsLoading && <p className="text-muted-foreground pt-8 text-center">Keine Termine für diesen Tag.</p>
                )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
