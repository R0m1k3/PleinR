"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OneTimeCredentials } from "@/components/OneTimeCredentials";
import { approveMembershipRequest, type CreatedMemberAccount } from "../actions";

/**
 * Approuve une demande et affiche une seule fois les identifiants du compte
 * créé. On reste sur la page : une redirection ferait perdre le mot de passe,
 * qui n'est conservé nulle part.
 */
export function ApproveRequestForm({ requestId }: { requestId: number }) {
  const [created, setCreated] = useState<CreatedMemberAccount | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (created) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 260 }}>
        <OneTimeCredentials items={[created]} title="Adhérent créé — identifiants à transmettre" />
        <Link href={`/backend/adherents/${created.memberId}`} style={{ color: "#2C6FB3", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
          Ouvrir la fiche adhérent →
        </Link>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        setPending(true);
        try {
          const result = await approveMembershipRequest(fd);
          // Échec de saisie (e-mail déjà pris, demande sans e-mail) : la
          // raison s'affiche à côté du bouton, la page reste en place.
          if (result && "error" in result) {
            setError(result.error);
          } else if (result) {
            setError(null);
            setCreated(result);
            router.refresh();
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="id" value={requestId} />
      {error && (
        <div role="alert" style={{ background: "#fdecea", border: "1px solid #f1c4bd", borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: "#a3372e", marginBottom: 8, maxWidth: 280, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        style={{ border: "1px solid #1f8a5b", color: "#1f8a5b", background: "#fff", fontWeight: 700, fontSize: 12.5, padding: "7px 12px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        {pending ? "Création…" : "Approuver & créer"}
      </button>
    </form>
  );
}
