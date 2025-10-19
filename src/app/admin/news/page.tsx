
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useUser } from '@/firebase';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Edit } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const newsArticleSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich'),
  content: z.string().min(1, 'Inhalt ist erforderlich'),
  author: z.string().min(1, 'Autor ist erforderlich'),
  imageUrls: z.array(z.object({
    value: z.string().url('Ungültige URL').min(1, 'URL ist erforderlich'),
  })).optional(),
});

type NewsArticleFormValues = z.infer<typeof newsArticleSchema>;

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  author: string;
  publicationDate: Timestamp | null;
  imageUrls?: string[];
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
      imageUrls: article.imageUrls?.map(url => ({ value: url })) || [],
    } : {
      title: '',
      content: '',
      author: '',
      imageUrls: [{ value: '' }],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "imageUrls"
  });

  const onSubmit = async (values: NewsArticleFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...values,
        imageUrls: values.imageUrls?.map(item => item.value).filter(url => url) || [],
      };

      if (article) {
        const articleRef = doc(firestore, 'news_articles', article.id);
        await updateDoc(articleRef, dataToSave);
        toast({ title: 'Artikel aktualisiert' });
      } else {
        await addDoc(collection(firestore, 'news_articles'), {
          ...dataToSave,
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
        
        <div>
          <FormLabel>Bild-URLs</FormLabel>
          <div className="space-y-2 mt-2">
            {fields.map((field, index) => (
               <FormField
                key={field.id}
                control={form.control}
                name={`imageUrls.${index}.value`}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                        <FormControl>
                            <Input placeholder="https://beispiel.com/bild.jpg" {...field} />
                        </FormControl>
                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
             <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ value: "" })}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Bild-URL hinzufügen
            </Button>
          </div>
        </div>

        <FormField control={form.control} name="content" render={({ field }) => (
          <FormItem>
            <FormLabel>Inhalt</FormLabel>
            <FormControl><Textarea rows={10} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <DialogFooter>
             <DialogClose asChild><Button type="button" variant="outline">Abbrechen</Button></DialogClose>
             <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function AdminNewsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | undefined>(undefined);
  const [articleToDelete, setArticleToDelete] = useState<NewsArticle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const userDocRef = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData, isLoading: isUserLoading } = useDoc<UserData>(userDocRef);

  const canManageNews = userData?.adminRechte;

  const newsQuery = useMemo(() => {
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
  
  const handleDelete = async () => {
    if (!firestore || !articleToDelete) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'news_articles', articleToDelete.id));
        toast({ title: 'Artikel gelöscht' });
        setArticleToDelete(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen', description: error.message });
    } finally {
        setIsDeleting(false);
    }
  }


  const renderContent = () => {
    if (isLoading || isUserLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (error) {
      return <p className="text-destructive text-center">Fehler beim Laden der Artikel: {error.message}</p>;
    }
    if (!articles) {
      return <p className="text-muted-foreground text-center py-10">Keine Nachrichtenartikel gefunden.</p>;
    }

    return (
      <Card>
        <CardHeader>
            <CardTitle>Bestehende Artikel</CardTitle>
            <CardDescription>Hier kannst du alle Nachrichtenartikel sehen, bearbeiten oder löschen.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Bild</TableHead>
                        <TableHead>Titel</TableHead>
                        <TableHead>Autor</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {articles.map((article) => (
                        <TableRow key={article.id}>
                            <TableCell>
                                {article.imageUrls && article.imageUrls.length > 0 ? (
                                    <Image src={article.imageUrls[0]} alt={article.title} width={64} height={48} className="rounded-md object-cover aspect-[4/3]" />
                                ) : (
                                    <div className="w-16 h-12 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">Kein Bild</div>
                                )}
                            </TableCell>
                            <TableCell className="font-medium">
                                <Link href={`/aktuelles/${article.id}`} className="hover:underline">
                                    {article.title}
                                </Link>
                            </TableCell>
                            <TableCell><Badge variant="outline">{article.author}</Badge></TableCell>
                            <TableCell>
                                {article.publicationDate ? 
                                    format(article.publicationDate.toDate(), 'dd.MM.yyyy', { locale: de }) :
                                    <span className="text-xs text-muted-foreground">Wird erstellt...</span>
                                }
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenForm(article)}><Edit className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => setArticleToDelete(article)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    );
  }
  
  if (isClient && !isUserLoading && !canManageNews) {
       return (
        <div className="flex min-h-screen w-full flex-col bg-background">
            <Header />
            <main className="flex-1 p-4 md:p-8">
                <div className="mx-auto max-w-7xl">
                    <Card className="text-center p-8">
                        <CardTitle>Zugriff verweigert</CardTitle>
                        <CardDescription className="mt-2">Sie haben nicht die erforderlichen Berechtigungen, um diese Seite anzuzeigen.</CardDescription>
                    </Card>
                </div>
            </main>
        </div>
       )
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">News verwalten</h1>
            {isClient && canManageNews && (
                <Button variant="outline" onClick={() => handleOpenForm()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Neuen Artikel erstellen
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

        <AlertDialog open={!!articleToDelete} onOpenChange={(open) => !open && setArticleToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird der Artikel "{articleToDelete?.title}" dauerhaft gelöscht.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? <Loader2 className="animate-spin" /> : 'Ja, löschen'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
