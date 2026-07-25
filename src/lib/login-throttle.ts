/**
 * Limitation des tentatives de connexion.
 *
 * L'application n'avait aucun frein : un mot de passe d'administrateur pouvait
 * être cherché par force brute aussi vite que le serveur répond. Le compteur
 * vit en mémoire du processus, ce qui suffit ici (un seul conteneur applicatif)
 * et se réinitialise au redémarrage.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type Entry = { failures: number; firstAt: number; blockedUntil: number };

const attempts = new Map<string, Entry>();

function prune(now: number) {
  if (attempts.size < 500) return;
  for (const [key, entry] of attempts) {
    if (now - entry.firstAt > WINDOW_MS && now > entry.blockedUntil) attempts.delete(key);
  }
}

/** true si la clé est actuellement bloquée. */
export function isLoginBlocked(key: string): boolean {
  const entry = attempts.get(key);
  return !!entry && Date.now() < entry.blockedUntil;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  prune(now);
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { failures: 1, firstAt: now, blockedUntil: 0 });
    return;
  }

  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    // Blocage progressif : chaque échec au-delà du seuil éloigne la prochaine
    // tentative, sans jamais verrouiller définitivement un compte légitime.
    const extra = entry.failures - MAX_FAILURES;
    entry.blockedUntil = now + Math.min(WINDOW_MS, 60_000 * 2 ** Math.min(extra, 4));
  }
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
