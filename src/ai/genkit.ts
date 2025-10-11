import 'dotenv/config';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Initialize googleAI with the API key only on the server-side.
// The browser environment does not have access to process.env.
// NOTE: This is currently commented out to resolve a build issue.
const isServer = typeof window === 'undefined';
const googleAiPlugin = isServer
  ? googleAI({apiKey: process.env.GEMINI_API_KEY})
  : googleAI();

export const ai = genkit({
  // plugins: [googleAiPlugin],
});
