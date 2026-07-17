import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EmailCreator } from "@/components/EmailCreator";
import { can } from "@/lib/rbac";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const session = await auth();
  if (!can(session?.user.role, "manageEmails")) redirect("/backend");
  const settings = await getSiteSettings();
  const brand = {
    associationName: settings.association_name,
    address: settings.association_address,
    email: settings.association_email,
    phone: settings.association_phone,
    siret: settings.association_siret,
  };

  return <EmailCreator brand={brand} />;
}
