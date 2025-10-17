
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { addDoc, collection, serverTimestamp, orderBy, query, Timestamp, doc, updateDoc, deleteDoc, setDoc, where } from 'firebase/firestore';
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
import { PlusCircle, Trash2, Loader2, CalendarIcon, Edit, Clock, MapPin, Users, Repeat, ChevronLeft, ChevronRight, Check, XIcon, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, add, startOfWeek, eachDayOfInterval, isSameDay, startOfDay, addWeeks, isWithinInterval } from 'date-fns';
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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

interface GroupMember {
  id: string;
  vorname?: string;
  nachname?: string;
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

interface EventTitle {
  id: string;
  name: string;
}

const eventSchema = z.object({
  titleId: z.string().min(1, 'Titel ist erforderlich.'),
  date: z.date({ required_error: 'Startdatum ist erforderlich.' }),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  endDate: z.date().optional(),
  isAllDay: z.boolean().default(false),
  recurrence: z.enum(['none', 'weekly', 'biweekly', 'monthly']).default('none'),
  recurrenceEndDate: z.date().optional(),
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

const eventTitleSchema = z.object({
    name: z.string().min(1, 'Name ist erforderlich.'),
});
type EventTitleFormValues = z.infer<typeof eventTitleSchema>;

function AddEventTitleForm({ onDone }: { onDone: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<EventTitleFormValues>({
        resolver: zodResolver(eventTitleSchema),
        defaultValues: { name: '' },
    });

    const onSubmit = (values: EventTitleFormValues) => {
        if (!firestore) return;
        setIsSubmitting(true);
        const eventTitlesCollection = collection(firestore, 'event_titles');
        addDoc(eventTitlesCollection, values)
            .then(() => {
                toast({ title: 'Titel hinzugefügt' });
                onDone();
            })
            .catch(serverError => {
                 const permissionError = new FirestorePermissionError({
                    path: eventTitlesCollection.path,
                    operation: 'create',
                    requestResourceData: values,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => setIsSubmitting(false));
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <DialogHeader>
                    <DialogTitle>Neuen Termin-Titel hinzufügen</DialogTitle>
                </DialogHeader>
                 <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name des Titels</FormLabel>
                        <FormControl><Input placeholder="z.B. Training" {...field} /></FormControl>
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
        const locationsCollection = collection(firestore, 'locations');
        addDoc(locationsCollection, values)
            .then(() => {
                toast({ title: 'Ort hinzugefügt' });
                onDone();
            })
            .catch(serverError => {
                 const permissionError = new FirestorePermissionError({
                    path: locationsCollection.path,
                    operation: 'create',
                    requestResourceData: values,
                });
                errorEmitter.emit('permission-error', permissionError);
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

function EventForm({ onDone, event, categories, teams, locations, eventTitles, isAdmin }: { onDone: () => void, event?: Event, categories: TeamCategory[], teams: Team[], locations: Location[], eventTitles: EventTitle[], isAdmin: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);
  const [isEventTitleFormOpen, setIsEventTitleFormOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);
  const [titleToDelete, setTitleToDelete] = useState<EventTitle | null>(null);
  const [isDeletingTitle, setIsDeletingTitle] = useState(false);

  const getInitialFormValues = () => {
    if (event) {
      const startDate = event.date.toDate();
      const endDate = event.endTime?.toDate();
      const rsvpDate = event.rsvpDeadline?.toDate();
      return {
        titleId: event.titleId,
        date: startDate,
        startTime: event.isAllDay ? '' : format(startDate, 'HH:mm'),
        endDate: endDate,
        endTime: endDate && !event.isAllDay ? format(endDate, 'HH:mm') : '',
        isAllDay: event.isAllDay || false,
        recurrence: event.recurrence || 'none',
        recurrenceEndDate: event.recurrenceEndDate?.toDate() || undefined,
        targetTeamIds: event.targetTeamIds || [],
        rsvpDeadlineDate: rsvpDate,
        rsvpDeadlineTime: rsvpDate ? format(rsvpDate, 'HH:mm') : '',
        locationId: event.locationId || '',
        meetingPoint: event.meetingPoint || '',
        description: event.description || '',
      };
    }
    return {
      titleId: '',
      date: undefined,
      startTime: '',
      endDate: undefined,
      endTime: '',
      isAllDay: false,
      recurrence: 'none' as const,
      recurrenceEndDate: undefined,
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
  const selectedLocationId = form.watch('locationId');
  const selectedTitleId = form.watch('titleId');
  const recurrence = form.watch('recurrence');


  const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id).sort((a,b) => a.name.localeCompare(b.name))
    }));
  }, [categories, teams]);

  const handleDeleteLocation = async () => {
    if (!firestore || !locationToDelete) return;
    setIsDeletingLocation(true);
    const locationRef = doc(firestore, 'locations', locationToDelete.id);
    try {
      await deleteDoc(locationRef);
      toast({ title: 'Ort gelöscht' });
      form.setValue('locationId', ''); // Reset selection in form
      setLocationToDelete(null);
    } catch (serverError: any) {
      toast({ variant: 'destructive', title: 'Fehler beim Löschen', description: serverError.message });
      const permissionError = new FirestorePermissionError({
        path: locationRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsDeletingLocation(false);
    }
  };
  
  const handleDeleteTitle = async () => {
    if (!firestore || !titleToDelete) return;
    setIsDeletingTitle(true);
    const titleRef = doc(firestore, 'event_titles', titleToDelete.id);
    try {
      await deleteDoc(titleRef);
      toast({ title: 'Titel gelöscht' });
      form.setValue('titleId', ''); // Reset selection in form
      setTitleToDelete(null);
    } catch (serverError: any) {
      toast({ variant: 'destructive', title: 'Fehler beim Löschen', description: serverError.message });
      const permissionError = new FirestorePermissionError({
        path: titleRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsDeletingTitle(false);
    }
  };

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
    let endDate : Date | undefined = undefined;
    if (values.endDate) {
        endDate = combineDateAndTime(values.endDate, values.isAllDay ? undefined : values.endTime);
    }
    
    let rsvpDeadline: Timestamp | null = null;
    if(values.rsvpDeadlineDate && values.rsvpDeadlineTime) {
        const rsvpDate = combineDateAndTime(values.rsvpDeadlineDate, values.rsvpDeadlineTime);
        rsvpDeadline = Timestamp.fromDate(rsvpDate);
    }

    const dataToSave: Omit<Event, 'id' | 'createdAt' | 'createdBy' | 'endTime'> & { endTime?: Timestamp | null, createdAt: any, createdBy: string } = {
      titleId: values.titleId,
      date: Timestamp.fromDate(startDate),
      endTime: endDate ? Timestamp.fromDate(endDate) : null,
      isAllDay: values.isAllDay,
      recurrence: values.recurrence,
      recurrenceEndDate: values.recurrenceEndDate ? Timestamp.fromDate(values.recurrenceEndDate) : null,
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
      updateDoc(eventRef, dataToSave as { [x: string]: any; })
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

        <FormField control={form.control} name="titleId" render={({ field }) => (
          <FormItem>
            <FormLabel>Titel</FormLabel>
             <div className="flex gap-2">
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Wähle einen Titel" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {eventTitles.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsEventTitleFormOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Neu
                    </Button>
                     <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon" 
                        disabled={!selectedTitleId}
                        onClick={() => {
                            const title = eventTitles.find(t => t.id === selectedTitleId);
                            if (title) setTitleToDelete(title);
                        }}
                        >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
            </div>
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
                    <FormLabel>Zeit</FormLabel>
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
                    <FormLabel>Zeit</FormLabel>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
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
            {recurrence !== 'none' && (
                <FormField control={form.control} name="recurrenceEndDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Wiederholung endet am</FormLabel>
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
            )}
        </div>
        
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
                    <FormLabel>Zeit</FormLabel>
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
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsLocationFormOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Neu
                    </Button>
                     <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon" 
                        disabled={!selectedLocationId}
                        onClick={() => {
                            const location = locations.find(l => l.id === selectedLocationId);
                            if (location) setLocationToDelete(location);
                        }}
                        >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
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
    
    <Dialog open={isEventTitleFormOpen} onOpenChange={setIsEventTitleFormOpen}>
        <DialogContent>
            <AddEventTitleForm onDone={() => setIsEventTitleFormOpen(false)} />
        </DialogContent>
    </Dialog>

    <AlertDialog open={!!locationToDelete} onOpenChange={(open) => !open && setLocationToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird der Ort "{locationToDelete?.name}" dauerhaft gelöscht.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingLocation}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteLocation} disabled={isDeletingLocation} className="bg-destructive hover:bg-destructive/90">
                    {isDeletingLocation ? <Loader2 className="animate-spin" /> : 'Ja, löschen'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

     <AlertDialog open={!!titleToDelete} onOpenChange={(open) => !open && setTitleToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird der Titel "{titleToDelete?.name}" dauerhaft gelöscht.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingTitle}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTitle} disabled={isDeletingTitle} className="bg-destructive hover:bg-destructive/90">
                    {isDeletingTitle ? <Loader2 className="animate-spin" /> : 'Ja, löschen'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

const EventCard = ({ event, allUsers, locations, teams, eventTitles, onEdit, onDelete }: { event: DisplayEvent; allUsers: GroupMember[]; locations: Location[]; teams: Team[], eventTitles: EventTitle[], onEdit: (event: Event) => void; onDelete: (event: Event) => void }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const location = locations.find(l => l.id === event.locationId);
    const {data: currentUserData} = useDoc<UserData>(user ? doc(firestore, 'users', user.uid) : null);
    const isAdmin = currentUserData?.adminRechte === true;

    const responsesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Query for responses for the specific event instance date
        return query(collection(firestore, 'events', event.id, 'responses'), where('eventDate', '==', Timestamp.fromDate(startOfDay(event.displayDate))));
    }, [firestore, event.id, event.displayDate]);

    const { data: responsesForThisInstance, isLoading: responsesLoading } = useCollection<EventResponse>(responsesQuery);
    
    const userResponse = useMemo(() => {
         return responsesForThisInstance?.find(r => r.userId === user?.uid);
    }, [responsesForThisInstance, user]);

    const getRecurrenceText = (event: Event) => {
        const recurrence = event.recurrence;
        const recurrenceEndDate = event.recurrenceEndDate?.toDate();
        let text = '';
        switch (recurrence) {
            case 'weekly': text = 'Wöchentlich'; break;
            case 'biweekly': text = 'Alle 2 Wochen'; break;
            case 'monthly': text = 'Monatlich'; break;
            default: return null;
        }
        if (recurrenceEndDate) {
            text += ` bis ${format(recurrenceEndDate, 'dd.MM.yyyy')}`;
        }
        return text;
    };
    
    const recurrenceText = getRecurrenceText(event);
    const startDate = event.displayDate;
    const endDate = event.endTime?.toDate();

    let timeString;
    if (event.isAllDay) {
        timeString = "Ganztägig";
    } else if (endDate) {
        // Adjust end date to match start date's day for correct time display
        const adjustedEndDate = new Date(startDate);
        adjustedEndDate.setHours(endDate.getHours(), endDate.getMinutes());
        if (adjustedEndDate < startDate) {
             adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
        }
        timeString = `${format(startDate, 'HH:mm')} - ${format(adjustedEndDate, 'HH:mm')} Uhr`;
    } else {
        timeString = `${format(startDate, 'HH:mm')} Uhr`;
    }
    
    const attendingCount = responsesForThisInstance?.filter(r => r.status === 'attending').length || 0;
    const declinedCount = responsesForThisInstance?.filter(r => r.status === 'declined').length || 0;
    const uncertainCount = responsesForThisInstance?.filter(r => r.status === 'uncertain').length || 0;

    const getResponderName = (userId: string) => {
      const responder = allUsers.find(u => u.id === userId);
      return responder ? `${responder.vorname || ''} ${responder.nachname || ''}`.trim() : 'Unbekannt';
    };
    
    const getEventTitle = () => {
        const titleName = eventTitles.find(t => t.id === event.titleId)?.name || 'Unbekannter Termin';
        if (!event.targetTeamIds || event.targetTeamIds.length === 0) {
            return titleName;
        }
        const teamNames = event.targetTeamIds.map(id => teams.find(t => t.id === id)?.name).filter(Boolean).join(', ');
        return teamNames ? `${titleName} für ${teamNames}` : titleName;
    }

    const attendees = useMemo(() => {
        return (responsesForThisInstance || [])
            .filter(r => r.status === 'attending')
            .map(r => getResponderName(r.userId))
            .sort();
    }, [responsesForThisInstance, allUsers]);

    const decliners = useMemo(() => {
        return (responsesForThisInstance || [])
            .filter(r => r.status === 'declined')
            .map(r => getResponderName(r.userId))
            .sort();
    }, [responsesForThisInstance, allUsers]);
    
    const uncertains = useMemo(() => {
        return (responsesForThisInstance || [])
            .filter(r => r.status === 'uncertain')
            .map(r => getResponderName(r.userId))
            .sort();
    }, [responsesForThisInstance, allUsers]);

    const handleRsvp = (status: 'attending' | 'declined' | 'uncertain') => {
        if (!user || !firestore) return;

        const responseCollectionRef = collection(firestore, 'events', event.id, 'responses');
        const eventDateAsTimestamp = Timestamp.fromDate(startOfDay(event.displayDate));
        
        const responseDocId = userResponse?.id || doc(responseCollectionRef).id;
        
        const data: Omit<EventResponse, 'id'| 'respondedAt' | 'eventId'> & { respondedAt: any, eventId: string } = {
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

    return (
        <Card key={event.id}>
            <CardHeader>
                 <div className="flex justify-between items-start">
                    <CardTitle>{getEventTitle()}</CardTitle>
                    {isAdmin && (
                        <div className="flex items-center">
                            <Button variant="ghost" size="icon" onClick={() => onEdit(event)}><Edit className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(event)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    )}
                </div>
                 <div className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-x-4 gap-y-1 pt-1">
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


export default function TerminePage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>(undefined);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('termineFilter');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const weekStartsOn = 1; // Monday
  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn });
  const currentWeekEnd = add(currentWeekStart, { days: 6 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });

  useEffect(() => {
    localStorage.setItem('termineFilter', JSON.stringify(selectedTeamIds));
  }, [selectedTeamIds]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'events'));
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
  
  const eventTitlesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'event_titles'), orderBy('name'));
  }, [firestore]);
  
  const groupMembersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'group_members'));
  }, [firestore]);


  const { data: currentUserData, isLoading: isUserLoading } = useDoc<UserData>(currentUserDocRef);
  const { data: eventsData, isLoading: eventsLoading, error } = useCollection<Event>(eventsQuery);
  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
  const { data: locations, isLoading: locationsLoading } = useCollection<Location>(locationsQuery);
  const { data: eventTitles, isLoading: eventTitlesLoading } = useCollection<EventTitle>(eventTitlesQuery);
  const { data: allUsers, isLoading: usersLoading } = useCollection<GroupMember>(groupMembersQuery);

  
  const isLoading = isUserLoading || eventsLoading || categoriesLoading || teamsLoading || locationsLoading || usersLoading || eventTitlesLoading;

  const isAdmin = currentUserData?.adminRechte === true;
  
  const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    }));
  }, [categories, teams]);
  
