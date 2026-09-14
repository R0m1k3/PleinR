import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { countMemberAccounts, getAdminInformations, getInformation } from "@/lib/informations";
import { richTextExcerpt } from "@/lib/rich-text";
import { InformationForm } from "./InformationForm";
import {
  deleteInformation,
  publishInformation,
  toggleInformationPin,
  unpublishInformation,
} from "../actions";

export const dynamic = "force-dynamic";

const panel: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 14, padding: "17px 18px" };
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800, marginBottom: 12 };
const rowButton: CSSProperties = { border: "1px solid #d8cdb4", background: "#fff", color: "#6c6150", fontWeight: 700, fontSize: 12, padding: "6px 11px", borderRadius: 8, cursor: "pointer" };
const pill: CSSProperties = { borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" };

function formatDay(value: Date) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Rédaction et suivi des informations diffusées dans l'espace adhérent.
 *
 * L'information en cours d'édition est désignée par `?modifier=<id>` plutôt
 * que par un état client : la page reste un composant serveur, et un lien
 * suffit à passer d'une information à l'autre.
 */
export default async function InformationsPage({
  searchParams,
}: {
  searchParams: Promise<{ modifier?: string }>;
}) {
  const session = await getSession();
  if (!can(session?.user.role, "manageInformations")) redirect("/backend");

  const { modifier } = await searchParams;
  const editId = Number(modifier ?? 0) || null;
  const editing = editId ? await getInformation(editId) : null;

  const [items, memberCount] = await Promise.all([getAdminInformations(), countMemberAccounts()]);
  const published = items.filter((item) => item.status === "published");
  const drafts = items.filter((item) => item.status === "draft");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 18, alignItems: "start" }} className="informations-split">
      <InformationForm
        key={editing?.id ?? "nouvelle"}
        draft={{
          id: editing?.id ?? null,
          title: editing?.title ?? "",
          body: editing?.body ?? "",
          imageUrl: editing?.imageUrl ?? null,
          pinned: editing?.pinned ?? false,
        }}
      />

      <div style={{ display: "grid", gap: 16 }}>
        <section style={panel}>
          <div style={eyebrow}>Publiées · {published.length}</div>
          {published.length === 0 && (
            <div style={{ color: "#a99c82", fontSize: 13 }}>
              Rien n&apos;est encore visible dans l&apos;espace adhérent.
            </div>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {published.map((item, index) => (
              <div key={item.id} style={index > 0 ? { borderTop: "1px solid #f0e8d6", paddingTop: 12 } : undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                  <span className="font-display" style={{ fontWeight: 700, fontSize: 15, color: "#26201a" }}>{item.title}</span>
                  {item.pinned && <span style={{ ...pill, background: "#fbeede", color: "#9a6638" }}>Épinglée</span>}
                </div>
                <div style={{ color: "#9a8d72", fontSize: 12.5, marginTop: 3 }}>
                  {item.publishedAt ? formatDay(item.publishedAt) : "—"}
                  {" · "}
                  lue par {item.readCount} / {memberCount}
                  {item.authorName ? ` · ${item.authorName}` : ""}
                </div>
                <div style={{ color: "#8c8068", fontSize: 12.5, marginTop: 5 }}>{richTextExcerpt(item.body, 110)}</div>
                <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                  <Link href={`/backend/informations?modifier=${item.id}`} style={{ ...rowButton, textDecoration: "none" }}>
                    Modifier
                  </Link>
                  <form action={toggleInformationPin}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" style={rowButton}>{item.pinned ? "Décrocher" : "Épingler"}</button>
                  </form>
                  <form action={unpublishInformation}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" style={rowButton}>Retirer</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={panel}>
          <div style={eyebrow}>Brouillons · {drafts.length}</div>
          {drafts.length === 0 && <div style={{ color: "#a99c82", fontSize: 13 }}>Aucun brouillon en attente.</div>}
          <div style={{ display: "grid", gap: 12 }}>
            {drafts.map((item, index) => (
              <div key={item.id} style={index > 0 ? { borderTop: "1px solid #f0e8d6", paddingTop: 12 } : undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                  <span className="font-display" style={{ fontWeight: 700, fontSize: 15, color: "#26201a" }}>{item.title}</span>
                  <span style={{ ...pill, background: "#f1efe7", color: "#a99c82" }}>Brouillon</span>
                </div>
                <div style={{ color: "#9a8d72", fontSize: 12.5, marginTop: 3 }}>
                  Modifié le {formatDay(item.updatedAt)}
                  {item.authorName ? ` · ${item.authorName}` : ""}
                </div>
                <div style={{ color: "#8c8068", fontSize: 12.5, marginTop: 5 }}>{richTextExcerpt(item.body, 110)}</div>
                <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                  <form action={publishInformation}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      style={{ ...rowButton, border: "none", background: "#13324F", color: "#fff", fontWeight: 800 }}
                    >
                      Publier
                    </button>
                  </form>
                  <Link href={`/backend/informations?modifier=${item.id}`} style={{ ...rowButton, textDecoration: "none" }}>
                    Modifier
                  </Link>
                  <form action={deleteInformation}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" style={{ ...rowButton, color: "#d8472b", borderColor: "#e0c3bb" }}>
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
