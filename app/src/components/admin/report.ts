import { toast } from "sonner";

import type { AdminActionState } from "@/lib/admin/action-state";

/** Toasts the outcome of an admin action; true when it went through. */
export function report(result: AdminActionState | undefined, success?: string) {
  if (result?.error) toast.error(result.error);
  else if (success) toast.success(success);
  return !result?.error;
}
