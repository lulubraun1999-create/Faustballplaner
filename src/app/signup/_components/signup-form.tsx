
"use client";

import React, { useState } from "react";
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
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Mock useForm for compatibility with the Form component structure
const useForm = <T extends Record<string, any>>(defaultValues: T) => {
  const [values, setValues] = useState(defaultValues.defaultValues);
  const [errors, setErrors] = useState<Record<string, { message: string }>>({});

  const setValue = (key: keyof T, value: any) => {
    setValues((prev: T) => ({ ...prev, [key]: value }));
  };

  return {
    control: {
      _fields: {},
      _formValues: values,
      _defaultValues: defaultValues.defaultValues
    },
    handleSubmit: (fn: (values: T) => void) => (e: React.FormEvent) => {
      e.preventDefault();
      const newErrors: Record<string, { message: string }> = {};
      if (!values.vorname || values.vorname.length < 2) newErrors.vorname = { message: "Vorname muss mindestens 2 Zeichen lang sein." };
      if (!values.nachname || values.nachname.length < 2) newErrors.nachname = { message: "Nachname muss mindestens 2 Zeichen lang sein." };
      if (!values.email || !/^\S+@\S+\.\S+$/.test(values.email)) newErrors.email = { message: "Ungültige E-Mail-Adresse." };
      if (!values.password || values.password.length < 6) newErrors.password = { message: "Das Passwort muss mindestens 6 Zeichen lang sein." };
      if (values.registrationCode !== "Ellaisttoll") newErrors.registrationCode = { message: "Ungültiger Registrierungscode." };
      
      setErrors(newErrors);

      if (Object.keys(newErrors).length === 0) {
        fn(values);
      }
    },
    watch: (key: keyof T) => values[key],
    formState: { errors },
    setValue,
  };
};


export function SignUpForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm({
    defaultValues: {
      vorname: "",
      nachname: "",
      email: "",
      password: "",
      registrationCode: "",
    },
  });

  const onSubmit = (values: any) => {
    startTransition(async () => {
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
          vorname: values.vorname,
          nachname: values.nachname,
          email: values.email,
          name: displayName,
          adminRechte: false, // Default admin rights to false
        };

        const userDocRef = doc(firestore, "users", user.uid);
        const memberDocRef = doc(firestore, "members", user.uid);

        // Write to both collections
        await Promise.all([
            setDoc(userDocRef, userData, { merge: true }),
            setDoc(memberDocRef, userData, { merge: true })
        ]);
        
        await sendEmailVerification(user);

        toast({
          title: "Registrierung erfolgreich",
          description: "Bitte überprüfen Sie Ihre E-Mails, um Ihr Konto zu bestätigen. Sie werden zum Login weitergeleitet.",
        });

        router.push("/login");

      } catch (error: any) {
        let description = "Ein unerwarteter Fehler ist aufgetreten.";
        if (error.code === 'auth/email-already-in-use') {
            description = "Diese E-Mail-Adresse wird bereits verwendet.";
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
    // @ts-ignore
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="vorname"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Vorname</FormLabel>
              <FormControl>
                <Input placeholder="Max" {...field} onChange={(e) => form.setValue('vorname', e.target.value)} />
              </FormControl>
              <FormMessage>{form.formState.errors.vorname?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nachname"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Nachname</FormLabel>
              <FormControl>
                <Input placeholder="Mustermann" {...field} onChange={(e) => form.setValue('nachname', e.target.value)} />
              </FormControl>
              <FormMessage>{form.formState.errors.nachname?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="name@beispiel.de" {...field} onChange={(e) => form.setValue('email', e.target.value)} />
              </FormControl>
              <FormMessage>{form.formState.errors.email?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <Input type="password" {...field} onChange={(e) => form.setValue('password', e.target.value)} />
              </FormControl>
              <FormMessage>{form.formState.errors.password?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="registrationCode"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Registrierungscode</FormLabel>
              <FormControl>
                <Input type="password" {...field} onChange={(e) => form.setValue('registrationCode', e.target.value)} />
              </FormControl>
              <FormMessage>{form.formState.errors.registrationCode?.message}</FormMessage>
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
