
'use client';

import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function MannschaftskassePage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
           <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Mannschaftskasse</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Demnächst verfügbar</CardTitle>
              <CardDescription>
                Diese Seite befindet sich im Aufbau. Hier können Sie bald die Mannschaftskasse verwalten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Weitere Informationen folgen in Kürze.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
