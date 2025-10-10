
"use client";

import React, { useEffect, useState } from "react";
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
} from "firebase/auth";
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
      if (!values.email || !/^\S+@\S+\.\S+$/.test(values.email)) newErrors.email = { message: "Ungültige E-Mail-Adresse." };
      if (!values.password || values.password.length < 1) newErrors.password = { message: "Passwort ist erforderlich." };
      
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

export function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm({
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

  const onSubmit = (values: any) => {
    startTransition(async () => {
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
     // @ts-ignore
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="name@beispiel.de" {...field} onChange={(e) => form.setValue('email', e.target.value)}/>
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
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : "Login"}
        </Button>
      </form>
    </Form>
  );
}
