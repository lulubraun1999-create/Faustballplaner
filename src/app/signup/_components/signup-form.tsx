
"use client";

import React from "react";
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
import { useAuth, useFirestore } from "@/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  vorname: z.string().min(2, { message: "Vorname muss mindestens 2 Zeichen lang sein." }),
  nachname: z.string().min(2, { message: "Nachname muss mindestens 2 Zeichen lang sein." }),
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  password: z.string().min(6, { message: "Das Passwort muss mindestens 6 Zeichen lang sein." }),
  registrationCode: z.string().refine(val => val === "Ellaisttoll", {
    message: "Ungültiger Registrierungscode.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export function SignUpForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vorname: "",
      nachname: "",
      email: "",
      password: "",
      registrationCode: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
       if (!auth || !firestore) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Firebase-Dienste nicht verfügbar.",
        });
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password
        );
        const user = userCredential.user;

        const displayName = `${values.vorname} ${values.nachname}`;
        await updateProfile(user, {
          displayName: displayName,
        });

        const userData = {
          id: user.uid,
          vorname: values.vorname,
          nachname: values.nachname,
          email: values.email,
          name: displayName,
          adminRechte: false, // Default admin rights to false
          createdAt: serverTimestamp(),
        };

        const userDocRef = doc(firestore, "users", user.uid);
        const memberDocRef = doc(firestore, "members", user.uid);
        const groupMemberDocRef = doc(firestore, "group_members", user.uid);
        
        await setDoc(userDocRef, userData, { merge: true });
        await setDoc(memberDocRef, userData, { merge: true });
        await setDoc(groupMemberDocRef, {
            id: user.uid,
            vorname: values.vorname,
            nachname: values.nachname,
            adminRechte: false,
        }, { merge: true });
        
        await sendEmailVerification(user);

        toast({
          title: "Registrierung erfolgreich",
          description: "Bitte überprüfen Sie Ihre E-Mails, um Ihr Konto zu bestätigen. Sie werden zum Login weitergeleitet.",
        });

        router.push("/login");

      } catch (error: any) {
        let description = error.message || "Ein unerwarteter Fehler ist aufgetreten.";
        if (error.code === 'auth/email-already-in-use') {
            description = "Diese E-Mail-Adresse wird bereits verwendet.";
        }
        if (error.code === 'permission-denied') {
            description = "Berechtigung verweigert. Bitte überprüfen Sie die Firestore-Sicherheitsregeln.";
        }
        toast({
          variant: "destructive",
          title: "Registrierung fehlgeschlagen",
          description,
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="vorname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vorname</FormLabel>
              <FormControl>
                <Input placeholder="Max" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nachname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nachname</FormLabel>
              <FormControl>
                <Input placeholder="Mustermann" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="registrationCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Registrierungscode</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : "Konto erstellen"}
        </Button>
      </form>
    </Form>
  );
}