  const eventsForWeek = useMemo(() => {
    if (!eventsData) return new Map();

    const filteredByTeam = eventsData.filter(event => {
        if (selectedTeamIds.length === 0) return true;
        if (!event.targetTeamIds || event.targetTeamIds.length === 0) return true;
        return event.targetTeamIds.some(id => selectedTeamIds.includes(id));
    });

    const weeklyEventsMap = new Map<string, DisplayEvent[]>();
    const interval = { start: startOfDay(currentWeekStart), end: startOfDay(currentWeekEnd) };

    for (const event of filteredByTeam) {
      const originalStartDate = event.date.toDate();
      const recurrenceEndDate = event.recurrenceEndDate?.toDate();

      // Handle non-recurring events
      if (event.recurrence === 'none' || !event.recurrence) {
        if (isWithinInterval(originalStartDate, interval)) {
          const dayKey = format(originalStartDate, 'yyyy-MM-dd');
          if (!weeklyEventsMap.has(dayKey)) weeklyEventsMap.set(dayKey, []);
          weeklyEventsMap.get(dayKey)?.push({ ...event, displayDate: originalStartDate });
        }
        continue;
      }
      
      // Handle recurring events
      let currentDate = originalStartDate;
      let limit = 100; // Safety break
      
      // Fast-forward to the current week's interval if the event starts before
      while(currentDate < interval.start && limit > 0) {
          if (recurrenceEndDate && currentDate > recurrenceEndDate) {
            limit = 0; // Stop if the recurrence end date is passed
            continue;
          }
           switch (event.recurrence) {
            case 'weekly': currentDate = addWeeks(currentDate, 1); break;
            case 'biweekly': currentDate = addWeeks(currentDate, 2); break;
            case 'monthly': currentDate = add(currentDate, { months: 1 }); break;
            default: limit = 0; break;
           }
           limit--;
      }

      limit = 100; // Reset limit
      while (currentDate <= interval.end && limit > 0) {
        // Stop if recurrence end date is passed
        if (recurrenceEndDate && currentDate > recurrenceEndDate) {
            limit = 0;
            continue;
        }
        
        if (isWithinInterval(currentDate, interval)) {
             const dayKey = format(currentDate, 'yyyy-MM-dd');
             if (!weeklyEventsMap.has(dayKey)) weeklyEventsMap.set(dayKey, []);
             weeklyEventsMap.get(dayKey)?.push({ ...event, displayDate: currentDate });
        }

        switch (event.recurrence) {
            case 'weekly': currentDate = addWeeks(currentDate, 1); break;
            case 'biweekly': currentDate = addWeeks(currentDate, 2); break;
            case 'monthly': currentDate = add(currentDate, { months: 1 }); break;
            default: limit = 0; break;
        }
        limit--;
      }
    }
     // Sort events within each day
    weeklyEventsMap.forEach((dayEvents) => {
        dayEvents.sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime());
    });

    return weeklyEventsMap;
  }, [eventsData, currentWeekStart, currentWeekEnd, selectedTeamIds]);


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

  const goToPreviousWeek = () => setCurrentDate(add(currentDate, { weeks: -1 }));
  const goToNextWeek = () => setCurrentDate(add(currentDate, { weeks: 1 }));
  const goToToday = () => setCurrentDate(new Date());


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
    
    return (
        <div className="space-y-8">
            {weekDays.map(day => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsForWeek.get(dayKey) || [];
                const isToday = isSameDay(day, new Date());
                
                return (
                    <div key={dayKey}>
                        <h2 className={cn("font-bold text-lg mb-2 sticky top-16 bg-background py-2 border-b", isToday && "text-primary")}>
                            {format(day, 'eeee, dd. MMMM', {locale: de})}
                        </h2>
                        {dayEvents.length > 0 ? (
                             <div className="space-y-4">
                                {dayEvents.map(event => (
                                    <EventCard
                                        key={`${event.id}-${event.displayDate.toISOString()}`}
                                        event={event}
                                        allUsers={allUsers || []}
                                        locations={locations || []}
                                        teams={teams || []}
                                        eventTitles={eventTitles || []}
                                        onEdit={handleOpenForm}
                                        onDelete={setEventToDelete}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Keine Termine für diesen Tag.</p>
                        )}
                    </div>
                )
            })}
        </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <h1 className="text-3xl font-bold">Termine</h1>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}><ChevronLeft className="h-4 w-4"/></Button>
                <Button variant="outline" onClick={goToToday}>Heute</Button>
                <Button variant="outline" size="sm" onClick={goToNextWeek}><ChevronRight className="h-4 w-4"/></Button>
            </div>
            {isAdmin && (
              <Button variant="outline" onClick={() => handleOpenForm()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Neuer Termin
              </Button>
            )}
          </div>
           <div className="mb-4 text-center text-xl font-semibold">
                {format(currentWeekStart, 'dd. MMM', { locale: de })} - {format(currentWeekEnd, 'dd. MMM yyyy', { locale: de })}
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Nach Mannschaften filtern</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {isLoading ? <Loader2 className="animate-spin" /> : (
                         <Accordion type="multiple" className="w-full" defaultValue={groupedTeams.map(g => g.id)}>
                            {groupedTeams.map(category => (
                                <AccordionItem value={category.id} key={category.id}>
                                    <AccordionTrigger>{category.name}</AccordionTrigger>
                                    <AccordionContent>
                                    {category.teams.map(team => (
                                        <div key={team.id} className="flex items-center space-x-2 p-1">
                                            <Checkbox
                                                id={team.id}
                                                checked={selectedTeamIds.includes(team.id)}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                    ? setSelectedTeamIds([...selectedTeamIds, team.id])
                                                    : setSelectedTeamIds(selectedTeamIds.filter((id) => id !== team.id))
                                                }}
                                            />
                                            <Label htmlFor={team.id} className="font-normal cursor-pointer">{team.name}</Label>
                                        </div>
                                    ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                       )}
                    </CardContent>
                </Card>
                 
                <div>
                  {renderContent()}
                </div>
            </div>

        </div>
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {isLoading ? (
             <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
          ) : (
             <EventForm onDone={handleFormDone} event={selectedEvent} categories={categories || []} teams={teams || []} locations={locations || []} eventTitles={eventTitles || []} isAdmin={isAdmin}/>
          )}
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird der Termin "{eventTitles?.find(t => t.id === eventToDelete?.titleId)?.name || 'Unbenannt'}" dauerhaft gelöscht.
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
