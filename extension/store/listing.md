# Chrome Web Store listing

Copy for the developer dashboard. Keep it in step with the privacy page (`landing/src/app/confidentialite`) and `wxt.config.ts`: Google rejects listings whose permissions or data use don't match the code.

## Store listing

- **Nom** : Clozer
- **Résumé** (≤ 132 car., = `description` du manifest) : Remplacez une pièce jointe PDF par un lien Clozer dans Gmail et Outlook, et sachez quand un prospect lit votre proposition.
- **Catégorie** : Productivité › Outils
- **Langue** : français
- **Site** : https://www.clozer.club
- **Support** : https://www.clozer.club/support
- **Visibilité** : Public

**Description**

```
Vous envoyez une proposition commerciale en PDF ? Avec Clozer, elle part sous forme de lien, et vous savez quand le prospect l'ouvre, combien de temps il y passe et sur quelles pages.

Dans Gmail ou Outlook sur le web, joignez votre PDF comme d'habitude. Clozer propose de le remplacer par un lien au nom du destinataire, l'insère au-dessus de votre signature et retire la pièce jointe. Le bouton « C » dans le coin du message permet aussi de choisir un document déjà dans Clozer.

Pendant que le prospect lit, l'extension vous prévient : c'est le bon moment pour l'appeler.

Il faut un compte Clozer (https://app.clozer.club). L'extension ne lit pas vos emails reçus et n'envoie pas le texte de vos messages : seulement le PDF que vous remplacez et le premier destinataire.
```

**Visuels** (à produire)

- Icône 128×128 : `public/icon/128.png`
- Au moins une capture 1280×800 : compose Gmail avec la proposition de remplacement, puis le lien inséré
- Petite vignette promo 440×280

## Privacy practices

**Objectif unique**

```
Remplacer une pièce jointe PDF dans un email en cours de rédaction (Gmail, Outlook web) par un lien de suivi Clozer, et prévenir le vendeur quand son prospect lit ce lien.
```

**Justification des permissions**

| Permission | Justification |
|---|---|
| `storage` | Garder le jeton de connexion au compte Clozer et les préférences de l'utilisateur. |
| `notifications` | Prévenir le vendeur qu'un prospect est en train de lire sa proposition. |
| `alarms` | Interroger Clozer toutes les 30 secondes pour savoir si un prospect lit en ce moment. |
| `idle` | Ne pas interroger Clozer quand la session de l'ordinateur est verrouillée. |
| Hôte `https://app.clozer.club/*` | Seul serveur contacté : API Clozer (connexion, envoi du PDF, création du lien, activité de lecture). |
| Content scripts sur `mail.google.com`, `outlook.office.com`, `outlook.office365.com`, `outlook.live.com`, `outlook.cloud.microsoft` | Repérer une fenêtre de rédaction, afficher le bouton Clozer et insérer le lien dans le message. Aucun autre site. |
| Script dans le monde de la page (`world: MAIN`) | Gmail et Outlook ajoutent les fichiers via un `<input type=file>` créé et cliqué par leur propre code, invisible depuis un script isolé. Le script observe ce clic pour détecter un PDF joint et le transmet au script isolé. Il ne bloque ni ne modifie le comportement de la messagerie. |

**Code distant** : Non. Tout le code est dans le paquet.

**Données collectées** (cocher)

- Contenu du site web : oui. Le PDF joint que l'utilisateur choisit de remplacer.
- Informations d'identification personnelle : oui. Adresse email et nom du premier destinataire, pour créer le lien à son nom.
- Authentification : oui. Jeton de connexion au compte Clozer.
- Le reste (santé, finances, localisation, historique web, activité utilisateur, communications) : non.

**Certifications** : les trois cases (pas de vente à des tiers, pas d'usage sans lien avec l'objectif unique, pas d'usage pour du crédit).

**Politique de confidentialité** : https://www.clozer.club/confidentialite

## After the first upload

The Store assigns the extension ID as soon as the draft is uploaded. Set it on the production app (Vercel, before submitting for review):

```
EXTENSION_IDS=<store id>
EXTENSION_STORE_URL=https://chromewebstore.google.com/detail/<store id>
```

`/api/health` then reports `extension: true`. Staging keeps the pinned dev ID.
