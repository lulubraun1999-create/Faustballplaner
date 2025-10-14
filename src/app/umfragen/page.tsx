
'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { addDoc, collection, serverTimestamp, orderBy, query, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { PlusCircle, Trash2, Loader2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface TeamCategory {
  id: string;
  name: string;
  order: number;
}

interface Team {
  id: string;
  name: string;
  categoryId: string;
}

const pollSchema = z.object({
  question: z.string().min(1, 'Frage ist erforderlich.'),
  options: z.array(z.object({ text: z.string().min(1, 'Option darf nicht leer sein.') })).min(2, 'Es müssen mindestens 2 Optionen angegeben werden.'),
  allowCustomOptions: z.boolean().default(false),
  allowMultipleAnswers: z.boolean().default(false),
  isAnonymous: z.boolean().default(false),
  expiresAt: z.date().optional(),
  archiveAt: z.date().optional(),
  targetTeamIds: z.array(z.string()).optional(),
});

type PollFormValues = z.infer<typeof pollSchema>;

function CreatePollForm({ onDone, categories, teams }: { onDone: () => void, categories: TeamCategory[], teams: Team[] }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PollFormValues>({
    resolver: zodResolver(pollSchema),
    defaultValues: {
      question: '',
      options: [{ text: '' }, { text: '' }],
      allowCustomOptions: false,
      allowMultipleAnswers: false,
      isAnonymous: false,
      targetTeamIds: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id)
    }));
  }, [categories, teams]);

  const onSubmit = (values: PollFormValues) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Nicht authentifiziert' });
      return;
    }
    setIsSubmitting(true);
    
    const dataToSave = {
        ...values,
        expiresAt: values.expiresAt ? Timestamp.fromDate(values.expiresAt) : null,
        archiveAt: values.archiveAt ? Timestamp.fromDate(values.archiveAt) : null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      };
      
    const pollsCollection = collection(firestore, 'polls');

    addDoc(pollsCollection, dataToSave)
      .then(() => {
        toast({ title: 'Umfrage veröffentlicht' });
        onDone();
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: pollsCollection.path,
          operation: 'create',
          requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
        // The listener will throw, but we also show a toast as a fallback.
        toast({ variant: 'destructive', title: 'Fehler', description: "Berechtigungsfehler: " + serverError.message });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DialogHeader>
          <DialogTitle>Neue Umfrage erstellen</DialogTitle>
          <DialogDescription>
            Stelle eine Frage, füge Optionen hinzu und lege die Einstellungen für die Umfrage fest.
          </DialogDescription>
        </DialogHeader>

        <FormField control={form.control} name="question" render={({ field }) => (
          <FormItem>
            <FormLabel>Frage</FormLabel>
            <FormControl><Input placeholder="z.B. Wann sollen wir trainieren?" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div>
          <Label>Antwortmöglichkeiten</Label>
          <div className="space-y-2 mt-2">
            {fields.map((field, index) => (
              <FormField key={field.id} control={form.control} name={`options.${index}.text`} render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl><Input placeholder={`Option ${index + 1}`} {...field} /></FormControl>
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Option hinzufügen
            </Button>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-medium">Einstellungen</h3>
          <div className="space-y-4">
            <FormField control={form.control} name="allowCustomOptions" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Eigene Optionen</FormLabel>
                  <p className="text-[0.8rem] text-muted-foreground">Teilnehmern erlauben, eigene Optionen hinzuzufügen.</p>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="allowMultipleAnswers" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Mehrfachantworten</FormLabel>
                  <p className="text-[0.8rem] text-muted-foreground">Teilnehmern erlauben, mehrere Optionen auszuwählen.</p>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="isAnonymous" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Anonyme Umfrage</FormLabel>
                  <p className="text-[0.8rem] text-muted-foreground">Die Namen der Teilnehmer werden nicht erfasst.</p>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="expiresAt" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Ablauffrist (optional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, 'PPP', { locale: de }) : <span>Wähle ein Datum</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="archiveAt" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Archivieren am (optional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, 'PPP', { locale: de }) : <span>Wähle ein Datum</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                </PopoverContent>
              </Popover>
               <p className="text-[0.8rem] text-muted-foreground">Die Umfrage wird nach diesem Datum aus der Hauptansicht ausgeblendet.</p>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        
        <FormField
          control={form.control}
          name="targetTeamIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zielgruppen (optional)</FormLabel>
              <p className="text-[0.8rem] text-muted-foreground">Wähle die Gruppen aus, die diese Umfrage sehen sollen. Wenn keine ausgewählt ist, ist sie für alle sichtbar.</p>
              <Accordion type="multiple" className="w-full">
                {groupedTeams.map(category => (
                  <AccordionItem value={category.id} key={category.id}>
                    <AccordionTrigger>{category.name}</AccordionTrigger>
                    <AccordionContent>
                      {category.teams.map(team => (
                        <FormField
                          key={team.id}
                          control={form.control}
                          name="targetTeamIds"
                          render={({ field }) => (
                            <FormItem key={team.id} className="flex flex-row items-start space-x-3 space-y-0 p-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(team.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), team.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== team.id
                                          )
                                        )
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
          )}
        />


        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Abbrechen</Button></DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Umfrage veröffentlichen'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}


export default function UmfragenPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const firestore = useFirestore();

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'team_categories'), orderBy('order'));
  }, [firestore]);

  const teamsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'teams'), orderBy('name'));
  }, [firestore]);

  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);


  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Umfragen</h1>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsFormOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Neue Umfrage erstellen
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Aktuelle & Vergangene Umfragen</CardTitle>
              <CardDescription>
                Hier sehen Sie alle laufenden und abgeschlossenen Umfragen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-10">
                <p className="text-muted-foreground">Derzeit sind keine Umfragen verfügbar.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {categoriesLoading || teamsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <CreatePollForm
              onDone={() => setIsFormOpen(false)}
              categories={categories || []}
              teams={teams || []}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
