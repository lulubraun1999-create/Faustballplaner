import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { liveMatch, upcomingMatches, matchResults } from '@/lib/data';
import TeamLogo from '@/components/app/team-logo';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Trophy, Futbol } from 'lucide-react';

const MatchCard = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <Card className={`mb-4 bg-card/80 backdrop-blur-sm ${className}`}>
    <CardContent className="p-4">{children}</CardContent>
  </Card>
);

const MatchRow = ({ homeTeam, awayTeam, homeScore, awayScore }: {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
}) => (
  <div className="flex flex-col sm:flex-row items-center justify-between text-center gap-4">
    <div className="flex items-center gap-3 w-full sm:w-1/3 justify-center sm:justify-end">
      <span className="font-semibold text-base text-right">{homeTeam}</span>
      <TeamLogo teamName={homeTeam} className="w-8 h-8" />
    </div>
    <div className="font-bold text-2xl text-primary">
      {typeof homeScore === 'number' && typeof awayScore === 'number' ? (
        <span>{homeScore} - {awayScore}</span>
      ) : (
        <span className="text-lg text-muted-foreground">vs</span>
      )}
    </div>
    <div className="flex items-center gap-3 w-full sm:w-1/3 justify-center sm:justify-start">
      <TeamLogo teamName={awayTeam} className="w-8 h-8" />
      <span className="font-semibold text-base text-left">{awayTeam}</span>
    </div>
  </div>
);

export default function MatchesPage() {
  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Match Center</h1>
        <p className="text-muted-foreground mt-2">Scores, fixtures, and results for Bayer Leverkusen.</p>
      </header>

      <Tabs defaultValue="live" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        <TabsContent value="live">
          <Card className="border-primary border-2 shadow-lg shadow-primary/20">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="w-4 h-4"/>
                <span>{liveMatch.competition}</span>
              </div>
              <CardTitle className="text-2xl">Live Match</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <MatchRow {...liveMatch} />
              <div className="text-center mt-4">
                <Badge variant="destructive" className="text-lg animate-pulse">{liveMatch.status}</Badge>
              </div>
              <Separator className="my-6" />
              <div className="flex justify-center items-center gap-6 text-sm">
                {liveMatch.events.map((event, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Futbol className="w-4 h-4 text-primary" />
                    <span>{event.player} {event.minute}'</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="upcoming">
          {upcomingMatches.map((match) => (
            <MatchCard key={match.id}>
              <MatchRow {...match} />
              <Separator className="my-4" />
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4"/>
                  <span>{match.competition}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4"/>
                        <span>{new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4"/>
                        <span>{match.time}</span>
                    </div>
                </div>
              </div>
            </MatchCard>
          ))}
        </TabsContent>
        <TabsContent value="results">
          {matchResults.map((match) => (
            <MatchCard key={match.id}>
              <MatchRow {...match} />
               <Separator className="my-4" />
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4"/>
                  <span>{match.competition}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4"/>
                    <span>{new Date(match.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            </MatchCard>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
