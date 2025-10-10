import HighlightGenerator from './highlight-generator';

export default function HighlightsPage() {
  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-primary">AI Highlight Reel Generator</h1>
        <p className="text-muted-foreground mt-2">
          Create custom highlight reels of recent matches powered by generative AI.
        </p>
      </header>
      <HighlightGenerator />
    </div>
  );
}
