'use client';

import { collection, Timestamp } from 'firebase/firestore';
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
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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

  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: users, isLoading, error } = useCollection<User>(usersCollectionRef);

  const renderContent = () => {
    if (isLoading || isUserLoading) {
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
             <p className="text-muted-foreground">Sie haben nicht die erforderlichen Administratorrechte, um diese Seite anzuzeigen.</p>
          </div>
        </div>
      );
    }
    
    if (users) {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vorname</TableHead>
              <TableHead>Nachname</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Geburtstag</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Telefonnummer</TableHead>
              <TableHead>Wohnort</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.vorname || 'N/A'}</TableCell>
                <TableCell className="font-medium">{user.nachname || 'N/A'}</TableCell>
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
                Eine Liste aller registrierten Mitglieder im System. Nur für Administratoren sichtbar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderContent()}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
