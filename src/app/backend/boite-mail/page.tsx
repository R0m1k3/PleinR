import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import {
  MAIL_LABELS,
  MAIL_PROVIDERS,
  getMailAccounts,
  mailHealthCached,
  type MailHealth,
} from "@/lib/mail-accounts";
import { recentMails } from "@/lib/mail-outbox";
import { SmtpAccountForm } from "@/components/SmtpAccountForm";
import { publicBaseUrl } from "@/lib/social-accounts";
import { getSiteSettings } from "@/lib/site-settings";
import type { MailAccount, MailProvider } from "@/db/schema";
import {
  cancelMail,
  checkMailProvider,
  disconnectMail,
  retryMail,
  saveMailApp,
  saveMailSmtp,
  sendMailTest,
  setMailProvider,
} from "../actions";

export const dynamic = "force-dynamic";

const panel: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 14, padding: "18px 20px", marginBottom: 16 };
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800, marginBottom: 12 };
const ghost: CSSProperties = { border: "1px solid #d8cdb4", background: "#fff", color: "#6c6150", fontWeight: 700, fontSize: 12.5, padding: "8px 13px", borderRadius: 9, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const primary: CSSProperties = { ...ghost, border: "none", background: "#13324F", color: "#fff", fontWeight: 800 };
const danger: CSSProperties = { ...ghost, color: "#d8472b", borderColor: "#e0c3bb" };
const pill: CSSProperties = { borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" };

const BRAND: Record<MailProvider, { color: string; mark: string }> = {
  google: { color: "#1a73e8", mark: "G" },
  microsoft: { color: "#0f6cbd", mark: "M" },
  smtp: { color: "#6c6150", mark: "@" },
};

const HELP: Record<"google" | "microsoft", { portal: string; steps: string[]; caution: string }> = {
  google: {
    portal: "https://console.cloud.google.com/apis/credentials",
    steps: [
      "Créez un projet, puis un identifiant OAuth de type « Application Web ».",
      "Activez l'API Gmail dans la bibliothèque d'API du projet.",
      "Sur l'écran de consentement, ajoutez la portée .../auth/gmail.send.",
      "Déclarez l'adresse de retour ci-dessous comme URI de redirection autorisé.",
      "Collez l'ID client et le code secret du client ci-dessus, puis connectez-vous avec la boîte de l'association.",
    ],
    caution:
      "Tant que l'application reste en mode « Test », Google fait expirer l'autorisation au bout de 7 jours et l'envoi s'arrête sans prévenir. Passez-la « En production » (un écran d'avertissement subsiste, sans conséquence), ou déclarez-la « Interne » si l'association a un compte Google Workspace.",
  },
  microsoft: {
    portal: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    steps: [
      "Inscrivez une application, en autorisant « comptes dans un annuaire quelconque et comptes Microsoft personnels ».",
      "Ajoutez l'adresse de retour ci-dessous comme URI de redirection de type « Web ».",
      "Dans les autorisations d'API, ajoutez les permissions déléguées Mail.Send, User.Read et offline_access.",
      "Créez un secret client et notez sa valeur : elle n'est affichée qu'une fois.",
      "Collez l'ID d'application et le secret ci-dessus, puis connectez-vous avec la boîte de l'association.",
    ],
    caution:
      "Microsoft a désactivé l'authentification par simple mot de passe (SMTP AUTH) sur les boîtes outlook.com et hotmail.com : cette connexion par bouton est le seul chemin fiable pour ces adresses.",
  },
};

function Banner({ tone, children }: { tone: "error" | "ok" | "warn"; children: ReactNode }) {
  const palette = {
    error: { background: "#fbe9e6", border: "#f2d5cf", color: "#a8503c" },
    ok: { background: "#e6f4ec", border: "#c4e2d1", color: "#1f8a5b" },
    warn: { background: "#fbeede", border: "#ecd8b8", color: "#9a6638" },
  }[tone];
  return (
    <div role="status" style={{ ...palette, border: `1px solid ${palette.border}`, borderRadius: 10, padding: "11px 15px", fontSize: 13.5, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function StatusChip({ account, health }: { account: MailAccount | undefined; health: MailHealth | null }) {
  if (!account) return <span style={{ ...pill, background: "#f1efe7", color: "#a99c82" }}>Non configurée</span>;
  if (health && !health.ok) return <span style={{ ...pill, background: "#fbe9e6", color: "#d8472b" }}>Ne répond plus</span>;
  if (account.provider !== "smtp" && !account.fromAddress) {
    return <span style={{ ...pill, background: "#f1efe7", color: "#a99c82" }}>Non connectée</span>;
  }
  if (account.provider === "smtp" && !account.smtpHost) {
    return <span style={{ ...pill, background: "#f1efe7", color: "#a99c82" }}>Non configurée</span>;
  }
  return <span style={{ ...pill, background: "#e6f4ec", color: "#1f8a5b" }}>Connectée</span>;
}

function formatMoment(value: Date) {
  return new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const MAIL_STATUS: Record<string, { label: string; background: string; color: string }> = {
  queued: { label: "En file", background: "#eaf0f6", color: "#2C6FB3" },
  sending: { label: "En cours", background: "#eaf0f6", color: "#2C6FB3" },
  sent: { label: "Remis", background: "#e6f4ec", color: "#1f8a5b" },
  failed: { label: "Échec", background: "#fbe9e6", color: "#d8472b" },
  cancelled: { label: "Annulé", background: "#f1efe7", color: "#a99c82" },
};

/**
 * Boîte mail de l'association.
 *
 * Même structure que Backend › Réseaux sociaux, et mêmes règles : aucun secret
 * ne descend vers le navigateur — le champ mot de passe part vide et un champ
 * vide conserve la valeur enregistrée.
 */
export default async function BoiteMailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; connected?: string }>;
}) {
  const session = await getSession();
  if (!can(session?.user.role, "manageSettings")) redirect("/backend");

  const { error, ok, connected } = await searchParams;
  const [accounts, settings, base, log] = await Promise.all([
    getMailAccounts(),
    getSiteSettings(),
    publicBaseUrl(),
    recentMails(20),
  ]);
  const byProvider = new Map(accounts.map((account) => [account.provider, account]));
  const health = Object.fromEntries(
    await Promise.all(MAIL_PROVIDERS.map(async (provider) => [provider, await mailHealthCached(provider)] as const)),
  ) as Record<MailProvider, MailHealth | null>;
  const active = accounts.find((account) => account.isActive) ?? null;

  return (
    <div>
      {error && <Banner tone="error">{error}</Banner>}
      {ok && <Banner tone="ok">{ok}</Banner>}
      {connected && <Banner tone="ok">Boîte {MAIL_LABELS[connected as MailProvider] ?? connected} connectée.</Banner>}
      {!active && (
        <Banner tone="warn">
          Aucune boîte n&apos;expédie pour l&apos;instant : les mots de passe temporaires restent affichés à
          l&apos;écran, et aucune information ne part par e-mail.
        </Banner>
      )}

      {MAIL_PROVIDERS.map((provider) => {
        const account = byProvider.get(provider);
        const verdict = health[provider];
        const brand = BRAND[provider];
        const isActive = account?.isActive ?? false;
        const connectable = provider !== "smtp";
        const usable = provider === "smtp" ? Boolean(account?.smtpHost) : Boolean(account?.fromAddress);

        return (
          <section
            key={provider}
            style={{ ...panel, ...(isActive ? { borderColor: "#b9d3c6", boxShadow: "inset 4px 0 0 #1f8a5b" } : {}) }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
                <span
                  aria-hidden="true"
                  className="font-display"
                  style={{ width: 40, height: 40, borderRadius: 10, background: brand.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}
                >
                  {brand.mark}
                </span>
                <div>
                  <div className="font-display" style={{ fontWeight: 700, fontSize: 16, color: "#26201a" }}>{MAIL_LABELS[provider]}</div>
                  <div style={{ color: "#9a8d72", fontSize: 12.5 }}>
                    {provider === "smtp"
                      ? account?.smtpHost
                        ? `${account.smtpHost} : ${account.smtpPort ?? 465} · ${account.smtpUser}`
                        : "Aucun serveur enregistré"
                      : account?.fromAddress
                        ? `${account.fromAddress}${account.connectedAt ? ` · connectée le ${formatMoment(account.connectedAt)}` : ""}`
                        : "Aucun compte relié"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                <StatusChip account={account} health={verdict} />
                {usable && (
                  <form action={setMailProvider}>
                    <input type="hidden" name="provider" value={provider} />
                    <button type="submit" disabled={isActive} style={{ ...(isActive ? { ...ghost, borderColor: "#b9d3c6", color: "#1f8a5b", cursor: "default" } : ghost) }}>
                      {isActive ? "✓ Expédie les messages" : "Expédier par ici"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {verdict && !verdict.ok && (
              <div style={{ marginTop: 13 }}>
                <Banner tone="error">{verdict.reason.slice(0, 400)}</Banner>
              </div>
            )}

            <div style={{ borderTop: "1px solid #f0e8d6", margin: "14px 0" }} />

            {provider === "smtp" ? (
              <SmtpAccountForm
                saveAction={saveMailSmtp}
                host={account?.smtpHost ?? ""}
                port={account?.smtpPort ?? 465}
                secure={account?.smtpSecure ?? true}
                user={account?.smtpUser ?? ""}
                hasPassword={Boolean(account?.smtpPassword)}
                fromAddress={account?.fromAddress ?? ""}
                fromName={account?.fromName ?? settings.association_name}
                submitStyle={primary}
              />
            ) : (
              <>
                <form action={saveMailApp}>
                  <input type="hidden" name="provider" value={provider} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                    <label className="field-label">
                      Identifiant de l&apos;application
                      <input className="field" name="appId" required defaultValue={account?.appId ?? ""} style={{ marginTop: 6 }} />
                    </label>
                    <label className="field-label">
                      Secret de l&apos;application
                      <input
                        className="field"
                        name="appSecret"
                        type="password"
                        autoComplete="new-password"
                        placeholder={account?.appSecret ? "Enregistré — laissez vide pour le conserver" : "Collez la clé secrète"}
                        style={{ marginTop: 6 }}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="submit" style={primary}>Enregistrer</button>
                    <Link
                      href={account?.appId ? `/api/mail/${provider}/connect` : "#"}
                      aria-disabled={!account?.appId}
                      style={{ ...ghost, ...(account?.appId ? {} : { opacity: 0.5, pointerEvents: "none" }) }}
                    >
                      {account?.fromAddress ? "Reconnecter la boîte" : "Connecter la boîte"}
                    </Link>
                  </div>
                </form>

                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#9a6638" }}>
                    Comment obtenir ces identifiants ?
                  </summary>
                  <ol style={{ margin: "11px 0 0", paddingLeft: 20, color: "#6c6150", fontSize: 13, lineHeight: 1.7 }}>
                    {HELP[provider].steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p style={{ margin: "11px 0 0", color: "#6c6150", fontSize: 13 }}>
                    Adresse de retour à déclarer :{" "}
                    <code style={{ background: "#faf7ef", border: "1px solid #e6dcc6", borderRadius: 5, padding: "1px 6px", fontSize: 12.5 }}>
                      {base ? `${base}/api/mail/${provider}/callback` : "définissez d'abord l'URL publique du site"}
                    </code>
                  </p>
                  <p style={{ margin: "11px 0 0" }}>
                    <Link href={HELP[provider].portal} target="_blank" style={{ color: "#2C6FB3", fontSize: 13, fontWeight: 700 }}>
                      Ouvrir la console {provider === "google" ? "Google Cloud" : "Microsoft Entra"} ↗
                    </Link>
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <Banner tone="warn">{HELP[provider].caution}</Banner>
                  </div>
                </details>
              </>
            )}

            {usable && (
              <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap", borderTop: "1px solid #f0e8d6", paddingTop: 13 }}>
                <form action={checkMailProvider}>
                  <input type="hidden" name="provider" value={provider} />
                  <button type="submit" style={ghost}>Vérifier la connexion</button>
                </form>
                {connectable && account?.fromAddress && (
                  <form action={disconnectMail}>
                    <input type="hidden" name="provider" value={provider} />
                    <button type="submit" style={danger}>Déconnecter</button>
                  </form>
                )}
                {verdict?.ok && <span style={{ alignSelf: "center", color: "#1f8a5b", fontSize: 12.5 }}>✓ {verdict.detail}</span>}
              </div>
            )}
          </section>
        );
      })}

      <section style={panel}>
        <div style={eyebrow}>Envoi de contrôle</div>
        <form action={sendMailTest} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={!active} style={{ ...primary, ...(active ? {} : { opacity: 0.5 }) }}>
            M&apos;envoyer un message de test
          </button>
          <span className="field-hint">
            Part immédiatement vers votre propre adresse et affiche le verdict, sans passer par la file.
          </span>
        </form>
      </section>

      <section style={panel}>
        <div style={eyebrow}>Journal d&apos;envoi</div>
        {log.length === 0 ? (
          <div style={{ color: "#a99c82", fontSize: 13 }}>Aucun message expédié pour l&apos;instant.</div>
        ) : (
          <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.8 }}>
              <thead>
                <tr>
                  {["Quand", "Destinataire", "Objet", "État", ""].map((header) => (
                    <th key={header} style={{ textAlign: "left", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800, padding: "0 10px 8px 0", whiteSpace: "nowrap" }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map((message) => {
                  const status = MAIL_STATUS[message.status] ?? MAIL_STATUS.queued;
                  return (
                    <tr key={message.id}>
                      <td style={{ padding: "9px 10px 9px 0", borderTop: "1px solid #f0e8d6", color: "#8c8068", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {formatMoment(message.createdAt)}
                      </td>
                      <td style={{ padding: "9px 10px 9px 0", borderTop: "1px solid #f0e8d6", color: "#26201a", fontWeight: 600 }}>{message.toAddress}</td>
                      <td style={{ padding: "9px 10px 9px 0", borderTop: "1px solid #f0e8d6", color: "#8c8068" }}>
                        {message.subject}
                        {message.error && <div style={{ color: "#d8472b", fontSize: 11.5, marginTop: 3 }}>{message.error.slice(0, 160)}</div>}
                      </td>
                      <td style={{ padding: "9px 10px 9px 0", borderTop: "1px solid #f0e8d6" }}>
                        <span style={{ ...pill, background: status.background, color: status.color }}>{status.label}</span>
                      </td>
                      <td style={{ padding: "9px 0", borderTop: "1px solid #f0e8d6", whiteSpace: "nowrap" }}>
                        {message.status === "failed" && (
                          <form action={retryMail}>
                            <input type="hidden" name="id" value={message.id} />
                            <button type="submit" style={{ ...ghost, padding: "5px 10px", fontSize: 11.5 }}>Réessayer</button>
                          </form>
                        )}
                        {message.status === "queued" && (
                          <form action={cancelMail}>
                            <input type="hidden" name="id" value={message.id} />
                            <button type="submit" style={{ ...ghost, padding: "5px 10px", fontSize: 11.5 }}>Annuler</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
