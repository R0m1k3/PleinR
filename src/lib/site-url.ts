/**
 * Déduction de l'origine publique du site à partir des en-têtes d'une requête.
 *
 * Sans dépendance à la base ni à Next : utilisable partout et testable. Sert de
 * repli quand aucune URL publique n'est enregistrée dans Backend › Réseaux
 * sociaux : derrière Caddy ou Nginx Proxy Manager, `X-Forwarded-Host` et
 * `X-Forwarded-Proto` décrivent l'adresse vue par le visiteur.
 */

type HeaderReader = { get(name: string): string | null };

const LOCAL_HOSTS = /^(localhost|.*\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|\[::\])$/i;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function first(value: string | null): string {
  return (value ?? "").split(",")[0]?.trim() ?? "";
}

/** Nom d'hôte sans port, en minuscules. */
function hostname(host: string): string {
  const match = /^(\[[^\]]*\]|[^:]+)/.exec(host);
  return (match?.[1] ?? host).toLowerCase();
}

/**
 * Sans `X-Forwarded-Proto`, on présume HTTPS pour un nom de domaine — c'est le
 * cas de tout déploiement réel — et HTTP pour une adresse locale ou une IP nue,
 * qu'aucun certificat ne couvre.
 */
export function defaultProtocol(host: string): "http" | "https" {
  const name = hostname(host);
  if (!name || LOCAL_HOSTS.test(name) || IPV4.test(name)) return "http";
  return "https";
}

/**
 * Origine (`https://pleinr.example.fr`) vue par le visiteur, ou chaîne vide si
 * la requête ne porte aucun hôte.
 */
export function originFromHeaders(headers: HeaderReader): string {
  const host = first(headers.get("x-forwarded-host")) || first(headers.get("host"));
  if (!host || /[\s/\\]/.test(host)) return "";
  const forwarded = first(headers.get("x-forwarded-proto")).toLowerCase();
  const protocol = forwarded === "https" || forwarded === "http" ? forwarded : defaultProtocol(host);
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return "";
  }
}
