'use server';

import { z } from 'zod';
import { generateMatchHighlights } from '@/ai/flows/generate-match-highlights';

export const highlightSchema = z.object({
  matchDescription: z.string().min(1, { message: 'Please select a match.' }),
  preferences: z.string().min(3, { message: 'Please enter your preferences (at least 3 characters).' }),
});

export type HighlightState = {
  message?: string;
  description?: string;
  errors?: {
    matchDescription?: string[];
    preferences?: string[];
  };
};

export async function handleGenerateHighlights(
  prevState: HighlightState,
  formData: FormData
): Promise<HighlightState> {
  const validatedFields = highlightSchema.safeParse({
    matchDescription: formData.get('matchDescription'),
    preferences: formData.get('preferences'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation failed. Please check your inputs.',
    };
  }

  try {
    const result = await generateMatchHighlights({
      matchDescription: validatedFields.data.matchDescription,
      preferences: validatedFields.data.preferences,
    });
    return {
      message: 'Success!',
      description: result.highlightReelDescription,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'An error occurred while generating highlights. Please try again.',
    };
  }
}
