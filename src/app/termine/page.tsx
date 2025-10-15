
'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { addDoc, collection, serverTimestamp, orderBy, query, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, Trash2, Loader2, CalendarIcon, Edit, Clock, MapPin, Users, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Event {
  id: string;
  title: string;
  date: Timestamp;
  endTime?: Timestamp;
  isAllDay?: boolean;
  recurrence?: 'none' | 'weekly' | 'biweekly' | 'monthly';
  targetTeamIds?: string[];
  rsvpDeadline?: Timestamp;
  locationId?: string;
  meetingPoint?: string;
  description?: string;
  createdBy: string;
  createdAt: Timestamp;
}

interface UserData {
  adminRechte?: boolean;
}

interface TeamCategory {
  id: string;
  name: string;
  order: number;
}

interface Team {
  id:string;
  name: string;
  categoryId: string;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
}

const eventSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich.'),
  date: z.date({ required_error: 'Startdatum ist erforderlich.' }),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  endDate: z.date().optional(),
  isAllDay: z.boolean().default(false),
  recurrence: z.enum(['none', 'weekly', 'biweekly', 'monthly']).default('none'),
  targetTeamIds: z.array(z.string()).optional(),
  rsvpDeadlineDate: z.date().optional(),
  rsvpDeadlineTime: z.string().optional(),
  locationId: z.string().optional(),
  meetingPoint: z.string().optional(),
  description: z.string().optional(),
}).refine(data => {
    if(data.endDate && data.date > data.endDate) {
        return false;
    }
    return true;
}, {
    message: "Das End-Datum darf nicht vor dem Start-Datum liegen.",
    path: ["endDate"],
});


type EventFormValues = z.infer<typeof eventSchema>;

const locationSchema = z.object({
    name: z.string().min(1, 'Name ist erforderlich.'),
    address: z.string().min(1, 'Adresse ist erforderlich.'),
    city: z.string().min(1, 'Ort ist erforderlich.'),
});
type LocationFormValues = z.infer<typeof locationSchema>;

