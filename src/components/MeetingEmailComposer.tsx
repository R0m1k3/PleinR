"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { copyRichEmail, downloadHtml, downloadOutlookDraft } from "@/lib/email-client";
import { buildMeetingEmail, defaultMeetingEmailTexts, type EmailBrand, type MeetingEmailData, type MeetingEmailTexts } from "@/lib/email-templates";
import {
  MailRecipientPicker,
  audienceCount,
  audienceFrom,
  type AudienceState,
  type RecipientChoices,
} from "@/components/MailRecipientPicker";
import { sendMeetingInvitations } from "@/app/backend/actions";

export function MeetingEmailComposer({
  meeting,
  brand,
  choices,
  mailReady,
  siteUrl,
}: {
  meeting: MeetingEmailData;
  brand: EmailBrand;
  choices: RecipientChoices;
  mailReady: boolean;
  siteUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(siteUrl);
  const [texts, setTexts] = useState<MeetingEmailTexts>(() => defaultMeetingEmailTexts(brand));
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [audience, setAudience] = useState<AudienceState>({ kind: "all", categoryId: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const email = useMemo(() => (baseUrl ? buildMeetingEmail(meeting, texts, baseUrl, brand) : null), [baseUrl, brand, meeting, texts]);
  const recipientCount = audienceCount(audience, choices);

  function show() {
    // L'adresse enregistrée prime : c'est celle que verront les destinataires.
    setBaseUrl(siteUrl || window.location.origin);
    setOpen(true);
  }

  async function deliver() {
    setSending(true);
    setError("");
    setSent(null);
    try {
      const result = await sendMeetingInvitations({
        meetingId: meeting.id,
        texts,
        audience: audienceFrom(audience, meeting.id),
      });
      if ("error" in result) setError(result.error);
      else setSent(`✓ ${result.queued} invitation(s) mises en file pour ${result.audience}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  }

  function change(name: keyof MeetingEmailTexts, value: string) {
    setTexts((current) => ({ ...current, [name]: value }));
  }

  async function action(key: string, task: () => Promise<void> | void) {
    try {
      setError("");
      await task();
      setFlash(key);
      setTimeout(() => setFlash(""), 1800);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action impossible dans ce navigateur.");
    }
  }

  return (
    <>
      <button type="button" onClick={show} className="meeting-email-button">✦ Créer invitation e-mail</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Invitation — ${meeting.title}`} maxWidth={1100}>
        <div className="meeting-email-workbench">
          <div style={{ display: "grid", gap: 13 }}>
            <EmailArea label="Salutation" value={texts.greeting} rows={2} onChange={(value) => change("greeting", value)} />
            <EmailArea label="Introduction" value={texts.intro} rows={5} onChange={(value) => change("intro", value)} />
            <EmailArea label="Conclusion" value={texts.outro} rows={4} onChange={(value) => change("outro", value)} />
            <EmailArea label="Signature" value={texts.signature} rows={3} onChange={(value) => change("signature", value)} />
            <p style={{ margin: 0, color: "#8c8068", fontSize: 12, lineHeight: 1.55 }}>
              Date, lieu, description, places et lien d'inscription repris automatiquement.
            </p>
            <div style={{ borderTop: "1px solid #f0e8d6", paddingTop: 13 }}>
              <MailRecipientPicker choices={choices} value={audience} onChange={setAudience} />
            </div>
            {error && <div style={{ color: "#d8472b", fontSize: 13, fontWeight: 700 }}>{error}</div>}
            {sent && <div style={{ color: "#1f8a5b", fontSize: 13, fontWeight: 700 }}>{sent}</div>}
            <button
              type="button"
              className="email-primary-button"
              disabled={!email || sending || !mailReady || recipientCount === 0}
              onClick={deliver}
            >
              {sending ? "Envoi en cours…" : `Envoyer à ${recipientCount} destinataire${recipientCount > 1 ? "s" : ""}`}
            </button>
            {!mailReady && (
              <p style={{ margin: 0, color: "#9a8d72", fontSize: 11.5, lineHeight: 1.55 }}>
                Aucune boîte mail ne répond : branchez-la dans Configuration › Boîte mail. Les boutons
                ci-dessous restent utilisables.
              </p>
            )}
            <button type="button" className="email-secondary-button" disabled={!email} onClick={() => email && action("outlook", () => downloadOutlookDraft(email.subject, email.html, "invitation"))}>
              {flash === "outlook" ? "✓ Brouillon téléchargé" : "Télécharger brouillon Outlook"}
            </button>
            <button type="button" className="email-secondary-button" disabled={!email} onClick={() => email && action("copy", () => copyRichEmail(email.html, `${email.subject}\n${email.registrationUrl}`))}>
              {flash === "copy" ? "✓ Invitation copiée" : "Copier invitation enrichie"}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" className="email-secondary-button" disabled={!email} onClick={() => email && action("link", () => navigator.clipboard.writeText(email.registrationUrl))}>{flash === "link" ? "✓ Lien copié" : "Copier lien"}</button>
              <button type="button" className="email-secondary-button" disabled={!email} onClick={() => email && action("html", () => downloadHtml(email.subject, email.html, "invitation"))}>{flash === "html" ? "✓ HTML créé" : "HTML"}</button>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 9, color: "#8c8068", fontSize: 12 }}><strong style={{ color: "#33291d" }}>Objet :</strong> {email?.subject}</div>
            <div className="email-preview-shell compact">
              {email && <iframe title="Aperçu invitation" srcDoc={email.html} sandbox="" />}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EmailArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return <label className="field-label">{label}<textarea className="field" value={value} rows={rows} onChange={(event) => onChange(event.target.value)} style={{ marginTop: 6, resize: "vertical" }} /></label>;
}
