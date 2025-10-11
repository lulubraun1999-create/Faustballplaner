
import { Header } from '@/components/header';

export default function AktuellesPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
           <h1 className="text-3xl font-bold mb-4">Aktuelles</h1>
           <p className="text-muted-foreground">...</p>
        </div>
      </main>
    </div>
  );
}
