/**
 * The page was loaded before a deployment: the server no longer knows the
 * server action it calls. Only a reload fixes it. Pure.
 */
export function isStaleDeployment(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /Server Action ".*" was not found on the server|failed-to-find-server-action/.test(error.message);
}

/**
 * @deprecated French only: translate `server.staleDeployment` instead
 * (`useTranslations("server")("staleDeployment")` in a component).
 */
export const STALE_DEPLOYMENT_MESSAGE = "Une nouvelle version de Clozer vient d'être mise en ligne. Rechargez la page pour continuer.";
