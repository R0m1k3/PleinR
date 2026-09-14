/**
 * Référent d'un adhérent : la personne à joindre, sa ligne directe.
 *
 * Ces informations sont **réservées aux visiteurs connectés** : elles ne
 * doivent jamais partir dans le HTML public, le JSON-LD ou les métadonnées.
 * Le module est pur — le filtrage par session se fait chez l'appelant, qui
 * n'appelle `memberContact()` qu'après avoir vérifié la session, et verrouillé
 * par `tests/member-contact.test.ts`.
 */

export type MemberContactSource = {
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactPhone?: string | null;
};

export type MemberContact = {
  /** « Prénom Nom », ou l'un des deux seulement. */
  name: string | null;
  phone: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed || null;
}

/** « Prénom Nom » à partir des deux champs, `null` si les deux sont vides. */
export function contactName(source: MemberContactSource): string | null {
  return clean([clean(source.contactFirstName), clean(source.contactLastName)].filter(Boolean).join(" "));
}

/**
 * Le référent affichable, ou `null` s'il n'y a rien à montrer : le bloc
 * « Contact adhérent » disparaît alors plutôt que d'afficher un cadre vide.
 */
export function memberContact(source: MemberContactSource): MemberContact | null {
  const name = contactName(source);
  const phone = clean(source.contactPhone);
  if (!name && !phone) return null;
  return { name, phone };
}

/**
 * `tel:` à partir d'un numéro saisi librement (« 03 83 24 .. », « +33 3 83 … »).
 * Seuls les chiffres sont conservés, avec l'indicatif international s'il ouvre
 * le numéro ; une saisie sans aucun chiffre ne produit pas de lien.
 */
export function telHref(phone: string | null | undefined): string | null {
  const raw = clean(phone);
  if (!raw) return null;
  const international = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:${international ? "+" : ""}${digits}`;
}
