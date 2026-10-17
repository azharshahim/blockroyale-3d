import { useEffect, useRef, useState } from 'react';
import Sandbox from './games/Sandbox';
import Battle from './games/Battle';
import LobbyPreview3D from './components/LobbyPreview3D';
import { SkinId } from './games/Character3D';

type Screen = 'menu' | 'sandbox' | 'battle';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [skinId, setSkinId] = useState<SkinId>('cyber');
  const [installOpen, setInstallOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [stale, setStale] = useState(false);
  const deferred = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    // Service worker -> jeu ouvrable hors connexion, mises à jour toujours fraîches
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker
        .register('sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          reg.update?.();
          // Si une nouvelle version est déjà prête, recharge une fois
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            nw?.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) setStale(true);
            });
          });
        })
        .catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as InstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      deferred.current = null;
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Chrome : l'app est-elle déjà enregistrée sur cet appareil ?
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    if (typeof nav.getInstalledRelatedApps === 'function') {
      nav
        .getInstalledRelatedApps()
        .then((apps) => {
          if (apps && apps.length > 0) setInstalled(true);
        })
        .catch(() => {});
    }
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'sandbox' || mode === 'minecraft') setScreen('sandbox');
    if (mode === 'battle' || mode === 'fortnite') setScreen('battle');

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const installApp = async () => {
    if (deferred.current) {
      const evt = deferred.current;
      deferred.current = null;
      try {
        await evt.prompt();
        const res = await evt.userChoice;
        if (res.outcome === 'accepted') setInstalled(true);
        setCanInstall(false);
        return;
      } catch {
        /* fallback vers le guide */
      }
    }
    setInstallOpen(true);
  };

  if (screen === 'sandbox') return <Sandbox onExit={() => setScreen('menu')} skinId={skinId} />;
  if (screen === 'battle') return <Battle onExit={() => setScreen('menu')} skinId={skinId} />;

  return (
    <div
      className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#312e81,_#090d16_65%)] px-4 py-6 text-white sm:px-6"
      style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}
    >
      <div className="mx-auto max-w-6xl pb-28">
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-yellow-300 sm:text-xs">
            ✨ 3D temps réel HD · iOS · Android · Web ✨
          </div>
          <h1 className="mt-2 bg-gradient-to-r from-cyan-300 via-yellow-300 to-pink-500 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
            BLOCKROYALE 3D HD
          </h1>
          <p className="mt-1.5 text-sm text-white/75 sm:text-base">
            Choisis ton personnage 3D dans le casier et lance le monde voxel ou l&apos;arène Battle Royale !
          </p>
        </header>

        <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <LobbyPreview3D skinId={skinId} onSelectSkin={setSkinId} />
          </div>

          <div className="flex flex-col justify-between gap-5 lg:col-span-7">
            <div className="group overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-950 p-5 shadow-2xl transition hover:border-emerald-400">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-black text-emerald-300">
                    ⛏️ VOXEL SANDBOX 3D · 1re & 3e PERSONNE
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Monde Craft & Exploration 3D</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/75 sm:text-sm">
                    Île en relief, plages, eau où l&apos;on nage, arbres, herbe, minerais de diamant et d&apos;or,
                    ombres HD et ciel Jour / Crépuscule / Nuit. Mine avec ta pioche et construis bloc par bloc.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setScreen('sandbox')}
                      className="rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 px-6 py-3 text-sm font-black text-black shadow-lg shadow-emerald-500/25 transition hover:scale-105 active:scale-95"
                    >
                      ▶ LANCER LE MONDE 3D
                    </button>
                    <span className="text-xs font-semibold text-white/50">✓ Joystick tactile · ✓ Souris verrouillée</span>
                  </div>
                </div>
                <div className="hidden h-28 w-28 shrink-0 flex-col items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-5xl sm:flex">
                  ⛏️<span className="mt-1 text-[10px] font-black text-emerald-300">VOXEL 3D</span>
                </div>
              </div>
            </div>

            <div className="group overflow-hidden rounded-3xl border-2 border-purple-500/40 bg-gradient-to-br from-indigo-950/90 via-purple-950/60 to-slate-950 p-5 shadow-2xl transition hover:border-purple-400">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/20 px-2.5 py-0.5 text-[11px] font-black text-purple-300">
                    🔫 TPS BATTLE ROYALE 3D · 20 COMBATTANTS
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Mode Battle Royale 3D</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/75 sm:text-sm">
                    Caméra épaule, 20 combattants 3D articulés, tir précis, coffres, murs et rampes à construire,
                    dôme de tempête qui rétrécit et radar temps réel.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setScreen('battle')}
                      className="rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 px-6 py-3 text-sm font-black text-black shadow-lg shadow-amber-500/25 transition hover:scale-105 active:scale-95"
                    >
                      ▶ LANCER BATTLE ROYALE 3D
                    </button>
                    <span className="text-xs font-semibold text-white/50">✓ Tir fiable · ✓ Visée assistée mobile</span>
                  </div>
                </div>
                <div className="hidden h-28 w-28 shrink-0 flex-col items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-5xl sm:flex">
                  👑<span className="mt-1 text-[10px] font-black text-purple-300">ROYALE 3D</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-4 text-xs sm:grid-cols-3 sm:text-sm">
          {[
            ['🕺', 'Personnages 3D dynamiques', 'Squelette articulé : visée, recul, sprint, saut, coup de pioche et danse de victoire.'],
            ['📱', 'Jouable partout', 'Joystick tactile et boutons sur iPhone / Android, souris verrouillée et clavier sur PC.'],
            ['📲', 'Application installable', 'Le jeu s&apos;installe sur ton écran d&apos;accueil et s&apos;ouvre sans navigateur.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-2xl">{icon}</div>
              <div className="mt-1 font-bold">{title}</div>
              <div className="mt-0.5 text-white/60">{desc}</div>
            </div>
          ))}
        </section>

        <p className="mt-6 text-center text-xs text-white/40">
          Jeu original inspiré des genres sandbox et battle royale. Non affilié à Mojang ou Epic Games.
        </p>
      </div>

      {stale && (
        <button
          onClick={() => window.location.reload()}
          className="fixed left-1/2 top-4 z-40 -translate-x-1/2 rounded-2xl border border-white/20 bg-blue-500 px-4 py-2 text-xs font-black text-white shadow-xl"
        >
          🔄 Nouvelle version disponible — Recharger
        </button>
      )}

      {/* Install shortcut */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-5" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2">
          <button
            onClick={installApp}
            className="rounded-2xl border border-white/20 bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-black text-black shadow-2xl active:scale-95"
          >
            {installed ? '✓ App installée — la retrouver' : canInstall ? '📲 Installer maintenant' : "📲 Installer l'app"}
          </button>
          <button
            onClick={() => setInstallOpen(true)}
            className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white shadow-xl backdrop-blur active:scale-95"
          >
            Aide
          </button>
        </div>
      </div>

      {installOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setInstallOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/15 bg-slate-900 p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setInstallOpen(false)} className="absolute right-4 top-4 h-9 w-9 rounded-full bg-white/10 font-bold">
              ✕
            </button>
            <h2 className="pr-10 text-xl font-black">📲 Installer BlockRoyale 3D</h2>
            <p className="mt-1 text-xs text-white/65">Le jeu s&apos;ouvre alors en plein écran, sans barre de navigation.</p>

            <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-950/40 p-4">
              <h3 className="font-black text-amber-300">⚠️ Chrome affiche « déjà installée » ?</h3>
              <p className="mt-1 text-xs text-white/75">
                Dans ce cas l&apos;application <strong>existe</strong> sur ton téléphone, mais l&apos;icône n&apos;a pas été
                posée (souvent écran d&apos;accueil plein, ou icônes automatiques désactivées). Fais ainsi :
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-white/85">
                <li>
                  Dans Chrome, menu <strong>⋮ → « Installer l&apos;application »</strong> puis tap
                  <strong> « Ouvrir »</strong> : l&apos;app s&apos;ouvre toute seule en plein écran.
                </li>
                <li>
                  Appuie <strong>longuement</strong> sur le vide de ton écran d&apos;accueil →
                  <strong> réglages du lanceur</strong> → active <strong>« Ajouter les icônes »</strong> (ou
                  « Apps ouvertes »).
                </li>
                <li>
                  Cherche <strong>« BlockRoyale »</strong> dans le tiroir d&apos;apps (liste de toutes les applications),
                  puis appuie longtemps → <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.
                </li>
                <li>
                  Si le message reste bloqué : chrome ⋮ → <strong>Paramètres → Données de sites → Icones Web/Apps</strong>
                  , retire BlockRoyale, puis réinstalle ici.
                </li>
              </ol>
            </div>

            <div className="mt-3 rounded-2xl border border-sky-400/30 bg-sky-950/40 p-4">
              <h3 className="font-black text-sky-300"> iPhone / iPad — Safari</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-white/80">
                <li>Ouvre le lien dans <strong>Safari</strong>.</li>
                <li>Bouton <strong>Partager ⤴</strong> en bas.</li>
                <li><strong>« Sur l&apos;écran d&apos;accueil »</strong> → <strong>Ajouter</strong>.</li>
              </ol>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/65">
              Android : garde une connexion à l&apos;installation. Ensuite le jeu s&apos;ouvre même hors connexion.
              Si l&apos;app s&apos;ouvre avec une barre d&apos;adresse, c&apos;est qu&apos;elle s&apos;est ouverte par
              erreur dans Chrome : relance-la depuis l&apos;icône.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
