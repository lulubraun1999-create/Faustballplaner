import Image from 'next/image';
import { newsData } from '@/lib/data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function Home() {
  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Latest News</h1>
        <p className="text-muted-foreground mt-2">All the latest updates from the Werkself camp.</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {newsData.map((item) => (
          <Card key={item.id} className="flex flex-col overflow-hidden transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-lg">
            <CardHeader className="p-0">
              <Image
                src={item.image.imageUrl}
                alt={item.image.description}
                data-ai-hint={item.image.imageHint}
                width={800}
                height={600}
                className="w-full h-48 object-cover"
              />
            </CardHeader>
            <CardContent className="p-4 flex-grow">
              <div>
                <CardTitle className="text-xl leading-tight mb-2">{item.title}</CardTitle>
                <p className="text-muted-foreground text-sm line-clamp-3">{item.summary}</p>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="mr-1.5 h-4 w-4" />
                <span>{new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
