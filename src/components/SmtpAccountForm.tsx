"use client";

import { useState, type CSSProperties } from "react";
import { IMPLICIT_TLS_PORT, impliedSecure, tlsMismatch } from "@/lib/smtp-config";

/**
 * Réglages d'un serveur SMTP générique.
 *
 * Client parce que le port et le chiffrement sont **un seul choix** présenté
 * en deux champs : changer le port réaligne la case, et un couple incohérent
 * s'annonce à l'écran plutôt qu'en échec de connexion illisible. Voir
 * `src/lib/smtp-config.ts` pour le pourquoi des deux ports.
 *
 * Aucun secret ne descend ici : le mot de passe enregistré n'est pas passé en
 * prop, seul `hasPassword` dit s'il faut proposer de le conserver.
 */

const PRESETS = [
  { port: IMPLICIT_TLS_PORT, label: "465 · chiffré dès l'ouverture" },
  { port: 587, label: "587 · STARTTLS" },
];

export function SmtpAccountForm({
  saveAction,
  host,
  port,
  secure,
  user,
  hasPassword,
  fromAddress,
  fromName,
  submitStyle,
}: {
  saveAction: (formData: FormData) => void | Promise<void>;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  fromAddress: string;
  fromName: string;
  submitStyle: CSSProperties;
}) {
  const [currentHost, setHost] = useState(host);
  const [currentPort, setPort] = useState(String(port));
  const [currentSecure, setSecure] = useState(secure);

  const numericPort = Number(currentPort);
  const knownPort = Number.isFinite(numericPort) && numericPort > 0;
  const warning = knownPort ? tlsMismatch(numericPort, currentSecure) : null;

  /** Le port choisi vaut choix du mode : la case suit, et reste reprenable à la main. */
  function applyPort(value: string) {
    setPort(value);
    const next = Number(value);
    if (Number.isFinite(next) && next > 0) setSecure(impliedSecure(next));
  }

  return (
    <form action={saveAction}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <label className="field-label">
          Serveur
          <input
            className="field"
            name="smtpHost"
            value={currentHost}
            onChange={(event) => setHost(event.target.value)}
            placeholder="smtp.ionos.fr"
            style={{ marginTop: 6 }}
          />
        </label>
        <label className="field-label">
          Port
          <input
            className="field"
            name="smtpPort"
            type="number"
            min={1}
            max={65535}
            value={currentPort}
            onChange={(event) => applyPort(event.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
        <label className="field-label">
          Identifiant
          <input className="field" name="smtpUser" defaultValue={user} placeholder="bureau@pleinr.fr" style={{ marginTop: 6 }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#9a8d72", fontWeight: 700 }}>Ports courants</span>
        {PRESETS.map((preset) => {
          const on = numericPort === preset.port;
          return (
            <button
              key={preset.port}
              type="button"
              onClick={() => applyPort(String(preset.port))}
              style={{
                border: `1px solid ${on ? "#13324F" : "#d8cdb4"}`,
                background: on ? "#13324F" : "#fff",
                color: on ? "#fff" : "#6c6150",
                fontWeight: 700,
                fontSize: 12,
                padding: "6px 11px",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
        <label className="field-label">
          Mot de passe
          <input
            className="field"
            name="smtpPassword"
            type="password"
            autoComplete="new-password"
            placeholder={hasPassword ? "Enregistré — laissez vide pour le conserver" : "Mot de passe de la boîte"}
            style={{ marginTop: 6 }}
          />
        </label>
        <label className="field-label">
          Adresse d&apos;expédition
          <input className="field" name="fromAddress" defaultValue={fromAddress} placeholder="contact@pleinr.fr" style={{ marginTop: 6 }} />
        </label>
        <label className="field-label">
          Nom affiché
          <input className="field" name="fromName" defaultValue={fromName} style={{ marginTop: 6 }} />
        </label>
      </div>

      <label style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 12, fontSize: 13, color: "#6c6150" }}>
        <input
          type="checkbox"
          name="smtpSecure"
          checked={currentSecure}
          onChange={(event) => setSecure(event.target.checked)}
        />
        Connexion chiffrée dès l&apos;ouverture (port 465). Décochez pour STARTTLS (port 587).
      </label>

      {warning && (
        <p style={{ marginTop: 8, fontSize: 12.5, color: "#a4571f", background: "#fdf3e3", border: "1px solid #ecd9b4", borderRadius: 9, padding: "9px 11px" }}>
          {warning}
        </p>
      )}

      <p className="field-hint" style={{ marginTop: 8 }}>
        L&apos;adresse d&apos;expédition doit appartenir au domaine qui authentifie la connexion, sinon
        SPF et DKIM échouent et les messages partent en indésirable.
      </p>
      <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
        <button type="submit" style={submitStyle}>Enregistrer</button>
      </div>
    </form>
  );
}
