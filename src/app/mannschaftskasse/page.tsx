

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirestore, useUser, useCollection, useDoc, FirestorePermissionError, errorEmitter } from '@/firebase';
import { collection, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, Trash2, Edit, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

// Schemas & Interfaces
const penaltySchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich.'),
  amount: z.coerce.number().min(0.01, 'Betrag muss größer als 0 sein.'),
});
type PenaltyFormValues = z.infer<typeof penaltySchema>;

interface Penalty {
  id: string;
  name: string;
  amount: number;
}

const transactionSchema = z.object({
  type: z.enum(['deposit', 'payout']),
  amount: z.coerce.number().min(0.01, 'Betrag muss größer als 0 sein.'),
  description: z.string().min(1, 'Beschreibung ist erforderlich.'),
  userId: z.string().optional(), // Optional, for member-specific transactions
});
type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TreasuryTransaction {
  id: string;
  teamId: string;
  userId?: string;
  type: 'deposit' | 'payout' | 'correction' | 'penalty';
  amount: number;
  description: string;
  date: Timestamp;
  recordedBy: string;
}

const assignPenaltySchema = z.object({
  memberIds: z.array(z.string()).min(1, 'Es muss mindestens ein Mitglied ausgewählt werden.'),
  penaltyIds: z.array(z.string()).min(1, 'Es muss mindestens eine Strafe ausgewählt werden.'),
});
type AssignPenaltyFormValues = z.infer<typeof assignPenaltySchema>;

interface UserPenalty {
    id: string;
    userId: string;
    teamId: string;
    penaltyName: string;
    amount: number;
    assignedAt: Timestamp;
    paid: boolean;
}

interface Team {
  id: string;
  name: string;
}

interface GroupMember {
  id: string;
  vorname: string;
  nachname: string;
  teamIds?: string[];
}

interface UserData {
  id: string;
  adminRechte?: boolean;
  teamIds?: string[];
  vorname: string;
  nachname: string;
}

