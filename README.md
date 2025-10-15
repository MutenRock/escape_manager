Escape Game Manager – HTML/JS (Pré-alpha)

This patch upgrades the base game to a responsive, full-screen version with improved movement and waiting-room behavior (grid seating + chairs). It also preserves the shop/rooms loop from the previous iteration.

✨ Nouvelles fonctionnalités

Ouverture au centre du mur séparateur (haut/bas) pour laisser passer le joueur.

Contrôles ZQSD par défaut (flèches toujours disponibles).

Canvas plein écran : s’adapte à la taille de la fenêtre, tout le layout est recalculé (QG, salle d’attente, zone missions, murs, grille).

Salle d’attente en quadrillage :

Les groupes ne se superposent pas.

Chaque slot est matérialisé par une petite chaise (vectorielle via Path2D), avec états vide / réservé / occupé.

Un slot est réservé quand un groupe est en approche, puis occupé à l’arrivée. Il est libéré quand le joueur prend le groupe (E).

Si le joueur repose un groupe, il est replacé proprement dans un slot libre (sans chevauchement).

🕹️ Contrôles

Z / Q / S / D (par défaut) ou Flèches : déplacer le joueur

E :

près d’un groupe en salle d’attente → prendre le groupe

près d’une salle libre → assigner le groupe

sinon → si un slot libre existe → reposer le groupe dans la salle d’attente

H : dans le QG, aider toutes les salles demandant de l’aide (évite le -10 % de satisfaction)

M : ouvrir la boutique (pour tests)

1 / 2 / 3 : acheter une salle (quand la boutique est ouverte)

Échap : ignorer la boutique (passer au jour suivant)

📦 Fichiers & Rôles

index.html
Point d’entrée. Charge les scripts et affiche le canvas plein écran. Contient l’overlay de boutique (simplifié).

styles.css
Styles généraux, plein écran, overlays.

data.js
Listes Objets et Thèmes pour la génération des noms de salles.

utils.js
Utilitaires : couleurs, mapping classe par somme d’indices (règle utilisateur; 30..39 ⇒ B par hypothèse), fonctions géométriques, roundRect, etc.

game.js
Logique du jeu :

Responsive layout + recalcul dynamique (zones, murs, grille de missions, grille des slots d’attente).

Ouverture centrale dans le mur horizontal (calculée selon la taille d’écran).

Déplacements ZQSD (+ flèches), collisions avec murs.

Groupes qui arrivent du haut, réservent un slot, s’y posent, puis suivent le joueur et peuvent être assignés à une salle.

Salles : timers, baisse de satisfaction, demandes d’aide avec fenêtre de 30 s (sinon -10 %).

Boutique basique de fin de journée (3 salles aux classes déterminées par la règle « somme d’indices »).

HUD : jour, argent, salles, groupes attendus/app., servis.

⚙️ Notes Techniques

Plein écran : le canvas suit window.innerWidth/innerHeight; la matrice est compensée par le devicePixelRatio pour un rendu net.

Ouverture murale : le mur horizontal est coupé en 2 segments avec un gap central proportionnel à la largeur de l’écran (min 140 px).

Grid d’attente :

Taille de cellule = GROUP_SIZE_PX + 12.

Nombre de colonnes/lignes calculé depuis la taille de la salle d’attente.

Chaque slot : { x, y, w, h, occupiedBy, reserved }.

Réservation : un slot passe à reserved = true lorsqu’un groupe est spawné vers lui; à l’arrivée le slot devient occupiedBy = group et reserved = false.

Reflow : lors d’un redimensionnement, le layout est recomputé (zones, murs, grilles). Les entités sont re-clampées et les groupes en attente sont redispatchés sur les nouveaux slots.

🔧 Paramètres clés (dans game.js)

GROUP_SPEED = 140 (px/s)

GROUP_SPAWN_DELAY = 3 (s)

ROOM_BASE_TIME = 20 (s)

SAT_LOSS_PER_SEC = 2.0

HELP_CHANCE_PER_SEC = 0.06

Classe par somme (dans utils.js) :
<=9: S, 10..29: A, 40..79: B, 80..98: C, (30..39 ⇒ B par hypothèse)

▶️ Démarrage

Ouvrez index.html dans un navigateur moderne (Chrome, Edge, Firefox).
Aucune dépendance externe.