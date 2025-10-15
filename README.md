# Escape Game Manager – Pré-alpha (HTML/JS)

## Démarrage
Ouvrez `index.html` dans un navigateur moderne (Chrome, Edge, Firefox).

## Contrôles
- **Flèches / WASD** : déplacer le joueur
- **E** : prendre un groupe en salle d’attente / le poser dans une salle libre
- **H** : (dans le QG) aider toutes les salles qui demandent de l’aide
- **M** : ouvrir la boutique (forçage fin de journée pour les tests)
- **1/2/3** : acheter une salle (lorsque la boutique est ouverte)
- **T** : acheter une **table d’accueil** (lorsque la boutique est ouverte)
- **Échap** : ignorer l’achat (passer au jour suivant)

## Règles clés
- Les groupes arrivent par le haut de l’écran, se placent dans la salle d’attente.
- Prenez-les (E), amenez-les à une salle, reposez (E) pour lancer la mission.
- Satisfaction baisse avec le temps ; demandes d’aide aléatoires (⚠) :
  - Allez au QG et pressez **H** dans les 30s, sinon **-10%**.
- Paiement à la fin : **prix base classe × satisfaction %**.
- **Boutique** de fin de journée : 3 salles au choix (classes via somme d’indices Objets+Thèmes),
  + achat d’une **table d’accueil** (augmente la capacité de la file).
- **Loyer** : dû tous les 3 jours, montant augmente à chaque paiement. Si l’argent < 0 → Game Over.

## Classes de salles (par somme des indices 0..98)
- ≤9 : **S**
- 10..29 : **A**
- 40..79 : **B**
- 80..98 : **C**
- *(Assumption : 30..39 → **B**)*
