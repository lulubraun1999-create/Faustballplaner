
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

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

export default function GruppenPage() {
  const firestore = useFirestore();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

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
    if (categoriesLoading || groupsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (!categories || categories.length === 0) {
        return <p className="p-4 text-muted-foreground">Keine Gruppenkategorien gefunden.</p>
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
            <Button variant="outline">Gruppe bearbeiten</Button>
          </div>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

    