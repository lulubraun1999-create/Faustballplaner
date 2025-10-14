
'use client';

import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function UmfragenPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Umfragen</h1>
            <Button className="bg-red-600 hover:bg-red-700 text-white">
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
    </div>
  );
}
