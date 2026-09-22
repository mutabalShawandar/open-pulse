"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ApiError,
  saveSmtpConfiguration,
  sendSmtpTestEmail,
} from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

function readRequired(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function fail(action: "save" | "test", error: unknown): never {
  if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
  if (error instanceof ApiError && error.status === 422) redirect(`/administration/email?error=${action}-validation`);
  if (error instanceof ApiError && error.status === 503) redirect(`/administration/email?error=${action}-encryption`);
  redirect(`/administration/email?error=${action}`);
}

export async function saveSmtpConfigurationAction(formData: FormData) {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");

  const host = readRequired(formData, "host");
  const senderName = readRequired(formData, "senderName");
  const senderEmail = readRequired(formData, "senderEmail");
  const port = Number.parseInt(readRequired(formData, "port"), 10);
  if (!host || !senderName || !senderEmail || !Number.isInteger(port)) redirect("/administration/email?error=save-validation");

  try {
    await saveSmtpConfiguration(accessToken, {
      host,
      port,
      use_starttls: formData.get("transport") === "starttls",
      use_ssl: formData.get("transport") === "ssl",
      username: readRequired(formData, "username") || null,
      password: readRequired(formData, "password") || null,
      sender_name: senderName,
      sender_email: senderEmail,
    });
  } catch (error) {
    fail("save", error);
  }

  revalidatePath("/administration/email");
  redirect("/administration/email?saved=1");
}

export async function sendSmtpTestEmailAction(formData: FormData) {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");
  const recipientEmail = readRequired(formData, "recipientEmail");
  if (!recipientEmail) redirect("/administration/email?error=test-validation");

  try {
    await sendSmtpTestEmail(accessToken, recipientEmail);
  } catch (error) {
    fail("test", error);
  }

  revalidatePath("/administration/email");
  redirect("/administration/email?tested=1");
}
