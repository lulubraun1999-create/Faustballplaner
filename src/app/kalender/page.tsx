
'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { de } from 'date-fns/locale';

export default function KalenderPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Kalender</h1>
          </div>

          <Card>
            <CardContent className="p-2 sm:p-6 flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border"
                locale={de}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
