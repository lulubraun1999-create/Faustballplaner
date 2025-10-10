import Image from 'next/image';
import Link from 'next/link';
import { players } from '@/lib/data';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SquadPage() {
  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Player Squad</h1>
        <p className="text-muted-foreground mt-2">Meet the Werkself heroes of this historic season.</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {players.map((player) => (
          <Link href={`/squad/${player.id}`} key={player.id} className="group">
            <Card className="overflow-hidden transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1">
              <CardHeader className="p-0 relative">
                <Image
                  src={player.image.imageUrl}
                  alt={player.image.description}
                  data-ai-hint={player.image.imageHint}
                  width={400}
                  height={500}
                  className="w-full h-[300px] object-cover object-top transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <Badge className="absolute top-3 right-3 text-2xl font-bold h-12 w-12 flex items-center justify-center bg-primary/80 border-2 border-background">
                  {player.number}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 bg-card relative -mt-8 rounded-b-lg z-10">
                  <h2 className="text-xl font-bold">{player.name}</h2>
                  <p className="text-muted-foreground">{player.position}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
