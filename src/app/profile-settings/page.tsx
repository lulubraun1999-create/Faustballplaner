'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { sendPasswordResetEmail, deleteUser, verifyBeforeUpdateEmail } from 'firebase/auth';

import { Header } from '@/components/header';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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

export default function ProfileSettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<any>(userDocRef);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      vorname: '',
      nachname: '',
      telefon: '',
      wohnort: '',
      position: {
        abwehr: false,
        zuspiel: false,
        angriff: false,
      },
      geschlecht: '',
      geburtstag: undefined,
    },
  });

   const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      newEmail: "",
    },
  });

  useEffect(() => {
    if (userData) {
      form.reset({
        vorname: userData.vorname || '',
        nachname: userData.nachname || '',
        telefon: userData.telefon || '',
        wohnort: userData.wohnort || '',
        position: userData.position || { abwehr: false, zuspiel: false, angriff: false },
        geschlecht: userData.geschlecht || '',
        geburtstag: userData.geburtstag?.toDate() || undefined,
      });
    }
  }, [userData, form]);
  
  const handleLogout = async () => {
    if(auth) {
      await auth.signOut();
      toast({
        title: "Abgemeldet",
        description: "Sie wurden erfolgreich abgemeldet.",
      });
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
      toast({
        title: "Bestätigungs-E-Mail gesendet",
        description: "Bitte überprüfen Sie Ihr neues E-Mail-Postfach, um die Änderung zu bestätigen.",
      });
      emailForm.reset();
      // Manually close dialog if possible/needed, depends on Dialog component structure
    } catch (error: any) {
      let description = 'Beim Senden der Bestätigungs-E-Mail ist ein Fehler aufgetreten.';
      if (error.code === 'auth/email-already-in-use') {
        description = 'Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.';
      } else if (error.code === 'auth/requires-recent-login') {
        description = 'Diese Aktion erfordert eine erneute Anmeldung. Bitte melden Sie sich ab und wieder an, bevor Sie es erneut versuchen.';
      }
      toast({
        variant: 'destructive',
        title: 'E-Mail-Änderung fehlgeschlagen',
        description: description,
      });
    } finally {
      setIsChangingEmail(false);
    }
  };


  const handlePasswordReset = async () => {
    if (!user?.email || !auth) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "E-Mail-Adresse nicht gefunden, um eine E-Mail zum Zurücksetzen zu senden.",
      });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({
        title: "E-Mail gesendet",
        description: "Eine E-Mail zum Zurücksetzen des Passworts wurde an Ihre E-Mail-Adresse gesendet.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Beim Senden der E-Mail zum Zurücksetzen des Passworts ist ein Fehler aufgetreten.",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Benutzer nicht authentifiziert.' });
      return;
    }

    setIsDeleting(true);

    try {
      // First, delete the Firestore document
      const userDocRef = doc(firestore, 'users', user.uid);
      await deleteDoc(userDocRef);

      // Then, delete the user from Firebase Auth
      if(auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      
      toast({
        title: "Konto gelöscht",
        description: "Ihr Konto wurde dauerhaft gelöscht.",
      });

      router.push('/login');

    } catch (error: any) {
      setIsDeleting(false);
      let description = 'Beim Löschen Ihres Kontos ist ein Fehler aufgetreten.';
      // This error often means the user needs to re-authenticate
      if (error.code === 'auth/requires-recent-login') {
        description = 'Diese Aktion erfordert eine erneute Anmeldung. Bitte melden Sie sich ab und wieder an, bevor Sie es erneut versuchen.';
      }
      toast({
        variant: 'destructive',
        title: 'Löschen fehlgeschlagen',
        description: description,
      });
    }
  };


  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Benutzer nicht authentifiziert.' });
      return;
    }
    try {
      const userDocRef = doc(firestore, "users", user.uid);
      await setDoc(userDocRef, values, { merge: true });
      toast({ title: 'Erfolg', description: 'Ihre Daten wurden erfolgreich gespeichert.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Beim Speichern Ihrer Daten ist ein Fehler aufgetreten.' });
    }
  };

  if (isUserLoading || isUserDataLoading) {
     return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
          <aside>
            <Card>
              <CardHeader>
                <CardTitle>Menü</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="ghost" className="justify-start">Daten ändern</Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="justify-start">E-Mail-Adresse ändern</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <Form {...emailForm}>
                      <form onSubmit={emailForm.handleSubmit(handleChangeEmail)}>
                        <DialogHeader>
                          <DialogTitle>E-Mail-Adresse ändern</DialogTitle>
                          <DialogDescription>
                            Geben Sie Ihre neue E-Mail-Adresse ein. Sie erhalten eine Bestätigungs-E-Mail, um die Änderung abzuschließen.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <FormField
                            control={emailForm.control}
                            name="newEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Neue E-Mail-Adresse</FormLabel>
                                <FormControl>
                                  <Input placeholder="neue.email@beispiel.de" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                           <DialogClose asChild>
                            <Button type="button" variant="outline">Abbrechen</Button>
                           </DialogClose>
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
                    <CardDescription>
                        Achtung: Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.
                    </CardDescription>
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
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="bg-destructive hover:bg-destructive/90"
                          disabled={isDeleting}
                        >
                          {isDeleting ? <Loader2 className="animate-spin" /> : 'Ja, Konto löschen'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
            </Card>
          </aside>

          <section>
            <Card>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardHeader>
                            <CardTitle>Daten ändern</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="vorname"
                                render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Vorname</FormLabel>
                                    <FormControl>
                                    <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="nachname"
                                render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Nachname</FormLabel>
                                    <FormControl>
                                    <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="telefon"
                                    render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Telefon</FormLabel>
                                        <FormControl>
                                        <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="wohnort"
                                    render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Wohnort</FormLabel>
                                        <FormControl>
                                        <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="position"
                                render={() => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Position</FormLabel>
                                         <div className="flex gap-4 items-center">
                                            <FormField
                                            control={form.control}
                                            name="position.abwehr"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2 space-y-0">
                                                    <FormControl>
                                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">Abwehr</FormLabel>
                                                </FormItem>
                                            )}
                                            />
                                            <FormField
                                            control={form.control}
                                            name="position.zuspiel"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2 space-y-0">
                                                    <FormControl>
                                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">Zuspiel</FormLabel>
                                                </FormItem>
                                            )}
                                            />
                                            <FormField
                                            control={form.control}
                                            name="position.angriff"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2 space-y-0">
                                                    <FormControl>
                                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">Angriff</FormLabel>
                                                </FormItem>
                                            )}
                                            />
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="geschlecht"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                        <FormLabel>Geschlecht</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Geschlecht wählen" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Männlich">Männlich</SelectItem>
                                                <SelectItem value="Weiblich">Weiblich</SelectItem>
                                                <SelectItem value="Divers (Herrenteam)">Divers (Herrenteam)</SelectItem>
                                                <SelectItem value="Divers (Damenteam)">Divers (Damenteam)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="geburtstag"
                                    render={({ field }) => (
                                        <div className="space-y-2">
                                            <Label htmlFor="geburtstag">Geburtstag</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                    >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {field.value ? format(field.value, 'PPP', { locale: de }) : <span>Wähle ein Datum</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        locale={de}
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        initialFocus
                                                        captionLayout="dropdown-buttons"
                                                        fromYear={1950}
                                                        toYear={new Date().getFullYear()}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="rolle">Rolle</Label>
                                    <Input id="rolle" defaultValue={userData?.adminRechte ? "Admin" : "Benutzer"} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">E-Mail</Label>
                                    <Input id="email" defaultValue={user?.email || ''} disabled />
                                </div>
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
          </section>
        </div>
      </main>
    </div>
  );
}
