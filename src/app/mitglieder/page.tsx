'use client';

import { collection, Timestamp, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
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
import { Loader2, ShieldAlert, Edit, Shield, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useMemo, useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';


interface User {
  id: string;
  name?: string;
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

interface Team {
    id: string;
    name: string;
}

const formatPosition = (position?: { abwehr: boolean; zuspiel: boolean; angriff: boolean; }) => {
    if (!position) return 'N/A';
    const positions = [];
    if (position.abwehr) positions.push('Abwehr');
    if (position.zuspiel) positions.push('Zuspiel');
    if (position.angriff) positions.push('Angriff');
    return positions.length > 0 ? positions.join(', ') : 'N/A';
}

export default function MitgliederPage() {
  const firestore = useFirestore();
  const { user: currentUser, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<boolean | undefined>(undefined);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const teamsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'teams');
  }, [firestore]);

  const { data: users, isLoading: usersLoading, error: usersError } = useCollection<User>(usersCollectionRef);
  const { data: teams, isLoading: teamsLoading, error: teamsError } = useCollection<Team>(teamsCollectionRef);
  
  const isLoading = usersLoading || teamsLoading || isUserLoading;
  const error = usersError || teamsError;

  const teamsMap = useMemo(() => {
    if (!teams) return new Map();
    return new Map(teams.map(team => [team.id, team.name]));
  }, [teams]);
  
  const currentUserData = useMemo(() => {
      if(!currentUser || !users) return null;
      return users.find(u => u.id === currentUser.uid);
  }, [currentUser, users]);

  const isAdmin = currentUserData?.adminRechte === true;
  
  // Action handlers
  const openDeleteAlert = (user: User) => {
    setActionUser(user);
    setIsDeleteAlertOpen(true);
  };
  
  const openRoleDialog = (user: User) => {
    setActionUser(user);
    setSelectedRole(user.adminRechte);
    setIsRoleDialogOpen(true);
  };
  
  const openTeamDialog = (user: User) => {
    setActionUser(user);
    setSelectedTeamIds(user.teamIds || []);
    setIsTeamDialogOpen(true);
  };
  
  const handleDeleteUser = async () => {
    if (!actionUser || !firestore) return;
    setIsSubmitting(true);
    try {
        await deleteDoc(doc(firestore, 'users', actionUser.id));
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
        await updateDoc(userDocRef, { adminRechte: selectedRole });
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
        await updateDoc(userDocRef, { teamIds: selectedTeamIds });

        // Get the full user object to save to other collections
        const userToSync = users?.find(u => u.id === actionUser.id);
        
        if(userToSync) {
            const fullMemberData = {
                ...userToSync,
                teamIds: selectedTeamIds, // use updated teamIds
            };

            const groupMemberData = {
                vorname: userToSync.vorname,
                position: userToSync.position,
                adminRechte: userToSync.adminRechte
            };

            // Save to 'members' and 'group_members' collections
            await setDoc(doc(firestore, 'members', userToSync.id), fullMemberData, { merge: true });
            await setDoc(doc(firestore, 'group_members', userToSync.id), groupMemberData, { merge: true });
        }

        toast({ title: 'Mannschaften aktualisiert', description: 'Die Mannschaften des Benutzers wurden erfolgreich geändert.' });
        setIsTeamDialogOpen(false);
        setActionUser(null);
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Fehler bei Mannschaftsänderung', description: err.message });
    } finally {
        setIsSubmitting(false);
    }
  };


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Mitglieder werden geladen...</p>
        </div>
      );
    }

    if (error) {
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
    
    if (users) {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mannschaft</TableHead>
              <TableHead>Vorname</TableHead>
              <TableHead>Nachname</TableHead>
              <TableHead>Geschlecht</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Geburtstag</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Telefonnummer</TableHead>
              <TableHead>Wohnort</TableHead>
              {isAdmin && <TableHead className="text-right">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.teamIds?.map(id => teamsMap.get(id)).filter(Boolean).join(', ') || 'N/A'}</TableCell>
                <TableCell className="font-medium">{user.vorname || 'N/A'}</TableCell>
                <TableCell className="font-medium">{user.nachname || 'N/A'}</TableCell>
                <TableCell>{user.geschlecht || 'N/A'}</TableCell>
                <TableCell>{formatPosition(user.position)}</TableCell>
                <TableCell>
                  {user.adminRechte ? (
                    <Badge>Admin</Badge>
                  ) : (
                    <Badge variant="secondary">Benutzer</Badge>
                  )}
                </TableCell>
                <TableCell>{user.geburtstag ? format(user.geburtstag.toDate(), 'dd.MM.yyyy', { locale: de }) : 'N/A'}</TableCell>
                <TableCell>{user.email || 'N/A'}</TableCell>
                <TableCell>{user.telefon || 'N/A'}</TableCell>
                <TableCell>{user.wohnort || 'N/A'}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openTeamDialog(user)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openRoleDialog(user)}><Shield className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => openDeleteAlert(user)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
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
                        value={selectedRole ? 'admin' : 'user'}
                        onValueChange={(value) => setSelectedRole(value === 'admin')}
                    >
                        <SelectTrigger id="role-select" className="col-span-3">
                            <SelectValue placeholder="Rolle auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user">Benutzer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
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
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                      <Label>Mannschaften</Label>
                      <div className="space-y-2 rounded-md border p-4 max-h-60 overflow-y-auto">
                        {teams?.map(team => (
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
