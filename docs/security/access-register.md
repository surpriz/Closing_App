# Registre des accès

Qui a accès à quoi. À relire à chaque arrivée ou départ, et tous les 6 mois. Une ligne sans 2FA est à corriger
avant de répondre à un questionnaire client.

| Service | Ce qu'il donne | Comptes | 2FA | Dernière revue |
|---|---|---|---|---|
| GitHub (`surpriz/Closing_App`) | Code, CI, secrets Actions | Fondateur | ☐ | |
| Vercel | Prod, variables d'environnement, fichiers Blob, logs | Fondateur | ☐ | |
| Neon | Base de prod et staging | Fondateur | ☐ | |
| AWS (compte root) | Tout AWS | Fondateur | ☐ | |
| AWS (utilisateur IAM de l'app) | SES (envoi), S3 (réponses entrantes) uniquement | Clé API dans Vercel | n/a | |
| Stripe | Paiements, clients, factures | Fondateur | ☐ | |
| Google Cloud (OAuth) | Connexion Google | Fondateur | ☐ | |
| Anthropic / OpenAI | Clés API IA | Fondateur | ☐ | |
| DeepL | Clé API traduction | Fondateur | ☐ | |
| Twilio | WhatsApp | Fondateur | ☐ | |
| Registrar du domaine `clozer.club` | DNS, emails | Fondateur | ☐ | |
| Chrome Web Store (compte développeur) | Publication de l'extension | Fondateur | ☐ | |
| Microsoft Partner Center | Complément Outlook | Fondateur | ☐ | |

## Dans l'application

- Administrateur plateforme : l'adresse de `PLATFORM_ADMIN_EMAIL`, seule. Ses actions vont dans `admin_audit_logs`.
- Personne d'autre n'a d'accès à la base ou aux fichiers de prod.

## Règles

- Un compte par personne, jamais partagé.
- Secrets dans un gestionnaire de mots de passe, jamais dans un fichier ou un message.
- Départ d'une personne : retirer ses accès partout le jour même, faire tourner les clés qu'elle a pu voir.
