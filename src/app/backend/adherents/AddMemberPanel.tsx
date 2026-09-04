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
          action={async (fd) => {
            const result = await addMember(fd);
            setOpen(false);
            // On reste sur la page : le mot de passe temporaire n'est affiché
            // qu'ici, une seule fois, et n'est conservé nulle part.
            setCreated(result ?? null);
            router.refresh();
          }}
          style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22, marginTop: 14 }}
        >
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div>
              <label className="field-label">Nom de l&apos;adhérent</label>
              <input name="name" required placeholder="ex : Au Bon Pain" className="field" />
            </div>
            <div>
              <label className="field-label">E-mail (identifiant de connexion)</label>
              <input name="email" type="email" required placeholder="contact@exemple.fr" className="field" />
            </div>
            <div>
              <label className="field-label">Catégorie</label>
              <select name="categoryId" className="field" defaultValue="">
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
              <select name="city" className="field" defaultValue="">
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
              <select name="status" className="field" defaultValue="pending">
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
