import { DEFAULT_UI_LOCALE, isUiLocale, type UiLocale } from "@/i18n/locale";
import { prisma } from "@/lib/db";

/** A saved locale, or the default when it is missing or unknown. */
export function toUiLocale(value: string | null | undefined): UiLocale {
  return isUiLocale(value) ? value : DEFAULT_UI_LOCALE;
}

/** Language the seller reads Clozer in: their emails, alerts and AI notes. */
export async function getSellerLocale(userId: string | null | undefined): Promise<UiLocale> {
  if (!userId) return DEFAULT_UI_LOCALE;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return toUiLocale(user?.locale);
}

/** Same for many sellers in one query; ids not found get the default. */
export async function getSellerLocales(userIds: readonly string[]): Promise<Map<string, UiLocale>> {
  const ids = [...new Set(userIds)];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, locale: true } })
    : [];
  const byId = new Map(users.map((user) => [user.id, toUiLocale(user.locale)]));
  return new Map(ids.map((id) => [id, byId.get(id) ?? DEFAULT_UI_LOCALE]));
}
