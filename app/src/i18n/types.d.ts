import type { UiLocale } from "./locale";
import type { Messages } from "./messages";

declare module "next-intl" {
  interface AppConfig {
    Locale: UiLocale;
    Messages: Messages;
  }
}
