"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ApiError,
  createPlatformUser,
  deactivatePlatformUser,
  grantPlatformAdmin,
  permanentlyDeletePlatformUser,
  reactivatePlatformUser,
} from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

export async function createUserAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!email || !displayName) redirect("/administration/users?error=validation");

  try {
    await createPlatformUser(accessToken, { email, display_name: displayName });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 409) redirect("/administration/users?error=exists");
    redirect("/administration/users?error=create");
  }

  revalidatePath("/administration/users");
  redirect("/administration/users?created=1");
}

export async function deactivateUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!userId) redirect("/administration/users?error=deactivate");

  try {
    await deactivatePlatformUser(accessToken, userId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect("/administration/users?error=deactivate");
  }

  revalidatePath("/administration/users");
  redirect("/administration/users?deactivated=1");
}

export async function reactivateUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!userId) redirect("/administration/users?error=reactivate");

  try {
    await reactivatePlatformUser(accessToken, userId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect("/administration/users?error=reactivate");
  }

  revalidatePath("/administration/users");
  redirect("/administration/users?reactivated=1");
}

export async function grantPlatformAdminAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");
  if (!userId) redirect("/administration/users?error=grant-admin");
  try {
    await grantPlatformAdmin(accessToken, userId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect("/administration/users?error=grant-admin");
  }
  revalidatePath("/administration/users");
  redirect("/administration/users?adminGranted=1");
}

export async function permanentlyDeleteUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!userId) redirect("/administration/users?error=delete");

  try {
    await permanentlyDeletePlatformUser(accessToken, userId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect("/administration/users?error=delete");
  }

  revalidatePath("/administration/users");
  redirect("/administration/users?deleted=1");
}
