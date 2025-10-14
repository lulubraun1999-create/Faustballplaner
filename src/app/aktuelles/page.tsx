
'use client';

import { useState } from 'react';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
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
  const [selectedImage, setSelectedImage] = useState(article.imageUrls?.[0] || '');

  return (
     <Card className="flex flex-col">
        <CardHeader>
          {selectedImage && (
            <div className="relative aspect-video w-full mb-4 overflow-hidden rounded-lg">
              <Image src={selectedImage} alt={article.title} fill className="object-cover" />
            </div>
          )}
           {article.imageUrls && article.imageUrls.length > 1 && (
            <div className="flex gap-2">
              {article.imageUrls.map((url, index) => (
                <button key={index} onClick={() => setSelectedImage(url)}>
                  <Image
                    src={url}
                    alt={`${article.title} thumbnail ${index + 1}`}
                    width={80}
                    height={60}
                    className={cn(
                      "object-cover rounded-md aspect-video cursor-pointer border-2",
                      selectedImage === url ? "border-primary" : "border-transparent"
                    )}
                  />
                </button>
              ))}
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
  )
}

export default function AktuellesPage() {
  const firestore = useFirestore();

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news_articles'), orderBy('publicationDate', 'desc'));
  }, [firestore]);

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
