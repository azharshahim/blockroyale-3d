import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function ShareModal({
  open,
  onClose,
  publicUrl,
  initialTab = 'link',
}: {
  open: boolean;
  onClose: () => void;
  publicUrl?: string;
  initialTab?: 'link' | 'github';
}) {
  const [tab, setTab] = useState<'link' | 'github'>(initialTab);
  const [detectedUrl, setDetectedUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // GitHub 1-Click Deployment State
  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('blockroyale-3d');
  const [ghStatus, setGhStatus] = useState<'idle' | 'deploying' | 'done' | 'error'>('idle');
  const [ghMessage, setGhMessage] = useState('');
  const [ghPagesUrl, setGhPagesUrl] = useState('');
  const [ghRepoUrl, setGhRepoUrl] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    const href = typeof window !== 'undefined' ? window.location.href : '';
    const ref = typeof document !== 'undefined' ? document.referrer : '';
    let best = publicUrl || '';
    if (!best) {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        best = href;
      } else if (ref.startsWith('http://') || ref.startsWith('https://')) {
        best = ref;
      } else {
        best = href || 'https://blockroyale.app';
      }
    }
    setDetectedUrl(best);
    setCustomUrl(best);
  }, [publicUrl, open]);

  useEffect(() => {
    const target = ghPagesUrl || customUrl;
    if (!target) return;
    QRCode.toDataURL(target, {
      width: 220,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [customUrl, ghPagesUrl]);

  if (!open) return null;

  const copyLink = async (textToCopy = customUrl) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const inp = document.createElement('input');
      inp.value = textToCopy;
      document.body.appendChild(inp);
      inp.select();
      document.execCommand('copy');
      document.body.removeChild(inp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const downloadStandaloneHtml = () => {
    const htmlContent = '<!doctype html>\n' + document.documentElement.outerHTML;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deployToGitHubPages = async () => {
    const token = ghToken.trim();
    const repoName = ghRepo.trim() || 'blockroyale-3d';
    if (!token) {
      setGhStatus('error');
      setGhMessage('Entre un Personal Access Token GitHub (avec permission repo / public_repo).');
      return;
    }

    try {
      setGhStatus('deploying');
      setGhMessage('1/4 Authentification sur GitHub...');

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      };

      const userRes = await fetch('https://api.github.com/user', { headers });
      if (!userRes.ok) {
        throw new Error('Token GitHub invalide ou expiré.');
      }
      const userData = await userRes.json();
      const owner = userData.login;

      setGhMessage(`2/4 Création / vérification du dépôt ${owner}/${repoName}...`);
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description: 'BlockRoyale 3D HD - Sandbox Voxel & Battle Royale 3D (Web / iOS / Android)',
          homepage: `https://${owner}.github.io/${repoName}/`,
          private: false,
          auto_init: true,
        }),
      });

      if (!createRes.ok && createRes.status !== 422) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.message || 'Impossible de créer le dépôt GitHub.');
      }

      setGhMessage('3/4 Envoi du jeu 3D HD compilé (index.html) sur la branche main...');
      const htmlContent = '<!doctype html>\n' + document.documentElement.outerHTML;
      const base64Content = btoa(unescape(encodeURIComponent(htmlContent)));

      // Check if index.html already exists to get sha
      let existingSha: string | undefined;
      const checkFile = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
        { headers }
      );
      if (checkFile.ok) {
        const fileData = await checkFile.json();
        existingSha = fileData.sha;
      }

      const putRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: 'Deploy BlockRoyale 3D HD standalone web app',
            content: base64Content,
            ...(existingSha ? { sha: existingSha } : {}),
          }),
        }
      );

      if (!putRes.ok) {
        throw new Error('Erreur lors de l’envoi de index.html sur le dépôt.');
      }

      setGhMessage('4/4 Activation de GitHub Pages...');
      await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source: { branch: 'main', path: '/' },
        }),
      }).catch(() => {});

      const finalPagesUrl = `https://${owner}.github.io/${repoName}/`;
      const finalRepoUrl = `https://github.com/${owner}/${repoName}`;
      setGhPagesUrl(finalPagesUrl);
      setGhRepoUrl(finalRepoUrl);
      setCustomUrl(finalPagesUrl);
      setGhStatus('done');
      setGhMessage('Déploiement GitHub terminé ! GitHub Pages sera actif d’ici ~30 à 60 secondes.');
    } catch (e: unknown) {
      setGhStatus('error');
      setGhMessage(e instanceof Error ? e.message : 'Erreur inconnue');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-900 p-6 text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold hover:bg-white/20"
          aria-label="Fermer"
        >
          ✕
        </button>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-4 pr-10">
          <button
            onClick={() => setTab('link')}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              tab === 'link'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            🌐 Lien HTTP & QR Code Mobile
          </button>
          <button
            onClick={() => setTab('github')}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              tab === 'github'
                ? 'bg-emerald-500 text-black shadow-lg'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            🚀 Déploiement GitHub Pages
          </button>
        </div>

        {tab === 'link' ? (
          <div className="mt-4">
            <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/50 p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300">
                Lien HTTP / HTTPS Direct (3D HD)
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="flex-1 rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 font-mono text-xs text-emerald-300 focus:border-indigo-400 focus:outline-none"
                />
                <button
                  onClick={() => copyLink(customUrl)}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-black transition hover:bg-emerald-400 active:scale-95"
                >
                  {copied ? '✓ Copié !' : '📋 Copier'}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={customUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-indigo-500"
                >
                  🌐 Ouvrir dans un nouvel onglet ↗
                </a>
                {detectedUrl !== customUrl && (
                  <button
                    onClick={() => setCustomUrl(detectedUrl)}
                    className="rounded-xl bg-white/10 px-3 py-2.5 text-xs font-bold text-white hover:bg-white/20"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center rounded-2xl bg-white/5 p-4 text-center sm:flex-row sm:text-left">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="h-36 w-36 rounded-2xl border-4 border-white bg-white p-1 shadow-lg"
                />
              )}
              <div className="mt-3 sm:ml-4 sm:mt-0">
                <h3 className="font-bold text-yellow-300">📱 Scanner sur iOS / Android</h3>
                <p className="mt-1 text-xs text-white/70">
                  Scanne ce QR Code avec ton téléphone pour ouvrir directement{' '}
                  <strong>BlockRoyale 3D HD</strong> avec contrôles tactiles.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">💾 Télécharger index.html (3D Autonome)</h3>
                  <p className="text-xs text-white/60">
                    Un seul fichier contenant tout le moteur 3D, prêt à héberger sur GitHub Pages ou jouer hors-ligne.
                  </p>
                </div>
                <button
                  onClick={downloadStandaloneHtml}
                  className="shrink-0 rounded-xl bg-amber-400 px-3.5 py-2.5 text-xs font-black text-black hover:bg-amber-300"
                >
                  ⬇ index.html
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4">
              <h3 className="text-sm font-black text-emerald-300">
                ⚡ Déploiement Automatique 1-Clic vers ton compte GitHub
              </h3>
              <p className="mt-1 text-xs text-white/70">
                Entre un jeton GitHub (Personal Access Token avec droit <code>public_repo</code>) :
                l&apos;application crée automatiquement le dépôt, envoie le build 3D HD et active{' '}
                <strong>GitHub Pages</strong>.
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-bold text-white/70">Nom du dépôt GitHub</label>
                  <input
                    type="text"
                    value={ghRepo}
                    onChange={(e) => setGhRepo(e.target.value)}
                    placeholder="blockroyale-3d"
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-white/70">
                    GitHub Personal Access Token
                  </label>
                  <input
                    type="password"
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                onClick={deployToGitHubPages}
                disabled={ghStatus === 'deploying'}
                className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-black shadow-lg transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {ghStatus === 'deploying'
                  ? '⏳ Déploiement en cours sur GitHub...'
                  : '🚀 Créer le dépôt & Publier sur GitHub Pages'}
              </button>

              {ghMessage && (
                <div
                  className={`mt-3 rounded-xl p-3 text-xs font-semibold ${
                    ghStatus === 'error'
                      ? 'bg-red-500/20 text-red-300'
                      : ghStatus === 'done'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-white/10 text-white'
                  }`}
                >
                  <div>{ghMessage}</div>
                  {ghPagesUrl && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={ghPagesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-black text-black"
                      >
                        🌐 Ouvrir GitHub Pages : {ghPagesUrl} ↗
                      </a>
                      <a
                        href={ghRepoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        📂 Voir le dépôt GitHub ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                🛠️ Déploiement Git Classique (Workflow .github/workflows/deploy.yml inclus)
              </h3>
              <p className="mt-1 text-xs text-white/65">
                Le dépôt Git local et le workflow GitHub Actions sont déjà configurés dans le projet :
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-black/60 p-3 font-mono text-[11px] text-emerald-300">
{`git remote add origin https://github.com/TON-PSEUDO/blockroyale-3d.git
git branch -M main
git push -u origin main`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
