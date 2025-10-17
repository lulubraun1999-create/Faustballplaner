
'use client';

import { useState, useEffect } from 'react';
import { doc, Timestamp } from 'firebase/firestore';
import { useFirestore, useDoc, WithId } from '@/firebase';
import { Header } from '@/components/header';
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface NewsArticle {
  title: string;
  content: string;
  author: string;
  publicationDate: Timestamp | null;
  imageUrls?: string[];
}

export default function ArticleDetailPage({ params }: { params: { articleId: string } }) {
  const firestore = useFirestore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const articleRef = doc(firestore, 'news_articles', params.articleId);

  const { data: article, isLoading, error } = useDoc<NewsArticle>(articleRef);
  
  useEffect(() => {
      if (article?.imageUrls && article.imageUrls.length > 0 && !selectedImage) {
          setSelectedImage(article.imageUrls[0]);
      }
  }, [article, selectedImage]);
  
  const handleNextImage = () => {
    if (!article?.imageUrls || article.imageUrls.length <= 1) return;
    const currentIndex = article.imageUrls.indexOf(selectedImage || '');
    const nextIndex = (currentIndex + 1) % article.imageUrls.length;
    setSelectedImage(article.imageUrls[nextIndex]);
  };

  const handlePrevImage = () => {
    if (!article?.imageUrls || article.imageUrls.length <= 1) return;
    const currentIndex = article.imageUrls.indexOf(selectedImage || '');
    const prevIndex = (currentIndex - 1 + article.imageUrls.length) % article.imageUrls.length;
    setSelectedImage(article.imageUrls[prevIndex]);
  };


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-destructive">Fehler</h2>
          <p className="text-muted-foreground mt-2">{error.message}</p>
        </div>
      );
    }
    
    if (!article) {
      return (
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">Artikel nicht gefunden</h2>
          <p className="text-muted-foreground mt-2">Der angeforderte Nachrichtenartikel konnte nicht gefunden werden.</p>
           <Button asChild variant="outline" className="mt-6">
              <Link href="/aktuelles">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zur Übersicht
              </Link>
          </Button>
        </div>
      );
    }
    
     // Set initial image if not set yet
    const currentSelectedImage = selectedImage || (article.imageUrls && article.imageUrls[0]) || null;
    const hasMultipleImages = article.imageUrls && article.imageUrls.length > 1;

    return (
      <article>
        <header className="mb-8">
            <Button asChild variant="ghost" className="mb-6 pl-0">
              <Link href="/aktuelles">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zur Übersicht
              </Link>
            </Button>
            
          {currentSelectedImage && (
            <div className="relative aspect-video w-full mb-4 overflow-hidden rounded-xl shadow-lg group">
              <Image src={currentSelectedImage} alt={article.title} fill className="object-cover" />
               {hasMultipleImages && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 hover:bg-background/75"
                    onClick={handlePrevImage}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 hover:bg-background/75"
                    onClick={handleNextImage}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
            </div>
          )}

          {hasMultipleImages && article.imageUrls && (
            <div className="flex gap-2 mb-8">
              {article.imageUrls.map((url, index) => (
                <button key={index} onClick={() => setSelectedImage(url)} className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md">
                  <Image
                    src={url}
                    alt={`${article.title} thumbnail ${index + 1}`}
                    width={100}
                    height={75}
                    className={cn(
                      "object-cover rounded-md aspect-video cursor-pointer border-2 transition-all",
                      currentSelectedImage === url ? "border-primary scale-105" : "border-transparent hover:border-muted-foreground/50"
                    )}
                  />
                </button>
              ))}
            </div>
          )}
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-3">{article.title}</h1>
          <p className="text-muted-foreground">
            Von {article.author} - {article.publicationDate ? 
                format(article.publicationDate.toDate(), 'dd. MMMM yyyy', { locale: de }) :
                'Datum unbekannt'
            }
          </p>
        </header>
        <div className="prose prose-lg dark:prose-invert max-w-none whitespace-pre-wrap">
          {article.content}
        </div>
      </article>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
