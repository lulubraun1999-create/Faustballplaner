import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getPlayerById, players } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function generateStaticParams() {
  return players.map((player) => ({
    playerId: player.id,
  }));
}

export default function PlayerProfilePage({ params }: { params: { playerId: string } }) {
  const player = getPlayerById(params.playerId);

  if (!player) {
    notFound();
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Button asChild variant="outline" className="bg-background/80">
          <Link href="/squad">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Squad
          </Link>
        </Button>
      </div>
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1">
          <Card className="overflow-hidden sticky top-8">
             <div className="relative">
                <Image
                  src={player.image.imageUrl}
                  alt={player.image.description}
                  data-ai-hint={player.image.imageHint}
                  width={400}
                  height={500}
                  className="w-full h-auto object-cover"
                />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            </div>
            <CardHeader className="text-center absolute bottom-0 left-0 right-0 p-4 z-10">
                <Badge className="mx-auto text-3xl font-bold h-16 w-16 flex items-center justify-center bg-primary border-4 border-background mb-2">
                    {player.number}
                </Badge>
                <CardTitle className="text-3xl text-white drop-shadow-md">{player.name}</CardTitle>
                <p className="text-lg text-white/80 drop-shadow-md">{player.position}</p>
            </CardHeader>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Season Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-4xl font-bold text-primary">{player.stats.appearances}</p>
                  <p className="text-sm text-muted-foreground">Appearances</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-primary">{player.stats.goals}</p>
                  <p className="text-sm text-muted-foreground">Goals</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-primary">{player.stats.assists}</p>
                  <p className="text-sm text-muted-foreground">Assists</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Biography</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{player.bio}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
