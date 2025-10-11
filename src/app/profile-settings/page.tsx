
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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

export default function ProfileSettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

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
      console.error("Error updating document: ", error);
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
                <Button variant="ghost" className="justify-start text-muted-foreground" disabled>Passwort ändern</Button>
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
                    <Button variant="destructive" className="w-full" disabled>Konto dauerhaft löschen</Button>
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
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Geschlecht wählen" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="divers_herrenteam">Divers Herrenteam</SelectItem>
                                                <SelectItem value="divers_damenteam">Divers Damenteam</SelectItem>
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

    

    