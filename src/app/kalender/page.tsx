

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useCollection, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { addDoc, collection, serverTimestamp, orderBy, query, Timestamp, doc, updateDoc, deleteDoc, setDoc, where, getDocs } from 'firebase/firestore';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Trash2, Loader2, CalendarIcon, Edit, Clock, MapPin, Users, Repeat, ChevronLeft, ChevronRight, Check, XIcon, HelpCircle, Ban, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, add, startOfWeek, eachDayOfInterval, isSameDay, startOfDay, addWeeks, isWithinInterval, getDay, differenceInDays } from 'date-fns';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


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
  titleId?: string;
  date?: Timestamp;
  endTime?: Timestamp;
  isAllDay?: boolean;
  targetTeamIds?: string[];
  rsvpDeadline?: Timestamp;
  locationId?: string;
  meetingPoint?: string;
  description?: string;
  updatedAt?: Timestamp;
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
    reason?: string;
    respondedAt: Timestamp;
}

interface GroupMember {
  id: string;
  vorname?: string;
  nachname?: string;
}

interface UserData {
    adminRechte?: boolean;
    teamIds?: string[];
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

const combineDateAndTime = (date: Date, time?: string): Date => {
    const newDate = new Date(date);
    if(time) {
        const [hours, minutes] = time.split(':').map(Number);
        newDate.setHours(hours, minutes, 0, 0);
    }
    return newDate;
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
}).superRefine((data, ctx) => {
    // 1. Endzeitpunkt muss nach Startzeitpunkt liegen
    if (data.date && (data.endTime || data.endDate)) {
        const startDate = combineDateAndTime(data.date, data.startTime);
        const endDate = combineDateAndTime(data.endDate || data.date, data.endTime);
        
        if (endDate < startDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Der Endzeitpunkt muss nach dem Startzeitpunkt liegen.',
                path: ['endDate'], 
            });
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Der Endzeitpunkt muss nach dem Startzeitpunkt liegen.',
                path: ['endTime'],
            });
        }
    }

    // 2. Rückmeldefrist muss vor dem Startzeitpunkt liegen
    if (data.rsvpDeadlineDate && data.date) {
        const rsvpDate = combineDateAndTime(data.rsvpDeadlineDate, data.rsvpDeadlineTime);
        const startDate = combineDateAndTime(data.date, data.startTime);
        
        if (rsvpDate >= startDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Die Rückmeldefrist muss vor dem Start des Termins liegen.',
                path: ['rsvpDeadlineDate'],
            });
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Die Rückmeldefrist muss vor dem Start des Termins liegen.',
                path: ['rsvpDeadlineTime'],
            });
        }
    }
});


type EventFormValues = z.infer<typeof eventSchema>;

const locationSchema = z.object({
    name: z.string().min(1, "Name ist erforderlich"),
    address: z.string().min(1, "Adresse ist erforderlich"),
    city: z.string().min(1, "Stadt ist erforderlich"),
});

const titleSchema = z.object({
    name: z.string().min(1, "Name ist erforderlich"),
});

const deleteLocationSchema = z.object({
    locationId: z.string().min(1, "Bitte einen Ort zum Löschen auswählen."),
});
const deleteTitleSchema = z.object({
    titleId: z.string().min(1, "Bitte einen Titel zum Löschen auswählen."),
});


