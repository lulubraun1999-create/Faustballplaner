
'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const groupCategories = [
  'Damen',
  'Herren',
  'Jugend',
  'Mixed',
  'Senioren',
];

const groupData: { [key: string]: string[] } = {
  'Damen': ['Damen 1'],
  'Herren': ['Herren 1', 'Herren 2'],
  'Jugend': ['U18', 'U16'],
  'Mixed': ['Mixed 1'],
  'Senioren': ['Senioren 1'],
};

export default function GruppenPage() {
  const [selectedCategory, setSelectedCategory] = useState('Damen');

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Gruppen</h1>
            <Button variant="outline">Gruppe bearbeiten</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TSV Bayer Leverkusen</CardTitle>
              </CardHeader>
              <CardContent>
                <nav className="flex flex-col gap-1">
                  {groupCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        selectedCategory === category
                          ? 'bg-muted font-semibold'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{selectedCategory}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {(groupData[selectedCategory] || []).map((group) => (
                    <div key={group} className="p-3 rounded-md border">
                      {group}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
