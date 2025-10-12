
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


interface GroupCategory {
  id: string;
  name: string;
  order: number;
}

interface Group {
  id: string;
  name: string;
  categoryId: string;
}

function ManageGroupsForm({ categories, groups, onDone }: { categories: GroupCategory[], groups: Group[], onDone: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [action, setAction] = useState<'add' | 'edit' | 'delete'>('add');
    const [target, setTarget] = useState<'category' | 'group'>('group');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [newName, setNewName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getTargetId = () => target === 'category' ? selectedCategoryId : selectedGroupId;
    const getTargetName = () => {
        if (target === 'category') {
            return categories.find(c => c.id === selectedCategoryId)?.name || '';
        }
        return groups.find(g => g.id === selectedGroupId)?.name || '';
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
    }, [action, target, selectedCategoryId, selectedGroupId, categories, groups]);


    const handleExecute = async () => {
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
                    await addDoc(collection(firestore, 'group_categories'), {
                        name: newName,
                        order: (categories?.length || 0) + 1,
                    });
                    toast({ title: 'Obergruppe hinzugefügt' });
                } else { // target === 'group'
                    if (!selectedCategoryId) {
                        toast({ variant: 'destructive', title: 'Obergruppe fehlt', description: 'Bitte wählen Sie eine Obergruppe aus.' });
                        setIsSubmitting(false);
                        return;
                    }
                    await addDoc(collection(firestore, 'groups'), {
                        name: newName,
                        categoryId: selectedCategoryId,
                    });
                    toast({ title: 'Untergruppe hinzugefügt' });
                }
            } else if (action === 'edit') {
                 if (!newName || !getTargetId()) {
                    toast({ variant: 'destructive', title: 'Auswahl oder Name fehlt', description: 'Bitte wählen Sie ein Element aus und geben Sie einen neuen Namen an.' });
                    setIsSubmitting(false);
                    return;
                 }
                const collectionName = target === 'category' ? 'group_categories' : 'groups';
                await updateDoc(doc(firestore, collectionName, getTargetId()), { name: newName });
                toast({ title: `${target === 'category' ? 'Ober' : 'Unter'}gruppe aktualisiert` });

            } else { // action === 'delete'
                if (!getTargetId()) {
                    toast({ variant: 'destructive', title: 'Auswahl fehlt', description: 'Bitte wählen Sie ein Element zum Löschen aus.' });
                    setIsSubmitting(false);
                    return;
                }
                 const collectionName = target === 'category' ? 'group_categories' : 'groups';
                await deleteDoc(doc(firestore, collectionName, getTargetId()));
                if(target === 'category' && selectedCategoryId) {
                     // Also delete subgroups
                    const groupsToDelete = groups.filter(g => g.categoryId === selectedCategoryId);
                    for(const group of groupsToDelete) {
                        await deleteDoc(doc(firestore, 'groups', group.id));
                    }
                }
                toast({ title: `${target === 'category' ? 'Ober' : 'Unter'}gruppe gelöscht` });
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
                        <CardTitle>Gruppen verwalten</CardTitle>
                        <CardDescription>Füge neue Gruppen hinzu, bearbeite oder lösche bestehende.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={onDone}>Schließen</Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                            <SelectItem value="category">Obergruppe</SelectItem>
                            <SelectItem value="group">Untergruppe</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                { (action === 'add' && target === 'group') || (action !== 'add' && target === 'group') ? (
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Obergruppe wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                ) : null }

                {action !== 'add' && target === 'group' ? (
                     <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Untergruppe wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                             {(groups || []).filter(g => g.categoryId === selectedCategoryId).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                ) : null}

                 {action !== 'add' && target === 'category' ? (
                     <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Obergruppe wählen..." />
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
                    <Button onClick={handleExecute} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Aktion ausführen'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function GruppenPage() {
  const firestore = useFirestore();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'group_categories'), orderBy('order'));
  }, [firestore]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'groups');
  }, [firestore]);

  const { data: categories, isLoading: categoriesLoading } = useCollection<GroupCategory>(categoriesQuery);
  const { data: groups, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);
  
  useEffect(() => {
    if (categories && categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);


  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const filteredGroups = groups?.filter(g => g.categoryId === selectedCategoryId);

  const renderContent = () => {
    if (!isClient || categoriesLoading || groupsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (isEditing) {
        return <ManageGroupsForm categories={categories || []} groups={groups || []} onDone={() => setIsEditing(false)} />;
    }
    
    if (!categories || categories.length === 0) {
        return (
            <div className="text-center p-8">
                <p className="p-4 text-muted-foreground">Keine Gruppenkategorien gefunden.</p>
                <Button onClick={() => setIsEditing(true)}>Jetzt erstellen</Button>
            </div>
        );
    }

    return (
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
                  onClick={() => setSelectedCategoryId(category.id)}
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
            {filteredGroups && filteredGroups.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {filteredGroups.map((group) => (
                    <div key={group.id} className="p-3 rounded-md border">
                      {group.name}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Keine Gruppen in dieser Kategorie gefunden.</p>
              )}
          </CardContent>
        </Card>
      </div>
    );
  };


  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Gruppen</h1>
            {isClient && !isEditing && <Button variant="outline" onClick={() => setIsEditing(true)}>Gruppe bearbeiten</Button>}
          </div>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
