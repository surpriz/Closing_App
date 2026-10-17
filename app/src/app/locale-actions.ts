"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isUiLocale } from "@/i18n/locale";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function setLocaleAction(locale: string) {
  if (!isUiLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: "/", sameSite: "lax" });
  const session = await getSession();
  if (session) await prisma.user.update({ where: { id: session.user.id }, data: { locale } });
}
