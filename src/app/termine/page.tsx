
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
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
import { PlusCircle, Trash2, Loader2, CalendarIcon, Edit, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Event {
  id: string;
  title: string;
  date: Timestamp;
  endTime?: string;
  location?: string;
  description?: string;
  createdBy: string;
  createdAt: Timestamp;
}

interface UserData {
  adminRechte?: boolean;
}

const eventSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich.'),
  date: z.date({ required_error: 'Datum ist erforderlich.' }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Ungültige Zeit (HH:mm).'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Ungültige Zeit (HH:mm).').optional().or(z.literal('')),
  location: z.string().optional(),
  description: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

function EventForm({ onDone, event }: { onDone: () => void, event?: Event }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getInitialFormValues = () => {
    if (event) {
      const eventDate = event.date.toDate();
      return {
        title: event.title,
        date: eventDate,
        startTime: format(eventDate, 'HH:mm'),
        endTime: event.endTime || '',
        location: event.location || '',
        description: event.description || '',
      };
    }
    return {
      title: '',
      date: undefined,
      startTime: '',
      endTime: '',
      location: '',
      description: '',
    };
  };

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: getInitialFormValues(),
  });

  const onSubmit = async (values: EventFormValues) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Nicht authentifiziert' });
      return;
    }
    setIsSubmitting(true);

    const [hours, minutes] = values.startTime.split(':').map(Number);
    const eventDate = new Date(values.date);
    eventDate.setHours(hours);
    eventDate.setMinutes(minutes);

    const dataToSave = {
      ...values,
      date: Timestamp.fromDate(eventDate),
      endTime: values.endTime || null,
      createdBy: user.uid,
      createdAt: event ? event.createdAt : serverTimestamp(),
    };
    // remove startTime as it's merged into date
    delete (dataToSave as any).startTime;

    try {
      if (event) {
        const eventRef = doc(firestore, 'events', event.id);
        await updateDoc(eventRef, dataToSave);
        toast({ title: 'Termin aktualisiert' });
      } else {
        await addDoc(collection(firestore, 'events'), dataToSave);
        toast({ title: 'Termin erstellt' });
      }
      onDone();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="date" render={({ field }) => (
            <FormItem className="flex flex-col md:col-span-1">
              <FormLabel>Datum</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Wähle ein Datum</span>}
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
          <FormField control={form.control} name="startTime" render={({ field }) => (
            <FormItem>
              <FormLabel>Beginn</FormLabel>
              <FormControl><Input type="time" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="endTime" render={({ field }) => (
            <FormItem>
              <FormLabel>Ende (optional)</FormLabel>
              <FormControl><Input type="time" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        
        <FormField control={form.control} name="location" render={({ field }) => (
          <FormItem>
            <FormLabel>Ort</FormLabel>
            <FormControl><Input placeholder="z.B. Fritz-Jacobi-Anlage" {...field} /></FormControl>
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

  const { data: currentUserData, isLoading: isUserLoading } = useDoc<UserData>(currentUserDocRef);
  const { data: events, isLoading, error } = useCollection<Event>(eventsQuery);

  const isAdmin = currentUserData?.adminRechte === true;

  const handleOpenForm = (event?: Event) => {
    setSelectedEvent(event);
    setIsFormOpen(true);
  };

  const handleFormDone = () => {
    setIsFormOpen(false);
    setSelectedEvent(undefined);
  };

  const handleDelete = async () => {
    if (!firestore || !eventToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'events', eventToDelete.id));
      toast({ title: 'Termin gelöscht' });
      setEventToDelete(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler beim Löschen', description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderContent = () => {
    if (isLoading || isUserLoading) {
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
            {events.map(event => (
                <Card key={event.id}>
                    <CardHeader>
                        <CardTitle>{event.title}</CardTitle>
                        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                            <div className="flex items-center gap-1.5">
                                <CalendarIcon className="h-4 w-4" />
                                <span>{format(event.date.toDate(), 'eeee, dd.MM.yyyy', { locale: de })}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                <span>{format(event.date.toDate(), 'HH:mm')} Uhr {event.endTime ? `- ${event.endTime} Uhr` : ''}</span>
                            </div>
                            {event.location && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4" />
                                    <span>{event.location}</span>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    {event.description && (
                        <CardContent>
                            <p className="whitespace-pre-wrap">{event.description}</p>
                        </CardContent>
                    )}
                    {isAdmin && (
                        <CardFooter className="flex justify-end gap-2">
                             <Button variant="ghost" size="icon" onClick={() => handleOpenForm(event)}><Edit className="h-4 w-4"/></Button>
                             <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => setEventToDelete(event)}><Trash2 className="h-4 w-4" /></Button>
                        </CardFooter>
                    )}
                </Card>
            ))}
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
        <DialogContent className="sm:max-w-xl">
          <EventForm onDone={handleFormDone} event={selectedEvent} />
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

    