function AddLocationForm({ onDone }: { onDone: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<LocationFormValues>({
        resolver: zodResolver(locationSchema),
        defaultValues: { name: '', address: '', city: '' },
    });

    const onSubmit = (values: LocationFormValues) => {
        if (!firestore) return;
        setIsSubmitting(true);
        addDoc(collection(firestore, 'locations'), values)
            .then(() => {
                toast({ title: 'Ort hinzugefügt' });
                onDone();
            })
            .catch(error => {
                 toast({ variant: 'destructive', title: 'Fehler', description: error.message });
            })
            .finally(() => setIsSubmitting(false));
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <DialogHeader>
                    <DialogTitle>Neuen Ort hinzufügen</DialogTitle>
                </DialogHeader>
                 <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name des Ortes</FormLabel>
                        <FormControl><Input placeholder="z.B. Fritz-Jacobi-Anlage" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Straße und Hausnummer</FormLabel>
                        <FormControl><Input placeholder="z.B. Kalkstr. 45" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Stadt</FormLabel>
                        <FormControl><Input placeholder="z.B. Leverkusen" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Abbrechen</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

function EventForm({ onDone, event, categories, teams, locations }: { onDone: () => void, event?: Event, categories: TeamCategory[], teams: Team[], locations: Location[] }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);

  const getInitialFormValues = () => {
    if (event) {
      const startDate = event.date.toDate();
      const endDate = event.endTime?.toDate();
      const rsvpDate = event.rsvpDeadline?.toDate();
      return {
        title: event.title,
        date: startDate,
        startTime: event.isAllDay ? '' : format(startDate, 'HH:mm'),
        endDate: endDate,
        endTime: endDate && !event.isAllDay ? format(endDate, 'HH:mm') : '',
        isAllDay: event.isAllDay || false,
        recurrence: event.recurrence || 'none',
        targetTeamIds: event.targetTeamIds || [],
        rsvpDeadlineDate: rsvpDate,
        rsvpDeadlineTime: rsvpDate ? format(rsvpDate, 'HH:mm') : '',
        locationId: event.locationId || '',
        meetingPoint: event.meetingPoint || '',
        description: event.description || '',
      };
    }
    return {
      title: '',
      date: undefined,
      startTime: '',
      endDate: undefined,
      endTime: '',
      isAllDay: false,
      recurrence: 'none' as const,
      targetTeamIds: [],
      rsvpDeadlineDate: undefined,
      rsvpDeadlineTime: '',
      locationId: '',
      meetingPoint: '',
      description: '',
    };
  };

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: getInitialFormValues(),
  });
  
  const isAllDay = form.watch('isAllDay');

  const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id).sort((a,b) => a.name.localeCompare(b.name))
    }));
  }, [categories, teams]);

  const onSubmit = (values: EventFormValues) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Nicht authentifiziert' });
      return;
    }
    setIsSubmitting(true);
    
    const combineDateAndTime = (date: Date, time?: string): Date => {
        const newDate = new Date(date);
        if(time) {
            const [hours, minutes] = time.split(':').map(Number);
            newDate.setHours(hours, minutes, 0, 0);
        } else {
            newDate.setHours(0,0,0,0);
        }
        return newDate;
    }

    const startDate = combineDateAndTime(values.date, values.isAllDay ? undefined : values.startTime);
    let endDate : Date | null = null;
    if (values.endDate) {
        endDate = combineDateAndTime(values.endDate, values.isAllDay ? undefined : values.endTime);
    }
    
    let rsvpDeadline: Timestamp | null = null;
    if(values.rsvpDeadlineDate && values.rsvpDeadlineTime) {
        const rsvpDate = combineDateAndTime(values.rsvpDeadlineDate, values.rsvpDeadlineTime);
        rsvpDeadline = Timestamp.fromDate(rsvpDate);
    }

    const dataToSave: Omit<Event, 'id' | 'createdAt'> & { createdAt: any } = {
      title: values.title,
      date: Timestamp.fromDate(startDate),
      endTime: endDate ? Timestamp.fromDate(endDate) : null,
      isAllDay: values.isAllDay,
      recurrence: values.recurrence,
      targetTeamIds: values.targetTeamIds || [],
      rsvpDeadline: rsvpDeadline,
      locationId: values.locationId || '',
      meetingPoint: values.meetingPoint || '',
      description: values.description || '',
      createdBy: user.uid,
      createdAt: event ? event.createdAt : serverTimestamp(),
    };
    
    if (event) {
      const eventRef = doc(firestore, 'events', event.id);
      updateDoc(eventRef, dataToSave)
        .then(() => {
          toast({ title: 'Termin aktualisiert' });
          onDone();
        })
        .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: eventRef.path,
            operation: 'update',
            requestResourceData: dataToSave,
          });
          errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => setIsSubmitting(false));
    } else {
      const eventsCollection = collection(firestore, 'events');
      addDoc(eventsCollection, dataToSave)
        .then(() => {
          toast({ title: 'Termin erstellt' });
          onDone();
        })
        .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: eventsCollection.path,
            operation: 'create',
            requestResourceData: dataToSave,
          });
          errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => setIsSubmitting(false));
    }
  };

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DialogHeader>
          <DialogTitle>{event ? 'Termin bearbeiten' : 'Neuen Termin erstellen'}</DialogTitle>
        </DialogHeader>

        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Titel</FormLabel>
            <FormControl><Input placeholder="z.B. Mannschaftstraining" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Beginn</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Datum</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={de} />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
            )} />
            {!isAllDay && <FormField control={form.control} name="startTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-transparent">Zeit</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />}
        </div>
        
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Ende</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Datum (optional)</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={de} />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
            )} />
            {!isAllDay && <FormField control={form.control} name="endTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-transparent">Zeit</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />}
        </div>
        
        <FormField control={form.control} name="isAllDay" render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-lg border p-4">
                 <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-0.5">
                  <FormLabel>Ganztägiger Termin</FormLabel>
                  <p className="text-[0.8rem] text-muted-foreground">Wenn aktiviert, werden die Zeitfelder ignoriert.</p>
                </div>
            </FormItem>
        )} />
        
        <FormField control={form.control} name="recurrence" render={({ field }) => (
            <FormItem>
                <FormLabel>Wiederholung</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Wähle eine Wiederholungsregel" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="none">Keine Wiederholung</SelectItem>
                        <SelectItem value="weekly">Wöchentlich</SelectItem>
                        <SelectItem value="biweekly">Alle 2 Wochen</SelectItem>
                        <SelectItem value="monthly">Monatlich</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
        
        <FormField control={form.control} name="targetTeamIds" render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Zielgruppen</FormLabel>
                <p className="text-sm text-muted-foreground">Wähle die Mannschaften aus, für die dieser Termin gilt. Wenn keine ausgewählt ist, ist er für alle sichtbar.</p>
              </div>
              <Accordion type="multiple" className="w-full">
                {groupedTeams.map(category => (
                  <AccordionItem value={category.id} key={category.id}>
                    <AccordionTrigger>{category.name}</AccordionTrigger>
                    <AccordionContent>
                      {category.teams.map(team => (
                        <FormField key={team.id} control={form.control} name="targetTeamIds" render={({ field }) => (
                            <FormItem key={team.id} className="flex flex-row items-start space-x-3 space-y-0 p-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(team.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), team.id])
                                      : field.onChange(field.value?.filter((value) => value !== team.id));
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">{team.name}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <FormMessage />
            </FormItem>
        )} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField control={form.control} name="rsvpDeadlineDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Rückmeldung bis</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Datum (optional)</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={de} />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="rsvpDeadlineTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-transparent">Zeit</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        </div>
        
        <FormField control={form.control} name="locationId" render={({ field }) => (
          <FormItem>
            <FormLabel>Ort</FormLabel>
            <div className="flex gap-2">
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Wähle einen Ort" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setIsLocationFormOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Neu
                </Button>
            </div>
            <FormMessage />
          </FormItem>
        )} />


        <FormField control={form.control} name="meetingPoint" render={({ field }) => (
          <FormItem>
            <FormLabel>Treffpunkt (optional)</FormLabel>
            <FormControl><Input placeholder="z.B. Vor dem Vereinsheim" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Beschreibung (optional)</FormLabel>
            <FormControl><Textarea placeholder="Weitere Details zum Termin..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Abbrechen</Button></DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
    <Dialog open={isLocationFormOpen} onOpenChange={setIsLocationFormOpen}>
        <DialogContent>
            <AddLocationForm onDone={() => setIsLocationFormOpen(false)} />
        </DialogContent>
    </Dialog>
    </>
  );
}

export default function TerminePage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>(undefined);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'events'), orderBy('date', 'desc'));
  }, [firestore]);
  
  const currentUserDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'team_categories'), orderBy('order'));
  }, [firestore]);

  const teamsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'teams'), orderBy('name'));
  }, [firestore]);
  
  const locationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'locations'), orderBy('name'));
  }, [firestore]);

  const { data: currentUserData, isLoading: isUserLoading } = useDoc<UserData>(currentUserDocRef);
  const { data: events, isLoading: eventsLoading, error } = useCollection<Event>(eventsQuery);
  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
  const { data: locations, isLoading: locationsLoading } = useCollection<Location>(locationsQuery);

  
  const isLoading = isUserLoading || eventsLoading || categoriesLoading || teamsLoading || locationsLoading;

  const isAdmin = currentUserData?.adminRechte === true;

  const handleOpenForm = (event?: Event) => {
    setSelectedEvent(event);
    setIsFormOpen(true);
  };

  const handleFormDone = () => {
    setIsFormOpen(false);
    setSelectedEvent(undefined);
  };

  const handleDelete = () => {
    if (!firestore || !eventToDelete) return;
    setIsDeleting(true);
    const eventDocRef = doc(firestore, 'events', eventToDelete.id);
    deleteDoc(eventDocRef)
      .then(() => {
        toast({ title: 'Termin gelöscht' });
        setEventToDelete(null);
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: eventDocRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsDeleting(false);
      });
  };
  
  const getRecurrenceText = (recurrence?: string) => {
    switch (recurrence) {
      case 'weekly': return 'Wöchentlich';
      case 'biweekly': return 'Alle 2 Wochen';
      case 'monthly': return 'Monatlich';
      default: return null;
    }
  };


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (error) {
      return <p className="text-destructive text-center">Fehler beim Laden der Termine: {error.message}</p>;
    }
    if (!events || events.length === 0) {
      return (
         <Card>
            <CardContent>
              <div className="text-center py-10">
                <p className="text-muted-foreground">Keine Termine gefunden.</p>
              </div>
            </CardContent>
          </Card>
      );
    }
    return (
        <div className="space-y-4">
            {events.map(event => {
                const recurrenceText = getRecurrenceText(event.recurrence);
                const startDate = event.date.toDate();
                const endDate = event.endTime?.toDate();
                const location = locations?.find(loc => loc.id === event.locationId);

                let timeString;
                if (event.isAllDay) {
                    timeString = "Ganztägig";
                } else if (endDate) {
                    timeString = `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')} Uhr`;
                } else {
                    timeString = `${format(startDate, 'HH:mm')} Uhr`;
                }

                let dateString = format(startDate, 'eeee, dd.MM.yyyy', { locale: de });
                if(endDate && format(startDate, 'yyyyMMdd') !== format(endDate, 'yyyyMMdd')) {
                    dateString += ` - ${format(endDate, 'eeee, dd.MM.yyyy', { locale: de })}`;
                }

                return (
                    <Card key={event.id}>
                        <CardHeader>
                            <CardTitle>{event.title}</CardTitle>
                            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                                <div className="flex items-center gap-1.5">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span>{dateString}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="h-4 w-4" />
                                    <span>{timeString}</span>
                                </div>
                                {location && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-4 w-4" />
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name}, ${location.address}, ${location.city}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline"
                                        >
                                            {location.name}
                                        </a>
                                    </div>
                                )}
                                {recurrenceText && (
                                    <div className="flex items-center gap-1.5">
                                        <Repeat className="h-4 w-4" />
                                        <span>{recurrenceText}</span>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        {(event.description || event.meetingPoint) && (
                            <CardContent className="space-y-2">
                                {event.meetingPoint && <p><span className="font-semibold">Treffpunkt:</span> {event.meetingPoint}</p>}
                                {event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
                            </CardContent>
                        )}
                        {isAdmin && (
                            <CardFooter className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenForm(event)}><Edit className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => setEventToDelete(event)}><Trash2 className="h-4 w-4" /></Button>
                            </CardFooter>
                        )}
                    </Card>
                )
            })}
        </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Termine</h1>
            {isAdmin && (
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleOpenForm()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Neuer Termin
              </Button>
            )}
          </div>

          {renderContent()}

        </div>
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {isLoading ? (
             <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
          ) : (
             <EventForm onDone={handleFormDone} event={selectedEvent} categories={categories || []} teams={teams || []} locations={locations || []} />
          )}
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird der Termin "{eventToDelete?.title}" dauerhaft gelöscht.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <Loader2 className="animate-spin" /> : 'Ja, löschen'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}

    