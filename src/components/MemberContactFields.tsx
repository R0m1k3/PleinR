/**
 * Coordonnées du référent de l'adhérent (nom, prénom, ligne directe), dans les
 * deux formulaires de fiche : l'espace adhérent et l'écran staff.
 *
 * Ces champs ne sont jamais publiés : l'annuaire et la fiche publique ne les
 * affichent qu'à un visiteur connecté (`src/lib/member-contact.ts`).
 */
export function MemberContactFields({
  firstName,
  lastName,
  phone,
}: {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}) {
  return (
    <fieldset
      style={{
        marginTop: 16,
        border: "1px solid #f0e8d6",
        borderRadius: 12,
        background: "#faf7ef",
        padding: 16,
        minWidth: 0,
      }}
    >
      <legend className="field-label" style={{ padding: "0 6px" }}>
        Contact adhérent
      </legend>
      <p className="field-hint" style={{ margin: "0 0 12px" }}>
        La personne à joindre et sa ligne directe. Affiché sur l&apos;annuaire et sur la fiche
        <strong> uniquement aux visiteurs connectés</strong> : rien de tout cela n&apos;apparaît sur
        le site public ni dans les moteurs de recherche.
      </p>
      <div className="grid grid-2" style={{ gap: 16 }}>
        <div>
          <label className="field-label">Prénom</label>
          <input name="contactFirstName" defaultValue={firstName ?? ""} className="field" />
        </div>
        <div>
          <label className="field-label">Nom</label>
          <input name="contactLastName" defaultValue={lastName ?? ""} className="field" />
        </div>
        <div>
          <label className="field-label">Téléphone direct</label>
          <input name="contactPhone" defaultValue={phone ?? ""} className="field" placeholder="06 12 ..." />
        </div>
      </div>
    </fieldset>
  );
}
