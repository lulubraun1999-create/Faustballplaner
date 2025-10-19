

'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, doc, setDoc, deleteDoc, Timestamp, query, where, getDocs, writeBatch, serverTimestamp, addDoc, getDoc, orderBy } from 'firebase/firestore';
import { useAuth, useUser, useFirestore, useDoc, useCollection, FirestorePermissionError, errorEmitter } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, eachDayOfInterval, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { sendPasswordResetEmail, deleteUser, verifyBeforeUpdateEmail } from 'firebase/auth';

import { Header } from '@/components/header';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';

const profileSchema = z.object({
  vorname: z.string().min(1, 'Vorname ist erforderlich'),
  nachname: z.string().min(1, 'Nachname ist erforderlich'),
  telefon: z.string().optional(),
  wohnort: z.string().optional(),
  position: z.object({
    abwehr: z.boolean().default(false),
    zuspiel: z.boolean().default(false),
    angriff: z.boolean().default(false),
  }).optional(),
  geschlecht: z.string().optional(),
  geburtstag: z.date().optional(),
});

const emailSchema = z.object({
  newEmail: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
});

const absenceSchema = z.object({
    reason: z.string().min(1, { message: "Grund ist erforderlich." }),
    dateRange: z.object({
        from: z.date({ required_error: "Startdatum ist erforderlich." }),
        to: z.date({ required_error: "Enddatum ist erforderlich." }),
    }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type AbsenceFormValues = z.infer<typeof absenceSchema>;

interface UserData {
    vorname?: string;
    nachname?: string;
    telefon?: string;
    wohnort?: string;
    position?: {
        abwehr: boolean;
        zuspiel: boolean;
        angriff: boolean;
    };
    geschlecht?: string;
    geburtstag?: Timestamp;
    adminRechte?: boolean;
    teamIds?: string[];
}

interface UserAbsence {
    id: string;
    userId: string;
    startDate: Timestamp;
    endDate: Timestamp;
    reason: string;
    createdAt: Timestamp;
}

interface Event {
  id: string;
  date: Timestamp;
  recurrence?: 'none' | 'weekly' | 'biweekly' | 'monthly';
  recurrenceEndDate?: Timestamp;
  targetTeamIds?: string[];
}

interface EventOverride {
    eventId: string;
    originalDate: Timestamp;
    date?: Timestamp;
}

function ProfileForm({ defaultValues, userData }: { defaultValues: ProfileFormValues, userData: UserData | null }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues,
    values: defaultValues,
  });

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Benutzer nicht authentifiziert.' });
      return;
    }
    try {
      const userDocRef = doc(firestore, "users", user.uid);
      const memberDocRef = doc(firestore, "members", user.uid);
      
      const dataToSave: any = {
        ...values,
        geburtstag: values.geburtstag ? Timestamp.fromDate(values.geburtstag) : null,
      }
      
      await setDoc(userDocRef, dataToSave, { merge: true });
      await setDoc(memberDocRef, dataToSave, { merge: true });

      const groupMemberRef = doc(firestore, 'group_members', user.uid);
      const groupMemberSnap = await getDoc(groupMemberRef);
      if (groupMemberSnap.exists()) {
        await setDoc(groupMemberRef, {
            vorname: values.vorname,
            nachname: values.nachname,
            position: values.position,
        }, { merge: true });
      }


      toast({ title: 'Erfolg', description: 'Ihre Daten wurden erfolgreich gespeichert.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Beim Speichern Ihrer Daten ist ein Fehler aufgetreten.' });
    }
  };

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Daten ändern</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="vorname" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Vorname</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="nachname" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Nachname</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="position" render={() => (
                <FormItem className="space-y-2">
                  <FormLabel>Position</FormLabel>
                  <div className="flex gap-4 items-center">
                    <FormField control={form.control} name="position.abwehr" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal">Abwehr</FormLabel>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="position.zuspiel" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal">Zuspiel</FormLabel>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="position.angriff" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal">Angriff</FormLabel>
                        </FormItem>
                    )} />
                  </div>
                  <FormMessage />
                </FormItem>
            )} />
            
            <div className="space-y-2">
                <Label htmlFor="rolle">Rolle</Label>
                <Input id="rolle" defaultValue={userData?.adminRechte ? "Trainer" : "Benutzer"} disabled />
            </div>

            <FormField control={form.control} name="geschlecht" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Geschlecht</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Männlich" /></FormControl>
                        <FormLabel className="font-normal">Männlich</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Weiblich" /></FormControl>
                        <FormLabel className="font-normal">Weiblich</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Divers (Herrenteam)" /></FormControl>
                        <FormLabel className="font-normal">Divers (Herrenteam)</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Divers (Damenteam)" /></FormControl>
                        <FormLabel className="font-normal">Divers (Damenteam)</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )} />

             <FormField control={form.control} name="geburtstag" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Geburtstag</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP', { locale: de }) : <span>Wähle ein Datum</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar locale={de} mode="single" selected={field.value} onSelect={field.onChange} initialFocus captionLayout="dropdown-buttons" fromYear={1950} toYear={new Date().getFullYear()} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
              )} />

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" defaultValue={user?.email || ''} disabled />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="telefon" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Telefon</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="wohnort" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Wohnort</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
            </div>
            
            <div>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin"/> : 'Speichern'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}

