
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Edit } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const newsArticleSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich'),
  content: z.string().min(1, 'Inhalt ist erforderlich'),
  author: z.string().min(1, 'Autor ist erforderlich'),
  imageUrl: z.string().url('Ungültige URL').optional().or(z.literal('')),
});

type NewsArticleFormValues = z.infer<typeof newsArticleSchema>;

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  author: string;
  publicationDate: Timestamp;
  imageUrl?: string;
}

interface UserData {
  adminRechte?: boolean;
}

function NewsForm({ article, onDone }: { article?: NewsArticle, onDone: () => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NewsArticleFormValues>({
    resolver: zodResolver(newsArticleSchema),
    defaultValues: article ? {
      title: article.title,
      content: article.content,
      author: article.author,
      imageUrl: article.imageUrl,
    } : {
      title: '',
      content: '',
      author: '',
      imageUrl: '',
    },
  });

  const onSubmit = async (values: NewsArticleFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);
    try {
      if (article) {
        // Update existing article
        const articleRef = doc(firestore, 'news_articles', article.id);
        await updateDoc(articleRef, values);
        toast({ title: 'Artikel aktualisiert' });
      } else {
        // Create new article
        await addDoc(collection(firestore, 'news_articles'), {
          ...values,
          publicationDate: serverTimestamp(),
        });
        toast({ title: 'Artikel erstellt' });
      }
      onDone();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !article) return;
    setIsSubmitting(true);
    try {
        await deleteDoc(doc(firestore, 'news_articles', article.id));
        toast({ title: 'Artikel gelöscht' });
        onDone();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{article ? 'Artikel bearbeiten' : 'Neuen Artikel erstellen'}</DialogTitle>
          <DialogDescription>
            Füllen Sie die Details aus, um einen Nachrichtenartikel zu {article ? 'bearbeiten' : 'erstellen'}.
          </DialogDescription>
        </DialogHeader>

        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Titel</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="author" render={({ field }) => (
          <FormItem>
            <FormLabel>Autor</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="imageUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>Bild-URL</FormLabel>
            <FormControl><Input placeholder="https://beispiel.com/bild.jpg" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="content" render={({ field }) => (
          <FormItem>
            <FormLabel>Inhalt</FormLabel>
            <FormControl><Textarea rows={10} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <DialogFooter className="sm:justify-between pt-4">
            <div>
                 {article && <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4" /> Löschen</Button>}
            </div>
            <div className="flex gap-2">
                 <DialogClose asChild><Button type="button" variant="outline">Abbrechen</Button></DialogClose>
                 <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}</Button>
            </div>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function AktuellesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | undefined>(undefined);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: users } = useCollection<UserData>(usersCollectionRef);

  const currentUserData = users?.find(u => u.id === user?.uid);
  const isAdmin = currentUserData?.adminRechte === true;

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news_articles'), orderBy('publicationDate', 'desc'));
  }, [firestore]);

  const { data: articles, isLoading, error } = useCollection<NewsArticle>(newsQuery);

  const handleOpenForm = (article?: NewsArticle) => {
    setSelectedArticle(article);
    setIsFormOpen(true);
  }

  const handleFormDone = () => {
    setIsFormOpen(false);
    setSelectedArticle(undefined);
  }

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
          <Card key={article.id} className="flex flex-col">
            <CardHeader>
              {article.imageUrl && (
                <div className="relative aspect-video w-full mb-4 overflow-hidden rounded-lg">
                  <Image src={article.imageUrl} alt={article.title} fill className="object-cover" />
                </div>
              )}
              <CardTitle>{article.title}</CardTitle>
              <CardDescription>
                Von {article.author} - {format(article.publicationDate.toDate(), 'dd. MMMM yyyy', { locale: de })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm line-clamp-4">{article.content}</p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="link" className="p-0">Weiterlesen</Button>
              {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleOpenForm(article)}><Edit className="h-4 w-4"/></Button>}
            </CardFooter>
          </Card>
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
            {isClient && isAdmin && (
                <Button onClick={() => handleOpenForm()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Neuer Artikel
                </Button>
            )}
          </div>
          
          {renderContent()}

        </div>
      </main>

       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="sm:max-w-3xl">
                <NewsForm article={selectedArticle} onDone={handleFormDone} />
            </DialogContent>
        </Dialog>
    </div>
  );
}

    