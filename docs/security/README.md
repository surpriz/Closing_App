# Sécurité : dossier interne

Ce qu'il faut pour répondre à un client qui challenge la sécurité. La version publique est la page
[www.clozer.club/fr/securite](https://www.clozer.club/fr/securite) (`landing/src/content/security.fr.tsx`).

| Fichier | Sert à |
|---|---|
| [questionnaire.fr.md](questionnaire.fr.md) / [questionnaire.en.md](questionnaire.en.md) | Réponses prêtes à copier dans un questionnaire sécurité client |
| [incident-response.md](incident-response.md) | Quoi faire, dans quel ordre, en cas d'incident ou de fuite |
| [backup-restore.md](backup-restore.md) | Sauvegardes Neon et procédure de restauration (à tester) |
| [access-register.md](access-register.md) | Qui a accès à quoi, 2FA activée ou non |

## Règle

Une réponse du questionnaire ou une ligne de la page sécurité qui n'est plus vraie est pire que pas de réponse.
Quand le code change (auth, stockage, sous-traitants, rétention), relire ces fichiers dans le même commit.

## Où c'est dans le code

| Sujet | Fichier |
|---|---|
| En-têtes HTTP | `app/next.config.ts`, `landing/next.config.ts` |
| Limites de requêtes | `app/src/lib/rate-limit.ts`, `rateLimit` dans `app/src/lib/auth.ts` |
| Accès aux documents | `app/src/lib/closing/links.ts`, `app/src/app/api/v/[slug]/file/route.ts` |
| Cookie du formulaire d'email (signé) | `app/src/lib/closing/tracking/gate-cookie.ts` |
| Chiffrement des secrets | `app/src/lib/crypto.ts` |
| Garde SSRF | `app/src/lib/closing/channels/public-address.ts`, `webhooks.ts` |
| Journal d'audit | `app/src/lib/audit.ts` (table `audit_logs`) |
| Alertes sécurité (Sentry, tag `kind:security`) | `app/src/lib/security-events.ts` |
| Rétention et purge | `app/src/lib/closing/retention/purge.ts`, `app/src/lib/privacy/` |
| CI sécurité | `.github/workflows/ci.yml` (job `security`), `codeql.yml`, `dependabot.yml` |
