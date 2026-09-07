"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BASSIN_POMPEY_COMMUNES } from "@/lib/communes";
import { OneTimeCredentials } from "@/components/OneTimeCredentials";
import { addMember, type CreatedMemberAccount } from "../actions";

export function AddMemberPanel({
  categories,
}: {
  categories: { id: number; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<CreatedMemberAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  // React vide un formulaire non contrôlé après chaque action : sur un refus,
  // on réinjecte la saisie plutôt que de la faire retaper.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {created && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <OneTimeCredentials items={[created]} title="Adhérent créé — identifiants à transmettre" />
          <Link href={`/backend/adherents/${created.memberId}`} style={{ color: "#2C6FB3", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            Ouvrir la fiche adhérent →
          </Link>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="font-display"
          style={{ border: "none", background: "#13324F", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 18px", borderRadius: 10, cursor: "pointer" }}
        >
          {open ? "× Fermer" : "+ Ajouter un adhérent"}
        </button>
      </div>

      {open && (
        <form
          key={attempt}
          action={async (fd) => {
            setError(null);
            const result = await addMember(fd);
            // Échec de saisie : le formulaire reste ouvert avec la raison.
            if (result && "error" in result) {
              setDraft(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])));
              setAttempt((n) => n + 1);
              setError(result.error);
              return;
            }
            setDraft({});
            setOpen(false);
            // On reste sur la page : le mot de passe temporaire n'est affiché
            // qu'ici, une seule fois, et n'est conservé nulle part.
            setCreated(result ?? null);
            router.refresh();
          }}
          style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22, marginTop: 14 }}
        >
          {error && (
            <div role="alert" style={{ background: "#fdecea", border: "1px solid #f1c4bd", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#a3372e", marginBottom: 16 }}>
              {error}
            </div>
          )}
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div>
              <label className="field-label">Nom de l&apos;adhérent</label>
              <input name="name" required placeholder="ex : Au Bon Pain" className="field" defaultValue={draft.name ?? ""} />
            </div>
            <div>
              <label className="field-label">E-mail (identifiant de connexion)</label>
              <input name="email" type="email" required placeholder="contact@exemple.fr" className="field" defaultValue={draft.email ?? ""} />
            </div>
            <div>
              <label className="field-label">Catégorie</label>
              <select name="categoryId" className="field" defaultValue={draft.categoryId ?? ""}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Commune</label>
              <select name="city" className="field" defaultValue={draft.city ?? ""}>
                <option value="">—</option>
                {BASSIN_POMPEY_COMMUNES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Statut</label>
              <select name="status" className="field" defaultValue={draft.status ?? "pending"}>
                <option value="pending">En attente</option>
                <option value="active">Actif</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: "#9a8d72" }}>
            Un compte de connexion est créé automatiquement. Le mot de passe temporaire s&apos;affiche
            une seule fois, juste après l&apos;enregistrement : notez-le avant de quitter la page.
          </div>
          <button
            type="submit"
            className="font-display"
            style={{ marginTop: 14, border: "none", background: "#9a6638", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "12px 22px", borderRadius: 11, cursor: "pointer" }}
          >
            Enregistrer l&apos;adhérent
          </button>
        </form>
      )}
    </div>
  );
}
