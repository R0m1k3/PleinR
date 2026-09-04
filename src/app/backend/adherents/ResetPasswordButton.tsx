"use client";

import { useState } from "react";
import { OneTimeCredentials } from "@/components/OneTimeCredentials";
import { resetMemberPassword, type IssuedCredentials } from "../actions";

export function ResetPasswordButton({ memberId }: { memberId: number }) {
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      {issued && <OneTimeCredentials items={[issued]} title="Nouveau mot de passe temporaire" />}
      <form
        action={async (fd) => {
          setPending(true);
          try {
            const result = await resetMemberPassword(fd);
            setIssued(result ?? null);
          } finally {
            setPending(false);
          }
        }}
      >
        <input type="hidden" name="memberId" value={memberId} />
        <button
          type="submit"
          disabled={pending}
          style={{ border: "1px solid #d8cdb4", background: "#fff", color: "#6f6450", fontWeight: 600, fontSize: 13, padding: "9px 15px", borderRadius: 9, cursor: "pointer" }}
        >
          {pending ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
        </button>
      </form>
    </div>
  );
}
