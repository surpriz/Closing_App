# Questionnaire sécurité : réponses types (FR)

À copier-coller dans les questionnaires clients. Chaque réponse est vraie au 22/10/2026 ; à relire si le code
bouge (voir [README](README.md)). Les points marqués **[à confirmer]** dépendent d'une action pas encore faite
(voir la checklist en bas).

## Société et organisation

**Qui édite Clozer ?**
JAAP v2 (SASU), France. Contact sécurité : contact@clozer.club.

**Avez-vous une certification ISO 27001 ou SOC 2 ?**
Non, pas en propre. Nos hébergeurs en ont : Vercel et Neon sont certifiés ISO 27001 et audités SOC 2 Type 2,
comme AWS. Les paiements passent par Stripe (PCI DSS niveau 1).

**Avez-vous une politique de sécurité écrite ?**
Oui : page publique www.clozer.club/fr/securite, procédure de réponse aux incidents, registre des accès et procédure
de sauvegarde internes. Communicables sur demande.

**Qui a accès aux données de production ?**
Le fondateur uniquement. Accès aux consoles (Vercel, Neon, AWS, Stripe) nominatifs, avec double authentification
**[à confirmer]**. Pas de prestataire avec accès aux données.

## Hébergement et localisation

**Où sont hébergées les données ?**
Union européenne : application chez Vercel (Paris), base de données chez Neon (Francfort), fichiers chez Vercel
Blob (Paris), emails chez AWS SES (Stockholm).

**Des données sortent-elles de l'UE ?**
Oui, le texte des documents est envoyé aux fournisseurs d'IA (Anthropic ou OpenAI, États-Unis) pour la lecture
automatique et la rédaction des relances, sans l'email ni l'adresse IP des lecteurs. Les commentaires vocaux sont
transcrits par OpenAI. Encadré par leur DPA et le Data Privacy Framework ou les clauses contractuelles types. Les
relances WhatsApp (Twilio, US) ne partent que si le vendeur les active.

**Vos fournisseurs d'IA entraînent-ils leurs modèles avec nos données ?**
Non. Utilisation par API, sans entraînement sur les données des clients, selon les conditions d'Anthropic et
d'OpenAI. La traduction des PDF passe par DeepL API Pro (Allemagne), qui supprime les documents une fois traduits.

**Liste des sous-traitants ?**
www.clozer.club/fr/sous-traitants. Nous prévenons les clients 30 jours avant tout ajout.

## Chiffrement

**Chiffrement en transit ?**
HTTPS (TLS 1.2+) partout, HSTS de 2 ans avec sous-domaines.

**Chiffrement au repos ?**
AES-256 par Neon (base) et Vercel Blob (fichiers). Les secrets clients (webhooks Slack, clés de signature) et les
jetons OAuth Google sont en plus chiffrés par l'application en AES-256-GCM. Les jetons de l'extension et du
complément Outlook sont stockés hachés (SHA-256).

**Gestion des clés ?**
Clés applicatives dans les variables d'environnement chiffrées de Vercel, jamais dans le code (scan gitleaks à
chaque commit). Clés de chiffrement au repos gérées par les hébergeurs.

## Documents et liens

**Comment les documents sont-ils protégés ?**
Stockage privé, sans URL publique. Chaque ouverture passe par nos serveurs, qui vérifient que le lien est actif,
non expiré, non retiré, et que l'email a été donné si demandé. Réponse `Cache-Control: private, no-store` et
`X-Robots-Tag: noindex`.

**Un lien peut-il être deviné ?**
Non. Identifiant aléatoire de 12 caractères (alphabet de 62, environ 71 bits), généré par `crypto.randomInt`.
Requêtes limitées par IP.

**Peut-on révoquer un lien ?**
Oui, immédiatement (retrait ou expiration), y compris les copies transférées et les liens dérivés d'un Smart Link.

**Le lecteur est-il authentifié ?**
Il est identifié par l'email qu'il saisit (option par lien), pas vérifié. Le cookie qui retient cet email est signé
(HMAC) et propre à chaque lien. Pas de vérification par code, de mot de passe ni de filigrane aujourd'hui.

