import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { members, promotions } from "@/db/schema";
import { can } from "@/lib/rbac";
import { moderatePromo } from "../actions";

export const dynamic = "force-dynamic";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 11px,#e6ddc9 11px,#e6ddc9 22px)";
const STRIPE_COOL =
  "repeating-linear-gradient(45deg,#eef0ec,#eef0ec 11px,#e2e8e6 11px,#e2e8e6 22px)";

export default async function PromotionsPage() {
  const session = await auth();
  if (!can(session?.user.role, "moderatePromos")) {
    redirect("/backend");
  }

  const rows = await db
    .select({
      id: promotions.id,
      title: promotions.title,
      text: promotions.text,
      category: promotions.category,
      status: promotions.status,
      imageUrl: promotions.imageUrl,
      memberName: members.name,
    })
    .from(promotions)
    .leftJoin(members, eq(promotions.memberId, members.id))
    .where(inArray(promotions.status, ["pending", "live"]))
    .orderBy(desc(promotions.status), desc(promotions.createdAt));

  const pending = rows.filter((r) => r.status === "pending");
  const live = rows.filter((r) => r.status === "live");
  // pending first, then live
  const ordered = [...pending, ...live];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ background: "#13324F", color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999 }}>
          En attente · {pending.length}
        </span>
        <span style={{ background: "#fff", border: "1px solid #e6dcc6", color: "#6c6150", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999 }}>
          En ligne · {live.length}
        </span>
      </div>

      {ordered.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 28, color: "#a99c82", fontSize: 14 }}>
          Aucune promotion pour le moment.
        </div>
      )}

      <div className="grid grid-3" style={{ gap: 18 }}>
        {ordered.map((p) => {
          const isPending = p.status === "pending";
          return (
            <article
              key={p.id}
              style={{
                background: "#fff",
                border: "1px solid #e6dcc6",
                borderRadius: 16,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: 150,
                  background: p.imageUrl
                    ? `url(${p.imageUrl})`
                    : isPending
                      ? STRIPE_COOL
                      : STRIPE_WARM,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {p.category && (
                  <span style={{ position: "absolute", top: 10, left: 10, background: "#9a6638", color: "#fff", borderRadius: 999, padding: "4px 11px", fontSize: 11, fontWeight: 700 }}>
                    {p.category}
                  </span>
                )}
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    borderRadius: 999,
                    padding: "4px 11px",
                    fontSize: 11,
                    fontWeight: 800,
                    background: isPending ? "#fbeede" : "#e6f4ec",
                    color: isPending ? "#9a6638" : "#1f8a5b",
                  }}
                >
                  {isPending ? "En attente" : "En ligne"}
                </span>
              </div>
              <div style={{ padding: "15px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
                <h3 className="font-display" style={{ fontWeight: 700, fontSize: 16.5, margin: "0 0 4px", color: "#26201a" }}>
                  {p.title}
                </h3>
                <div style={{ fontSize: 12.5, color: "#9a6638", fontWeight: 600, marginBottom: 8 }}>
                  {p.memberName}
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#8c8068", lineHeight: 1.5, flex: 1 }}>
                  {p.text}
                </p>

                {isPending ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <form action={moderatePromo} style={{ flex: 1 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button type="submit" style={{ width: "100%", border: "none", background: "#1f8a5b", color: "#fff", fontWeight: 700, fontSize: 13, padding: 10, borderRadius: 9, cursor: "pointer" }}>
                        Valider
                      </button>
                    </form>
                    <form action={moderatePromo} style={{ flex: 1 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button type="submit" style={{ width: "100%", border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", fontWeight: 700, fontSize: 13, padding: 10, borderRadius: 9, cursor: "pointer" }}>
                        Refuser
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f0e8d6", paddingTop: 11 }}>
                    <span style={{ fontSize: 12.5, color: "#1f8a5b", fontWeight: 700 }}>● En ligne</span>
                    <form action={moderatePromo}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="action" value="remove" />
                      <button type="submit" style={{ border: "none", background: "transparent", color: "#a99c82", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                        Retirer
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