function AbsenceManager() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const absencesQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'absences'), orderBy('startDate', 'desc'));
    }, [firestore, user]);

    const { data: absences, isLoading: absencesLoading } = useCollection<UserAbsence>(absencesQuery);
    
    const eventsQuery = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'events');
    }, [firestore]);
    const { data: allEvents } = useCollection<Event>(eventsQuery);
    
    const overridesQuery = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'event_overrides');
    }, [firestore]);
    const { data: allOverrides } = useCollection<EventOverride>(overridesQuery);

    const form = useForm<AbsenceFormValues>({
        resolver: zodResolver(absenceSchema),
        defaultValues: {
            reason: '',
            dateRange: { from: undefined, to: undefined }
        }
    });

    const findApplicableEvents = useCallback((startDate: Date, endDate: Date, userTeamIds: string[]) => {
        if (!allEvents || !allOverrides) return [];

        const absenceInterval = { start: startOfDay(startDate), end: endOfDay(endDate) };
        const relevantEvents: { eventId: string; eventDate: Date; }[] = [];

        const userEvents = allEvents.filter(event => {
            if (!event.targetTeamIds || event.targetTeamIds.length === 0) return true; // public event
            return event.targetTeamIds.some(teamId => userTeamIds.includes(teamId));
        });

        userEvents.forEach(event => {
            if (event.recurrence === 'none') {
                const eventDate = event.date.toDate();
                if (eventDate >= absenceInterval.start && eventDate <= absenceInterval.end) {
                    const isOverridden = allOverrides.some(o => o.eventId === event.id && isSameDay(o.originalDate.toDate(), eventDate));
                    if (!isOverridden) {
                         relevantEvents.push({ eventId: event.id, eventDate });
                    }
                }
            } else {
                 let currentDate = event.date.toDate();
                 const recurrenceEndDate = event.recurrenceEndDate?.toDate();
                 let limit = 100;
                 while(currentDate <= absenceInterval.end && limit > 0) {
                     if (recurrenceEndDate && currentDate > recurrenceEndDate) break;

                     if (currentDate >= absenceInterval.start) {
                        const isOverridden = allOverrides.some(o => o.eventId === event.id && isSameDay(o.originalDate.toDate(), currentDate));
                        if(!isOverridden) {
                            relevantEvents.push({ eventId: event.id, eventDate: new Date(currentDate) });
                        }
                     }

                     switch(event.recurrence) {
                        case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                        case 'biweekly': currentDate.setDate(currentDate.getDate() + 14); break;
                        case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                        default: limit=0; break;
                     }
                     limit--;
                 }
            }
        });
        
        allOverrides.forEach(override => {
            const overrideDate = override.date?.toDate();
            if(overrideDate && overrideDate >= absenceInterval.start && overrideDate <= absenceInterval.end) {
                const originalEvent = allEvents.find(e => e.id === override.eventId);
                if (originalEvent) {
                     const isPublic = !originalEvent.targetTeamIds || originalEvent.targetTeamIds.length === 0;
                     const isInUserTeam = originalEvent.targetTeamIds?.some(id => userTeamIds.includes(id));
                     if(isPublic || isInUserTeam) {
                        relevantEvents.push({ eventId: override.eventId, eventDate: overrideDate });
                     }
                }
            }
        });


        return relevantEvents;
    }, [allEvents, allOverrides]);


    const onSubmit = async (values: AbsenceFormValues) => {
        if (!firestore || !user) return;
        setIsSubmitting(true);
        const { reason, dateRange } = values;

        try {
            const batch = writeBatch(firestore);
            
            // 1. Save the absence period
            const absenceRef = doc(collection(firestore, 'users', user.uid, 'absences'));
            batch.set(absenceRef, {
                userId: user.uid,
                reason: reason,
                startDate: Timestamp.fromDate(dateRange.from),
                endDate: Timestamp.fromDate(dateRange.to),
                createdAt: serverTimestamp(),
            });

            // 2. Find and decline events
            const userDocSnap = await getDoc(doc(firestore, 'users', user.uid));
            const userData = userDocSnap.data() as UserData;
            const userTeamIds = userData.teamIds || [];
            
            const eventsToDecline = findApplicableEvents(dateRange.from, dateRange.to, userTeamIds);
            
            for (const { eventId, eventDate } of eventsToDecline) {
                const responseQuery = query(
                    collection(firestore, 'event_responses'),
                    where('eventId', '==', eventId),
                    where('userId', '==', user.uid),
                    where('eventDate', '==', Timestamp.fromDate(startOfDay(eventDate)))
                );
                
                const existingResponses = await getDocs(responseQuery);
                
                const responseData = {
                    eventId: eventId,
                    userId: user.uid,
                    eventDate: Timestamp.fromDate(startOfDay(eventDate)),
                    status: 'declined' as const,
                    reason: reason,
                    respondedAt: serverTimestamp(),
                };

                if (existingResponses.empty) {
                    const responseRef = doc(collection(firestore, 'event_responses'));
                    batch.set(responseRef, responseData);
                } else {
                    const responseRef = existingResponses.docs[0].ref;
                    batch.update(responseRef, responseData);
                }
            }

            await batch.commit();
            toast({ title: "Abwesenheit gespeichert", description: `${eventsToDecline.length} Termin(e) automatisch abgesagt.` });
            setIsFormOpen(false);
            form.reset();

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Fehler beim Speichern der Abwesenheit', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteAbsence = async (absenceId: string) => {
        if (!firestore || !user) return;
        try {
            await deleteDoc(doc(firestore, 'users', user.uid, 'absences', absenceId));
            toast({ title: "Abwesenheit gelöscht" });
        } catch (error: any) {
             const permissionError = new FirestorePermissionError({
                path: `users/${user.uid}/absences/${absenceId}`,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Fehler", description: "Löschen fehlgeschlagen" });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Meine Ausfallzeiten</CardTitle>
                    <CardDescription>Hier kannst du geplante Abwesenheiten wie Urlaub eintragen.</CardDescription>
                </div>
                 <Button variant="outline" onClick={() => setIsFormOpen(true)}>Neue Abwesenheit</Button>
            </CardHeader>
            <CardContent>
                {absencesLoading && <Loader2 className="animate-spin" />}
                {!absencesLoading && (!absences || absences.length === 0) && (
                    <p className="text-sm text-muted-foreground">Keine Abwesenheiten eingetragen.</p>
                )}
                <div className="space-y-4">
                    {absences?.map(absence => (
                        <div key={absence.id} className="flex justify-between items-center p-3 rounded-md border">
                            <div>
                                <p className="font-semibold">{absence.reason}</p>
                                <p className="text-sm text-muted-foreground">
                                    {format(absence.startDate.toDate(), 'dd.MM.yyyy')} - {format(absence.endDate.toDate(), 'dd.MM.yyyy')}
                                </p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon"><Trash2 className="text-destructive h-4 w-4"/></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Abwesenheit löschen?</AlertDialogTitle>
                                        <AlertDialogDescription>Diese Aktion löscht nur den Abwesenheitseintrag. Manuell getätigte Terminabsagen bleiben bestehen.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteAbsence(absence.id)}>Ja, löschen</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    ))}
                </div>
            </CardContent>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                 <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Neue Abwesenheit anlegen</DialogTitle>
                    </DialogHeader>
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                             <FormField control={form.control} name="reason" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Grund</FormLabel>
                                    <FormControl><Input placeholder="z.B. Urlaub, Krank" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="dateRange" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Zeitraum</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button id="date" variant={"outline"} className={cn("justify-start text-left font-normal", !field.value?.from && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value?.from ? (
                                                    field.value.to ? (
                                                    <>
                                                        {format(field.value.from, "dd. LLL, y", { locale: de })} -{" "}
                                                        {format(field.value.to, "dd. LLL, y", { locale: de })}
                                                    </>
                                                    ) : (
                                                    format(field.value.from, "dd. LLL, y", { locale: de })
                                                    )
                                                ) : (
                                                    <span>Wähle einen Zeitraum</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                defaultMonth={field.value?.from}
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                numberOfMonths={2}
                                                locale={de}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Abbrechen</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern & Absagen'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                 </DialogContent>
            </Dialog>
        </Card>
    )
}


export default function ProfileSettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const userDocRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<UserData>(userDocRef);

  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "" },
  });
  
  const handleLogout = async () => {
    if(auth) {
      await auth.signOut();
      toast({ title: "Abgemeldet", description: "Sie wurden erfolgreich abgemeldet." });
      router.push('/login');
    }
  };

  const handleChangeEmail = async (values: z.infer<typeof emailSchema>) => {
    if (!auth?.currentUser) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Benutzer nicht authentifiziert.' });
      return;
    }
    
    setIsChangingEmail(true);

    try {
      await verifyBeforeUpdateEmail(auth.currentUser, values.newEmail);
      toast({ title: "Bestätigungs-E-Mail gesendet", description: "Bitte überprüfen Sie Ihr neues E-Mail-Postfach, um die Änderung abzuschließen." });
      emailForm.reset();
    } catch (error: any) {
      let description = 'Beim Senden der Bestätigungs-E-Mail ist ein Fehler aufgetreten.';
      if (error.code === 'auth/email-already-in-use') {
        description = 'Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.';
      } else if (error.code === 'auth/requires-recent-login') {
        description = 'Diese Aktion erfordert eine erneute Anmeldung. Bitte melden Sie sich ab und wieder an, bevor Sie es erneut versuchen.';
      }
      toast({ variant: 'destructive', title: 'E-Mail-Änderung fehlgeschlagen', description: description });
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email || !auth) {
      toast({ variant: "destructive", title: "Fehler", description: "E-Mail-Adresse nicht gefunden, um eine E-Mail zum Zurücksetzen zu senden." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({ title: "E-Mail gesendet", description: "Eine E-Mail zum Zurücksetzen des Passworts wurde an Ihre E-Mail-Adresse gesendet." });
    } catch (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Beim Senden der E-Mail zum Zurücksetzen des Passworts ist ein Fehler aufgetreten." });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Benutzer nicht authentifiziert.' });
      return;
    }

    setIsDeleting(true);

    try {
      await deleteDoc(doc(firestore, 'users', user.uid));
      await deleteDoc(doc(firestore, 'members', user.uid));
      await deleteDoc(doc(firestore, 'group_members', user.uid));

      if(auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      
      toast({ title: "Konto gelöscht", description: "Ihr Konto wurde dauerhaft gelöscht." });
      router.push('/login');

    } catch (error: any) {
      setIsDeleting(false);
      let description = 'Beim Löschen Ihres Kontos ist ein Fehler aufgetreten.';
      if (error.code === 'auth/requires-recent-login') {
        description = 'Diese Aktion erfordert eine erneute Anmeldung. Bitte melden Sie sich ab und wieder an, bevor Sie es erneut versuchen.';
      }
      toast({ variant: 'destructive', title: 'Löschen fehlgeschlagen', description: description });
    }
  };

  const isLoading = isUserLoading || isUserDataLoading;

  if (isLoading) {
     return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Laden...</p>
      </div>
    );
  }

  const defaultFormValues = {
    vorname: userData?.vorname || '',
    nachname: userData?.nachname || '',
    telefon: userData?.telefon || '',
    wohnort: userData?.wohnort || '',
    position: userData?.position || { abwehr: false, zuspiel: false, angriff: false },
    geschlecht: userData?.geschlecht || '',
    geburtstag: userData?.geburtstag?.toDate() || undefined,
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          <aside className="lg:sticky lg:top-24 self-start">
            <Card>
              <CardHeader><CardTitle>Konto-Aktionen</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                <Dialog>
                  <DialogTrigger asChild><Button variant="ghost" className="justify-start">E-Mail-Adresse ändern</Button></DialogTrigger>
                  <DialogContent>
                    <Form {...emailForm}>
                      <form onSubmit={emailForm.handleSubmit(handleChangeEmail)}>
                        <DialogHeader><DialogTitle>E-Mail-Adresse ändern</DialogTitle></DialogHeader>
                        <div className="py-4">
                          <FormField control={emailForm.control} name="newEmail" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Neue E-Mail-Adresse</FormLabel>
                                <FormControl><Input placeholder="neue.email@beispiel.de" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                          )} />
                        </div>
                        <DialogFooter>
                           <DialogClose asChild><Button type="button" variant="outline" disabled={isChangingEmail}>Abbrechen</Button></DialogClose>
                           <Button type="submit" disabled={isChangingEmail}>
                            {isChangingEmail ? <Loader2 className="animate-spin" /> : 'Änderung anfordern'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" className="justify-start" onClick={handlePasswordReset}>Passwort ändern</Button>
                <Button variant="ghost" className="justify-start" onClick={handleLogout}>Logout</Button>
              </CardContent>
            </Card>
            <Card className="mt-8 border-destructive">
                <CardHeader>
                    <CardTitle>Konto löschen</CardTitle>
                    <CardDescription>Achtung: Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.</CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="animate-spin" /> : 'Konto dauerhaft löschen'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird Ihr Konto dauerhaft gelöscht und Ihre Daten von unseren Servern entfernt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                          {isDeleting ? <Loader2 className="animate-spin" /> : 'Ja, Konto löschen'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
            </Card>
          </aside>

          <section className="space-y-8">
             <ProfileForm defaultValues={defaultFormValues} userData={userData} />
             <AbsenceManager />
          </section>
        </div>
      </main>
    </div>
  );
}
