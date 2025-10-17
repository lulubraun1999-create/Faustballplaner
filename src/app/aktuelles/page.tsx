
'use client';

import { useState } from 'react';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  author: string;
  publicationDate: Timestamp | null;
  imageUrls?: string[];
}

const ArticleCard = ({ article }: { article: NewsArticle }) => {
  return (
     <Link href={`/aktuelles/${article.id}`} className="flex">
        <Card className="flex flex-col w-full hover:border-primary transition-colors">
            <CardHeader>
            {article.imageUrls && article.imageUrls.length > 0 && (
                <div className="relative aspect-video w-full mb-4 overflow-hidden rounded-lg">
                <Image src={article.imageUrls[0]} alt={article.title} fill className="object-cover" />
                </div>
            )}
            <CardTitle>{article.title}</CardTitle>
            <CardDescription>
                Von {article.author} - {article.publicationDate ? 
                    format(article.publicationDate.toDate(), 'dd. MMMM yyyy', { locale: de }) :
                    <span className="text-xs text-muted-foreground">Wird erstellt...</span>
                }
            </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
            <p className="text-sm line-clamp-4">{article.content}</p>
            </CardContent>
            <CardFooter>
            <Button variant="link" className="p-0">Weiterlesen</Button>
            </CardFooter>
        </Card>
    </Link>
  )
}

export default function AktuellesPage() {
  const firestore = useFirestore();

  const newsQuery = query(collection(firestore, 'news_articles'), orderBy('publicationDate', 'desc'));

  const { data: articles, isLoading, error } = useCollection<NewsArticle>(newsQuery);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (error) {
      return <p className="text-destructive text-center">Fehler beim Laden der Artikel: {error.message}</p>;
    }
    if (!articles || articles.length === 0) {
      return <p className="text-muted-foreground text-center py-10">Keine Nachrichtenartikel gefunden.</p>;
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Aktuelles</h1>
          </div>
          
          {renderContent()}

        </div>
      </main>
    </div>
  );
}
