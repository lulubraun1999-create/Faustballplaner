
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
  cancellationReason?: string;
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
  cancellationReason: z.string().optional(),
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
    const { toast } } from '@/hooks/use-toast';
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
  cancellationReason?: string;
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
  cancellationReason: z.string().optional(),
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
             
                
                  ) : (
             <EventForm onDone={handleFormDone} event={selectedEvent} categories={categories || []} teams={teams || []} canEdit={!!canEditEvents} eventTitles={eventTitles || []} locations={locations || []} />
          )}
        
      
      
        
            
                
                    
                        Termin absagen
                    
                    Bitte geben Sie einen Grund für die Absage des Termins am {eventToCancel ? format(eventToCancel.displayDate, 'dd.MM.yyyy') : ''} an.
                
                
                    
                
                
                    
                        Abbrechen
                    
                    
                        Absage bestätigen
                    
                
            
        
      
    
  );
}










    