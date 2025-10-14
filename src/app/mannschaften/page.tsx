
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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

interface GroupMember {
  id: string;
  vorname: string;
  nachname: string;
  position?: {
    abwehr: boolean;
    zuspiel: boolean;
    angriff: boolean;
  };
  adminRechte?: boolean;
  teamIds?: string[];
}

const formatPosition = (position?: { abwehr: boolean; zuspiel: boolean; angriff: boolean; }) => {
    if (!position) return '';
    const positions = [];
    if (position.zuspiel) positions.push('Zuspiel');
    if (position.abwehr) positions.push('Abwehr');
    if (position.angriff) positions.push('Angriff');
    return positions.join(', ');
}


function ManageTeamsForm({ categories, teams, onDone }: { categories: TeamCategory[], teams: Team[], onDone: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [action, setAction] = useState<'add' | 'edit' | 'delete'>('add');
    const [target, setTarget] = useState<'category' | 'team'>('team');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [newName, setNewName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getTargetId = () => target === 'category' ? selectedCategoryId : selectedTeamId;
    const getTargetName = () => {
        if (target === 'category') {
            return categories.find(c => c.id === selectedCategoryId)?.name || '';
        }
        return teams.find(g => g.id === selectedTeamId)?.name || '';
    }

    useEffect(() => {
        if (action === 'edit' || action === 'delete') {
            const targetId = getTargetId();
            const targetName = getTargetName();
            if(targetId) setNewName(targetName);
            else setNewName('');
        } else {
            setNewName('');
        }
    }, [action, target, selectedCategoryId, selectedTeamId, categories, teams]);


    const handleExecute = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Datenbank nicht verbunden.' });
            return;
        }

        setIsSubmitting(true);
        try {
            if (action === 'add') {
                if (!newName) {
                    toast({ variant: 'destructive', title: 'Name fehlt', description: 'Bitte geben Sie einen Namen ein.' });
                    setIsSubmitting(false);
                    return;
                }
                if (target === 'category') {
                    await addDoc(collection(firestore, 'team_categories'), {
                        name: newName,
                        order: (categories?.length || 0) + 1,
                    });
                    toast({ title: 'Ober-Mannschaft hinzugefügt' });
                } else { // target === 'team'
                    if (!selectedCategoryId) {
                        toast({ variant: 'destructive', title: 'Ober-Mannschaft fehlt', description: 'Bitte wählen Sie eine Ober-Mannschaft aus.' });
                        setIsSubmitting(false);
                        return;
                    }
                    await addDoc(collection(firestore, 'teams'), {
                        name: newName,
                        categoryId: selectedCategoryId,
                    });
                    toast({ title: 'Unter-Mannschaft hinzugefügt' });
                }
            } else if (action === 'edit') {
                 if (!newName || !getTargetId()) {
                    toast({ variant: 'destructive', title: 'Auswahl oder Name fehlt', description: 'Bitte wählen Sie ein Element aus und geben Sie einen neuen Namen an.' });
                    setIsSubmitting(false);
                    return;
                 }
                const collectionName = target === 'category' ? 'team_categories' : 'teams';
                await updateDoc(doc(firestore, collectionName, getTargetId()), { name: newName });
                toast({ title: `${target === 'category' ? 'Ober' : 'Unter'}mannschaft aktualisiert` });

            } else { // action === 'delete'
                if (!getTargetId()) {
                    toast({ variant: 'destructive', title: 'Auswahl fehlt', description: 'Bitte wählen Sie ein Element zum Löschen aus.' });
                    setIsSubmitting(false);
                    return;
                }
                 const collectionName = target === 'category' ? 'team_categories' : 'teams';
                await deleteDoc(doc(firestore, collectionName, getTargetId()));
                if(target === 'category' && selectedCategoryId) {
                     // Also delete subteams
                    const teamsToDelete = teams.filter(g => g.categoryId === selectedCategoryId);
                    for(const team of teamsToDelete) {
                        await deleteDoc(doc(firestore, 'teams', team.id));
                    }
                }
                toast({ title: `${target === 'category' ? 'Ober' : 'Unter'}mannschaft gelöscht` });
            }
        } catch (error: any) {
            console.error("Fehler bei der Aktion:", error);
            toast({ 
                variant: 'destructive', 
                title: 'Ein Fehler ist aufgetreten',
                description: error.message || 'Die Aktion konnte nicht ausgeführt werden. Prüfen Sie die Berechtigungen.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Mannschaften verwalten</CardTitle>
                        <CardDescription>Füge neue Mannschaften hinzu, bearbeite oder lösche bestehende.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={onDone}>Schließen</Button>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleExecute} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select value={action} onValueChange={(v: any) => setAction(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Aktion wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="add">Hinzufügen</SelectItem>
                                <SelectItem value="edit">Bearbeiten</SelectItem>
                                <SelectItem value="delete">Löschen</SelectItem>
                            </SelectContent>
                        </Select>
                         <Select value={target} onValueChange={(v: any) => setTarget(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ziel wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="category">Ober-Mannschaft</SelectItem>
                                <SelectItem value="team">Unter-Mannschaft</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    { (action === 'add' && target === 'team') || (action !== 'add' && target === 'team') ? (
                        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ober-Mannschaft wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    ) : null }

                    {action !== 'add' && target === 'team' ? (
                         <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Unter-Mannschaft wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                 {(teams || []).filter(g => g.categoryId === selectedCategoryId).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    ) : null}

                     {action !== 'add' && target === 'category' ? (
                         <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ober-Mannschaft wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    ) : null}

                    { action !== 'delete' && (
                        <Input
                            placeholder="Name für neues Element..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                    )}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Aktion ausführen'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

export default function MannschaftenPage() {
  const firestore = useFirestore();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'team_categories'), orderBy('order'));
  }, [firestore]);

  const teamsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'teams');
  }, [firestore]);

  const groupMembersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'group_members');
  }, [firestore]);


  const { data: categories, isLoading: categoriesLoading } = useCollection<TeamCategory>(categoriesQuery);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsQuery);
  const { data: groupMembers, isLoading: groupMembersLoading } = useCollection<GroupMember>(groupMembersQuery);

  
  useEffect(() => {
    if (categories && categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedTeamId(null); // Reset sub-team selection
  }

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const filteredTeams = teams
    ?.filter(t => t.categoryId === selectedCategoryId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);
  const filteredMembers = groupMembers?.filter(member => member.teamIds?.includes(selectedTeamId || ''));


  const renderContent = () => {
    if (!isClient || categoriesLoading || teamsLoading || groupMembersLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (isEditing) {
        return <ManageTeamsForm categories={categories || []} teams={teams || []} onDone={() => setIsEditing(false)} />;
    }
    
    if (!categories || categories.length === 0) {
        return (
            <div className="text-center p-8">
                <p className="p-4 text-muted-foreground">Keine Mannschafts-Kategorien gefunden.</p>
                <Button onClick={() => setIsEditing(true)}>Jetzt erstellen</Button>
            </div>
        );
    }

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
           <Card>
            <CardHeader>
              <CardTitle className="text-lg">TSV Bayer Leverkusen</CardTitle>
            </CardHeader>
            <CardContent>
              <nav className="flex flex-col gap-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      selectedCategoryId === category.id
                        ? 'bg-muted font-semibold'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{selectedCategory?.name || 'Kategorie wählen'}</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTeams && filteredTeams.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {filteredTeams.map((team) => (
                      <button 
                        key={team.id}
                        onClick={() => setSelectedTeamId(team.id)}
                        className={cn("p-3 rounded-md border text-left",
                            selectedTeamId === team.id ? 'bg-muted ring-2 ring-primary' : 'hover:bg-muted/50'
                        )}
                        >
                        {team.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Keine Mannschaften in dieser Kategorie gefunden.</p>
                )}
            </CardContent>
          </Card>
        </div>

        {selectedTeamId && (
            <Card>
                <CardHeader>
                    <CardTitle>{selectedTeam?.name}</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredMembers && filteredMembers.length > 0 ? (
                        <div className="space-y-2">
                            {filteredMembers.map((member) => {
                                const positionText = formatPosition(member.position);
                                const roleText = member.adminRechte ? "Trainer" : "";
                                return (
                                    <div key={member.id} className="grid grid-cols-3 gap-4 items-center py-2 border-b">
                                        <span>{`${member.vorname} ${member.nachname}`}</span>
                                        <span className="text-muted-foreground">{positionText}</span>
                                        <span className="text-muted-foreground justify-self-end">{roleText}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Keine Mitglieder in dieser Mannschaft gefunden.</p>
                    )}
                </CardContent>
            </Card>
        )}
      </div>
    );
  };


  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Mannschaften</h1>
            {isClient && !isEditing && <Button variant="outline" onClick={() => setIsEditing(true)}>Mannschaft bearbeiten</Button>}
          </div>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
