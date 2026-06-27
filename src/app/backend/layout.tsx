import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contactMessages, membershipRequests, promotions } from "@/db/schema";
import { isStaff } from "@/lib/rbac";
import { BackendShell } from "./BackendShell";

export const dynamic = "force-dynamic";

export default async function BackendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
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
