"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OneTimeCredentials, type IssuedCredentialsItem } from "@/components/OneTimeCredentials";
import { createMissingMemberAccounts } from "../actions";

export function BackfillAccountsForm({ missingAccounts }: { missingAccounts: number }) {
  const [issued, setIssued] = useState<IssuedCredentialsItem[] | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  if (issued) {
    return (
      <OneTimeCredentials
        items={issued.map((i) => ({ label: i.label, email: i.email, tempPassword: i.tempPassword }))}
        title={`${issued.length} compte(s) créé(s) — identifiants à transmettre`}
      />
    );
  }

  return (
    <form
      action={async () => {
        setPending(true);
        try {
          const created = await createMissingMemberAccounts();
          setIssued(created.map((c) => ({ label: c.name, email: c.email, tempPassword: c.tempPassword })));
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      style={{ background: "#fbeede", border: "1px solid #ecd8b8", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}
    >
      <div style={{ fontSize: 13.5, color: "#9a6638" }}>
        <strong>{missingAccounts}</strong> adhérent(s) avec un e-mail n&apos;ont pas encore de compte de connexion.
      </div>
      <button
        type="submit"
        disabled={pending}
        className="font-display"
        style={{ border: "none", background: "#9a6638", color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "10px 18px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        {pending ? "Création…" : "Créer les comptes manquants"}
      </button>
    </form>
  );
}
