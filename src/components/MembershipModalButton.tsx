"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { submitMembershipRequest } from "@/app/actions/public";

export function MembershipModalButton({
  label,
  className,
  style,
}: {
  label: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    // Réinitialise après la fermeture (laisse l'animation finir).
    setTimeout(() => {
      setDone(false);
      setError(null);
    }, 200);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await submitMembershipRequest(new FormData(e.currentTarget));
    setPending(false);
    if (res.ok) setDone(true);
    else setError(res.error ?? "Une erreur est survenue.");
  }

  return (
    <>
      <button type="button" className={className} style={{ cursor: "pointer", ...style }} onClick={() => setOpen(true)}>
        {label}
      </button>

      <Modal open={open} onClose={close} title="Devenir adhérent">
        {done ? (
          <div style={{ textAlign: "center", padding: "10px 0 6px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
            <p style={{ margin: "0 0 18px", fontSize: 15, color: "#4a4030" }}>
              Demande envoyée ! L&apos;équipe Plein R vous recontactera rapidement.
            </p>
            <button type="button" className="lift-cta" onClick={close} style={primaryBtn}>
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: "#6c6150" }}>
              Laissez vos coordonnées : nous revenons vers vous pour finaliser votre adhésion.
            </p>

            <Field label="Nom / Raison sociale *">
              <input name="name" required maxLength={200} className="field" placeholder="Votre nom ou entreprise" />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" maxLength={200} className="field" placeholder="vous@exemple.fr" />
            </Field>
            <Field label="Téléphone">
              <input name="phone" maxLength={40} className="field" placeholder="06 12 34 56 78" />
            </Field>
            <Field label="Message">
              <textarea name="message" rows={4} maxLength={2000} className="field" placeholder="Votre activité, vos questions…" style={{ resize: "vertical" }} />
            </Field>

            {error && <div style={errorBox}>{error}</div>}

            <button type="submit" className="lift-cta" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}>
              {pending ? "Envoi…" : "Envoyer ma demande"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "#9a6638",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  padding: "13px 18px",
  borderRadius: 12,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  background: "#fbe8e6",
  color: "#a3372e",
  fontSize: 13,
  padding: "10px 12px",
  borderRadius: 10,
  marginBottom: 14,
};
