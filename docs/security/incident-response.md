# Réponse à un incident de sécurité

Une page, à suivre dans l'ordre. Un incident = accès non autorisé, fuite ou perte de données, compte compromis,
secret exposé, faille signalée par quelqu'un.

## 1. Noter (tout de suite)

Ouvrir une note datée (`.personal-docs/incidents/AAAA-MM-JJ.md`) : ce qui a été vu, quand, par qui, comment. Tout
ce qui suit y est ajouté avec l'heure. C'est elle qui sert pour la CNIL et les clients.

## 2. Contenir (dans l'heure)

| Situation | Action |
|---|---|
| Secret exposé (clé API, `ENCRYPTION_KEY`, token Blob…) | Le révoquer chez le fournisseur, en créer un nouveau, mettre à jour Vercel, redéployer |
| Compte fournisseur compromis | Changer le mot de passe, couper les sessions, vérifier la 2FA et les clés API du compte |
| Compte utilisateur Clozer compromis | Bannir l'utilisateur depuis `/admin` (coupe ses sessions), révoquer ses jetons d'extension |
| Lien partagé par erreur | Le vendeur le retire (ou nous le retirons) : l'accès est coupé tout de suite |
| Faille dans le code | Corriger, ou couper la fonction (flag, route) en attendant |
| Attaque en cours (robots, spam) | Baisser les limites dans `app/src/lib/rate-limit.ts`, activer le pare-feu Vercel si besoin |

⚠️ Changer `ENCRYPTION_KEY` rend illisibles les secrets chiffrés (webhooks Slack, clés de signature), les cookies
du formulaire d'email et les liens de transfert déjà envoyés. Seulement si la clé a fuité.

## 3. Évaluer (dans les 24 h)

- Quelles données, combien de personnes, quels espaces clients ?
- Sources : logs Vercel, `audit_logs` (actions sensibles par espace), `admin_audit_logs`, tableaux de bord Neon / AWS / Stripe.
- Risque pour les personnes : nul, faible, élevé ?

## 4. Notifier

| Qui | Quand | Comment |
|---|---|---|
| Clients concernés | **48 h max** après en avoir eu connaissance (engagement du DPA) | Email au propriétaire de l'espace : ce qui s'est passé, données touchées, ce qui est fait, ce qu'ils doivent faire |
| CNIL | 72 h, si Clozer est responsable du traitement (données des vendeurs) et qu'il y a un risque | [notifications.cnil.fr](https://notifications.cnil.fr) |
| Personnes concernées | Sans délai si risque élevé | Pour les prospects, c'est le client (responsable) qui décide ; on l'aide |

Pour les données des prospects, Clozer est sous-traitant : c'est le client qui notifie la CNIL. On lui donne ce
qu'il faut pour le faire.

## 5. Après

- Post-mortem dans la note : cause, chronologie, ce qui a marché, ce qui change.
- Corriger la cause, pas seulement le symptôme. Ajouter un test si c'est du code.
- Mettre à jour la page sécurité et le questionnaire si une réponse a changé.

## Faille signalée par un tiers

Accuser réception sous 72 h (engagement public). Remercier, ne pas menacer. Corriger, puis prévenir la personne.
