
'use client';

import { collection } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface User {
  id: string;
  name: string;
  email: string;
  adminRechte: boolean;
}

export default function MitgliederPage() {
  const firestore = useFirestore();

  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: users, isLoading, error } = useCollection<User>(usersCollectionRef);

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
              {isLoading && (
                 <div className="flex items-center justify-center py-8">
                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
                   <p className="ml-2 text-muted-foreground">Mitglieder werden geladen...</p>
                 </div>
              )}
              {error && (
                <div className="text-center py-8 text-destructive">
                  Fehler beim Laden der Mitglieder: {error.message}
                </div>
              )}
              {!isLoading && !error && users && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Rolle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.adminRechte ? (
                            <Badge>Admin</Badge>
                          ) : (
                            <Badge variant="secondary">Benutzer</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
