import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { promotions } from "@/db/schema";
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

  const pendingRows = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(eq(promotions.status, "pending"));

  return (
    <BackendShell
      user={{ name: session.user.name ?? "Adhérent", role: session.user.role }}
      pendingCount={pendingRows.length}
    >
      {children}
    </BackendShell>
  );
}
