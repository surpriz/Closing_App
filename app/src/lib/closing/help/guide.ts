/**
 * What the help assistant knows about Clozer, for logged-in users. Written
 * from the app's own screens: update it with every feature that changes
 * what a user sees or can do. French, like the dashboard.
 */
export const HELP_GUIDE = `## Ce qu'est Clozer
- Clozer remplace la pièce jointe par un lien suivi. Le vendeur dépose un document (devis, proposition,
  présentation en PDF, page web ou pitch vidéo), crée un lien par prospect et l'envoie.
- Clozer voit comment le prospect lit, comprend où en est le deal et prépare la bonne relance au bon moment.
  Le vendeur valide et appelle ceux qui sont prêts.
- Connexion par email, sans mot de passe. Le prospect lit dans son navigateur, sur ordinateur comme sur
  téléphone, sans rien installer.
- Les lectures du vendeur connecté à Clozer ne comptent pas, ni les robots ni les aperçus automatiques (Slack,
  LinkedIn).
- Navigation principale (onglets en haut, barre en bas sur téléphone) : Aujourd'hui (/dashboard), Documents
  (/documents), Réglages (/settings). Équipe (/equipe) s'ajoute pour les propriétaires et admins dès que
  l'espace a un deuxième membre (sinon : Réglages → Équipe → « Inviter un commercial », et /equipe reste
  accessible par son adresse). Prospection (/prospection) n'existe que pour les espaces où elle est activée.
- Bouton « ? » en haut à droite : Poser une question (l'assistant d'aide, aussi pour les suggestions et les
  bugs), Comment ça marche (/comment-ca-marche), Questions fréquentes (/faq), Revoir la prise en main
  (/bienvenue).
- Menu du compte (avatar en haut à droite) : Données et confidentialité (/settings#donnees), choix du thème,
  Se déconnecter.

## Parcours d'un deal
1. Vous déposez un document. Clozer le lit une fois : type, résumé de chaque page, où sont le prix, le
   planning, le périmètre, et les faits précis (« 12 000 € HT »).
2. Le prospect ouvre son lien. Clozer note page par page le temps passé, quand, sur quel appareil, et si
   d'autres l'ouvrent. Sur Clozer, vous le voyez lire en direct.
3. Quelques minutes après sa lecture, Clozer reconstitue l'histoire du deal en faits datés et une IA
   l'interprète : où en est le deal, ce qui coince (prix, décideur, timing…), quoi faire. Chaque conclusion
   cite ses faits ; ce qui n'est pas prouvé est écarté.
4. S'il faut relancer, Clozer écrit le message en votre nom, avec votre offre et les vrais chiffres du
   document. Jamais « j'ai vu que vous avez regardé les prix ».
5. Il choisit le moment : jamais juste après une lecture, toujours aux heures de bureau du prospect, 3
   relances par mois au maximum, rien juste après un échange que vous avez noté.
6. Par défaut la relance vous attend (email + « Relances à valider »). En mode automatique, seules les
   relances sûres partent seules. Les réponses du prospect arrivent dans votre boîte mail.
7. Il continue de surveiller : silence de 3 jours, de 7 jours, il relit le deal et adapte la suite. Lien
   jamais ouvert : rappel discret après quelques jours. Le prospect clique « Valider » ou « Demander un
   ajustement » : tout s'arrête et vous êtes prévenu.
- Statuts d'un deal : En cours, Validé, Ajustement demandé, Gagné, Perdu.

## Deux indicateurs : température et lecture IA
- Température (sur 100, Chaud / Tiède / Froid) : combien il lit. Calculée sans IA : lecture récente, temps
  passé, visites répétées, plusieurs lecteurs, tarifs lus, lecture jusqu'au bout, demandes, rendez-vous.
  Chaque point a sa raison (bloc « Pourquoi » de la fiche).
- Lecture IA (avec sa fiabilité) : ce que ça veut dire. Un prospect peut être « chaud » avec une lecture IA
  prudente (lectures courtes, trop tôt pour conclure). Fiabilité faible quand il y a peu de signaux.
- Actions conseillées par la lecture IA : Relancer par écrit, Appeler, Répondre à sa demande, Faire entrer le
  décideur dans la boucle, Attendre, Classer le deal.

## Aujourd'hui (/dashboard)
- La page d'accueil. Un vendeur y voit ses propres deals ; la vue de toute l'équipe est sur Équipe.
- Premiers pas (3 étapes cochées d'après vos vraies données) : Déposez un document, Envoyez le lien, Le
  prospect l'ouvre. Pour tester, ouvrez votre lien dans une fenêtre privée : vos propres lectures connectées
  ne comptent pas.
- En haut : une phrase qui résume la journée, le bouton « Ajouter un document / lien », et « En train de lire
  » quand un prospect lit en ce moment.
- Bandeau « Mode automatique » (si le pilote automatique est actif) : combien de relances sont parties seules
  depuis 24 h, et pour les propriétaires et admins le bouton « Tout valider moi-même » qui repasse tout en
  validation manuelle.
- À traiter : vos deals du plus urgent au moins urgent (15 affichés), avec leur état (Chaud, Tiède, Froid, Pas
  encore ouvert, Validé…), l'action conseillée et un bouton pour copier le lien, ou « Marquer gagné » quand le
  prospect a validé.
- Vos envois : entonnoir envoyés, ouverts, lus attentivement, validés, sur 7 jours, 30 jours ou Tout. « Lu
  attentivement » = la moitié du PDF avec au moins 30 s de lecture, une minute sur un lien web, ou une longue
  lecture des tarifs.
- Colonne de droite : Deals en cours (répartition par température), Relances à valider (mène à la fiche,
  rubrique Relances), Ce qui s'est passé, Relances à venir.

## Documents (/documents)
- Ajouter : bouton « Ajouter un document / lien », ou glisser un PDF / coller un lien n'importe où sur la page
  Documents.
- PDF uniquement pour les fichiers, 25 Mo maximum. Un Word ou un PowerPoint doit être exporté en PDF avant.
- Lien web : collez une adresse complète (Notion, Loom, Figma, Webflow…). Si le site refuse l'affichage
  intégré, le prospect l'ouvre dans un nouvel onglet.
- « Enregistrer un pitch vidéo » : jusqu'à 3 minutes, Caméra ou Écran + caméra. Le prospect voit la vidéo en
  grand avec vos boutons rendez-vous et devis, et vous savez jusqu'où il l'a regardée. La transcription sert à
  l'IA et à l'assistant.
- Dès le dépôt, un lien prêt à envoyer s'ouvre (écran de partage) : pas besoin d'attendre la fin de l'analyse.
  Si le document existait déjà, Clozer crée simplement un nouveau lien.

## Page d'un document (/documents/[id])
- Bouton « Un lien pour un autre prospect » (« Créer le lien » tant que le document n'en a aucun) : un lien de plus pour un autre prospect.
- Onglet Prospects : un lien par prospect, avec son état, ses lectures, un interrupteur « Relances » par lien
  et le bouton copier.
- Onglet Lecture : « Ce qui bloque » (sur tous les prospects de ce document), « Temps passé par page » (pages
  de tarifs en couleur), pages repérées automatiquement, « Dernières lectures ». Pour un lien web : temps
  passé sur la page seulement ; pour une vidéo YouTube ou Vimeo, aussi la part réellement regardée ; pour
  Loom, le temps sur la page seulement.
- Lecteurs anonymes : une même lettre = un même navigateur, deux lettres = souvent deux personnes. Pour savoir
  exactement qui lit, activez « Demander son email avant de lire » dans les réglages du lien.
- Onglet Le document :
  - Mot d'accueil : vidéo ou vocal vu par le prospect dès l'ouverture, sur tous les liens de ce document (pas
    pour un pitch vidéo).
  - Type de document (Devis, Proposition commerciale, Présentation, Document technique, CV / profil, Facture,
    Contrat, Étude de cas, Plaquette, Document) : deviné par l'IA, modifiable ; il décide du vocabulaire des
    étiquettes et de l'assistant.
  - Infos pour l'assistant : précisions propres à ce document pour répondre aux questions du prospect (4 000
    caractères au plus).
  - Contenu : résumé de chaque page par l'IA, avec des étiquettes (Tarifs, Conditions, Planning, Périmètre,
    Équipe, Références, Autre). Corrigez-les si besoin : votre choix ne sera plus touché. Bouton « Relire les
    pages » si l'IA n'a pas réussi. Pour une page web : « Ce que présente la page » et « Relire la page ».
  - Aperçu : le document tel que le prospect le voit.
- Onglet Relances : les relances et alertes de tous les prospects du document.
- Supprimer le document (propriétaires et admins) : il disparaît, tous les liens envoyés ne s'ouvrent plus et
  leurs relances prévues sont annulées. Il est effacé pour de bon au bout de 30 jours.

## Écran de partage d'un lien
- S'affiche juste après le dépôt ou « Un lien pour un autre prospect » (« Créer le lien » tant que le document n'en a aucun), tant que le lien n'est pas envoyé. « Votre lien
  est prêt ».
- Choix « Pour un prospect » ou « Lien ouvert à tous ». Lien ouvert à tous = lien partagé (plaquette, post
  LinkedIn, signature) : chaque lecteur donne son email et reçoit son propre lien, suivi comme un deal ; ses
  relances attendent toujours votre feu vert. Un lien déjà lu ou attribué à un contact ne peut plus devenir
  partagé : créez-en un nouveau.
- Champ « Pour qui est ce lien ? » en haut (facultatif) : un email ajoute le contact, un nom nomme juste le
  lien (et le deal).
- Un lien « Pour un prospect » s'ouvre directement, sans demander d'email au lecteur : il a été fait pour
  lui. On peut quand même l'exiger lien par lien dans « Personnaliser ». Un lien transféré est repéré comme
  un nouveau lecteur.
- « Copier le lien » ou « Envoyer par email » : le lien devient un deal.
- Aussi : « Personnaliser » (mot d'accueil) et « Voir ce que verra le prospect ». Pour un devis ou une
  proposition, une échéance peut être réglée d'office : le prospect voit un décompte.

## Fiche d'un prospect / deal (/links/[id])
- En-tête : nom de la société ou du contact, le lien à copier, le sélecteur « Statut du deal », « Réglages du
  lien » et « Archiver le lien ». Changer le statut (hors En cours) annule les relances en attente.
- Deal d'un collègue : consultable, mais seuls son commercial et les admins peuvent le modifier.
- Prospect qui a validé : bandeau « a validé… Confirmez la vente pour arrêter les relances » avec « Marquer
  gagné ».
- Lien expiré : bandeau rouge, le prospect ne peut plus l'ouvrir ; prolongez-le pour le réactiver.
- Bandeau « En train de lire » dès qu'un lecteur est sur le document (rien n'est affiché sinon).
- Le verdict, un seul bloc en tête : pastille de température (Chaud, Tiède, Froid, « Pas encore lu »),
  « lu il y a… », nombre de lectures, puis la phrase de la lecture IA (ou, sans analyse, la température et
  ses deux raisons les plus fortes), puis l'action conseillée (la même que sur Aujourd'hui) avec « Préparer
  une relance », « Voir la relance prête » ou « Analyser ce deal ».
  - Repli « Pourquoi cette température » : score sur 100, jauge, chaque raison avec ses points, « Comment la
    température est calculée ».
  - Repli « Détails de l'analyse » : date, « sûre à N % », stade et dynamique, « Ce qui compte », « Ce qui
    coince » avec leurs faits sources, « À surveiller », « Réanalyser » (au plus toutes les deux minutes),
    « Les N faits lus par l'IA ».
- Relances (#relances), Questions du prospect (#questions, posées à l'assistant), Commentaires vocaux
  (#vocaux), Mot d'accueil (#mot-accueil, version perso pour ce prospect possible), Capsules par page
  (#capsules), « Lecture détaillée » (repli : temps par page ou par passage de la vidéo, affiché seulement
  quand il y a assez de lecture), Activité (chronologie complète).
- Colonne de droite :
  - Prospect : les contacts qui reçoivent les relances, chacun avec ce qu'il a lu (1re lecture, dernière,
    durée), son rôle (Décideur, Finance / achats, Technique…) deviné depuis l'email ou choisi par vous ;
    ouvrir un contact pour le modifier (email, nom, entreprise, téléphone mobile, « Accepte d'être contacté
    sur WhatsApp ») ; « Ajouter un contact » ; puis « Autres lecteurs » (#qui-lit), regroupés par société ou
    réseau. Pour un lien partagé : « Lecteurs », chacun avec son lien.
  - Contexte du deal (replié ; votre équipe le voit, pas le prospect) : Montant du deal, Devise, Décision
    attendue avant le, Décideur, Son rôle, Vos notes. Les notes servent à l'analyse, jamais à la rédaction
    d'un message. Le résumé (montant · échéance · décideur) reste visible sur la ligne repliée.
  - « Mettre en pause jusqu'au » (dans Contexte du deal) : le prospect revient vers vous plus tard, Clozer se
    tait d'ici là. « Reprendre » pour annuler.
  - Noter un échange : Appel, Réponse reçue, Rendez-vous, Note, avec « Ce qui s'est dit » et « Quand » (vide =
    maintenant), bouton « Noter l'échange ». Clozer en tient compte et ne relance pas juste après.
- Expiration : dans « Réglages du lien » (#expiration ouvre la fenêtre) : Aucune, 48 h, 7 jours, 15 jours, 30
  jours ou Date précise ; boutons +3 j, +7 j, +14 j, « Autre date », « Retirer ». Un lien qui expire montre
  « Expire dans … » sous le titre. Le prospect d'un lien expiré peut « Demander une prolongation » : vous
  êtes prévenu.
- Réglages du lien (« Chaque changement est enregistré tout de suite ») : Nom du lien, « Demander son email
  avant de lire », et ce que le prospect peut faire : « Valider ou demander un ajustement » (deux boutons en
  bas du document ; « Demander un devis » sous une vidéo), « Prendre rendez-vous », « Poser ses questions à
  l'assistant », « Laisser un vocal sur une page » (PDF), « Relances préparées par Clozer » (coupé : le deal
  reste suivi, sans relance). « Lien de l'agenda » : vide = votre agenda des Réglages. Propriétaires et admins
  : « Garder ces réglages pour mes prochains liens ».
- Archiver le lien : le prospect ne peut plus ouvrir le document, les relances prévues sont annulées.

## Réglages (/settings)
- L'essentiel est visible d'emblée : Pilote automatique, Être prévenu, Votre agenda. Le bouton « Réglages
  avancés » déplie le reste : Votre offre, Vos liens, Assistant prospect, Vos messages, Chrome et Outlook,
  Équipe, Données. Un lien direct vers une section avancée (/settings#offre…) la déplie tout seul.

## Relances et pilote automatique
- Réglages → Pilote automatique (/settings#pilote), réglé par les propriétaires et admins pour tout l'espace.
  Deux modes :
  - « Je la relis et je valide » (copilote, par défaut, recommandé pour commencer) : email + relance dans «
    Relances à valider » et sur la fiche, rubrique Relances.
  - « Elle part seule quand Clozer est sûr de lui » (automatique) : les cas délicats (objection, message du
    prospect, doute) attendent quand même votre accord. Un second contrôle par IA passe avant tout envoi
    automatique. Un récapitulatif arrive chaque matin.
- Règles toujours respectées : jamais d'allusion au fait que vous voyez ce qu'il lit (un contrôle bloque toute
  phrase qui le laisserait deviner) ; jamais un chiffre ou une date absents du document ; 3 relances par mois
  et par contact au maximum, espacées ; jamais dans les heures qui suivent une lecture, toujours aux heures de
  bureau du prospect ; une seule relance en préparation par deal (une analyse plus récente remplace
  l'ancienne) ; vos notes privées ne servent jamais à la rédaction.
- Sur une relance : modifier l'objet et le message puis « Enregistrer » ; « Réécrire » avec Plus court, Plus
  direct, Proposer un appel, Autre angle, ou une consigne libre ; « Valider » (elle part à l'heure prévue,
  heure du prospect) ; « Envoyer maintenant » ; « Copier » ou « Ouvrir dans ma messagerie » puis « Je l'ai
  envoyée moi-même » ; « Annuler ». Un lien expiré doit être prolongé avant de relancer.
- Un lien de désinscription est ajouté à chaque envoi.
- Arrêter les relances : pour tout l'espace, « Tout valider moi-même » sur Aujourd'hui ou repasser sur « Je la
  relis et je valide » ; pour un deal, l'interrupteur « Relances » (onglet Prospects du document) ou «
  Relances préparées par Clozer » dans les réglages du lien, la pause « Mettre en pause jusqu'au », ou un
  statut autre que En cours. Pour les nouveaux liens : Réglages → Vos liens → « Préparer les relances ».

## Assistant prospect
- Sur le document, il répond aux questions du prospect quand vous n'êtes pas là. Il s'appuie sur le document
  (résumés, faits, texte des pages, transcription d'une vidéo), sur votre offre (Réglages → Votre offre), sur
  les « Infos pour l'assistant » du document et sur « Ce que l'assistant doit savoir » (Réglages → Assistant
  prospect, /settings#assistant, 4 000 caractères). Jamais sur un prix ou une condition inventés.
- Ce qu'il ne sait pas, il vous le transmet aussitôt : alerte « Question du prospect », question marquée sur
  la fiche et reprise dans le compte rendu du matin.
- Tout ce que vous écrivez pour l'assistant peut être obtenu par le prospect en posant la question : rien de
  confidentiel.
- Activation : « Activer l'assistant sur les nouveaux liens » dans Réglages, puis lien par lien (« Poser ses
  questions à l'assistant »). Sans IA configurée, l'assistant reste masqué.
- Les conversations apparaissent sur la fiche, rubrique « Questions du prospect ». Vos propres tests sur votre
  lien ne sont pas comptés.

## Mot d'accueil, capsules et commentaires vocaux
- Mot d'accueil : vidéo ou « Audio seul », jusqu'à 90 secondes, avec une phrase d'accroche facultative. Le
  prospect voit votre bulle dès l'ouverture, sur toutes les pages. Version du document (page du document,
  onglet Le document) ou version perso pour un prospect (« Version perso pour ce prospect », sur la fiche),
  qui remplace celle du document.
- Capsules par page : anciennes explications page par page, toujours jouées sur leur page.
- Commentaires vocaux : le prospect enregistre un vocal sur une page (60 s max) ; vous recevez l'audio et sa
  transcription (rubrique « Commentaires vocaux » + alerte). À activer avec « Laisser le prospect enregistrer
  un vocal sur une page » (Réglages → Vos liens) ou lien par lien.

## Extension Chrome et add-in Outlook
- Réglages → Chrome et Outlook (/settings#extension). Principe : vous joignez un PDF dans Gmail ou Outlook,
  Clozer le remplace par un lien, avec le premier destinataire comme prospect.
- Extension Chrome (Gmail et Outlook dans le navigateur, sur Chrome ou Edge) : installez-la, épinglez-la
  (icône puzzle), cliquez sur Clozer puis « Connecter » ; la page « Connecter l'extension » s'ouvre,
  connectez-vous si besoin et cliquez « Connecter l'extension ». Le bouton « C » dans l'email permet aussi de
  choisir un document existant.
- Complément Outlook (Outlook installé sur Windows ou Mac) : téléchargez le fichier manifeste (lien dans
  Réglages ou la prise en main), puis Outlook › Compléments › Mes compléments › Ajouter à partir d'un fichier.
  Dans un nouvel email, cliquez « Clozer » dans le ruban : un code s'affiche ; saisissez-le sur la page «
  Connecter Outlook » (Code affiché dans Outlook). L'informatique peut le déployer pour toute l'équipe via le
  centre d'administration Microsoft 365.
- Connexions listées dans Réglages → Réglages avancés → Chrome et Outlook (une carte Chrome, une carte Outlook), avec « Révoquer » (confirmation demandée).
- Pas encore couvert : pièces jointes depuis Drive ou OneDrive, pièces jointes transférées. Utilisez le bouton
  « C » ou déposez le PDF dans Clozer.
- Autre messagerie : déposez le PDF dans Clozer, puis copiez le lien ou « Envoyer par email ».

## Notifications (Réglages → Être prévenu, /settings#alertes)
- Ces réglages ne concernent que vous :
  - « Un email dès qu'un prospect valide, demande un ajustement ou prend rendez-vous » : ces alertes (plus
    questions à l'assistant, vocaux, demandes de prolongation) arrivent même le soir et le week-end.
  - « Quand c'est le moment d'appeler » : « Notification de l'extension Chrome » et « Un email aussi » (si
    l'extension n'est pas ouverte). Première ouverture, retour après un silence, longue lecture des tarifs,
    lecture à plusieurs. Jamais le soir ni le week-end, 4 par heure au plus.
  - « Un compte rendu chaque matin à » 6 h à 10 h : qui recontacter aujourd'hui et pourquoi, puis réponses et
    lectures de la veille. Du lundi au vendredi, rien s'il n'y a rien à dire.
- Pour toute l'équipe (propriétaires et admins) : « Pour toute l'équipe, prévenir aussi sur » Slack et/ou
  Outil externe ; « Mettre en copie des emails d'alerte » ; « Brancher Slack ou un outil externe » : adresse
  du webhook Slack, et Webhook (CRM, Zapier, Make…) signé HMAC SHA-256 (en-tête X-Closing-Signature).
- Votre agenda (/settings#agenda, personnel) : lien de prise de rendez-vous. Calendly et Cal.com s'affichent
  dans la page du prospect (nom et email pré-remplis) ; les autres (HubSpot, Google Agenda…) s'ouvrent dans un
  onglet. Vide : pas de bouton « Prendre rendez-vous ».

## Autres réglages de l'espace
- Votre offre (/settings#offre) : Ce que vous vendez, Vos clients, Pourquoi ils vous choisissent, Les
  objections que vous entendez souvent, durée habituelle d'un deal en jours. Facultatif : Clozer la
  pré-remplit à la lecture du premier document.
- Vos liens (/settings#liens) : ce que chaque nouveau lien propose d'office. « Demander son email au lecteur
  avant d'ouvrir », expiration d'un devis ou d'une proposition (7, 15, 30 jours ou jamais ; le décompte ne va
  que sur les devis et propositions), vocaux, « Préparer les relances ». Modifiable ensuite lien par lien.
- Vos messages (/settings#messages) : Signé par, Ton (ex. « direct, vouvoiement, sans jargon »), Signature.
- Après une modification : « Enregistrer les réglages ».

## Équipe et rôles
- Rôles : Propriétaire, Admin, Membre.
- Membre : voit ses propres deals sur Aujourd'hui, consulte ceux des collègues sans les modifier, règle ses
  notifications et son agenda. Réglages de l'espace grisés (« Réglé par un administrateur de l'espace. »).
- Admin : voit toute l'équipe sur la page Équipe, règle l'espace, modifie tous les deals, supprime les
  documents, invite et retire des membres.
- Propriétaire : comme un admin, plus les liens sans commercial attitré, la possibilité de nommer un autre
  propriétaire et de supprimer l'espace.
- Page Équipe (/equipe) : chiffres En cours, Ça avance, Ça glisse, À classer, Pipeline ; tableau « Par
  commercial » (cliquez pour filtrer) ; colonnes Ça avance (à suivre de près), Ça glisse (en train de
  refroidir), À classer (à relancer une dernière fois ou à classer). Ces mots décrivent la vie du deal ; la
  température (Chaud, Tiède, Froid) reste celle du dashboard.
- Inviter : « Inviter un commercial » ou Réglages → Équipe (/settings#equipe), email + rôle (Membre ou Admin),
  « Inviter ». Changer un rôle, « Retirer » un membre, annuler une invitation.

## Données et confidentialité (/settings#donnees)
- Le prospect est informé : une mention claire figure sur la page du document, avec un lien vers la politique
  de confidentialité. Les relances ne citent jamais une page ni un temps de lecture.
- Aucune adresse email ni IP n'est envoyée à l'IA : les lecteurs sont désignés par une lettre.
- Suivi de lecture effacé 12 mois après la dernière activité d'un lien ; document supprimé effacé pour de bon
  au bout de 30 jours.
- Demande d'un prospect (propriétaires et admins) : cherchez son email, puis « Exporter » ou « Tout supprimer
  » (lectures, messages, vocaux, relances). Les validations signées restent 5 ans comme preuve de l'accord.
  Répondez sous un mois.
- « Exporter l'espace » (propriétaires et admins) : liens, prospects, lectures et messages en JSON.
- « Supprimer mon compte » (tapez SUPPRIMER) : vos deals restent dans l'espace, votre accès disparaît.
- « Supprimer l'espace » (propriétaire, tapez le nom de l'espace) : tout est effacé, fichiers compris, pour
  toute l'équipe. Irréversible : exportez d'abord.

## Limites connues
- Les relances partent de l'adresse de Clozer, avec votre email en adresse de réponse.
- Clozer ne voit pas encore les réponses reçues par email : notez-les sur la fiche (« Noter un échange » →
  Réponse reçue).
- Les relances WhatsApp arrivent bientôt.
- Fichiers : PDF uniquement, 25 Mo maximum. Sur un lien web, pas de détail page par page.
- IA : Claude Haiku (d'Anthropic) lit les documents et fait le second contrôle avant tout envoi automatique ;
  Claude Sonnet analyse chaque deal et rédige les relances. Une analyse n'est relancée que s'il s'est passé
  quelque chose de nouveau.

## Conseils pour bien utiliser Clozer
- Un lien par prospect : vous saurez qui lit. Lien partagé seulement pour une diffusion large (plaquette,
  post).
- Envoyez le lien à la place de la pièce jointe, pas en plus.
- Remplissez Votre offre et Vos messages : les relances sont plus justes et signées comme vous.
- Commencez en « Je la relis et je valide », passez en automatique une fois en confiance avec les brouillons.
- Notez vos appels, rendez-vous et réponses : Clozer évite de relancer à contretemps et l'analyse reste juste.
- Renseignez Le deal (montant, échéance, décideur) : meilleure analyse, pipeline juste.
- Vérifiez les étiquettes de pages, surtout Tarifs : elles comptent pour la température et les relances.
- Nourrissez l'assistant (modalités, garanties, FAQ) et lisez les questions posées : elles révèlent les
  objections.
- Activez « Demander son email avant de lire » si le document circule en interne chez le prospect.
- Appelez quand l'alerte « moment d'appeler » arrive : c'est pendant ou juste après la lecture que ça compte.
- Marquez Gagné ou Perdu dès que c'est tranché : les relances s'arrêtent.

## Aide et suggestions
- L'assistant d'aide (bouton « ? » en haut à droite → « Poser une question », ou Cmd+K)
  répond aux questions sur Clozer et transmet à l'équipe Clozer, avec votre accord, vos suggestions, bugs,
  remarques et les questions auxquelles il n'a pas su répondre. L'équipe lit tout et peut vous répondre par
  email.
- Il ne voit ni vos documents ni vos deals et ne peut rien modifier à votre place.
- Questions fréquentes (/faq) : toutes les questions courantes, par thème, avec une recherche. Depuis le menu
  du compte, Cmd+K ou Comment ça marche.

## Raccourcis
- Cmd+K (Ctrl+K sur Windows) ou « Rechercher… » en haut : aller à un prospect, une société, un document ou une
  page (Aujourd'hui, Documents, Comment ça marche, Réglages, Prise en main), ou « Poser une question ».
- Revoir la prise en main (/bienvenue) : depuis le bouton « ? » ou Comment ça marche. Trois étapes : Votre
  messagerie, L'outil (extension, complément ou rien), C'est parti (offre, premier document).
`;
