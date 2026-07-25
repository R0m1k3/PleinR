import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { changeOwnPassword } from "../actions";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { error } = await searchParams;
  const forced = session.user.mustChangePassword;

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 26 }}>
        <h3 className="font-display" style={{ fontWeight: 800, fontSize: 20, margin: "0 0 8px", color: "#26201a" }}>
          Changer mon mot de passe
        </h3>
        {forced && (
          <div style={{ background: "#fbeede", border: "1px solid #ecd8b8", color: "#9a6638", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, marginBottom: 16 }}>
            Première connexion : pour des raisons de sécurité, choisissez un nouveau mot de passe
            avant de continuer.
          </div>
        )}

        {error && (
          <div style={{ background: "#fbe9e6", border: "1px solid #f2d5cf", color: "#a8503c", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form action={changeOwnPassword}>
          <label className="field-label">
            {forced ? "Mot de passe temporaire reçu" : "Mot de passe actuel"}
          </label>
          <input
            name="currentPassword"
            type="password"
            required
            className="field"
            style={{ marginBottom: 14 }}
            autoComplete="current-password"
          />

          <label className="field-label">Nouveau mot de passe (8 caractères min.)</label>
          <input name="password" type="password" required minLength={8} className="field" style={{ marginBottom: 14 }} autoComplete="new-password" />

          <label className="field-label">Confirmer le mot de passe</label>
          <input name="confirm" type="password" required minLength={8} className="field" style={{ marginBottom: 18 }} autoComplete="new-password" />

          <button
            type="submit"
            className="font-display"
            style={{ width: "100%", border: "none", background: "#13324F", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 11, cursor: "pointer" }}
          >
            Enregistrer le nouveau mot de passe
          </button>
        </form>
      </div>
    </div>
  );
}
