"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { submitContactMessage } from "@/app/actions/public";

export function ContactModalButton({
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
    setTimeout(() => {
      setDone(false);
      setError(null);
    }, 200);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await submitContactMessage(new FormData(e.currentTarget));
    setPending(false);
    if (res.ok) setDone(true);
    else setError(res.error ?? "Une erreur est survenue.");
  }

  return (
    <>
      <button type="button" className={className} style={{ cursor: "pointer", ...style }} onClick={() => setOpen(true)}>
        {label}
      </button>

      <Modal open={open} onClose={close} title="Nous contacter">
        {done ? (
          <div style={{ textAlign: "center", padding: "10px 0 6px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
            <p style={{ margin: "0 0 18px", fontSize: 15, color: "#4a4030" }}>
              Message envoyé ! Nous vous répondrons dès que possible.
            </p>
            <button type="button" className="lift-cta" onClick={close} style={primaryBtn}>
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: "#6c6150" }}>
              Une question, une suggestion ? Écrivez-nous.
            </p>

            <Field label="Nom *">
              <input name="name" required maxLength={200} className="field" placeholder="Votre nom" />
            </Field>
            <Field label="E-mail *">
              <input name="email" type="email" required maxLength={200} className="field" placeholder="vous@exemple.fr" />
            </Field>
            <Field label="Objet">
              <input name="subject" maxLength={200} className="field" placeholder="Objet du message" />
            </Field>
            <Field label="Message *">
              <textarea name="message" required rows={5} maxLength={4000} className="field" placeholder="Votre message…" style={{ resize: "vertical" }} />
            </Field>

            {error && <div style={errorBox}>{error}</div>}

            <button type="submit" className="lift-cta" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}>
              {pending ? "Envoi…" : "Envoyer le message"}
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
  background: "#13324F",
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
