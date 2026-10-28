import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";

import { APP_LOGIN_URL, appUrl } from "./links";

/**
 * The report's "Client" field is the signup itself: the email travels to the app's login page,
 * which sends the link at once. No JS needed. `lang` rides along so the account gets the page's language.
 */
export async function SignupForm({
  id,
  locale,
  tone = "light",
  extraParams = {},
  submitLabel,
}: {
  id: string;
  locale: Locale;
  tone?: "light" | "dark";
  /** Forwarded to the login page on both paths (email and Google), e.g. an offer code and utm values. */
  extraParams?: Record<string, string>;
  submitLabel?: string;
}) {
  const t = await getTranslations({ locale, namespace: "signup" });
  const dark = tone === "dark";
  const line = dark ? "border-sheet/30" : "border-ink";
  return (
    <form action={APP_LOGIN_URL} method="get" className={`border ${line} ${dark ? "text-sheet" : "bg-sheet"}`}>
      <label
        htmlFor={id}
        className={`flex items-baseline justify-between gap-4 border-b ${line} px-4 py-2.5 text-micro font-medium tracking-[0.06em] uppercase`}
      >
        <span>{t("emailLabel")}</span>
        <span className={`normal-case tracking-normal ${dark ? "text-sheet/60" : "text-ink-soft"}`}>
          {t("noPassword")}
        </span>
      </label>
      <input
        id={id}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder={t("placeholder")}
        className={`block h-14 w-full border-b ${line} bg-transparent px-4 text-lead outline-none placeholder:text-ink-soft/70 focus-visible:outline-2 focus-visible:-outline-offset-2 ${dark ? "placeholder:text-sheet/50" : ""}`}
      />
      <input type="hidden" name="lang" value={locale} />
      {Object.entries(extraParams).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className={`group flex h-16 w-full items-center justify-between px-4 text-left text-lead font-semibold transition-colors ${
          dark ? "bg-sheet text-ink hover:bg-iron-4" : "bg-ink text-sheet hover:bg-ink/90"
        }`}
      >
        {submitLabel ?? t("submit")}
        <Arrow />
      </button>
      <a
        href={appUrl(locale, { ...extraParams, provider: "google" })}
        className={`flex h-14 items-center gap-3 border-t ${line} px-4 text-body font-medium transition-colors ${
          dark ? "hover:bg-sheet/10" : "hover:bg-muted"
        }`}
      >
        <GoogleMark />
        {t("google")}
      </a>
    </form>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
    >
      <path d="M2.5 8h10M8.5 4l4 4-4 4" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}
