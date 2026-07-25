import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { contactMessages, imageConsents, membershipRequests, promotions } from "@/db/schema";
import { ImageConsentForm } from "@/components/ImageConsentForm";
import { isStaff } from "@/lib/rbac";
import { saveImageConsent } from "./actions";
import { BackendShell } from "./BackendShell";

export const dynamic = "force-dynamic";

export default async function BackendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role === "member" &&
    session.user.memberId &&
    !session.user.mustChangePassword
  ) {
    const latestConsent = await db
      .select({ id: imageConsents.id })
      .from(imageConsents)
      .where(eq(imageConsents.memberId, session.user.memberId))
      .orderBy(desc(imageConsents.createdAt))
      .limit(1);

    if (latestConsent.length === 0) {
      return (
        <div style={{ minHeight: "100vh", background: "#F6F2E8", color: "#33291D", fontFamily: "'Public Sans',sans-serif", padding: "clamp(22px, 5vw, 54px)" }}>
          <main style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo.png" alt="Plein R" style={{ height: 50, width: "auto" }} />
              <div>
                <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: "#26201a" }}>
                  Consentement RGPD
                </div>
                <div style={{ color: "#8c8068", fontSize: 14 }}>Droit à l'image - première connexion adhérent</div>
              </div>
            </div>
            <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 20, padding: "clamp(22px, 5vw, 36px)", boxShadow: "0 24px 55px -42px rgba(40,30,15,0.55)" }}>
              <h1 className="font-display" style={{ margin: "0 0 10px", color: "#26201a", fontSize: "clamp(28px, 5vw, 40px)" }}>
                Votre choix sur le droit à l'image
              </h1>
              <p style={{ margin: "0 0 20px", color: "#6c6150", lineHeight: 1.7 }}>
                Avant d'accéder à votre espace, indiquez si Plein R peut utiliser votre image dans
                les supports liés aux rencontres et à la vie de l'association.
              </p>
              <ImageConsentForm saveAction={saveImageConsent} defaultName={session.user.name ?? "Adhérent"} />
            </section>
          </main>
        </div>
      );
    }
  }

  let pendingCount = 0;
  let inboxCount = 0;
  if (isStaff(session.user.role)) {
    const [pendingRows, newReqs, newMsgs] = await Promise.all([
      db.select({ id: promotions.id }).from(promotions).where(eq(promotions.status, "pending")),
      db.select({ id: membershipRequests.id }).from(membershipRequests).where(eq(membershipRequests.status, "new")),
      db.select({ id: contactMessages.id }).from(contactMessages).where(eq(contactMessages.status, "new")),
    ]);
    pendingCount = pendingRows.length;
    inboxCount = newReqs.length + newMsgs.length;
  }

  return (
    <BackendShell
      user={{ name: session.user.name ?? "Adhérent", role: session.user.role }}
      pendingCount={pendingCount}
      inboxCount={inboxCount}
    >
      {children}
    </BackendShell>
  );
}