**Peut-on empêcher le téléchargement ?**
Pas aujourd'hui.

**Contrôle des fichiers envoyés ?**
PDF uniquement (type et octets d'en-tête vérifiés côté serveur), 25 Mo maximum, chemin de stockage propre à
l'espace, nom aléatoire.

## Accès et authentification

**Comment les utilisateurs se connectent-ils ?**
Sans mot de passe : lien de connexion par email (valable 5 minutes, usage unique) ou Google. Sessions de 7 jours,
cookies `HttpOnly`, `Secure`, `SameSite=Lax`. Tentatives limitées (5 liens par minute et par IP).

**Double authentification ?**
Pas propre à Clozer. Avec Google, la 2FA du compte Google s'applique.

**SSO / SAML ?**
Pas aujourd'hui.

**Gestion des droits ?**
Rôles propriétaire / administrateur / membre. Exports, effacements et suppression de documents réservés aux
administrateurs, suppression de l'espace au propriétaire.

**Isolation entre clients ?**
Base mutualisée, isolation logique : chaque requête est filtrée par espace côté serveur, fichiers rangés par
espace. Pas de requête qui prend un identifiant sans vérifier l'espace (revue faite en octobre 2026).

**Journalisation ?**
Journal d'audit par espace des actions sensibles (équipe, exports, effacements, suppressions, connexion de
l'extension), conservé 12 mois. Actions de l'administrateur plateforme journalisées à part. Logs applicatifs chez
Vercel.

## Développement et exploitation

**Pratiques de développement ?**
Chaque changement passe par un environnement de préproduction avant la production. Tests automatisés,
typage strict, CI à chaque push (tests, lint, build). Analyse de
code CodeQL, scan de secrets gitleaks, audit des dépendances (`npm audit`) et Dependabot.

**Protections applicatives ?**
En-têtes de sécurité (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, CSP), limites de
requêtes sur les points d'entrée publics, requêtes SQL paramétrées, validation des entrées (zod), garde SSRF sur
les URL fournies par les clients (résolution DNS, pas de redirection), webhooks sortants signés HMAC SHA-256,
webhooks entrants vérifiés (Stripe, AWS SNS).

**Tests d'intrusion ?**
Pas de pentest externe à ce jour. Revue de sécurité interne faite en octobre 2026. Programme de divulgation
responsable : contact@clozer.club, réponse sous 72 h.

**Sauvegardes ?**
Sauvegarde continue par Neon avec restauration à un instant donné. Procédure de restauration testée le
**[à confirmer]**.

**Plan de continuité ?**
Infrastructure entièrement managée (Vercel, Neon, AWS). Redéploiement de l'application possible depuis le dépôt Git
en quelques minutes.

## Incidents et RGPD

**Notification des violations ?**
Au client sous 48 h maximum après en avoir eu connaissance, avec les éléments pour sa propre notification à la
CNIL (72 h). Procédure écrite.

**Rôle RGPD ?**
Clozer est sous-traitant pour les données des prospects, le client responsable de traitement. DPA (article 28)
public : www.clozer.club/fr/dpa, exemplaire signé sur demande.

**Durées de conservation ?**
Données de lecture : 12 mois après la dernière activité du lien, effacement automatique. Documents supprimés :
effacés définitivement après 30 jours, fichiers compris. Preuves de signature : 5 ans. Facturation : 10 ans.
Adresses IP : jamais en clair (empreinte SHA-256 salée).

**Droits des personnes ?**
Export et effacement d'un prospect depuis Réglages › Données. Export JSON et suppression complète de l'espace à
tout moment. Information du lecteur sur la page, lien de désinscription dans chaque relance.

**Fin de contrat ?**
Suppression de l'espace = suppression des données et fichiers, abonnement Stripe arrêté.

---

## Checklist avant d'envoyer ces réponses

- [ ] 2FA activée sur tous les comptes du [registre des accès](access-register.md)
- [ ] Restauration Neon testée, date notée dans [backup-restore.md](backup-restore.md)
- [ ] Store Vercel Blob confirmé en privé uniquement
