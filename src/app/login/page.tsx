import Link from "next/link";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <div className="w-full flex items-center justify-center min-h-screen py-12">
      <div className="mx-auto grid w-[400px] gap-6">
        <div className="grid gap-2 text-center">
          <h1 className="text-3xl font-bold">Login</h1>
          <p className="text-balance text-muted-foreground">
            Geben Sie Ihre E-Mail-Adresse ein, um sich bei Ihrem Konto anzumelden
          </p>
        </div>
        <LoginForm />
        <div className="mt-4 text-center text-sm">
          Noch kein Konto?{" "}
          <Link href="/signup" className="underline">
            Registrieren
          </Link>
        </div>
      </div>
    </div>
  );
}
