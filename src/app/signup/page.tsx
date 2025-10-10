import Link from "next/link"
import { SignUpForm } from "./_components/signup-form"

export default function SignUpPage() {
  return (
    <div className="w-full flex items-center justify-center min-h-screen py-12">
      <div className="mx-auto grid w-[400px] gap-6">
        <div className="grid gap-2 text-center">
          <h1 className="text-3xl font-bold">Registrieren</h1>
          <p className="text-balance text-muted-foreground">
            Geben Sie Ihre Daten ein, um ein Konto zu erstellen
          </p>
        </div>
        <SignUpForm />
        <div className="mt-4 text-center text-sm">
          Bereits ein Konto?{" "}
          <Link href="/login" className="underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  )
}
