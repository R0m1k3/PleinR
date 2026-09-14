import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { EmailCreator } from "@/components/EmailCreator";
import { can } from "@/lib/rbac";
import { emailBrand, getSiteSettings } from "@/lib/site-settings";
import { audienceOptions } from "@/lib/mail-recipients";
import { isMailConfigured } from "@/lib/mail-accounts";
import { siteUrl } from "@/lib/social-accounts";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const session = await getSession();
  if (!can(session?.user.role, "manageEmails")) redirect("/backend");

  const [settings, choices, mailReady, base] = await Promise.all([
    getSiteSettings(),
    audienceOptions(),
    isMailConfigured(),
    siteUrl(),
  ]);

  return (
    <EmailCreator
      brand={emailBrand(settings)}
      choices={choices}
      mailReady={mailReady}
      siteUrl={base}
    />
  );
}
