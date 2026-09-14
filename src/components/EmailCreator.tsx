"use client";

import { useEffect, useMemo, useState } from "react";
import { copyRichEmail, downloadHtml, downloadOutlookDraft } from "@/lib/email-client";
import { buildGeneralEmail, type EmailBrand, type GeneralEmailContent } from "@/lib/email-templates";
import {
  MailRecipientPicker,
  audienceCount,
  audienceFrom,
  type AudienceState,
  type RecipientChoices,
} from "@/components/MailRecipientPicker";
import { sendSelfTest, sendStudioEmail } from "@/app/backend/actions";

export function EmailCreator({
  brand,
  choices,
  mailReady,
  siteUrl,
}: {
  brand: EmailBrand;
  choices: RecipientChoices;
  /** Faux si aucune boîte n'expédie : l'envoi réel est alors désactivé. */
  mailReady: boolean;
  /** Adresse publique enregistrée, utilisée par l'aperçu comme par l'envoi. */
  siteUrl: string;
}) {
  const [baseUrl, setBaseUrl] = useState(siteUrl);
  const [audience, setAudience] = useState<AudienceState>({ kind: "all", categoryId: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [form, setForm] = useState<GeneralEmailContent>({
    subject: `Actualités de ${brand.associationName}`,
    kicker: brand.associationName,
    title: "Votre titre ici",
    body: "Bonjour,\n\nRédigez ici votre message. Créez plusieurs paragraphes en laissant une ligne vide.\n\nLe gabarit conserve automatiquement l'identité visuelle Plein R.",
    buttonLabel: "Découvrir",
    buttonUrl: "",
    signature: `À très bientôt,\nL'équipe de ${brand.associationName}`,
  });
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // L'adresse enregistrée prime : c'est elle que verront les destinataires,
    // et non celle par laquelle l'administrateur est arrivé.
    const origin = siteUrl || window.location.origin;
    setBaseUrl(origin);
    setForm((current) => ({ ...current, buttonUrl: `${origin}/association` }));
  }, [siteUrl]);

  const email = useMemo(
    () => (baseUrl ? buildGeneralEmail(form, baseUrl, brand) : null),
    [baseUrl, brand, form],
  );

  const recipientCount = audienceCount(audience, choices);

  async function deliver(task: () => Promise<{ queued: number; audience: string } | { error: string }>) {
    setSending(true);
    setError("");
    setSent(null);
    try {
      const result = await task();
      if ("error" in result) setError(result.error);
      else setSent(`✓ ${result.queued} message(s) mis en file pour ${result.audience}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  }

  function change(name: keyof GeneralEmailContent, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function success(key: string) {
    setFlash(key);
    setTimeout(() => setFlash(""), 1800);
  }

  async function action(key: string, task: () => Promise<void> | void) {
    try {
      setError("");
      await task();
      success(key);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action impossible dans ce navigateur.");
    }
  }

  return (
    <div className="email-workbench">
      <section className="email-editor-card">
        <div className="email-editor-kicker">Studio de communication</div>
        <h2 className="font-display" style={{ margin: "6px 0 8px", fontSize: 23, color: "#26201a" }}>Composer un e-mail</h2>
        <p style={{ margin: "0 0 20px", color: "#8c8068", fontSize: 13, lineHeight: 1.6 }}>
          Logo, couleurs Plein R et coordonnées ajoutés automatiquement.
        </p>

        <div style={{ display: "grid", gap: 13 }}>
          <EmailField label="Objet" value={form.subject} onChange={(value) => change("subject", value)} />
          <EmailField label="Surtitre" value={form.kicker} onChange={(value) => change("kicker", value)} />
          <EmailField label="Titre" value={form.title} onChange={(value) => change("title", value)} />
          <EmailArea label="Message" value={form.body} rows={9} onChange={(value) => change("body", value)} />
          <div style={{ borderTop: "1px solid #f0e8d6", paddingTop: 14, display: "grid", gap: 11 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#6c6150" }}>Bouton facultatif</div>
            <EmailField label="Texte du bouton" value={form.buttonLabel} onChange={(value) => change("buttonLabel", value)} />
            <EmailField label="Lien" type="url" value={form.buttonUrl} onChange={(value) => change("buttonUrl", value)} />
          </div>
          <EmailArea label="Signature" value={form.signature} rows={3} onChange={(value) => change("signature", value)} />
        </div>

        <div style={{ marginTop: 20, borderTop: "1px solid #f0e8d6", paddingTop: 16 }}>
          <MailRecipientPicker choices={choices} value={audience} onChange={setAudience} />
          <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
            <button
              type="button"
              className="email-primary-button"
              disabled={!email || sending || !mailReady || recipientCount === 0}
              onClick={() => email && deliver(() => sendStudioEmail({ content: form, audience: audienceFrom(audience) }))}
            >
              {sending ? "Envoi en cours…" : `Envoyer à ${recipientCount} adhérent${recipientCount > 1 ? "s" : ""}`}
            </button>
            <button
              type="button"
              className="email-secondary-button"
              disabled={!email || sending || !mailReady}
              onClick={() => email && deliver(() => sendSelfTest({ subject: email.subject, html: email.html, text: form.body }))}
            >
              M&apos;envoyer un test
            </button>
            {sent && <div style={{ color: "#1f8a5b", fontSize: 13, fontWeight: 700 }}>{sent}</div>}
            {!mailReady && (
              <p style={{ margin: 0, color: "#9a8d72", fontSize: 11.5, lineHeight: 1.55 }}>
                Aucune boîte mail n&apos;expédie pour l&apos;instant : branchez-la dans Configuration › Boîte mail.
                Les boutons ci-dessous restent utilisables.
              </p>
            )}
          </div>
        </div>

        {error && <div style={{ marginTop: 13, color: "#d8472b", fontSize: 13, fontWeight: 700 }}>{error}</div>}
        <div style={{ display: "grid", gap: 9, marginTop: 20, borderTop: "1px solid #f0e8d6", paddingTop: 16 }}>
          <button type="button" className="email-primary-button" disabled={!email} onClick={() => email && action("outlook", () => downloadOutlookDraft(email.subject, email.html))}>
            {flash === "outlook" ? "✓ Brouillon téléchargé" : "Télécharger le brouillon Outlook"}
          </button>
          <button type="button" className="email-secondary-button" disabled={!email} onClick={() => email && action("copy", () => copyRichEmail(email.html, `${email.subject}\n\n${form.body}`))}>
            {flash === "copy" ? "✓ E-mail copié" : "Copier l'e-mail enrichi"}
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <button type="button" className="email-secondary-button" onClick={() => action("subject", () => navigator.clipboard.writeText(form.subject))}>
              {flash === "subject" ? "✓ Objet copié" : "Copier l'objet"}
            </button>
            <button type="button" className="email-secondary-button" disabled={!email} onClick={() => email && action("html", () => downloadHtml(email.subject, email.html))}>
              {flash === "html" ? "✓ HTML créé" : "Télécharger HTML"}
            </button>
          </div>
        </div>
        <p style={{ margin: "13px 0 0", color: "#9a8d72", fontSize: 11.5, lineHeight: 1.55 }}>
          Ces trois boutons restent là pour les cas particuliers : le .eml donne un brouillon Outlook
          à compléter à la main.
        </p>
      </section>

      <section style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 10, color: "#8c8068", fontSize: 12.5 }}><strong style={{ color: "#33291d" }}>Objet :</strong> {form.subject}</div>
        <div className="email-preview-shell">
          {email ? <iframe title="Aperçu de l'e-mail" srcDoc={email.html} sandbox="" /> : <div style={{ padding: 30 }}>Préparation aperçu…</div>}
        </div>
      </section>
    </div>
  );
}

function EmailField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="field-label">{label}<input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} style={{ marginTop: 6 }} /></label>;
}

function EmailArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return <label className="field-label">{label}<textarea className="field" value={value} rows={rows} onChange={(event) => onChange(event.target.value)} style={{ marginTop: 6, resize: "vertical" }} /></label>;
}
