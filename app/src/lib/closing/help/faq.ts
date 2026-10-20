/**
 * Questions users ask about Clozer, shown on /faq and given to the help
 * assistant so both answer the same way. Written from the app's own screens,
 * like guide.ts: update both when a feature changes what a user sees or does.
 * Answers are plain text; a blank line starts a new paragraph.
 * English lives in faq.en.ts with the same ids; pick one with getFaq(locale).
 */

import type { UiLocale } from "@/i18n/locale";

import { FAQ_EN } from "./faq.en";

export type FaqItem = {
  /** Anchor on /faq: stable, a link may point to it. */
  id: string;
  q: string;
  a: string;
  link?: { href: string; label: string };
};

export type FaqSection = { id: string; title: string; items: FaqItem[] };

export const FAQ: FaqSection[] = [
  {
    id: "demarrer",
    title: "Bien démarrer",
    items: [
      {
        id: "cest-quoi",
        q: "Qu'est-ce que Clozer fait, concrètement ?",
        a: "Clozer remplace la pièce jointe par un lien suivi. Vous déposez un document (devis, proposition, présentation, page web ou pitch vidéo), vous créez un lien par prospect et vous l'envoyez.\n\nClozer voit comment le prospect lit, comprend où en est la vente et prépare la bonne relance au bon moment. Vous validez, et vous appelez ceux qui sont prêts.",
        link: { href: "/how-it-works", label: "Comment ça marche" },
      },
      {
        id: "par-ou-commencer",
        q: "Par où commencer ?",
        a: "Trois étapes, cochées automatiquement sur Aujourd'hui dans « Premiers pas » : déposez un document, envoyez le lien, le prospect l'ouvre.\n\nEnsuite, prenez cinq minutes pour remplir Réglages → Réglages avancés → Votre offre et Vos messages : les relances seront plus justes et signées comme vous.",
        link: { href: "/documents", label: "Déposer un document" },
      },
      {
        id: "installer",
        q: "Faut-il installer quelque chose ?",
        a: "Non. Vous vous connectez avec votre email, sans mot de passe, et le prospect lit dans son navigateur, sur ordinateur comme sur téléphone, sans rien installer.\n\nL'extension Chrome ou le complément Outlook sont facultatifs : ils transforment directement une pièce jointe PDF en lien Clozer dans votre messagerie.",
      },
      {
        id: "tester",
        q: "Comment tester mon lien sans fausser les chiffres ?",
        a: "Ouvrez votre lien dans une fenêtre de navigation privée. Vos propres lectures, quand vous êtes connecté à Clozer, ne comptent pas. Les robots et les aperçus automatiques (Slack, LinkedIn) sont écartés aussi.",
      },
      {
        id: "prise-en-main",
        q: "Comment revoir la prise en main ?",
        a: "Bouton « ? » en haut à droite → Revoir la prise en main, ou depuis la page Comment ça marche. Trois étapes : votre messagerie, l'outil adapté (extension, complément ou rien), puis c'est parti.",
        link: { href: "/welcome", label: "Revoir la prise en main" },
      },
      {
        id: "recherche",
        q: "Comment retrouver vite un prospect ou un document ?",
        a: "Cmd+K (Ctrl+K sur Windows), ou « Rechercher… » en haut de l'écran : tapez un prospect, une société ou un document, puis Entrée.",
      },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    items: [
      {
        id: "formats",
        q: "Quels documents puis-je envoyer ?",
        a: "Trois sortes :\n- un PDF (devis, proposition, présentation, CV…), 25 Mo maximum ;\n- un lien web (Notion, Loom, Figma, Webflow…) : collez l'adresse complète ;\n- un pitch vidéo enregistré dans Clozer, jusqu'à 3 minutes, caméra seule ou écran + caméra.",
      },
      {
        id: "word-powerpoint",
        q: "Puis-je envoyer un Word ou un PowerPoint ?",
        a: "Pas directement : exportez-le d'abord en PDF, puis déposez le PDF.",
      },
      {
        id: "ajouter",
        q: "Comment ajouter un document ?",
        a: "Bouton « Ajouter un document / lien » sur Aujourd'hui ou Documents. Sur la page Documents, vous pouvez aussi glisser un PDF ou coller un lien n'importe où.\n\nUn lien prêt à envoyer s'ouvre tout de suite : pas besoin d'attendre la fin de l'analyse.",
        link: { href: "/documents", label: "Documents" },
      },
      {
        id: "lien-web-bloque",
        q: "Mon lien web ne s'affiche pas dans Clozer, c'est normal ?",
        a: "Certains sites refusent d'être affichés dans une autre page. Dans ce cas, le prospect l'ouvre dans un nouvel onglet. Vous voyez l'ouverture et le temps passé, mais pas de détail page par page.",
      },
      {
        id: "pitch-video",
        q: "À quoi sert le pitch vidéo ?",
        a: "Vous enregistrez jusqu'à 3 minutes (Documents → « Enregistrer un pitch vidéo »). Le prospect voit la vidéo en grand avec vos boutons rendez-vous et devis, et vous savez jusqu'où il l'a regardée. La transcription nourrit l'analyse et l'assistant prospect.",
      },
      {
        id: "comprehension",
        q: "Comment voir ce que Clozer a compris de mon document ?",
        a: "Page du document → onglet Le document → Contenu : un résumé de chaque page avec des étiquettes (Tarifs, Conditions, Planning, Périmètre, Équipe, Références, Autre). Si une étiquette est fausse, corrigez-la : votre choix ne sera plus touché. Bouton « Relire les pages » si l'IA n'a pas réussi.",
      },
      {
        id: "etiquettes",
        q: "Pourquoi corriger les étiquettes de pages ?",
        a: "Elles comptent pour la température et pour les relances, en particulier Tarifs : une page de prix mal repérée fausse la lecture de la vente.",
      },
      {
        id: "type-document",
        q: "À quoi sert le type de document ?",
        a: "Devis, Proposition commerciale, Présentation, Document technique, CV / profil, Facture, Contrat, Étude de cas, Plaquette ou Document : l'IA le devine et vous pouvez le changer (onglet Le document). Il décide du vocabulaire des étiquettes et de l'assistant, et, pour un devis ou une proposition, de l'échéance proposée d'office.",
      },
      {
        id: "ce-qui-bloque",
        q: "Que montre l'onglet Lecture d'un document ?",
        a: "« Ce qui bloque » sur tous les prospects de ce document, le temps passé par page (pages de tarifs en couleur) et les dernières lectures. Pour une vidéo YouTube ou Vimeo, aussi la part réellement regardée ; pour Loom, le temps passé sur la page seulement.",
      },
      {
        id: "supprimer-document",
        q: "Comment supprimer un document ?",
        a: "Depuis la page du document (propriétaires et admins). Tous les liens envoyés ne s'ouvrent plus et leurs relances prévues sont annulées. Le document est effacé pour de bon au bout de 30 jours.",
      },
    ],
  },
  {
    id: "liens",
    title: "Liens et partage",
    items: [
      {
        id: "un-lien-par-prospect",
        q: "Pourquoi un lien par prospect ?",
        a: "Pour savoir qui lit. Chaque lien devient un prospect, avec ses lectures, sa température et ses relances. Sur la page du document, « Un lien pour un autre prospect » (« Créer le lien » tant que le document n'en a aucun) en crée un de plus.",
      },
      {
        id: "lien-partage",
        q: "Puis-je envoyer un même lien à beaucoup de monde ?",
        a: "Oui, avec « Lien ouvert à tous » sur l'écran de partage : c'est un lien partagé, pratique pour une plaquette, un post LinkedIn ou une signature. Chaque lecteur donne son email et reçoit son propre lien, suivi comme un prospect ; ses relances attendent toujours votre feu vert.\n\nUn lien déjà lu ou attribué à un contact ne peut plus devenir partagé : créez-en un nouveau.",
      },
      {
        id: "envoyer",
        q: "Comment envoyer le lien ?",
        a: "Sur l'écran de partage : « Copier le lien » pour le coller dans votre email, ou « Envoyer par email ». Le champ « Pour qui ? » accepte un email (le contact est ajouté) ou un nom (le lien est juste nommé).\n\nEnvoyez le lien à la place de la pièce jointe, pas en plus.",
      },
      {
        id: "lien-envoye",
        q: "Comment Clozer sait-il que mon lien est parti ?",
        a: "Copier le lien ne suffit pas. Il compte comme envoyé quand vous l'envoyez depuis Gmail ou Outlook avec l'extension ou le complément Outlook (détecté tout seul), quand vous cliquez « C'est envoyé » sur la fiche du prospect, ou quand le prospect l'ouvre.\n\nTant qu'il n'est pas envoyé, Clozer ne relance personne : il reste dans « À envoyer » sur Aujourd'hui. Une fois envoyé et jamais ouvert, un rappel part à J+3, J+7 puis J+14.",
        link: { href: "/how-it-works#apres-envoi", label: "Après l'envoi : ce qui se passe" },
      },
      {
        id: "voir-comme-prospect",
        q: "Comment voir ce que verra le prospect ?",
        a: "« Voir ce que verra le prospect » sur l'écran de partage, ou l'Aperçu dans l'onglet Le document de la page du document.",
      },
      {
        id: "demander-email",
        q: "Comment savoir exactement qui lit ?",
        a: "Activez « Demander son email avant de lire » dans les réglages du lien (un lien « Pour un prospect » ne le demande pas par défaut : il a été fait pour une personne). Sans cela, les lecteurs anonymes sont désignés par une lettre : une même lettre = un même navigateur.\n\nUtile surtout quand le document circule en interne chez le prospect.",
      },
      {
        id: "expiration",
        q: "Comment fonctionne l'expiration d'un lien ?",
        a: "Sur la fiche du prospect, « Réglages du lien » → Expiration : Aucune, 48 h, 7, 15 ou 30 jours, ou une date précise. Pour un devis ou une proposition, le prospect voit un décompte. Après l'échéance, le lien ne s'ouvre plus.\n\nLe réglage par défaut se fait dans Réglages → Réglages avancés → Vos liens (7, 15, 30 jours ou jamais).",
      },
      {
        id: "prolonger",
        q: "Comment prolonger ou rouvrir un lien expiré ?",
        a: "Fiche du prospect → « Réglages du lien » → Expiration : +3 j, +7 j, +14 j ou « Autre date ». Le prospect d'un lien expiré peut aussi cliquer « Demander une prolongation » : vous êtes prévenu. Un lien expiré doit être prolongé avant toute relance.",
      },
      {
        id: "reglages-lien",
        q: "Que puis-je régler lien par lien ?",
        a: "Fiche du prospect → Réglages du lien (chaque changement est enregistré tout de suite) : nom du lien, « Demander son email avant de lire », « Valider ou demander un ajustement », « Prendre rendez-vous », « Poser ses questions à l'assistant », « Laisser un vocal sur une page », « Relances préparées par Clozer » et le lien de l'agenda.\n\nPropriétaires et admins : « Garder ces réglages pour mes prochains liens ».",
      },
      {
        id: "archiver-lien",
        q: "Comment désactiver un lien ?",
        a: "Fiche du prospect → « Archiver le lien » : le prospect ne peut plus ouvrir le document et les relances prévues sont annulées.",
      },
    ],
  },
  {
    id: "lecture",
    title: "Suivi de lecture",
    items: [
      {
        id: "ce-que-je-vois",
        q: "Qu'est-ce que je vois des lectures ?",
        a: "Pour un PDF, page par page : le temps passé, quand, sur quel appareil, et si d'autres personnes l'ouvrent. Si vous êtes sur Clozer au même moment, vous le voyez lire en direct (« En train de lire »).\n\nPour un lien web, l'ouverture et le temps passé sur la page.",
      },
      {
        id: "temperature",
        q: "Que veut dire la température ?",
        a: "Une note sur 100 (Chaud, Tiède, Froid) qui dit combien il lit. Elle est calculée sans IA : lecture récente, temps passé, visites répétées, plusieurs lecteurs, tarifs lus, lecture jusqu'au bout, demandes, rendez-vous. Sur la fiche, le repli « Pourquoi cette température » détaille chaque point.",
      },
      {
        id: "temperature-vs-ia",
        q: "Pourquoi un prospect chaud a une lecture IA prudente ?",
        a: "Ce sont deux questions différentes. La température dit combien il lit ; la lecture IA dit ce que ça veut dire. Beaucoup de lectures courtes, ou trop tôt pour conclure : chaud, mais prudent. La lecture IA mène la fiche ; la température reste en pastille, avec son détail dans « Pourquoi cette température ». « Sûre à N % » (dans « Détails de l'analyse ») est faible quand il y a peu de signaux.",
      },
      {
        id: "lu-en-profondeur",
        q: "Que veut dire « lu attentivement » ?",
        a: "La moitié du PDF avec au moins 30 secondes de lecture, une minute sur un lien web, ou une longue lecture des tarifs. C'est une étape de l'entonnoir « Vos envois » sur Aujourd'hui.",
      },
      {
        id: "plusieurs-lecteurs",
        q: "Comment savoir si plusieurs personnes lisent ?",
        a: "Bloc « Prospect » de la fiche : chaque contact avec ce qu'il a lu, puis « Autres lecteurs », regroupés par société ou réseau, avec leur rôle (Décideur, Finance / achats, Technique…), deviné depuis l'email ou choisi par vous. Deux lettres différentes = souvent deux personnes.",
      },
      {
        id: "pas-de-lecture",
        q: "Mon prospect dit avoir lu, mais Clozer ne montre rien. Pourquoi ?",
        a: "Vérifiez qu'il a bien ouvert le lien Clozer et pas une pièce jointe envoyée en plus. Les aperçus automatiques et les robots ne comptent pas, et vos propres ouvertures en étant connecté non plus. Si le problème persiste, signalez-le via l'assistant d'aide.",
      },
    ],
  },
  {
    id: "deals",
    title: "Prospects et analyse",
    items: [
      {
        id: "aujourdhui",
        q: "À quoi sert la page Aujourd'hui ?",
        a: "C'est votre cockpit : un résumé de la journée, qui lit en ce moment, « À traiter » (vos prospects du plus urgent au moins urgent, avec l'action conseillée), l'entonnoir de vos envois, les relances à valider, ce qui s'est passé et les relances à venir.",
        link: { href: "/dashboard", label: "Aujourd'hui" },
      },
      {
        id: "lecture-ia",
        q: "Que fait l'analyse IA d'un prospect ?",
        a: "Quelques minutes après une lecture, Clozer reconstitue l'histoire de la vente en faits datés et une IA l'interprète : « Ce qui compte », « Ce qui coince » (prix, décideur, timing…) et l'action conseillée. Chaque conclusion cite ses faits ; ce qui n'est pas prouvé est écarté.",
      },
      {
        id: "actions-conseillees",
        q: "Quelles actions Clozer peut-il conseiller ?",
        a: "Relancer par écrit, Appeler, Répondre à sa demande, Faire entrer le décideur dans la boucle, Attendre, Classer comme perdu.",
      },
      {
        id: "reanalyser",
        q: "Comment relancer l'analyse d'un prospect ?",
        a: "Fiche du prospect → « Réanalyser » (au plus toutes les deux minutes), ou « Analyser ce prospect » s'il n'y en a pas encore. Une analyse n'est refaite automatiquement que s'il s'est passé quelque chose de nouveau.",
      },
      {
        id: "statuts",
        q: "Quels sont les statuts d'un prospect ?",
        a: "En cours, Validé, Ajustement demandé, Gagné, Perdu. Changez-le avec le sélecteur « Statut du prospect » en haut de la fiche. Tout statut autre que En cours annule les relances en attente.",
      },
      {
        id: "gagne",
        q: "Le prospect a validé, que dois-je faire ?",
        a: "Un bandeau apparaît sur la fiche : cliquez « Marquer gagné » pour confirmer la vente et arrêter les relances. Marquez Gagné ou Perdu dès que c'est tranché.",
      },
      {
        id: "noter-echange",
        q: "J'ai eu le prospect au téléphone, je le note où ?",
        a: "Fiche du prospect → Noter un échange : Appel, Réponse reçue, Rendez-vous ou Note, avec « Ce qui s'est dit » et « Quand » (vide = maintenant). Clozer en tient compte et ne relance pas juste après.",
      },
      {
        id: "infos-deal",
        q: "Où renseigner le montant, l'échéance ou le décideur ?",
        a: "Fiche du prospect → « Contexte commercial » (replié, colonne de droite) : montant, devise, décision attendue avant le, décideur, son rôle et vos notes. Votre équipe le voit, pas le prospect. Les notes servent à l'analyse, jamais à la rédaction d'un message.",
      },
      {
        id: "pause-deal",
        q: "Le prospect m'a dit de revenir vers lui plus tard. Comment mettre en pause ?",
        a: "Fiche du prospect → « Mettre en pause jusqu'au » : Clozer se tait jusqu'à cette date. « Reprendre » pour annuler.",
      },
      {
        id: "contacts",
        q: "Comment ajouter ou modifier un contact ?",
        a: "Fiche du prospect → Contacts (ce sont eux qui reçoivent les relances) : modifier un contact (email, nom, entreprise, mobile, accord WhatsApp) ou « Ajouter un contact ».",
      },
      {
        id: "deal-collegue",
        q: "Puis-je modifier le prospect d'un collègue ?",
        a: "Vous pouvez le consulter, mais seuls son commercial, les admins et les propriétaires peuvent le modifier.",
      },
    ],
  },
  {
    id: "relances",
    title: "Relances et pilote automatique",
    items: [
      {
        id: "relances-seules",
        q: "Les relances partent-elles toutes seules ?",
        a: "Pas par défaut. En mode « Je la relis et je valide » (copilote), chaque relance vous attend : vous recevez un email et elle apparaît dans « Relances à valider » et sur la fiche.\n\nEn mode « Elle part seule quand Clozer est sûr de lui », seules les relances sûres partent seules ; les cas délicats (objection, message du prospect, doute) attendent votre accord.",
        link: { href: "/settings#pilote", label: "Réglages → Pilote automatique" },
      },
      {
        id: "copilote-ou-auto",
        q: "Copilote ou pilote automatique, je choisis quoi ?",
        a: "Commencez en « Je la relis et je valide ». Passez en automatique une fois en confiance avec les brouillons. En automatique, un second contrôle par IA passe avant tout envoi et un récapitulatif arrive chaque matin. Le mode se règle pour tout l'espace, par les propriétaires et admins.",
      },
      {
        id: "quand",
        q: "Quand partent les relances ?",
        a: "Jamais juste après une lecture, toujours aux heures de bureau du prospect, 3 relances par mois et par contact au maximum, espacées, et rien juste après un échange que vous avez noté.",
      },
      {
        id: "allusion-lecture",
        q: "Le prospect va-t-il deviner que je vois ce qu'il lit ?",
        a: "Non. Les relances ne citent jamais une page ni un temps de lecture, et un contrôle bloque toute phrase qui le laisserait deviner. Elles n'utilisent jamais un chiffre ou une date absents du document.",
      },
      {
        id: "modifier-relance",
        q: "Comment modifier une relance avant envoi ?",
        a: "Sur la relance : modifiez l'objet et le message puis « Enregistrer », ou « Réécrire » avec Plus court, Plus direct, Proposer un appel, Autre angle, ou une consigne libre. Puis « Valider » (elle part à l'heure prévue, heure du prospect) ou « Envoyer maintenant ».",
      },
      {
        id: "envoyer-moi-meme",
        q: "Puis-je envoyer la relance depuis ma propre messagerie ?",
        a: "Oui : « Copier » ou « Ouvrir dans ma messagerie », envoyez-la, puis cliquez « Je l'ai envoyée moi-même » pour que Clozer le sache.",
      },
      {
        id: "adresse-envoi",
        q: "Depuis quelle adresse partent les relances ?",
        a: "Depuis l'adresse de Clozer, avec votre email en adresse de réponse : les réponses du prospect arrivent dans votre boîte. Un lien de désinscription est ajouté à chaque envoi.",
      },
      {
        id: "reponses",
        q: "Clozer voit-il les réponses de mes prospects ?",
        a: "Oui, dans deux cas. Quand le prospect répond à une relance envoyée par Clozer : la réponse arrive dans votre boîte comme d'habitude, et Clozer en reçoit une copie. Et dans Gmail avec l'extension, quand un fil qui contient votre lien Clozer reçoit une réponse du prospect.\n\nLa réponse s'affiche sur la fiche, les relances automatiques s'arrêtent et vous êtes prévenu. « Reprendre les relances » sur la fiche pour les relancer.\n\nUne réponse que Clozer ne peut pas voir (Outlook, téléphone) : notez-la sur la fiche (Noter un échange → Réponse reçue).",
      },
      {
        id: "arreter",
        q: "Comment arrêter les relances ?",
        a: "Pour tout l'espace : « Tout valider moi-même » sur Aujourd'hui, ou repasser en « Je la relis et je valide ».\n\nPour un prospect : l'interrupteur « Relances » (onglet Prospects du document), « Relances préparées par Clozer » dans les réglages du lien, « Mettre en pause jusqu'au », ou un statut autre que En cours.\n\nPour les nouveaux liens : Réglages → Réglages avancés → Vos liens → « Préparer les relances ».",
      },
      {
        id: "ton-signature",
        q: "Comment faire pour que les relances me ressemblent ?",
        a: "Réglages → Réglages avancés → Vos messages : « Signé par », le ton (par exemple « direct, vouvoiement, sans jargon ») et votre signature. Remplissez aussi Votre offre : Clozer s'en sert pour écrire.",
        link: { href: "/settings#messages", label: "Réglages → Réglages avancés → Vos messages" },
      },
      {
        id: "whatsapp",
        q: "Peut-on relancer par WhatsApp ?",
        a: "Pas encore : les relances WhatsApp arrivent bientôt. Vous pouvez déjà noter l'accord WhatsApp d'un contact sur la fiche.",
      },
    ],
  },
  {
    id: "assistant",
    title: "Assistant prospect",
    items: [
      {
        id: "assistant-quoi",
        q: "Qu'est-ce que l'assistant prospect ?",
        a: "Sur votre document, il répond aux questions du prospect quand vous n'êtes pas là. Il s'appuie sur le document, votre offre, les « Infos pour l'assistant » du document et « Ce que l'assistant doit savoir » (Réglages → Réglages avancés → Assistant prospect). Il n'invente jamais un prix ou une condition.",
      },
      {
        id: "assistant-ne-sait-pas",
        q: "Que se passe-t-il quand il ne sait pas répondre ?",
        a: "Il vous transmet la question aussitôt : alerte « Question du prospect », question marquée sur la fiche et reprise dans le compte rendu du matin.",
      },
      {
        id: "assistant-nourrir",
        q: "Comment le rendre plus utile ?",
        a: "Ajoutez vos modalités, garanties et questions fréquentes dans Réglages → Réglages avancés → Assistant prospect (pour tous les documents) ou dans « Infos pour l'assistant » sur la page d'un document. Puis lisez les questions posées : elles révèlent les objections.\n\nAttention : tout ce que vous écrivez pour l'assistant peut être obtenu par le prospect. Rien de confidentiel.",
        link: { href: "/settings#assistant", label: "Réglages → Réglages avancés → Assistant prospect" },
      },
      {
        id: "assistant-activer",
        q: "Comment l'activer ou le désactiver ?",
        a: "« Activer l'assistant sur les nouveaux liens » dans Réglages, puis lien par lien avec « Poser ses questions à l'assistant » dans les réglages du lien.",
      },
      {
        id: "assistant-conversations",
        q: "Où voir les questions posées par le prospect ?",
        a: "Sur la fiche du prospect, rubrique « Questions du prospect ». Vos propres tests sur votre lien ne sont pas comptés.",
      },
    ],
  },
  {
    id: "accueil",
    title: "Mot d'accueil et vocaux",
    items: [
      {
        id: "mot-accueil",
        q: "Comment ajouter un mot d'accueil vidéo ?",
        a: "Page du document → onglet Le document → Mot d'accueil : une vidéo ou un audio seul, jusqu'à 90 secondes, avec une phrase d'accroche facultative. Le prospect voit votre bulle dès l'ouverture, sur toutes les pages et sur tous les liens de ce document.",
      },
      {
        id: "mot-accueil-perso",
        q: "Puis-je personnaliser le mot d'accueil pour un prospect ?",
        a: "Oui : fiche du prospect → Mot d'accueil → « Version perso pour ce prospect ». Elle remplace celle du document pour ce prospect.",
      },
      {
        id: "vocaux",
        q: "Le prospect peut-il me laisser un message vocal ?",
        a: "Oui, sur une page d'un PDF (60 secondes maximum). Vous recevez l'audio et sa transcription, sur la fiche (Commentaires vocaux) et par une alerte. À activer dans Réglages → Réglages avancés → Vos liens, ou lien par lien avec « Laisser un vocal sur une page ».",
      },
      {
        id: "capsules",
        q: "Qu'est-ce que les capsules par page ?",
        a: "Ce sont d'anciennes explications enregistrées page par page. Celles qui existent sont toujours jouées sur leur page ; pour un nouveau message, utilisez le mot d'accueil.",
      },
    ],
  },
  {
    id: "outils",
    title: "Extension Chrome et Outlook",
    items: [
      {
        id: "outil-pourquoi",
        q: "À quoi servent l'extension et le complément Outlook ?",
        a: "Vous joignez un PDF dans Gmail ou Outlook comme d'habitude : Clozer le remplace par un lien suivi, avec le premier destinataire comme prospect. Le bouton « C » dans l'email permet aussi de choisir un document existant.",
        link: { href: "/settings#extension", label: "Réglages → Chrome et Outlook" },
      },
      {
        id: "chrome",
        q: "Comment installer l'extension Chrome ?",
        a: "Elle fonctionne avec Gmail et Outlook dans le navigateur, sur Chrome ou Edge. Installez-la, épinglez-la (icône puzzle), cliquez sur Clozer puis « Connecter » ; sur la page qui s'ouvre, connectez-vous si besoin et cliquez « Connecter l'extension ».",
      },
      {
        id: "outlook",
        q: "Comment installer le complément Outlook (Windows ou Mac) ?",
        a: "Téléchargez le fichier manifeste (lien dans Réglages → Chrome et Outlook ou dans la prise en main), puis dans Outlook : Compléments → Mes compléments → Ajouter à partir d'un fichier. Dans un nouvel email, cliquez « Clozer » dans le ruban : un code s'affiche ; saisissez-le sur la page « Connecter Outlook ».\n\nVotre service informatique peut aussi le déployer pour toute l'équipe depuis le centre d'administration Microsoft 365.",
      },
      {
        id: "autre-messagerie",
        q: "J'utilise une autre messagerie, comment faire ?",
        a: "Déposez le PDF dans Clozer, puis copiez le lien ou utilisez « Envoyer par email ».",
      },
      {
        id: "drive",
        q: "Mes pièces jointes Drive ou OneDrive sont-elles prises en charge ?",
        a: "Pas encore, ni les pièces jointes transférées. Utilisez le bouton « C » dans l'email ou déposez le PDF dans Clozer.",
      },
      {
        id: "deconnecter-outil",
        q: "Comment déconnecter l'extension ou Outlook ?",
        a: "Réglages → Chrome et Outlook : une carte Chrome, une carte Outlook, chacune avec ses connexions et un bouton « Révoquer » (une confirmation est demandée).",
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    items: [
      {
        id: "etre-prevenu",
        q: "Comment choisir quand je suis prévenu ?",
        a: "Réglages → Être prévenu. Ces réglages ne concernent que vous :\n- un email dès qu'un prospect valide, demande un ajustement ou prend rendez-vous ;\n- « Quand c'est le moment d'appeler » : notification de l'extension Chrome et, si vous voulez, un email aussi ;\n- un compte rendu chaque matin, à l'heure de votre choix entre 6 h et 10 h.",
        link: { href: "/settings#alertes", label: "Réglages → Être prévenu" },
      },
      {
        id: "moment-appeler",
        q: "Qu'est-ce que l'alerte « moment d'appeler » ?",
        a: "Clozer vous prévient à la première ouverture, au retour après un silence, lors d'une longue lecture des tarifs ou d'une lecture à plusieurs. Jamais le soir ni le week-end, 4 par heure au plus. Appelez à ce moment-là : c'est pendant ou juste après la lecture que ça compte.",
      },
      {
        id: "compte-rendu",
        q: "Que contient le compte rendu du matin ?",
        a: "Qui recontacter aujourd'hui et pourquoi, puis les réponses et lectures de la veille. Du lundi au vendredi, et rien s'il n'y a rien à dire.",
      },
      {
        id: "soir-weekend",
        q: "Vais-je recevoir des alertes le soir ou le week-end ?",
        a: "Seulement pour ce qui demande une action : validation, demande d'ajustement, rendez-vous, question à l'assistant, vocal, demande de prolongation. Les alertes « moment d'appeler » ne partent jamais le soir ni le week-end.",
      },
      {
        id: "slack",
        q: "Comment être prévenu sur Slack ou dans mon CRM ?",
        a: "Réglages → Être prévenu, partie équipe (propriétaires et admins) : « Brancher Slack ou un outil externe » avec l'adresse du webhook Slack, ou un webhook (CRM, Zapier, Make…) signé HMAC SHA-256, en-tête X-Closing-Signature. Puis choisissez de prévenir toute l'équipe sur Slack et/ou l'outil externe.",
      },
      {
        id: "agenda",
        q: "Comment proposer un rendez-vous au prospect ?",
        a: "Réglages → Votre agenda : collez votre lien de prise de rendez-vous. Calendly et Cal.com s'affichent dans la page du prospect (nom et email pré-remplis) ; les autres (HubSpot, Google Agenda…) s'ouvrent dans un onglet. Sans lien, pas de bouton « Prendre rendez-vous ». Un lien différent peut être mis lien par lien.",
        link: { href: "/settings#agenda", label: "Réglages → Votre agenda" },
      },
    ],
  },
  {
    id: "equipe",
    title: "Équipe et rôles",
    items: [
      {
        id: "roles",
        q: "Quels sont les rôles et que peut faire chacun ?",
        a: "- Membre : voit ses propres prospects sur Aujourd'hui, consulte ceux des collègues sans les modifier, règle ses notifications et son agenda.\n- Admin : voit toute l'équipe sur la page Équipe, règle l'espace, modifie tous les prospects, supprime les documents, invite et retire des membres.\n- Propriétaire : comme un admin, plus les liens sans commercial attitré, la possibilité de nommer un autre propriétaire et de supprimer l'espace.",
      },
      {
        id: "inviter",
        q: "Comment inviter un collègue ?",
        a: "Réglages → Réglages avancés → Équipe (ou « Inviter un commercial » sur la page Équipe) : email + rôle (Membre ou Admin), puis « Inviter ». Réservé aux propriétaires et admins.",
        link: { href: "/settings#equipe", label: "Réglages → Réglages avancés → Équipe" },
      },
      {
        id: "role-retirer",
        q: "Comment changer un rôle ou retirer quelqu'un ?",
        a: "Réglages → Réglages avancés → Équipe : changez le rôle, « Retirer » un membre ou annulez une invitation en attente.",
      },
      {
        id: "vue-equipe",
        q: "Comment lire la vue équipe ?",
        a: "Page Équipe (propriétaires et admins), visible dès qu'un deuxième membre a rejoint l'espace : les chiffres En cours, Ça avance, Ça glisse, À classer et Pipeline, un tableau « Par commercial » (cliquez pour filtrer) et trois colonnes : Ça avance (à suivre de près), Ça glisse (en train de refroidir), À classer (à relancer une dernière fois ou à classer). La température (Chaud, Tiède, Froid) reste celle d'Aujourd'hui.",
      },
      {
        id: "reglages-grises",
        q: "Pourquoi certains réglages sont grisés ?",
        a: "Les réglages de l'espace sont réservés aux propriétaires et admins (« Réglé par un administrateur de l'espace »). Un membre règle seulement ses notifications et son agenda.",
      },
    ],
  },
  {
    id: "donnees",
    title: "Données et confidentialité",
    items: [
      {
        id: "prospect-informe",
        q: "Le prospect sait-il que sa lecture est suivie ?",
        a: "Oui. Une mention claire figure sur la page du document, avec un lien vers la politique de confidentialité. Les relances, elles, ne citent jamais une page ni un temps de lecture.",
      },
      {
        id: "ia-donnees",
        q: "Quelles données sont envoyées à l'IA ?",
        a: "Le contenu des documents et les faits de lecture. Aucune adresse email ni adresse IP : les lecteurs sont désignés par une lettre (lecteur A, lecteur B…).",
      },
      {
        id: "conservation",
        q: "Combien de temps les données sont-elles gardées ?",
        a: "Le suivi de lecture est effacé 12 mois après la dernière activité d'un lien. Un document supprimé est effacé pour de bon au bout de 30 jours.",
      },
      {
        id: "demande-prospect",
        q: "Un prospect demande ses données ou leur suppression. Que faire ?",
        a: "Réglages → Données (propriétaires et admins) : cherchez son email, puis « Exporter » ou « Tout supprimer » (lectures, messages, vocaux, relances). Les validations signées restent 5 ans comme preuve de l'accord. Répondez sous un mois.",
        link: { href: "/settings#donnees", label: "Réglages → Données" },
      },
      {
        id: "exporter",
        q: "Puis-je exporter les données de mon espace ?",
        a: "Oui : « Exporter l'espace » dans Réglages → Données (propriétaires et admins) : liens, prospects, lectures et messages en JSON.",
      },
      {
        id: "supprimer-compte",
        q: "Comment supprimer mon compte ou l'espace ?",
        a: "Réglages → Données :\n- « Supprimer mon compte » (tapez SUPPRIMER) : vos prospects restent dans l'espace, votre accès disparaît ;\n- « Supprimer l'espace » (propriétaire, tapez le nom de l'espace) : tout est effacé, fichiers compris, pour toute l'équipe. C'est irréversible : exportez d'abord.",
      },
    ],
  },
  {
    id: "reglages",
    title: "Réglages et offre",
    items: [
      {
        id: "votre-offre",
        q: "À quoi sert « Votre offre » ?",
        a: "Ce que vous vendez, vos clients, pourquoi ils vous choisissent, les objections fréquentes et la durée habituelle d'une vente. Clozer s'en sert pour analyser et rédiger. C'est facultatif : Clozer la pré-remplit à la lecture du premier document. Pensez à « Enregistrer les réglages ».",
        link: { href: "/settings#offre", label: "Réglages → Réglages avancés → Votre offre" },
      },
      {
        id: "vos-liens",
        q: "Comment changer les réglages par défaut des nouveaux liens ?",
        a: "Réglages → Réglages avancés → Vos liens : expiration des devis et propositions, vocaux, préparer les relances. Chaque lien reste modifiable ensuite.",
        link: { href: "/settings#liens", label: "Réglages → Réglages avancés → Vos liens" },
      },
      {
        id: "theme",
        q: "Comment passer en mode sombre ?",
        a: "Menu du compte (votre avatar en haut à droite) : choix du thème.",
      },
      {
        id: "prix",
        q: "Combien coûte Clozer ?",
        a: "Clozer est gratuit pendant la bêta.",
      },
    ],
  },
  {
    id: "aide",
    title: "Aide et suggestions",
    items: [
      {
        id: "assistant-aide",
        q: "Comment poser une question qui n'est pas ici ?",
        a: "Ouvrez l'assistant d'aide : bouton « ? » en haut à droite → « Poser une question », ou Cmd+K. Il répond tout de suite et, si besoin, transmet votre question à l'équipe.",
      },
      {
        id: "suggestion",
        q: "Comment proposer une idée ou signaler un bug ?",
        a: "Écrivez-le à l'assistant d'aide. Il vous demande votre accord puis transmet à l'équipe Clozer, qui lit tout et peut vous répondre par email.",
      },
    ],
  },
];

/** The FAQ in the user's language. Section and question ids are the same in both. */
export function getFaq(locale: UiLocale): FaqSection[] {
  return locale === "en" ? FAQ_EN : FAQ;
}

/** Pure: the FAQ as plain text, for the help assistant. */
export function faqAsText(sections: FaqSection[] = FAQ, locale: UiLocale = "fr") {
  const answer = locale === "en" ? "A" : "R";
  return sections
    .map(
      (section) =>
        `## ${section.title}\n` + section.items.map((item) => `Q: ${item.q}\n${answer}: ${item.a}`).join("\n\n"),
    )
    .join("\n\n");
}

/** The FAQ as plain text in the user's language, for the help assistant. */
export function getFaqText(locale: UiLocale) {
  return faqAsText(getFaq(locale), locale);
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Pure: sections keeping only the questions whose text holds every word of the query. */
export function searchFaq(query: string, sections: FaqSection[] = FAQ): FaqSection[] {
  const words = fold(query).split(/\s+/).filter((word) => word.length > 1);
  if (!words.length) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const text = fold(`${section.title} ${item.q} ${item.a}`);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.items.length > 0);
}
