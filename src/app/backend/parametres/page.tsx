import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { ImageField } from "@/components/ImageField";
import { can } from "@/lib/rbac";
import { getSiteSettings } from "@/lib/site-settings";
import { saveSiteSettings } from "../actions";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const session = await auth();
  if (!can(session?.user.role, "manageSettings")) redirect("/backend");

  const settings = await getSiteSettings();

  return (
    <form action={saveSiteSettings} style={{ display: "grid", gap: 22, maxWidth: 1080 }}>
      <section style={panel}>
        <h2 className="font-display" style={title}>Identité du site</h2>
        <div className="grid grid-2" style={{ gap: 16 }}>
          <Field label="Nom association" name="association_name" value={settings.association_name} />
          <Field label="Slogan" name="association_tagline" value={settings.association_tagline} />
          <Field label="E-mail" name="association_email" value={settings.association_email} />
          <Field label="Téléphone" name="association_phone" value={settings.association_phone} />
          <Field label="Site web" name="association_website" value={settings.association_website} />
          <Field label="Contact principal" name="association_contact" value={settings.association_contact} />
          <Field
            label="Page Facebook"
            name="association_facebook"
            value={settings.association_facebook}
            placeholder="https://www.facebook.com/..."
          />
          <Field
            label="Page LinkedIn"
            name="association_linkedin"
            value={settings.association_linkedin}
            placeholder="https://www.linkedin.com/company/..."
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Adresse" name="association_address" value={settings.association_address} />
          </div>
          <Area label="Texte d'introduction Association" name="association_intro" value={settings.association_intro} />
          <Area
            label="Mission (une ligne vide sépare les paragraphes)"
            name="association_mission"
            value={settings.association_mission}
          />
          <Area
            label="Ce que l'association apporte (Titre|Description, une ligne par point)"
            name="association_pillars"
            value={settings.association_pillars}
          />
        </div>
        <div style={{ marginTop: 14, color: "#9a6638", fontSize: 13, lineHeight: 1.6 }}>
          Les pages Facebook et LinkedIn s&apos;affichent sur la page d&apos;accueil et dans le pied
          de page. Laissez un champ vide pour masquer le réseau correspondant. La publication
          automatique des promotions, elle, se configure côté serveur (jetons d&apos;accès dans les
          variables d&apos;environnement).
        </div>
      </section>

      <section style={panel}>
        <h2 className="font-display" style={title}>Directoire</h2>
        <div className="grid grid-2" style={{ gap: 16 }}>
          <Field label="Président(e)" name="association_president" value={settings.association_president} />
          <Field label="Intitulé du rôle" name="association_president_role" value={settings.association_president_role} />
          <Field label="Vice-président(e)" name="association_vice_president" value={settings.association_vice_president} />
          <Field label="Trésorier(ère)" name="association_treasurer" value={settings.association_treasurer} />
          <Field label="Secrétaire" name="association_secretary" value={settings.association_secretary} />
          <ImageField name="association_president_photo" label="Photo président(e)" defaultValue={settings.association_president_photo} height={130} />
          <Area label="Message président(e)" name="association_president_message" value={settings.association_president_message} />
          <Area
            label="Autres membres du directoire (Nom|Fonction, une ligne par personne)"
            name="association_board_members"
            value={settings.association_board_members}
          />
        </div>
      </section>

      <section style={panel}>
        <h2 className="font-display" style={title}>Mentions légales & confidentialité</h2>
        <div className="grid grid-2" style={{ gap: 16 }}>
          <Field label="SIRET" name="association_siret" value={settings.association_siret} />
          <Field label="RNA" name="association_rna" value={settings.association_rna} />
          <Field label="Directeur de publication" name="association_publication_director" value={settings.association_publication_director} />
          <Field label="Contact confidentialité/RGPD" name="association_privacy_contact" value={settings.association_privacy_contact} />
          <Field label="Hébergeur" name="association_host_name" value={settings.association_host_name} />
          <Field label="Téléphone hébergeur" name="association_host_phone" value={settings.association_host_phone} />
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Adresse hébergeur" name="association_host_address" value={settings.association_host_address} />
          </div>
          <Field label="Dernière mise à jour légale" name="legal_updated" value={settings.legal_updated} placeholder="17 juillet 2026" />
        </div>
        <div style={{ marginTop: 14, color: "#9a6638", fontSize: 13, lineHeight: 1.6 }}>
          Remplissez ces champs avant mise en production: ils alimentent les pages publiques
          Mentions légales et Confidentialité.
        </div>
      </section>

      <button type="submit" style={submitButton}>Enregistrer les paramètres</button>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input name={name} defaultValue={value} placeholder={placeholder} className="field" />
    </div>
  );
}

function Area({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <label className="field-label">{label}</label>
      <textarea name={name} rows={4} defaultValue={value} className="field" />
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
  margin: "0 0 16px",
  fontSize: 20,
  color: "#26201a",
};

const submitButton: CSSProperties = {
  justifySelf: "start",
  border: "none",
  background: "#13324F",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14.5,
  padding: "13px 22px",
  borderRadius: 10,
  cursor: "pointer",
};