// Components
function PenaltyCatalogManager({ teamId, penalties, penaltiesLoading }: { teamId: string, penalties: Penalty[] | null, penaltiesLoading: boolean }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPenalty, setEditingPenalty] = useState<Penalty | null>(null);

  const form = useForm<PenaltyFormValues>({
    resolver: zodResolver(penaltySchema),
    defaultValues: { name: '', amount: 0 },
  });

  useEffect(() => {
    if (editingPenalty) {
      form.reset({ name: editingPenalty.name, amount: editingPenalty.amount });
    } else {
      form.reset({ name: '', amount: 0 });
    }
  }, [editingPenalty, form]);

  const onSubmit = async (values: PenaltyFormValues) => {
    if (!firestore || !teamId) return;

    try {
      if (editingPenalty) {
        await updateDoc(doc(firestore, 'teams', teamId, 'penalties', editingPenalty.id), values);
        toast({ title: 'Strafe aktualisiert' });
      } else {
        await addDoc(collection(firestore, 'teams', teamId, 'penalties'), values);
        toast({ title: 'Strafe hinzugefügt' });
      }
      setIsFormOpen(false);
      setEditingPenalty(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    }
  };

  const handleDelete = async (penaltyId: string) => {
    if (!firestore || !teamId) return;
    try {
      await deleteDoc(doc(firestore, 'teams', teamId, 'penalties', penaltyId));
      toast({ title: 'Strafe gelöscht' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Strafenkatalog</CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setEditingPenalty(null); setIsFormOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" /> Neue Strafe
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {penaltiesLoading ? <Loader2 className="animate-spin" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {penalties?.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(p.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingPenalty(p); setIsFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                         <AlertDialogHeader>
                            <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Diese Aktion kann nicht rückgängig gemacht werden. Die Strafe "{p.name}" wird dauerhaft gelöscht.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive hover:bg-destructive/90">
                                Ja, löschen
                            </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {penalties?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">Noch keine Strafen im Katalog.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPenalty ? 'Strafe bearbeiten' : 'Neue Strafe'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="amount" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Betrag (€)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Abbrechen</Button></DialogClose>
                <Button type="submit">Speichern</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TreasuryManager({ teamId, members, transactions, transactionsLoading }: { teamId: string, members: GroupMember[] | null, transactions: TreasuryTransaction[] | null, transactionsLoading: boolean }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const [isFormOpen, setIsFormOpen] = useState(false);

    const balance = useMemo(() => {
        return transactions?.reduce((acc, t) => acc + t.amount, 0) ?? 0;
    }, [transactions]);

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionSchema),
        defaultValues: { type: 'deposit', amount: 0, description: '' },
    });

    const onSubmit = async (values: TransactionFormValues) => {
        if (!firestore || !teamId || !user) return;
        const amount = values.type === 'deposit' ? values.amount : -values.amount;

        try {
            await addDoc(collection(firestore, 'teams', teamId, 'transactions'), {
                teamId,
                type: values.type,
                amount,
                description: values.description,
                userId: values.userId,
                date: serverTimestamp(),
                recordedBy: user.uid,
            });
            toast({ title: 'Transaktion gespeichert' });
            setIsFormOpen(false);
            form.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Fehler', description: error.message });
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Kontostand</CardTitle>
                        <CardDescription className="text-2xl font-bold">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(balance)}</CardDescription>
                    </div>
                     <Button variant="outline" onClick={() => setIsFormOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Zahlung verbuchen
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                 <h3 className="font-semibold mb-2">Transaktionen</h3>
                 <ScrollArea className="h-72">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Datum</TableHead>
                                <TableHead>Beschreibung</TableHead>
                                <TableHead>Mitglied</TableHead>
                                <TableHead className="text-right">Betrag</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactionsLoading ? (
                                <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="animate-spin"/></TableCell></TableRow>
                            ) : transactions?.map(t => {
                                const member = members?.find(m => m.id === t.userId);
                                return (
                                <TableRow key={t.id}>
                                    <TableCell>{t.date?.toDate ? format(t.date.toDate(), 'dd.MM.yyyy') : '...'}</TableCell>
                                    <TableCell>{t.description}</TableCell>
                                    <TableCell>{member ? `${member.vorname} ${member.nachname}` : (t.type === 'correction' ? 'System' : 'Allgemein')}</TableCell>
                                    <TableCell className={cn("text-right", t.amount > 0 ? 'text-green-600' : 'text-red-600')}>
                                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(t.amount)}
                                    </TableCell>
                                </TableRow>
                            )})
                            }
                             {transactions?.length === 0 && !transactionsLoading && (
                                <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">Keine Transaktionen vorhanden.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Zahlung verbuchen</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField name="type" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Art</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="deposit">Einzahlung</SelectItem>
                                            <SelectItem value="payout">Auszahlung</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="amount" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Betrag (€)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="description" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Beschreibung</FormLabel>
                                    <FormControl><Textarea {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField name="userId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mitglied (optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Allgemeine Transaktion"/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="">Allgemeine Transaktion</SelectItem>
                                            {members?.map(m => <SelectItem key={m.id} value={m.id}>{m.vorname} {m.nachname}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Abbrechen</Button></DialogClose>
                                <Button type="submit">Speichern</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function AssignPenaltiesManager({ teamId, members, penalties, userPenalties, userPenaltiesLoading }: { teamId: string, members: GroupMember[] | null, penalties: Penalty[] | null, userPenalties: UserPenalty[] | null, userPenaltiesLoading: boolean }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const [isFormOpen, setIsFormOpen] = useState(false);

    const form = useForm<AssignPenaltyFormValues>({
        resolver: zodResolver(assignPenaltySchema),
        defaultValues: { memberIds: [], penaltyIds: [] }
    });
    
    const calculateMemberBalance = useCallback((memberId: string) => {
        if(!userPenalties) return 0;
        const penaltiesTotal = userPenalties
            .filter(up => up.userId === memberId && !up.paid)
            .reduce((sum, up) => sum + up.amount, 0);
        return penaltiesTotal;
    }, [userPenalties]);

    const onSubmit = async (values: AssignPenaltyFormValues) => {
        if (!firestore || !teamId || !user) return;
        const { memberIds, penaltyIds } = values;

        const batch = writeBatch(firestore);
        
        for (const memberId of memberIds) {
            for (const penaltyId of penaltyIds) {
                const penalty = penalties?.find(p => p.id === penaltyId);
                if (penalty) {
                    const userPenaltyRef = doc(collection(firestore, 'user_penalties'));
                    batch.set(userPenaltyRef, {
                        userId: memberId,
                        teamId: teamId,
                        penaltyId: penalty.id,
                        penaltyName: penalty.name,
                        amount: penalty.amount,
                        assignedAt: serverTimestamp(),
                        paid: false,
                    });
                }
            }
        }
        try {
            await batch.commit();
            toast({ title: 'Strafen zugewiesen' });
            setIsFormOpen(false);
            form.reset();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Fehler', description: error.message });
        }
    };
    
    const markAsPaid = async (userPenaltyId: string) => {
        if (!firestore || !user || !teamId) return;
        
        const userPenaltyRef = doc(firestore, 'user_penalties', userPenaltyId);
        const userPenalty = userPenalties?.find(up => up.id === userPenaltyId);
        if(!userPenalty) return;

        const transactionRef = doc(collection(firestore, 'teams', teamId, 'transactions'));
        
        const batch = writeBatch(firestore);
        batch.update(userPenaltyRef, { paid: true });
        batch.set(transactionRef, {
             teamId,
             type: 'deposit',
             amount: userPenalty.amount,
             description: `Strafe bezahlt: ${userPenalty.penaltyName}`,
             userId: userPenalty.userId,
             date: serverTimestamp(),
             recordedBy: user.uid,
        });

        try {
            await batch.commit();
            toast({ title: "Strafe als bezahlt markiert."});
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Fehler', description: error.message });
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Strafen verwalten</CardTitle>
                    <Button variant="outline" onClick={() => setIsFormOpen(true)}>Strafen zuweisen</Button>
                </div>
            </CardHeader>
            <CardContent>
                <h3 className="font-semibold mb-2">Offene Strafen</h3>
                <ScrollArea className="h-96">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mitglied</TableHead>
                                <TableHead>Strafe</TableHead>
                                <TableHead>Datum</TableHead>
                                <TableHead>Betrag</TableHead>
                                <TableHead className="text-right">Aktion</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userPenaltiesLoading ? <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="animate-spin"/></TableCell></TableRow> :
                             userPenalties?.filter(up => !up.paid).map(up => {
                                const member = members?.find(m => m.id === up.userId);
                                return (
                                    <TableRow key={up.id}>
                                        <TableCell>{member ? `${member.vorname} ${member.nachname}`: 'Unbekannt'}</TableCell>
                                        <TableCell>{up.penaltyName}</TableCell>
                                        <TableCell>{up.assignedAt?.toDate ? format(up.assignedAt.toDate(), 'dd.MM.yyyy') : '...'}</TableCell>
                                        <TableCell>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(up.amount)}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button size="sm">Bezahlt</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Wurde diese Strafe wirklich bezahlt?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Diese Aktion markiert die Strafe als bezahlt und erstellt eine entsprechende Einzahlung in der Mannschaftskasse.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => markAsPaid(up.id)}>Ja, bezahlt</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )
                             })
                            }
                             {userPenalties?.filter(up => !up.paid).length === 0 && !userPenaltiesLoading && (
                                <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">Keine offenen Strafen.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                
                 <h3 className="font-semibold mt-6 mb-2">Salden der Mitglieder</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {members?.map(member => {
                        const balance = calculateMemberBalance(member.id);
                        return (
                            <Card key={member.id} className={cn(balance > 0 && "border-red-500")}>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base">{member.vorname} {member.nachname}</CardTitle>
                                    <CardDescription className={cn("text-xl font-bold", balance > 0 ? "text-red-600" : "text-green-600")}>
                                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(-balance)}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )
                    })}
                </div>

            </CardContent>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Strafen zuweisen</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="memberIds" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mitglieder</FormLabel>
                                        <ScrollArea className="h-60 rounded-md border p-4">
                                            {members?.map(m => (
                                                <FormField key={m.id} control={form.control} name="memberIds" render={({ field }) => (
                                                    <FormItem className="flex items-center gap-2 space-y-0 py-1">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(m.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked ? field.onChange([...(field.value || []), m.id]) : field.onChange(field.value?.filter(id => id !== m.id))
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">{m.vorname} {m.nachname}</FormLabel>
                                                    </FormItem>
                                                )} />
                                            ))}
                                        </ScrollArea>
                                        <FormMessage/>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="penaltyIds" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Strafen</FormLabel>
                                        <ScrollArea className="h-60 rounded-md border p-4">
                                            {penalties?.map(p => (
                                                 <FormField key={p.id} control={form.control} name="penaltyIds" render={({ field }) => (
                                                    <FormItem className="flex items-center gap-2 space-y-0 py-1">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(p.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked ? field.onChange([...(field.value || []), p.id]) : field.onChange(field.value?.filter(id => id !== p.id))
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">{p.name} ({new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(p.amount)})</FormLabel>
                                                    </FormItem>
                                                )} />
                                            ))}
                                        </ScrollArea>
                                        <FormMessage/>
                                    </FormItem>
                                )}/>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Abbrechen</Button></DialogClose>
                                <Button type="submit">Zuweisen</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}


export default function MannschaftskassePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);

  const userDocRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserLoading } = useDoc<UserData>(userDocRef);

  const adminTeamsQuery = useMemo(() => {
    if (!firestore || !userData?.adminRechte || !userData.teamIds || userData.teamIds.length === 0) {
      return null;
    }
    return query(collection(firestore, 'teams'), where('__name__', 'in', userData.teamIds));
  }, [firestore, userData]);

  const { data: adminTeams, isLoading: teamsLoading } = useCollection<Team>(adminTeamsQuery);
  
  useEffect(() => {
    if (adminTeams && adminTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(adminTeams[0].id);
    }
  }, [adminTeams, selectedTeamId]);
  
  const allMembersQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'group_members');
  }, [firestore]);
  const { data: allMembers, isLoading: membersLoading } = useCollection<GroupMember>(allMembersQuery);
  
  const membersForTeam = useMemo(() => {
    if (!allMembers || !selectedTeamId) return null;
    return allMembers.filter(m => m.teamIds?.includes(selectedTeamId));
  }, [allMembers, selectedTeamId]);
  
  const penaltiesQuery = useMemo(() => {
    if (!firestore || !selectedTeamId) return null;
    return query(collection(firestore, 'teams', selectedTeamId, 'penalties'), orderBy('name'));
  }, [firestore, selectedTeamId]);
  const { data: penalties, isLoading: penaltiesLoading } = useCollection<Penalty>(penaltiesQuery);

  const userPenaltiesQuery = useMemo(() => {
    if (!firestore || !selectedTeamId) return null;
    return query(collection(firestore, 'user_penalties'), where('teamId', '==', selectedTeamId), orderBy('assignedAt', 'desc'))
  }, [firestore, selectedTeamId]);
  const { data: userPenalties, isLoading: userPenaltiesLoading } = useCollection<UserPenalty>(userPenaltiesQuery);
  
  const transactionsQuery = useMemo(() => {
      if (!firestore || !selectedTeamId) return null;
      return query(collection(firestore, 'teams', selectedTeamId, 'transactions'), orderBy('date', 'desc'));
  }, [firestore, selectedTeamId]);
  const { data: transactions, isLoading: transactionsLoading } = useCollection<TreasuryTransaction>(transactionsQuery);


  const isLoadingInitial = isUserLoading || teamsLoading;

  if (isLoadingInitial) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  if (!userData?.adminRechte || !adminTeams || adminTeams.length === 0) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex-1 p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Zugriff verweigert</CardTitle>
                    <CardDescription>Sie haben nicht die erforderlichen Rechte oder sind keinem Team mit Mannschaftskasse zugewiesen.</CardDescription>
                </CardHeader>
            </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-8">
           <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Mannschaftskasse</h1>
                {adminTeams.length > 0 && (
                  <Select value={selectedTeamId} onValueChange={(value) => setSelectedTeamId(value === '' ? undefined : value)}>
                      <SelectTrigger className="w-[280px]">
                          <SelectValue placeholder="Team auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                          {adminTeams.map(team => (
                              <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                )}
            </div>
          
            {selectedTeamId ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="space-y-8">
                        <TreasuryManager 
                          teamId={selectedTeamId} 
                          members={membersForTeam}
                          transactions={transactions}
                          transactionsLoading={transactionsLoading}
                        />
                       <PenaltyCatalogManager 
                          teamId={selectedTeamId}
                          penalties={penalties}
                          penaltiesLoading={penaltiesLoading}
                        />
                    </div>
                    <AssignPenaltiesManager 
                      teamId={selectedTeamId} 
                      members={membersForTeam}
                      penalties={penalties}
                      userPenalties={userPenalties}
                      userPenaltiesLoading={userPenaltiesLoading}
                    />
                </div>
            ) : (
                <Card>
                    <CardContent>
                        <div className="p-8 text-center text-muted-foreground">
                            {isLoadingInitial ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : "Bitte wählen Sie ein Team aus."}
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
      </main>
    </div>
  );
}
