import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { EmailCreator } from "@/components/EmailCreator";
import { can } from "@/lib/rbac";
import { emailBrand, getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const session = await getSession();
  if (!can(session?.user.role, "manageEmails")) redirect("/backend");
  const settings = await getSiteSettings();

  return <EmailCreator brand={emailBrand(settings)} />;
}
