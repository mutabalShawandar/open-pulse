"use client";

import { useFormStatus } from "react-dom";
import { UserPlusIcon } from "lucide-react";

import { createUserAction } from "@/app/(platform)/administration/users/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CreateUserForm() {
  return <form action={createUserAction}><FieldGroup><Field><FieldLabel htmlFor="displayName">Anzeigename</FieldLabel><Input id="displayName" name="displayName" required /></Field><Field><FieldLabel htmlFor="email">E-Mail-Adresse</FieldLabel><Input id="email" name="email" type="email" required /></Field><SubmitButton /></FieldGroup></form>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : <UserPlusIcon data-icon="inline-start" />}{pending ? "Benutzer wird eingeladen …" : "Benutzer einladen"}</Button>;
}
