"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OneTimeCredentials } from "@/components/OneTimeCredentials";
import { inviteAdmin, type IssuedCredentials } from "../actions";

export function InviteAdminForm() {
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {issued && <OneTimeCredentials items={[issued]} title="Compte créé — identifiants à transmettre" />}
      {error && (
        <div role="alert" style={{ background: "#fdecea", border: "1px solid #f1c4bd", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#a3372e" }}>
          {error}
        </div>
      )}
      <form
        action={async (fd) => {
          setPending(true);
          setError(null);
          try {
            const result = await inviteAdmin(fd);
            setIssued(result ?? null);
            router.refresh();
          } catch {
            // Next masque le détail des erreurs serveur en production.
            setError("Impossible de créer ce compte : vérifiez que l'e-mail n'est pas déjà utilisé.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="field-label">Nom complet</label>
        <input name="name" required placeholder="ex : Julie Bernard" className="field" style={{ marginBottom: 14 }} />

        <label className="field-label">E-mail</label>
        <input name="email" type="email" required placeholder="prenom@plein-r.fr" className="field" style={{ marginBottom: 14 }} />

        <label className="field-label">Rôle</label>
        <select name="role" defaultValue="Administrateur" className="field" style={{ marginBottom: 18 }}>
          <option>Administrateur</option>
          <option>Modérateur</option>
          <option>Éditeur</option>
        </select>

        <button
          type="submit"
          disabled={pending}
          className="font-display"
          style={{ width: "100%", border: "none", background: "#13324F", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 11, cursor: "pointer" }}
        >
          {pending ? "Création…" : "Créer le compte"}
        </button>
      </form>
      <p style={{ fontSize: 11.5, color: "#a99c82", margin: 0, lineHeight: 1.5 }}>
        Un mot de passe temporaire est généré et affiché une seule fois ici. L&apos;invité devra le
        changer à sa première connexion.
      </p>
    </div>
  );
}