function AddLocationForm({ onDone }: { onDone: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm<z.infer<typeof locationSchema>>({
        resolver: zodResolver(locationSchema),
        defaultValues: { name: '', address: '', city: '' }
    });

    const handleLocalSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        
        form.trigger().then(isValid => {
            if (!isValid) return;

            const values = form.getValues();
            if (!firestore) return;
            
            const locationsCollection = collection(firestore, 'locations');
            
            addDoc(locationsCollection, values)
                .then(() => {
                    toast({ title: "Ort hinzugefügt" });
                    onDone();
                    form.reset();
                })
                .catch(serverError => {
                     const permissionError = new FirestorePermissionError({
                        path: locationsCollection.path,
                        operation: 'create',
                        requestResourceData: values,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
        });
    };

    return (
        <div className="space-y-4">
            <Form {...form}>
                
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name des Ortes</FormLabel>
                            <FormControl><Input placeholder="z.B. Fritz-Jacobi-Anlage" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Straße & Hausnummer</FormLabel>
                            <FormControl><Input placeholder="z.B. Kalkstraße 46" {...field} /></FormControl>
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
                
            </Form>
            <Button type="button" onClick={handleLocalSubmit} className="w-full">Hinzufügen</Button>
        </div>
    );
}

function AddEventTitleForm({ onDone }: { onDone: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm<z.infer<typeof titleSchema>>({
        resolver: zodResolver(titleSchema),
        defaultValues: { name: '' }
    });

    const handleLocalSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        form.trigger().then(isValid => {
            if (!isValid) return;

            const values = form.getValues();
            if (!firestore) return;
            const eventTitlesCollection = collection(firestore, 'event_titles');
            addDoc(eventTitlesCollection, values)
                .then(() => {
                    toast({ title: "Titel hinzugefügt" });
                    onDone();
                    form.reset();
                })
                .catch(serverError => {
                    const permissionError = new FirestorePermissionError({
                        path: eventTitlesCollection.path,
                        operation: 'create',
                        requestResourceData: values,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
        });
    };

    return (
         <div className="space-y-4">
            <Form {...form}>
                
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name des Titels</FormLabel>
                            <FormControl><Input placeholder="z.B. Training" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                
            </Form>
            <Button type="button" onClick={handleLocalSubmit} className="w-full">Hinzufügen</Button>
        </div>
    );
}

function DeleteLocationForm({ onDone, locations }: { onDone: () => void, locations: Location[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm<z.infer<typeof deleteLocationSchema>>({
        resolver: zodResolver(deleteLocationSchema),
    });

    const handleLocalSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        form.trigger().then(isValid => {
            if (!isValid) return;
            const { locationId } = form.getValues();
            if (!firestore || !locationId) return;

            deleteDoc(doc(firestore, 'locations', locationId))
                .then(() => {
                    toast({ title: "Ort gelöscht" });
                    onDone();
                    form.reset();
                })
                .catch(serverError => {
                     const permissionError = new FirestorePermissionError({
                        path: `locations/${locationId}`,
                        operation: 'delete',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
        });
    };

    return (
        <Form {...form}>
             
                <div className="space-y-4">
                    <FormField control={form.control} name="locationId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Ort zum Löschen auswählen</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wähle einen Ort" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" className="w-full" disabled={!form.watch('locationId')}>Löschen</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Diese Aktion kann nicht rückgängig gemacht werden. Der Ort wird dauerhaft gelöscht.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={handleLocalSubmit} className="bg-destructive hover:bg-destructive/90">Ja, löschen</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            
        </Form>
    );
}

function DeleteEventTitleForm({ onDone, eventTitles }: { onDone: () => void, eventTitles: EventTitle[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm<z.infer<typeof deleteTitleSchema>>({
        resolver: zodResolver(deleteTitleSchema),
    });

    const handleLocalSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        form.trigger().then(isValid => {
            if (!isValid) return;
            const { titleId } = form.getValues();
            if (!firestore || !titleId) return;

            deleteDoc(doc(firestore, 'event_titles', titleId))
                .then(() => {
                    toast({ title: "Titel gelöscht" });
                    onDone();
                    form.reset();
                })
                .catch(serverError => {
                    const permissionError = new FirestorePermissionError({
                        path: `event_titles/${titleId}`,
                        operation: 'delete',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
        });
    };

    return (
        <Form {...form}>
            
                <div className="space-y-4">
                    <FormField control={form.control} name="titleId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Titel zum Löschen auswählen</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wähle einen Titel" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {eventTitles.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" className="w-full" disabled={!form.watch('titleId')}>Löschen</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Diese Aktion kann nicht rückgängig gemacht werden. Der Titel wird dauerhaft gelöscht.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={handleLocalSubmit} className="bg-destructive hover:bg-destructive/90">Ja, löschen</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            
        </Form>
    );
}

function EventForm({ onDone, event, categories, teams, canEdit, eventTitles, locations }: { onDone: () => void, event?: DisplayEvent, categories: TeamCategory[], teams: Team[], canEdit: boolean, eventTitles: EventTitle[], locations: Location[] }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddTitle, setShowAddTitle] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [isEditModeDialog, setIsEditModeDialog] = useState(false);
  
  const getInitialFormValues = () => {
    if (event) {
      const startDate = event.displayDate;
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
  const recurrence = form.watch('recurrence');
  const formValues = form.watch();

  const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id).sort((a,b) => a.name.localeCompare(b.name))
    }));
  }, [categories, teams]);


 const handleFormSubmit = async (values: EventFormValues) => {
    const isBecomingRecurring = (!event || event.recurrence === 'none') && values.recurrence !== 'none';
    if (event && event.recurrence && event.recurrence !== 'none' && !isBecomingRecurring) {
      setIsEditModeDialog(true);
    } else {
      await saveEvent(values, 'all'); 
    }
  };

  const saveEvent = async (values: EventFormValues, mode: 'single' | 'future' | 'all') => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Nicht authentifiziert' });
      return;
    }
    setIsSubmitting(true);

    try {
        const dataToSave: { [key: string]: any } = {
            titleId: values.titleId,
            isAllDay: values.isAllDay,
            recurrence: values.recurrence,
            targetTeamIds: values.targetTeamIds || [],
            locationId: values.locationId || '',
            meetingPoint: values.meetingPoint || '',
            description: values.description || '',
        };

        const startDate = combineDateAndTime(values.date, values.isAllDay ? undefined : values.startTime);
        dataToSave.date = Timestamp.fromDate(startDate);
        
        if (!values.isAllDay && values.endTime) {
            const endDateValue = values.endDate || values.date;
            dataToSave.endTime = Timestamp.fromDate(combineDateAndTime(endDateValue, values.endTime));
        } else {
             dataToSave.endTime = null;
        }
        
        if (values.recurrence !== 'none' && values.recurrenceEndDate) {
            dataToSave.recurrenceEndDate = Timestamp.fromDate(values.recurrenceEndDate);
        } else {
            dataToSave.recurrenceEndDate = null;
        }

        if (values.rsvpDeadlineDate) {
           const rsvpDateValue = values.rsvpDeadlineDate;
           dataToSave.rsvpDeadline = Timestamp.fromDate(combineDateAndTime(rsvpDateValue, values.rsvpDeadlineTime));
        } else {
             dataToSave.rsvpDeadline = null;
        }


        if (event && mode === 'single') {
            const overrideData = {
                eventId: event.id,
                originalDate: Timestamp.fromDate(startOfDay(event.displayDate)),
                updatedAt: serverTimestamp(),
                titleId: values.titleId,
                date: dataToSave.date,
                endTime: dataToSave.endTime,
                isAllDay: values.isAllDay,
                recurrence: 'none', 
                targetTeamIds: values.targetTeamIds,
                rsvpDeadline: dataToSave.rsvpDeadline,
                locationId: values.locationId,
                meetingPoint: values.meetingPoint,
                description: values.description,
            };
            
            const overridesRef = collection(firestore, 'event_overrides');
            const q = query(overridesRef, where("eventId", "==", event.id), where("originalDate", "==", overrideData.originalDate));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const existingOverrideId = querySnapshot.docs[0].id;
                await updateDoc(doc(firestore, 'event_overrides', existingOverrideId), overrideData);
            } else {
                await addDoc(overridesRef, overrideData);
            }

        } else {
            const finalData = {
                ...dataToSave,
                createdBy: event?.createdBy || user.uid,
                createdAt: event?.createdAt || serverTimestamp(),
            };
            
            let promise;
            if (event) { 
                if(mode === 'future') { 
                    const oldEventRef = doc(firestore, 'events', event.id);
                    const newRecurrenceEndDate = add(event.displayDate, { days: -1 });
                    await updateDoc(oldEventRef, { recurrenceEndDate: Timestamp.fromDate(newRecurrenceEndDate) });
                    
                    const newSeriesStartDate = combineDateAndTime(event.displayDate, values.isAllDay ? undefined : values.startTime);
                    finalData.date = Timestamp.fromDate(newSeriesStartDate);

                    promise = addDoc(collection(firestore, 'events'), finalData);
                } else { 
                     promise = updateDoc(doc(firestore, 'events', event.id), finalData);
                }
            } else { 
                promise = addDoc(collection(firestore, 'events'), finalData);
            }
            await promise;
        }

        toast({ title: event ? 'Termin aktualisiert' : 'Termin erstellt' });
        onDone();

    } catch(serverError: any) {
        toast({ variant: 'destructive', title: 'Fehler', description: serverError.message });
    } finally {
        setIsSubmitting(false);
        setIsEditModeDialog(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{event ? 'Termin bearbeiten' : 'Neuen Termin erstellen'}</DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 items-end">
              <FormField control={form.control} name="titleId" render={({ field }) => (
                  <FormItem className="flex-grow">
                      <FormLabel>Titel</FormLabel>
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
                      <FormMessage />
                  </FormItem>
              )} />
              {canEdit && (
                  <Popover open={showAddTitle} onOpenChange={setShowAddTitle}>
                      <PopoverTrigger asChild>
                          <Button type="button" variant="outline"><PlusCircle /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                          <Tabs defaultValue="add">
                              <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger value="add">Hinzufügen</TabsTrigger>
                                  <TabsTrigger value="delete">Löschen</TabsTrigger>
                              </TabsList>
                              <TabsContent value="add" className="pt-4">
                                  <AddEventTitleForm onDone={() => setShowAddTitle(false)} />
                              </TabsContent>
                              <TabsContent value="delete" className="pt-4">
                                  <DeleteEventTitleForm onDone={() => setShowAddTitle(false)} eventTitles={eventTitles}/>
                              </TabsContent>
                          </Tabs>
                      </PopoverContent>
                  </Popover>
              )}
          </div>


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
          
         <div className="flex gap-2 items-end">
              <FormField control={form.control} name="locationId" render={({ field }) => (
                  <FormItem className="flex-grow">
                      <FormLabel>Ort</FormLabel>
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
                      <FormMessage />
                  </FormItem>
              )} />
               {canEdit && (
                  <Popover open={showAddLocation} onOpenChange={setShowAddLocation}>
                      <PopoverTrigger asChild>
                          <Button type="button" variant="outline"><PlusCircle /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                           <Tabs defaultValue="add">
                              <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger value="add">Hinzufügen</TabsTrigger>
                                  <TabsTrigger value="delete">Löschen</TabsTrigger>
                              </TabsList>
                              <TabsContent value="add" className="pt-4">
                                  <AddLocationForm onDone={() => setShowAddLocation(false)} />
                              </TabsContent>
                              <TabsContent value="delete" className="pt-4">
                                  <DeleteLocationForm onDone={() => setShowAddLocation(false)} locations={locations}/>
                              </TabsContent>
                          </Tabs>
                      </PopoverContent>
                  </Popover>
              )}
          </div>


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
      <AlertDialog open={isEditModeDialog} onOpenChange={setIsEditModeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Serientermin bearbeiten</AlertDialogTitle>
            <AlertDialogDescription>
              Sie bearbeiten einen Termin, der Teil einer Serie ist. Möchten Sie nur diesen einzelnen Termin ändern, die gesamte Serie oder diesen und alle zukünftigen Termine?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='sm:justify-around'>
            <Button variant="outline" onClick={() => saveEvent(formValues, 'single')}>
              Nur diesen Termin
            </Button>
            <Button variant="outline" onClick={() => saveEvent(formValues, 'future')}>
              Diesen und zukünftige
            </Button>
            <Button variant="outline" onClick={() => saveEvent(formValues, 'all')}>
              Alle Termine der Serie
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const EventCard = ({ event, allUsers, teams, responses, onEdit, onDelete, onCancel, onReactivate, eventTitles, locations, canEdit, currentUserTeamIds }: { event: DisplayEvent; allUsers: GroupMember[]; teams: Team[]; responses: EventResponse[] | null, onEdit: (event: DisplayEvent) => void; onDelete: (event: DisplayEvent) => void; onCancel: (event: DisplayEvent) => void; onReactivate: (event: DisplayEvent) => void; eventTitles: EventTitle[], locations: Location[], canEdit: boolean, currentUserTeamIds: string[] }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const {toast} = useToast();
    const location = locations.find(l => l.id === event.locationId);
    
    const responsesForThisInstance = useMemo(() => {
        if (!responses) return [];
        return responses.filter(r => 
            r.eventDate && isSameDay(r.eventDate.toDate(), event.displayDate)
        );
    }, [responses, event.displayDate]);
    
    const userResponse = useMemo(() => {
         return responsesForThisInstance?.find(r => r.userId === user?.uid);
    }, [responsesForThisInstance, user]);

    const isRsvpVisible = useMemo(() => {
        if (!event.targetTeamIds || event.targetTeamIds.length === 0) {
            return true; // Event is for everyone
        }
        return event.targetTeamIds.some(teamId => currentUserTeamIds.includes(teamId));
    }, [event.targetTeamIds, currentUserTeamIds]);

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
    
    const endDate = useMemo(() => {
        if (!event.endTime) return undefined;

        const originalEndDate = event.endTime.toDate();
        
        const newEndDate = new Date(startDate);
        newEndDate.setHours(originalEndDate.getHours());
        newEndDate.setMinutes(originalEndDate.getMinutes());
        newEndDate.setSeconds(originalEndDate.getSeconds());

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
    const declinedCount = responsesForThisInstance?.filter(r => r.status === 'declined').length || 0;
    const uncertainCount = responsesForThisInstance?.filter(r => r.status === 'uncertain').length || 0;

    const getResponderName = (userId: string) => {
      const responder = allUsers.find(u => u.id === userId);
      return responder ? `${responder.vorname || ''} ${responder.nachname || ''}`.trim() : 'Unbekannt';
    };
    
    const getEventTitle = () => {
        const titleName = eventTitles.find(t => t.id === event.titleId)?.name || 'Unbekannter Termin';
        if (event.isCancelled) return `ABGESAGT: ${titleName}`;
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
        if (!user || !firestore || event.isCancelled) return;

        const responseCollectionRef = collection(firestore, 'event_responses');
        
        if (userResponse && userResponse.status === status) {
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

        const eventDateAsTimestamp = Timestamp.fromDate(startOfDay(event.displayDate));
        const responseDocId = userResponse?.id || doc(responseCollectionRef).id;
        
        const data: Omit<EventResponse, 'id'| 'respondedAt' > & { respondedAt: any } = {
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

    const isRecurring = event.recurrence && event.recurrence !== 'none';
    const deleteMessage = isRecurring
        ? `Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird die gesamte Terminserie "${eventTitles?.find(t => t.id === event?.titleId)?.name || 'Unbenannt'}" und alle zugehörigen Daten dauerhaft gelöscht. Beachten Sie, dass einzelne Änderungen an Terminen in dieser Serie ebenfalls verloren gehen.`
        : `Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird der Termin "${eventTitles?.find(t => t.id === event?.titleId)?.name || 'Unbenannt'}" und alle zugehörigen Daten dauerhaft gelöscht.`;


    return (
        <Card key={event.id} className={cn(event.isCancelled && "bg-destructive/10 border-destructive/30")}>
            <CardHeader>
                 <div className="flex justify-between items-start">
                    <CardTitle className={cn(event.isCancelled && "text-destructive")}>{getEventTitle()}</CardTitle>
                    {canEdit && (
                        <div className="flex items-center">
                             {!event.isCancelled && <Button variant="ghost" size="icon" onClick={() => onEdit(event)}><Edit className="h-4 w-4"/></Button>}
                            
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
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                                        <AlertDialogDescription>{deleteMessage}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(event)} className="bg-destructive hover:bg-destructive/90">
                                            Ja, löschen
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    )}
                </div>
                 <div className={cn("text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-x-4 gap-y-1 pt-1", event.isCancelled && "text-destructive/80")}>
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
                        <Badge variant="outline" className={cn("flex items-center gap-1.5 w-fit mt-1 sm:mt-0", event.isCancelled && "border-destructive/30 text-destructive")}>
                            <Repeat className="h-3 w-3" />
                            <span>{recurrenceText}</span>
                        </Badge>
                    )}
                </div>
            </CardHeader>
            {(event.description || event.meetingPoint) && !event.isCancelled && (
                <CardContent className="space-y-2">
                    {event.meetingPoint && <p className="text-sm"><span className="font-semibold">Treffpunkt:</span> {event.meetingPoint}</p>}
                    {event.description && <p className="text-sm whitespace-pre-wrap">{event.description}</p>}
                </CardContent>
            )}
             {!event.isCancelled && (
                <CardFooter className="flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="link" className="p-0 h-auto text-muted-foreground" disabled={!responses || (attendingCount === 0 && declinedCount === 0 && uncertainCount === 0)}>
                                {!responses ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
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


export default function TerminePage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DisplayEvent | undefined>(undefined);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('termineTeamFilter');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [selectedTitleIds, setSelectedTitleIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('termineTitleFilter');
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
    localStorage.setItem('termineTeamFilter', JSON.stringify(selectedTeamIds));
  }, [selectedTeamIds]);

  useEffect(() => {
    localStorage.setItem('termineTitleFilter', JSON.stringify(selectedTitleIds));
  }, [selectedTitleIds]);

  const userDocRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserLoading } = useDoc<UserData>(userDocRef);

  const canEditEvents = userData?.adminRechte;
  
  const eventsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'events'));
  }, [firestore]);
  
  const { data: eventsData, isLoading: eventsLoading, error } = useCollection<Event>(eventsQuery);
  const [localEvents, setLocalEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    if (eventsData) {
      setLocalEvents(eventsData);
    }
  }, [eventsData]);

  const eventOverridesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'event_overrides'));
  }, [firestore]);
  
  const categoriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'team_categories'), orderBy('order'));
  }, [firestore]);

  const teamsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'teams'), orderBy('name'));
  }, [firestore]);
  
  const groupMembersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'group_members'));
  }, [firestore]);
  
  const locationsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'locations'));
  }, [firestore]);

  const eventTitlesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'event_titles'));
  }, [firestore]);
  
  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
  const { data: allUsers, isLoading: usersLoading } = useCollection<GroupMember>(groupMembersQuery);
  const { data: locations, isLoading: locationsLoading } = useCollection<Location>(locationsQuery);
  const { data: eventTitles, isLoading: eventTitlesLoading } = useCollection<EventTitle>(eventTitlesQuery);
  const { data: overridesData, isLoading: overridesLoading } = useCollection<EventOverride>(eventOverridesQuery);
  
  const eventIdsInWeek = useMemo(() => {
      // This logic needs to be simplified or made more efficient.
      // For now, let's just return all event ids to fetch all responses.
      // A more performant approach would calculate occurrences and get their IDs.
      return eventsData?.map(e => e.id) || [];
  }, [eventsData, currentDate]);

  const responsesQuery = useMemo(() => {
      if (!firestore || eventIdsInWeek.length === 0) return null;
      // Fetch responses for all potentially visible events
      return query(collection(firestore, 'event_responses'), where('eventId', 'in', eventIdsInWeek));
  }, [firestore, eventIdsInWeek]);

  const { data: responses, isLoading: responsesLoading } = useCollection<EventResponse>(responsesQuery);
  
  const isLoading = isUserLoading || eventsLoading || categoriesLoading || teamsLoading || usersLoading || locationsLoading || eventTitlesLoading || overridesLoading || responsesLoading;

  
  const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    }));
  }, [categories, teams]);
  
 const eventsForWeek = useMemo(() => {
    const weeklyEventsMap = new Map<string, DisplayEvent[]>();
    if (!localEvents || !overridesData) return weeklyEventsMap;
  
    const interval = { start: startOfDay(currentWeekStart), end: add(startOfDay(currentWeekEnd), { days: 1 }) };
  
    // 1. Create a set of overridden instance keys for quick lookup.
    // An instance is a specific occurrence of a recurring event on a particular day.
    const overriddenInstanceKeys = new Set<string>();
    overridesData.forEach(override => {
      const key = `${override.eventId}_${format(override.originalDate.toDate(), 'yyyy-MM-dd')}`;
      overriddenInstanceKeys.add(key);
    });
  
    // 2. Process all overrides. Add them to the map if they fall within the week.
    for (const override of overridesData) {
      const originalEvent = localEvents.find(e => e.id === override.eventId);
      if (!originalEvent) continue;
  
      // Apply filters to the override
      const finalTargetTeams = override.targetTeamIds || originalEvent.targetTeamIds;
      const finalTitleId = override.titleId || originalEvent.titleId;
      if (selectedTeamIds.length > 0 && !(finalTargetTeams || []).some(id => selectedTeamIds.includes(id))) continue;
      if (selectedTitleIds.length > 0 && !selectedTitleIds.includes(finalTitleId)) continue;
  
      const displayDate = override.date?.toDate() || override.originalDate.toDate();
  
      if (isWithinInterval(displayDate, interval)) {
        const dayKey = format(displayDate, 'yyyy-MM-dd');
        if (!weeklyEventsMap.has(dayKey)) weeklyEventsMap.set(dayKey, []);
        
        const eventWithOverride: DisplayEvent = {
          ...originalEvent,
          ...(override as Partial<Event>),
          id: originalEvent.id, // Ensure original event ID is preserved
          displayDate: displayDate,
        };
        weeklyEventsMap.get(dayKey)!.push(eventWithOverride);
      }
    }
    
    // 3. Process base events.
    for (const event of localEvents) {
      // Apply filters to the base event
      if (selectedTeamIds.length > 0 && !(event.targetTeamIds || []).some(id => selectedTeamIds.includes(id))) continue;
      if (selectedTitleIds.length > 0 && !selectedTitleIds.includes(event.titleId)) continue;
  
      // Handle non-recurring events
      if (event.recurrence === 'none' || !event.recurrence) {
        const originalDate = event.date.toDate();
        const key = `${event.id}_${format(originalDate, 'yyyy-MM-dd')}`;
        if (isWithinInterval(originalDate, interval) && !overriddenInstanceKeys.has(key)) {
          const dayKey = format(originalDate, 'yyyy-MM-dd');
          if (!weeklyEventsMap.has(dayKey)) weeklyEventsMap.set(dayKey, []);
          weeklyEventsMap.get(dayKey)!.push({ ...event, displayDate: originalDate });
        }
        continue;
      }
  
      // Handle recurring events
      let currentDate = event.date.toDate();
      const recurrenceEndDate = event.recurrenceEndDate?.toDate();
  
      // Performance optimization: Fast-forward to a point before the current week
      if (currentDate < interval.start) {
        if (event.recurrence === 'weekly' || event.recurrence === 'biweekly') {
          const weeksDiff = Math.floor((interval.start.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
          const step = event.recurrence === 'weekly' ? 1 : 2;
          currentDate = addWeeks(currentDate, Math.floor(weeksDiff / step) * step);
        } else if (event.recurrence === 'monthly') {
          const monthDiff = (interval.start.getFullYear() - currentDate.getFullYear()) * 12 + (interval.start.getMonth() - currentDate.getMonth());
          if (monthDiff > 0) {
            currentDate = add(currentDate, { months: monthDiff - 1 });
          }
        }
      }
  
      let safety = 100;
      while (currentDate < interval.end && safety > 0) {
        if (recurrenceEndDate && currentDate > recurrenceEndDate) break;
  
        if (currentDate >= interval.start) {
          const key = `${event.id}_${format(currentDate, 'yyyy-MM-dd')}`;
          // Only add the recurring instance if it hasn't been overridden.
          if (!overriddenInstanceKeys.has(key)) {
            const dayKey = format(currentDate, 'yyyy-MM-dd');
            if (!weeklyEventsMap.has(dayKey)) weeklyEventsMap.set(dayKey, []);
            weeklyEventsMap.get(dayKey)!.push({ ...event, displayDate: currentDate });
          }
        }
  
        switch (event.recurrence) {
          case 'weekly': currentDate = addWeeks(currentDate, 1); break;
          case 'biweekly': currentDate = addWeeks(currentDate, 2); break;
          case 'monthly': currentDate = add(currentDate, { months: 1 }); break;
          default: safety = 0; break;
        }
        safety--;
      }
    }
  
    // 4. Sort events within each day
    weeklyEventsMap.forEach((dayEvents) => {
      dayEvents.sort((a, b) => {
        const timeA = a.isAllDay ? 0 : a.displayDate.getTime();
        const timeB = b.isAllDay ? 0 : b.displayDate.getTime();
        return timeA - timeB;
      });
    });
  
    return weeklyEventsMap;
  }, [localEvents, overridesData, currentWeekStart, currentWeekEnd, selectedTeamIds, selectedTitleIds]);


  const handleOpenForm = (event?: DisplayEvent) => {
    setSelectedEvent(event);
    setIsFormOpen(true);
  };

  const handleFormDone = () => {
    setIsFormOpen(false);
    setSelectedEvent(undefined);
  };

  const handleDelete = (eventToDelete: DisplayEvent) => {
    if (!firestore) return;
    if (!canEditEvents) return;
    const eventDocRef = doc(firestore, 'events', eventToDelete.id);
    
    setLocalEvents(prev => prev ? prev.filter(e => e.id !== eventToDelete.id) : null);

    deleteDoc(eventDocRef)
      .then(() => {
        toast({ title: 'Terminserie gelöscht' });
      })
      .catch((err) => {
        setLocalEvents(eventsData); 
        const permissionError = new FirestorePermissionError({
            path: eventDocRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
};


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
                                        teams={teams || []}
                                        responses={responses?.filter(r => r.eventId === event.id) || null}
                                        onEdit={handleOpenForm}
                                        onDelete={handleDelete}
                                        onCancel={handleCancelSingleEvent}
                                        onReactivate={handleReactivateSingleEvent}
                                        eventTitles={eventTitles || []}
                                        locations={locations || []}
                                        canEdit={!!canEditEvents}
                                        currentUserTeamIds={userData?.teamIds || []}
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <h1 className="text-3xl font-bold">Termine</h1>
            <div className="flex items-center gap-2 justify-center flex-wrap">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}><ChevronLeft className="h-4 w-4"/></Button>
                <Button variant="outline" onClick={goToToday}>Heute</Button>
                <Button variant="outline" size="sm" onClick={goToNextWeek}><ChevronRight className="h-4 w-4"/></Button>
            </div>
            {canEditEvents && (
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
                 <Card className="md:sticky md:top-24 self-start">
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
                                            <AccordionItem value={`cat-${category.id}`} key={category.id}>
                                                <AccordionTrigger className="pl-2">{category.name}</AccordionTrigger>
                                                <AccordionContent className="pl-4">
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
                                                id={title.id}
                                                checked={selectedTitleIds.includes(title.id)}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                    ? setSelectedTitleIds([...selectedTitleIds, title.id])
                                                    : setSelectedTitleIds(selectedTitleIds.filter((id) => id !== title.id))
                                                }}
                                            />
                                            <Label htmlFor={title.id} className="font-normal cursor-pointer">{title.name}</Label>
                                        </div>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                       )}
                    </CardContent>
                </Card>
                 
                <div className="row-start-1 md:row-start-auto">
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
             <EventForm onDone={handleFormDone} event={selectedEvent} categories={categories || []} teams={teams || []} canEdit={!!canEditEvents} eventTitles={eventTitles || []} locations={locations || []} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
