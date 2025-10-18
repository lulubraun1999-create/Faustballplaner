
"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth, useUser } from "@/firebase";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  password: z.string().min(1, { message: "Passwort ist erforderlich." }),
});

export function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!isUserLoading && user && user.emailVerified) {
      router.push("/");
    }
  }, [user, isUserLoading, router]);

  const handlePasswordReset = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast({
        variant: "destructive",
        title: "E-Mail fehlt",
        description: "Bitte geben Sie Ihre E-Mail-Adresse ein, um Ihr Passwort zurückzusetzen.",
      });
      return;
    }
    if (!auth) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Authentifizierungsdienst nicht verfügbar.",
      });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "E-Mail gesendet",
        description: "Eine E-Mail zum Zurücksetzen des Passworts wurde an Ihre E-Mail-Adresse gesendet.",
      });
    } catch (error: any) {
      let description = "Beim Senden der E-Mail zum Zurücksetzen des Passworts ist ein Fehler aufgetreten.";
      if (error.code === 'auth/user-not-found') {
        description = "Für diese E-Mail-Adresse wurde kein Benutzer gefunden.";
      }
      toast({
        variant: "destructive",
        title: "Fehler",
        description,
      });
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
      if (!auth) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Authentifizierungsdienst nicht verfügbar.",
        });
        return;
      }
      try {
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        
        if (!userCredential.user.emailVerified) {
          await auth.signOut();
          toast({
            variant: "destructive",
            title: "Anmeldung fehlgeschlagen",
            description: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.",
          });
          return;
        }

        toast({
          title: "Erfolgreich angemeldet",
          description: "Sie werden weitergeleitet.",
        });
        router.push("/");
      } catch (error: any) {
        let description = "Ein unerwarteter Fehler ist aufgetreten.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            description = "Falsche E-Mail-Adresse oder falsches Passwort.";
        }
        toast({
          variant: "destructive",
          title: "Anmeldung fehlgeschlagen",
          description,
        });
      }
    });
  };

  if (isUserLoading || (user && user.emailVerified)) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="name@beispiel.de" {...field} />
              </FormControl>
               <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center">
                <FormLabel>Passwort</FormLabel>
                <Button
                    type="button"
                    variant="link"
                    className="ml-auto inline-block px-0 text-sm underline"
                    onClick={handlePasswordReset}
                  >
                    Passwort vergessen?
                  </Button>
              </div>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : "Login"}
        </Button>
      </form>
    </Form>
  );
}
