import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { SOCIAL_BRAND, SocialIcon } from "@/components/SocialIcons";
import {
  expiryStatus,
  getSocialAccounts,
  listStoredTargets,
  redirectUri,
  siteUrl,
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  type SocialTarget,
} from "@/lib/social-accounts";
import { disconnectSocial, saveSitePublicUrl, saveSocialApp, selectSocialTarget } from "../actions";

export const dynamic = "force-dynamic";

const HELP: Record<
  (typeof SOCIAL_NETWORKS)[number],
  { portal: string; steps: string[]; caution?: string }
> = {
  facebook: {
    portal: "https://developers.facebook.com/apps",
    steps: [
      "Créez une application de type « Business » et relevez l'identifiant et la clé secrète (Paramètres › Général).",
      "Ajoutez le produit « Connexion Facebook » puis collez l'URL de redirection ci-dessous dans « URI de redirection OAuth valides ».",
      "Laissez l'application en mode développement et ajoutez le compte de l'association comme administrateur : publier sur votre propre page ne demande alors aucune revue Meta.",
    ],
  },
  linkedin: {
    portal: "https://www.linkedin.com/developers/apps",
    steps: [
      "Créez une application rattachée à la page LinkedIn de l'association et relevez le Client ID et le Client Secret (onglet Auth).",
      "Collez l'URL de redirection ci-dessous dans « Authorized redirect URLs ».",
      "Onglet Produits : demandez « Community Management API », indispensable pour publier au nom de la page.",
    ],
    caution:
      "LinkedIn soumet cette demande à une revue (page vérifiée, nom légal, adresse, politique de confidentialité) et ses jetons expirent au bout de 60 jours : il faudra recliquer sur Reconnecter environ tous les deux mois.",
  },
};

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function ReseauxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; choose?: string }>;
}) {
  const session = await getSession();
  if (!can(session?.user.role, "manageSettings")) redirect("/backend");

  const { error, connected, choose } = await searchParams;
  const accounts = await getSocialAccounts();
  const byNetwork = new Map(accounts.map((a) => [a.network, a]));
  const base = await siteUrl();

  // Adresse par laquelle l'administrateur consulte cette page : proposée par
  // défaut pour lui éviter de la recopier à la main.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const detected = host ? `${protocol}://${host}` : "";

  // Calculées ici : le rendu des cartes n'est pas asynchrone.
  const redirectUris = new Map<string, string>();
  for (const network of SOCIAL_NETWORKS) {
    redirectUris.set(network, await redirectUri(network));
  }

  // Cibles à proposer quand le compte administre plusieurs pages.
  const targets = new Map<string, SocialTarget[]>();
  let targetError: string | null = null;
  for (const network of SOCIAL_NETWORKS) {
    const account = byNetwork.get(network);
    if (account?.accessToken && !account.targetId) {
      try {
        targets.set(network, await listStoredTargets(network));
      } catch (caught) {
        targetError = caught instanceof Error ? caught.message : "Pages illisibles.";
      }
    }
  }

  return (
    <div style={{ display: "grid", gap: 22, maxWidth: 1080 }}>
      {error && <Banner tone="error">{error}</Banner>}
      {targetError && <Banner tone="error">{targetError}</Banner>}
      {connected && (
        <Banner tone="ok">
          Compte {SOCIAL_LABELS[connected as "facebook"] ?? connected} connecté.
        </Banner>
      )}
      {choose && (
        <Banner tone="warn">
          Connexion réussie : choisissez la page à utiliser pour les publications.
        </Banner>
      )}

      <section style={panel}>
        <h2 className="font-display" style={{ ...title, margin: "0 0 4px" }}>
          URL publique du site
        </h2>
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#6c6150", lineHeight: 1.6 }}>
          Adresse à laquelle vos visiteurs accèdent au site. Elle sert à construire
          l&apos;adresse de retour des connexions Facebook et LinkedIn, et le lien inséré dans
          les publications.
        </p>
        <form action={saveSitePublicUrl} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <label className="field-label">Adresse</label>
            <input
              name="sitePublicUrl"
              className="field"
              defaultValue={base || detected}
              placeholder="https://pleinr.example.fr"
            />
          </div>
          <button type="submit" style={submitButton}>Enregistrer</button>
        </form>
        {!base && detected && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#9a6638" }}>
            Adresse détectée depuis votre navigation : <strong>{detected}</strong>. Vérifiez-la puis
            enregistrez.
          </div>
        )}
        {!base && !detected && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#a8503c" }}>
            Renseignez cette adresse avant de connecter un réseau social.
          </div>
        )}
      </section>

      {SOCIAL_NETWORKS.map((network) => {
        const account = byNetwork.get(network);
        const help = HELP[network];
        const status = expiryStatus(account?.expiresAt);
        const isConnected = !!account?.accessToken && !!account.targetId;
        const candidates = targets.get(network) ?? [];

        return (
          <section key={network} style={panel}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: SOCIAL_BRAND[network],
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                <SocialIcon network={network} size={20} />
              </span>
              <h2 className="font-display" style={{ ...title, margin: 0, flex: 1 }}>
                {SOCIAL_LABELS[network]}
              </h2>
              <StatusChip connected={isConnected} status={status} />
            </div>

            {isConnected && (
              <div style={{ fontSize: 13.5, color: "#6c6150", marginBottom: 14, lineHeight: 1.6 }}>
                Publie sur <strong style={{ color: "#26201a" }}>{account?.targetName}</strong>.
                {status === "never" && " Ce jeton n'expire pas."}
                {account?.expiresAt && status !== "never" && ` Jeton valable jusqu'au ${fmtDate(account.expiresAt)}.`}
                {account?.connectedAt && ` Connecté le ${fmtDate(account.connectedAt)}.`}
                <br />
                Pour changer de page, relancez une connexion.
              </div>
            )}

            {(status === "soon" || status === "expired") && isConnected && (
              <Banner tone={status === "expired" ? "error" : "warn"}>
                {status === "expired"
                  ? `Le jeton ${SOCIAL_LABELS[network]} a expiré : les publications échoueront tant que vous n'aurez pas reconnecté le compte.`
                  : `Le jeton ${SOCIAL_LABELS[network]} expire bientôt. Un clic sur Reconnecter suffit à le renouveler.`}
              </Banner>
            )}

            {candidates.length > 0 && (
              <div style={{ background: "#faf7ef", border: "1px solid #f0e8d6", borderRadius: 12, padding: 15, marginBottom: 16 }}>
                <div className="field-label" style={{ marginBottom: 9 }}>
                  Page à utiliser pour les publications
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {candidates.map((target) => (
                    <form key={target.id} action={selectSocialTarget} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="hidden" name="network" value={network} />
                      <input type="hidden" name="targetId" value={target.id} />
                      <span style={{ flex: 1, fontSize: 13.5, color: "#3c3322", fontWeight: 600 }}>
                        {target.name}
                      </span>
                      <button type="submit" style={{ border: "none", background: "#13324F", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "8px 14px", borderRadius: 9, cursor: "pointer" }}>
                        Choisir
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}

            <form action={saveSocialApp} style={{ marginBottom: 14 }}>
              <input type="hidden" name="network" value={network} />
              <div className="grid grid-2" style={{ gap: 16 }}>
                <div>
                  <label className="field-label">
                    {network === "facebook" ? "Identifiant de l'application" : "Client ID"}
                  </label>
                  <input name="appId" defaultValue={account?.appId ?? ""} className="field" required />
                </div>
                <div>
                  <label className="field-label">
                    {network === "facebook" ? "Clé secrète" : "Client Secret"}
                  </label>
                  <input
                    name="appSecret"
                    type="password"
                    className="field"
                    autoComplete="new-password"
                    placeholder={account ? "Enregistré — laissez vide pour le conserver" : "Collez la clé secrète"}
                  />
                </div>
              </div>
              <button type="submit" style={{ ...submitButton, marginTop: 14 }}>
                Enregistrer les identifiants
              </button>
            </form>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", borderTop: "1px solid #f0e8d6", paddingTop: 14 }}>
              <a
                href={`/api/social/${network}/connect`}
                className="font-display"
                style={{
                  textDecoration: "none",
                  border: "none",
                  background: account?.appId ? SOCIAL_BRAND[network] : "#d8cdb4",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "12px 20px",
                  borderRadius: 10,
                  pointerEvents: account?.appId ? undefined : "none",
                }}
              >
                {isConnected ? "Reconnecter" : "Connecter"}
              </a>
              {isConnected && (
                <form action={disconnectSocial}>
                  <input type="hidden" name="network" value={network} />
                  <button type="submit" style={{ border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", fontWeight: 700, fontSize: 14, padding: "12px 18px", borderRadius: 10, cursor: "pointer" }}>
                    Déconnecter
                  </button>
                </form>
              )}
            </div>

            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#9a6638" }}>
                Comment obtenir ces identifiants ?
              </summary>
              <ol style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 13.5, color: "#6c6150", lineHeight: 1.7 }}>
                {help.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div style={{ marginTop: 12, fontSize: 13, color: "#6c6150" }}>
                Portail :{" "}
                <a href={help.portal} target="_blank" rel="noopener noreferrer" style={{ color: "#2C6FB3", fontWeight: 700 }}>
                  {help.portal}
                </a>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="field-label">URL de redirection à déclarer</div>
                <code style={{ display: "block", background: "#faf7ef", border: "1px solid #f0e8d6", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, color: "#3c3322", overflowWrap: "anywhere" }}>
                  {base ? redirectUris.get(network) : "— renseignez d'abord l'URL publique du site ci-dessus —"}
                </code>
              </div>
              {help.caution && (
                <div style={{ marginTop: 12, background: "#fbeede", border: "1px solid #ecd8b8", color: "#9a6638", borderRadius: 10, padding: "11px 13px", fontSize: 13, lineHeight: 1.6 }}>
                  {help.caution}
                </div>
              )}
            </details>
          </section>
        );
      })}
    </div>
  );
}

function StatusChip({ connected, status }: { connected: boolean; status: string }) {
  const [label, bg, color] = !connected
    ? ["Non connecté", "#f1efe7", "#a99c82"]
    : status === "expired"
      ? ["Jeton expiré", "#fbe9e6", "#d8472b"]
      : status === "soon"
        ? ["Expire bientôt", "#fbeede", "#9a6638"]
        : ["Connecté", "#e6f4ec", "#1f8a5b"];
  return (
    <span style={{ background: bg, color, borderRadius: 999, padding: "6px 13px", fontSize: 12, fontWeight: 800 }}>
      {label}
    </span>
  );
}

function Banner({ tone, children }: { tone: "ok" | "warn" | "error"; children: React.ReactNode }) {
  const palette = {
    ok: { bg: "#e6f4ec", border: "#c7e6d5", color: "#1f8a5b" },
    warn: { bg: "#fbeede", border: "#ecd8b8", color: "#9a6638" },
    error: { bg: "#fbe9e6", border: "#f2d5cf", color: "#a8503c" },
  }[tone];
  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, borderRadius: 12, padding: "12px 16px", fontSize: 13.5, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

const panel: CSSProperties = {
  background: "#fff",
  border: "1px solid #e6dcc6",
  borderRadius: 16,
  padding: 22,
};

const title: CSSProperties = {
  fontSize: 20,
  color: "#26201a",
};

const submitButton: CSSProperties = {
  border: "none",
  background: "#13324F",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
};
