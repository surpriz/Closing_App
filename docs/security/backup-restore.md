# Sauvegardes et restauration

## Ce qui est sauvegardé

| Donnée | Où | Sauvegarde |
|---|---|---|
| Base (tout sauf les fichiers) | Neon, branche de prod, `eu-central-1` | Historique continu, restauration à un instant donné (PITR). Durée selon le plan Neon : **à noter ici** |
| Fichiers (PDF, vidéos, audio) | Vercel Blob, CDG1 | Pas de versionnage. Un fichier supprimé est perdu |
| Code et migrations | GitHub | Dépôt Git |
| Variables d'environnement | Vercel | Pas de copie : garder les secrets dans un gestionnaire de mots de passe |

Les fichiers ne sont supprimés que volontairement : document supprimé + 30 jours, suppression de l'espace, ou
purge de rétention. Une restauration de la base ne ramène pas un fichier déjà effacé.

## Restaurer la base

Sans toucher à la prod d'abord :

1. Console Neon › projet › **Branches** › **Create branch**, source `main` (prod), option **Past data**, choisir
   l'heure juste avant l'incident.
2. Vérifier les données sur cette branche (SQL Editor ou `psql` avec son URL).
3. Si c'est bon : **Restore** de la branche de prod depuis cet instant (Neon garde une sauvegarde de l'état
   d'avant, restauration réversible).
4. Rien à changer côté Vercel : l'URL de connexion de la prod ne bouge pas.
5. Noter dans la note d'incident : heure choisie, durée, ce qui a été perdu entre-temps.

## Test de restauration

À faire une fois maintenant, puis tous les 6 mois. Créer une branche depuis la prod à H-1, vérifier qu'on y lit
les dernières lignes de `documents` et `links`, supprimer la branche.

| Date | Point restauré | Durée | Résultat | Par |
|---|---|---|---|---|
| à faire | | | | |
