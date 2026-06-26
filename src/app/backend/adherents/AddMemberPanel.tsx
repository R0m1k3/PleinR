"use client";

import { useState } from "react";
import { addMember } from "../actions";

export function AddMemberPanel({
  categories,
}: {
  categories: { id: number; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
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
            await addMember(fd);
            setOpen(false);
          }}
          style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22, marginTop: 14 }}
        >
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div>
              <label className="field-label">Nom de l&apos;adhérent</label>
              <input name="name" required placeholder="ex : Au Bon Pain" className="field" />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input name="email" type="email" placeholder="contact@exemple.fr" className="field" />
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
              <input name="city" placeholder="ex : Pompey" className="field" />
            </div>
            <div>
              <label className="field-label">Statut</label>
              <select name="status" className="field" defaultValue="pending">
                <option value="pending">En attente</option>
                <option value="active">Actif</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="font-display"
            style={{ marginTop: 18, border: "none", background: "#9a6638", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "12px 22px", borderRadius: 11, cursor: "pointer" }}
          >
            Enregistrer l&apos;adhérent
          </button>
        </form>
      )}
    </div>
  );
}
