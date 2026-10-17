import { notFound } from "next/navigation";

// Unknown paths under a locale get the localized not-found page instead of Next's bare one.
export default function CatchAll() {
  notFound();
}
