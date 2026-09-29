"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Building2Icon } from "lucide-react";

import { registerOrganizationAction } from "@/app/(auth)/register/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function RegisterOrganizationForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={registerOrganizationAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="organizationName">Name der Organisation</FieldLabel>
          <Input
            id="organizationName"
            name="organizationName"
            required
            value={name}
            onChange={(event) => {
              const value = event.target.value;
              setName(value);
              if (!slugTouched) setSlug(slugify(value));
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="organizationSlug">Adresse</FieldLabel>
          <Input
            id="organizationSlug"
            name="organizationSlug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(event) => {
              setSlug(slugify(event.target.value));
              setSlugTouched(true);
            }}
          />
          <FieldDescription>Nur Kleinbuchstaben, Ziffern und Bindestriche.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="ownerDisplayName">Ihr Name</FieldLabel>
          <Input id="ownerDisplayName" name="ownerDisplayName" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="ownerEmail">E-Mail-Adresse</FieldLabel>
          <Input id="ownerEmail" name="ownerEmail" type="email" required />
          <FieldDescription>Wir senden Ihnen einen Link zur Bestätigung und Passwort-Einrichtung.</FieldDescription>
        </Field>
        <SubmitButton />
      </FieldGroup>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : <Building2Icon data-icon="inline-start" />}
      {pending ? "Organisation wird angelegt …" : "Organisation registrieren"}
    </Button>
  );
}
