'use server';

/**
 * @fileOverview A flow for generating match highlights based on user preferences.
 *
 * - generateMatchHighlights - A function that generates a highlight reel of a recent match.
 * - GenerateMatchHighlightsInput - The input type for the generateMatchHighlights function.
 * - GenerateMatchHighlightsOutput - The return type for the generateMatchHighlights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMatchHighlightsInputSchema = z.object({
  matchDescription: z.string().describe('Description of the match to generate highlights for.'),
  preferences: z
    .string()
    .describe(
      'User preferences for the highlight reel, such as specific players, goals, saves, etc.'
    ),
});
export type GenerateMatchHighlightsInput = z.infer<typeof GenerateMatchHighlightsInputSchema>;

const GenerateMatchHighlightsOutputSchema = z.object({
  highlightReelDescription: z
    .string()
    .describe('A description of the generated highlight reel.'),
});
export type GenerateMatchHighlightsOutput = z.infer<typeof GenerateMatchHighlightsOutputSchema>;

export async function generateMatchHighlights(
  input: GenerateMatchHighlightsInput
): Promise<GenerateMatchHighlightsOutput> {
  return generateMatchHighlightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMatchHighlightsPrompt',
  input: {schema: GenerateMatchHighlightsInputSchema},
  output: {schema: GenerateMatchHighlightsOutputSchema},
  prompt: `You are an AI that generates descriptions for highlight reels of soccer matches based on user preferences.

  Match Description: {{{matchDescription}}}
  User Preferences: {{{preferences}}}

  Generate a description of a highlight reel that focuses on the key plays and moments, based on the user's preferences.`,
});

const generateMatchHighlightsFlow = ai.defineFlow(
  {
    name: 'generateMatchHighlightsFlow',
    inputSchema: GenerateMatchHighlightsInputSchema,
    outputSchema: GenerateMatchHighlightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
