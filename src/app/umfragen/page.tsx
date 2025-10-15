
'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { addDoc, collection, serverTimestamp, orderBy, query, Timestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PlusCircle, Trash2, Loader2, CalendarIcon, User, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

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

interface Poll {
  id: string;
  question: string;
  options: { id: string, text: string }[];
  allowCustomOptions: boolean;
  allowMultipleAnswers: boolean;
  isAnonymous: boolean;
  expiresAt?: Timestamp | null;
  archiveAt?: Timestamp | null;
  targetTeamIds?: string[];
  createdBy: string;
  createdAt: Timestamp;
}

interface PollResponse {
    id: string;
    userId: string;
    selectedOptionIds: string[];
    customOption?: string;
    respondedAt: Timestamp;
}

interface GroupMember {
    id: string;
    vorname?: string;
    nachname?: string;
    teamIds?: string[];
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
        options: values.options.map((opt, index) => ({ id: `option-${index + 1}`, text: opt.text })),
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
            <FormField control={form.control} name="allowMultipleAnswers" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Mehrfachantworten</FormLabel>
                  <p className="text-[0.8rem] text-muted-foreground">Teilnehmern erlauben, mehrere Optionen auszuwählen.</p>
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

function PollCard({ poll, allUsers }: { poll: Poll; allUsers: GroupMember[] }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    const [customOption, setCustomOption] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const responsesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'polls', poll.id, 'responses');
    }, [firestore, poll.id]);

    const { data: responses, isLoading: responsesLoading } = useCollection<PollResponse>(responsesQuery);
    
    const creator = useMemo(() => allUsers.find(u => u.id === poll.createdBy), [allUsers, poll.createdBy]);
    
    const userHasVoted = useMemo(() => responses?.some(r => r.userId === user?.uid), [responses, user]);

    const totalVotes = useMemo(() => {
        if (!responses) return 0;
        return responses.reduce((acc, response) => acc + response.selectedOptionIds.length, 0);
    }, [responses]);

    const voteCounts = useMemo(() => {
        const counts = new Map<string, number>();
        poll.options.forEach(opt => counts.set(opt.id, 0));
        if (responses) {
            for (const response of responses) {
                for (const optionId of response.selectedOptionIds) {
                    counts.set(optionId, (counts.get(optionId) || 0) + 1);
                }
            }
        }
        return counts;
    }, [responses, poll.options]);

    const handleVote = () => {
        if (!user || !firestore || (selectedOptions.length === 0 && !customOption)) {
            return;
        }
        setIsSubmitting(true);

        const responseRef = doc(collection(firestore, 'polls', poll.id, 'responses'));
        
        const responseData: { [key: string]: any } = {
            userId: user.uid,
            selectedOptionIds: selectedOptions,
            respondedAt: serverTimestamp(),
        };

        if (poll.allowCustomOptions && customOption) {
            responseData.customOption = customOption;
        }

        setDoc(responseRef, responseData)
            .then(() => {
                toast({ title: 'Stimme wurde gezählt' });
            })
            .catch((serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: responseRef.path,
                    operation: 'create',
                    requestResourceData: responseData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };
    
    const handleDeletePoll = async () => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'polls', poll.id));
        toast({title: "Umfrage gelöscht"});
    }

    const handleOptionChange = (optionId: string) => {
        if (poll.allowMultipleAnswers) {
            setSelectedOptions(prev => 
                prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
            );
        } else {
            setSelectedOptions([optionId]);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{poll.question}</CardTitle>
                <div className="text-sm text-muted-foreground flex items-center gap-4 pt-1">
                    <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        <span>{creator ? `${creator.vorname} ${creator.nachname}` : 'Unbekannt'}</span>
                    </div>
                     <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>
                            {poll.createdAt ? formatDistanceToNow(poll.createdAt.toDate(), { locale: de, addSuffix: true }) : '...'}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {userHasVoted || (poll.expiresAt && poll.expiresAt.toDate() < new Date()) ? (
                    // Results view
                    <div className="space-y-3">
                        {poll.options.map(option => {
                            const votes = voteCounts.get(option.id) || 0;
                            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                            return (
                                <div key={option.id}>
                                    <div className="flex justify-between items-center mb-1 text-sm">
                                        <p className="font-medium">{option.text}</p>
                                        <p className="text-muted-foreground">{votes} Stimme(n) ({percentage.toFixed(0)}%)</p>
                                    </div>
                                    <Progress value={percentage} />
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    // Voting view
                    <div className="space-y-3">
                        {poll.allowMultipleAnswers ? (
                             poll.options.map(option => (
                                <div key={option.id} className="flex items-center gap-3">
                                    <Checkbox 
                                        id={`${poll.id}-${option.id}`}
                                        checked={selectedOptions.includes(option.id)}
                                        onCheckedChange={() => handleOptionChange(option.id)}
                                    />
                                    <Label htmlFor={`${poll.id}-${option.id}`} className="font-normal flex-1 cursor-pointer">{option.text}</Label>
                                </div>
                            ))
                        ) : (
                            <RadioGroup value={selectedOptions[0]} onValueChange={handleOptionChange}>
                                {poll.options.map(option => (
                                    <div key={option.id} className="flex items-center gap-3">
                                        <RadioGroupItem value={option.id} id={`${poll.id}-${option.id}`} />
                                        <Label htmlFor={`${poll.id}-${option.id}`} className="font-normal flex-1 cursor-pointer">{option.text}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        )}
                        {poll.allowCustomOptions && (
                            <div className="flex items-center gap-3 pt-2">
                                <Checkbox
                                    id={`${poll.id}-custom`}
                                    onCheckedChange={(checked) => {
                                        if(!checked) setCustomOption('');
                                    }}
                                />
                                <Input 
                                    placeholder="Eigene Antwort" 
                                    value={customOption} 
                                    onChange={(e) => setCustomOption(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <div className="text-sm text-muted-foreground">
                    {totalVotes} Gesamtstimmen
                    {poll.expiresAt && <span className="ml-2">· Endet am {format(poll.expiresAt.toDate(), 'dd.MM.yyyy')}</span>}
                </div>
                {!userHasVoted && (!poll.expiresAt || poll.expiresAt.toDate() > new Date()) && (
                    <Button onClick={handleVote} disabled={isSubmitting || (selectedOptions.length === 0 && !customOption)}>
                         {isSubmitting ? <Loader2 className="animate-spin" /> : 'Abstimmen'}
                    </Button>
                )}
                 {user?.uid === poll.createdBy && (
                    <Button variant="destructive" size="sm" onClick={handleDeletePoll}>Löschen</Button>
                )}
            </CardFooter>
        </Card>
    )
}


export default function UmfragenPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'team_categories'), orderBy('order'));
  }, [firestore]);

  const teamsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'teams'), orderBy('name'));
  }, [firestore]);
  
  const groupMembersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'group_members');
  }, [firestore]);
  
  const pollsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'polls'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
  const { data: allUsers, isLoading: usersLoading } = useCollection<GroupMember>(groupMembersQuery);
  const { data: polls, isLoading: pollsLoading, error } = useCollection<Poll>(pollsQuery);

  const filteredPolls = useMemo(() => {
      if(!polls || !user || !allUsers) return [];
      const userTeams = allUsers?.find(u => u.id === user.uid)?.teamIds || [];

      return polls.filter(poll => {
          // Polls created by user are always visible
          if (poll.createdBy === user.uid) return true;
          // Public polls are visible
          if (!poll.targetTeamIds || poll.targetTeamIds.length === 0) return true;
          // Targeted polls are visible if user is in one of the teams
          return poll.targetTeamIds.some(teamId => userTeams.includes(teamId));
      });
  }, [polls, user, allUsers]);

  const renderContent = () => {
    if (pollsLoading || usersLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (error) {
      return <p className="text-destructive text-center">Fehler beim Laden der Umfragen: {error.message}</p>;
    }
    if (!filteredPolls || filteredPolls.length === 0) {
      return (
         <Card>
            <CardContent>
              <div className="text-center py-10">
                <p className="text-muted-foreground">Derzeit sind keine für Sie sichtbaren Umfragen verfügbar.</p>
              </div>
            </CardContent>
          </Card>
      )
    }
    return (
        <div className="space-y-6">
            {filteredPolls.map(poll => (
                <PollCard key={poll.id} poll={poll} allUsers={allUsers || []} />
            ))}
        </div>
    )
  }


  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Umfragen</h1>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsFormOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Neue Umfrage erstellen
            </Button>
          </div>

          {renderContent()}

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
