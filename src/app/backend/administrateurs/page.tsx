import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { can, ROLE_LABELS, STAFF_ROLES } from "@/lib/rbac";
import { removeAdmin } from "../actions";
import { InviteAdminForm } from "./InviteAdminForm";

export const dynamic = "force-dynamic";

function initialsOf(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default async function AdminsPage() {
  const session = await getSession();
  if (!can(session?.user.role, "manageAdmins")) {
    redirect("/backend");
  }

  const admins = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(inArray(users.role, STAFF_ROLES));

  return (
    <div className="grid admins-split">
      <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, overflow: "hidden" }}>
        <div className="font-display" style={{ padding: "16px 22px", borderBottom: "1px solid #f0e8d6", fontWeight: 700, fontSize: 16, color: "#26201a" }}>
          Administrateurs ({admins.length})
        </div>
        {admins.map((a) => {
          const isAdmin = a.role === "admin";
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 22px", borderBottom: "1px solid #f4eede" }}>
              <span className="font-display" style={{ width: 40, height: 40, borderRadius: "50%", background: "#13324F", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {initialsOf(a.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#26201a" }}>{a.name}</div>
                <div style={{ fontSize: 12.5, color: "#a99c82" }}>{a.email}</div>
              </div>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "4px 11px",
                  borderRadius: 999,
                  background: isAdmin ? "#e7eef6" : "#f1efe7",
                  color: isAdmin ? "#2C6FB3" : "#6c6150",
                }}
              >
                {ROLE_LABELS[a.role]}
              </span>
              {a.id !== Number(session?.user.id) && (
                <form action={removeAdmin}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" style={{ border: "none", background: "transparent", color: "#d8472b", fontWeight: 700, fontSize: 13, cursor: "pointer", marginLeft: 8 }}>
                    Retirer
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22 }}>
        <h3 className="font-display" style={{ fontWeight: 700, fontSize: 16, margin: "0 0 16px", color: "#26201a" }}>
          Inviter un administrateur
        </h3>
        <InviteAdminForm />
      </div>
    </div>
  );
}
