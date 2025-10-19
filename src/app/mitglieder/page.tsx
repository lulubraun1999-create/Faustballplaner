
'use client';

import { collection, Timestamp, doc, updateDoc, deleteDoc, setDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { Header } from '@/components/header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, Shield, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';


interface Member {
  id: string;
  vorname?: string;
  nachname?: string;
  position?: {
    abwehr: boolean;
    zuspiel: boolean;
    angriff: boolean;
  };
  adminRechte?: boolean;
  geburtstag?: Timestamp;
  email?: string;
  telefon?: string;
  wohnort?: string;
  teamIds?: string[];
  geschlecht?: string;
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
  id: string;
  name: string;
  categoryId: string;
}

const formatPosition = (position?: { abwehr: boolean; zuspiel: boolean; angriff: boolean; }) => {
    if (!position) return 'N/A';
    const positions = [];
    if (position.abwehr) positions.push('Abwehr');
    if (position.zuspiel) positions.push('Zuspiel');
    if (position.angriff) positions.push('Angriff');
    return positions.length > 0 ? positions.join(', ') : 'N/A';
}

const TeamsCell = ({ teamIds, teams, categories }: { teamIds?: string[], teams: Team[], categories: TeamCategory[] }) => {
    const teamsMap = useMemo(() => new Map(teams.map(t => [t.id, t.name])), [teams]);
    const categoryMap = useMemo(() => new Map(teams.map(t => [t.id, categories.find(c => c.id === t.categoryId)?.name || ''])), [teams, categories]);

    const userTeams = useMemo(() => {
        return (teamIds || [])
            .map(id => ({ 
                id, 
                name: teamsMap.get(id),
                category: categoryMap.get(id)
            }))
            .filter(team => team.name)
            .sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
    }, [teamIds, teamsMap, categoryMap]);

    if (userTeams.length === 0) {
        return <TableCell>N/A</TableCell>;
    }

    const firstTeam = userTeams[0];

    return (
        <TableCell>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="link" className="p-0 h-auto text-left font-normal text-foreground">
                        {firstTeam.name}
                        {userTeams.length > 1 && ` (+${userTeams.length - 1})`}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                    <div className="space-y-1">
                        <p className="font-semibold text-sm mb-2">Alle Mannschaften</p>
                        {userTeams.map(team => (
                            <div key={team.id} className="text-sm p-1.5 rounded-sm bg-muted/50">
                                <p className="font-medium">{team.name}</p>
                                <p className="text-xs text-muted-foreground">{team.category}</p>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </TableCell>
    );
};


export default function MitgliederPage() {
  const firestore = useFirestore();
  const { user: authUser, isUserLoading: isAuthLoading } = useUser();
  const { toast } = useToast();
  
  const [actionUser, setActionUser] = useState<Member | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<boolean | undefined>(undefined);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFilterTeamId, setSelectedFilterTeamId] = useState('all');
  const [selectedFilterRole, setSelectedFilterRole] = useState('all');

  const currentUserDocRef = useMemo(() => {
    if (!firestore || !authUser?.uid) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser?.uid]);
  const { data: currentUserData, isLoading: isCurrentUserLoading } = useDoc<UserData>(currentUserDocRef);
  const hasAdminRights = currentUserData?.adminRechte;

  const membersCollectionRef = useMemo(() => {
    if (!firestore || !hasAdminRights) return null;
    return collection(firestore, 'members');
  }, [firestore, hasAdminRights]);

  const teamsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'teams');
  }, [firestore]);

  const categoriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'team_categories'), orderBy('order'));
  }, [firestore]);

  const { data: members, isLoading: membersLoading, error: membersError } = useCollection<Member>(membersCollectionRef);
  const { data: teams, isLoading: teamsLoading, error: teamsError } = useCollection<Team>(teamsCollectionRef);
  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useCollection<TeamCategory>(categoriesQuery);
  
  const isLoading = isAuthLoading || isCurrentUserLoading || membersLoading || teamsLoading || categoriesLoading;
  const dataError = membersError || teamsError || categoriesError;

  
  const groupedTeams = useMemo(() => {
    if (!categories || !teams) return [];
    return categories.map(category => ({
      ...category,
      teams: teams.filter(team => team.categoryId === category.id)
    }));
  }, [categories, teams]);
  
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    let tempMembers = members;
    if (selectedFilterTeamId !== 'all') {
      tempMembers = tempMembers.filter(member => member.teamIds?.includes(selectedFilterTeamId));
    }
    if (selectedFilterRole !== 'all') {
        const isAdmin = selectedFilterRole === 'trainer';
        tempMembers = tempMembers.filter(member => (member.adminRechte || false) === isAdmin);
    }
    return tempMembers;
  }, [members, selectedFilterTeamId, selectedFilterRole]);
  
  // Action handlers
  const openDeleteAlert = (user: Member) => {
    setActionUser(user);
    setIsDeleteAlertOpen(true);
  };
  
  const openRoleDialog = (user: Member) => {
    setActionUser(user);
    setSelectedRole(user.adminRechte || false);
    setIsRoleDialogOpen(true);
  };
  
  const openTeamDialog = (user: Member) => {
    setActionUser(user);
    setSelectedTeamIds(user.teamIds || []);
    setIsTeamDialogOpen(true);
  };
  
  const handleDeleteUser = async () => {
    if (!actionUser || !firestore) return;
    setIsSubmitting(true);
    try {
        await deleteDoc(doc(firestore, 'users', actionUser.id));
        await deleteDoc(doc(firestore, 'members', actionUser.id));
        await deleteDoc(doc(firestore, 'group_members', actionUser.id));
        
        toast({ title: 'Benutzer gelöscht', description: 'Das Benutzerkonto wurde erfolgreich entfernt.' });
        setIsDeleteAlertOpen(false);
        setActionUser(null);
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen', description: err.message });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleUpdateRole = async () => {
    if (actionUser === null || selectedRole === undefined || !firestore) return;
    setIsSubmitting(true);
    try {
        const userDocRef = doc(firestore, 'users', actionUser.id);
        const memberDocRef = doc(firestore, 'members', actionUser.id);

        await updateDoc(userDocRef, { adminRechte: selectedRole });
        await updateDoc(memberDocRef, { adminRechte: selectedRole });
        
        const groupMemberRef = doc(firestore, 'group_members', actionUser.id);
        const groupMemberSnap = await getDoc(groupMemberRef);
        if (groupMemberSnap.exists()) {
             await updateDoc(groupMemberRef, { adminRechte: selectedRole });
        }


        toast({ title: 'Rolle aktualisiert', description: 'Die Rolle des Benutzers wurde erfolgreich geändert.' });
        setIsRoleDialogOpen(false);
        setActionUser(null);
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Fehler bei Rollenänderung', description: err.message });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleUpdateTeam = async () => {
    if (!actionUser || !firestore) return;
     setIsSubmitting(true);
    try {
        const userDocRef = doc(firestore, 'users', actionUser.id);
        const memberDocRef = doc(firestore, 'members', actionUser.id);
        await updateDoc(userDocRef, { teamIds: selectedTeamIds });
        await updateDoc(memberDocRef, { teamIds: selectedTeamIds });

        const groupMemberRef = doc(firestore, 'group_members', actionUser.id);
        const groupMemberSnap = await getDoc(groupMemberRef);
        if (groupMemberSnap.exists()) {
            await updateDoc(groupMemberRef, { teamIds: selectedTeamIds });
        }

        toast({ title: 'Mannschaften aktualisiert', description: 'Die Mannschaften des Benutzers wurden erfolgreich geändert.' });
        setIsTeamDialogOpen(false);
        setActionUser(null);
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Fehler bei Mannschaftsänderung', description: err.message || 'Ein unbekannter Fehler ist aufgetreten.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (isAuthLoading || isCurrentUserLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Berechtigungen werden geprüft...</p>
        </div>
      );
    }

    if (!hasAdminRights) {
      return (
        <div className="text-center py-8 text-destructive flex flex-col items-center gap-4">
          <ShieldAlert className="h-12 w-12" />
          <div className="space-y-1">
             <p className="font-bold text-lg">Zugriff verweigert</p>
             <p className="text-muted-foreground">Sie haben nicht die erforderlichen Berechtigungen, um diese Seite anzuzeigen.</p>
          </div>
        </div>
      );
    }

    if (membersLoading || teamsLoading || categoriesLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Mitglieder werden geladen...</p>
            </div>
        )
    }

    if (dataError) {
        return (
             <div className="text-center py-8 text-destructive flex flex-col items-center gap-4">
              <ShieldAlert className="h-12 w-12" />
              <div className="space-y-1">
                 <p className="font-bold text-lg">Fehler beim Laden der Daten</p>
                 <p className="text-muted-foreground">{dataError.message}</p>
              </div>
            </div>
        )
    }
    
    if (members && teams && categories) {
      return (
        <>
          <div className="flex items-center justify-start gap-4 mb-4">
                <Select value={selectedFilterTeamId} onValueChange={setSelectedFilterTeamId}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Nach Mannschaft filtern..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Mannschaften</SelectItem>
                        {teams.slice().sort((a, b) => a.name.localeCompare(b.name)).map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                                {team.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Select value={selectedFilterRole} onValueChange={setSelectedFilterRole}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Nach Rolle filtern..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Rollen</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                        <SelectItem value="user">Benutzer</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mannschaft</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Geschlecht</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Geburtstag</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Telefonnummer</TableHead>
              <TableHead>Wohnort</TableHead>
              {hasAdminRights && <TableHead className="text-right">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => (
              <TableRow key={member.id}>
                <TeamsCell teamIds={member.teamIds} teams={teams} categories={categories} />
                <TableCell className="font-medium">{`${member.vorname || ''} ${member.nachname || ''}`.trim() || 'N/A'}</TableCell>
                <TableCell>{member.geschlecht || 'N/A'}</TableCell>
                <TableCell>{formatPosition(member.position)}</TableCell>
                <TableCell>
                  {member.adminRechte ? (
                    <Badge>Trainer</Badge>
                  ) : (
                    <Badge variant="secondary">Benutzer</Badge>
                  )}
                </TableCell>
                <TableCell>{member.geburtstag ? format(member.geburtstag.toDate(), 'dd.MM.yyyy', { locale: de }) : 'N/A'}</TableCell>
                <TableCell>{member.email || 'N/A'}</TableCell>
                <TableCell>{member.telefon || 'N/A'}</TableCell>
                <TableCell>{member.wohnort || 'N/A'}</TableCell>
                {hasAdminRights && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openTeamDialog(member)}><Users className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openRoleDialog(member)}><Shield className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => openDeleteAlert(member)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-screen-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Mitglieder</CardTitle>
              <CardDescription>
                Eine Liste aller registrierten Mitglieder im System.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderContent()}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Dialogs and Alerts */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird das Benutzerkonto
              ({actionUser?.vorname} {actionUser?.nachname}) dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Ja, löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Rolle bearbeiten</DialogTitle>
                <DialogDescription>
                    Ändern Sie die Rolle für {actionUser?.vorname} {actionUser?.nachname}.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-select" className="text-right">Rolle</Label>
                    <Select
                        value={selectedRole ? 'trainer' : 'user'}
                        onValueChange={(value) => setSelectedRole(value === 'trainer')}
                    >
                        <SelectTrigger id="role-select" className="col-span-3">
                            <SelectValue placeholder="Rolle auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user">Benutzer</SelectItem>
                            <SelectItem value="trainer">Trainer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Abbrechen</Button></DialogClose>
                <Button onClick={handleUpdateRole} disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
          <DialogContent>
               <DialogHeader>
                    <DialogTitle>Mannschaften bearbeiten</DialogTitle>
                    <DialogDescription>
                        Wählen Sie die Mannschaften für {actionUser?.vorname} {actionUser?.nachname}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label>Mannschaften</Label>
                    <ScrollArea className="h-60 mt-2 rounded-md border p-4">
                      <div className="space-y-4">
                        {groupedTeams.map(category => (
                          <div key={category.id}>
                            <Label className="font-semibold text-base">{category.name}</Label>
                            <div className="space-y-2 mt-2 pl-2">
                              {category.teams.map(team => (
                                <div key={team.id} className="flex items-center gap-2">
                                  <Checkbox
                                      id={`team-${team.id}`}
                                      checked={selectedTeamIds.includes(team.id)}
                                      onCheckedChange={(checked) => {
                                          return checked
                                              ? setSelectedTeamIds([...selectedTeamIds, team.id])
                                              : setSelectedTeamIds(selectedTeamIds.filter(id => id !== team.id))
                                      }}
                                  />
                                  <Label htmlFor={`team-${team.id}`} className="font-normal">{team.name}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Abbrechen</Button></DialogClose>
                    <Button onClick={handleUpdateTeam} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}
                    </Button>
                </DialogFooter>
          </DialogContent>
      </Dialog>

    </div>
  );
}
