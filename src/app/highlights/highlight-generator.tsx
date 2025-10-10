'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { handleGenerateHighlights } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Wand } from 'lucide-react';
import { matchResults } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
      {pending ? (
        <>
          <Sparkles className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Wand className="mr-2 h-4 w-4" />
          Generate Highlights
        </>
      )}
    </Button>
  );
}

export default function HighlightGenerator() {
  const initialState = { message: '', errors: {}, description: '' };
  const [state, dispatch] = useFormState(handleGenerateHighlights, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state.message && state.message !== 'Success!') {
      toast({
        variant: "destructive",
        title: "Error",
        description: state.message,
      })
    }
    if (state.message === 'Success!') {
      formRef.current?.reset();
      toast({
        title: "Highlights Generated!",
        description: "Your highlight reel description is ready.",
      })
    }
  }, [state, toast]);

  const matchOptions = matchResults.map(match => ({
    value: `Result: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam} on ${new Date(match.date).toLocaleDateString()}`,
    label: `${match.homeTeam} vs ${match.awayTeam} (${new Date(match.date).toLocaleDateString()})`,
  }))

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <Card>
        <form ref={formRef} action={dispatch}>
          <CardHeader>
            <CardTitle>Create Your Reel</CardTitle>
            <CardDescription>Select a match and specify what you want to see.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matchDescription">Match</Label>
               <Select name="matchDescription">
                <SelectTrigger id="matchDescription">
                  <SelectValue placeholder="Select a recent match" />
                </SelectTrigger>
                <SelectContent>
                  {matchOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.errors?.matchDescription && <p className="text-sm font-medium text-destructive">{state.errors.matchDescription[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferences">Preferences</Label>
              <Textarea
                id="preferences"
                name="preferences"
                placeholder="e.g., 'Show all goals by Florian Wirtz', 'focus on great saves', 'all key passes from Grimaldo'"
                rows={4}
              />
              {state.errors?.preferences && <p className="text-sm font-medium text-destructive">{state.errors.preferences[0]}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
      <div>
        <Card className="h-full bg-card-foreground/5 dark:bg-card-foreground/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-primary"/>
                Your Highlight Reel
            </CardTitle>
            <CardDescription>The AI-generated description for your reel will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            {state.description ? (
                <p className="text-foreground leading-relaxed">{state.description}</p>
            ) : (
                <div className="text-center text-muted-foreground py-10">
                    <Wand className="mx-auto h-12 w-12 mb-4"/>
                    <p>Your highlights are waiting to be created.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
