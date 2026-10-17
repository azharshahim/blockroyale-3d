# BlockRoyale 3D HD

Jeu web 3D original inspiré des genres **sandbox voxel** et **battle royale**.
Fonctionne sur **iOS, Android et ordinateur** directement dans le navigateur (Three.js / WebGL).

## 🎮 Les deux modes

| Mode | Contenu |
| --- | --- |
| ⛏️ **Monde voxel 3D** | Île générée, reliefs, plages, eau, arbres, minerais (diamant, or), herbe, ciel dégradé, ombres. Minage et construction de blocs, caméra 1re/3e personne, jour / crépuscule / nuit. |
| 🔫 **Battle Royale 3D** | 20 combattants 3D articulés, caméra épaule, tir, coffres à butin, murs et rampes à construire, dôme de tempête qui rétrécit, radar. |

## 🕹️ Contrôles

- **Ordinateur** : clic pour verrouiller la souris, ZQSD/WASD pour bouger, Maj pour sprinter, Espace pour sauter.
  - Monde : clic gauche miner, clic droit poser, 1-9 choisir un bloc, molette zoom, V changer de vue.
  - Battle Royale : clic gauche tirer, F mur, R rampe, molette zoom.
- **Mobile** : joystick virtuel + boutons tactiles, glisser l'écran pour tourner la caméra.

## 🚀 Développement

```bash
npm install
npm run dev
npm run build
```

Le build produit un fichier unique `dist/index.html`.

## 🌐 Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` publie automatiquement le jeu à chaque `push` sur `main`.
Dans **Settings → Pages**, la source doit être **GitHub Actions**.

Jeu original, non affilié à Mojang ou Epic Games.
