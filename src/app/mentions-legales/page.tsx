import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getSiteSettings } from "@/lib/site-settings";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Mentions légales",
  description: "Mentions légales du site de l'association Plein R : éditeur, hébergeur, propriété intellectuelle.",
  path: "/mentions-legales",
});

export const dynamic = "force-dynamic";

function value(input: string, fallback = "à renseigner") {
  return input || fallback;
}

export default async function MentionsLegalesPage() {
  const settings = await getSiteSettings();

  return (
    <LegalPage title="Mentions légales" intro={`Informations relatives à l’édition et à l’utilisation du site ${settings.association_name}.`}>
      <h2>Éditeur du site</h2>
      <p>
        Ce site est édité par {settings.association_name}, association des commerçants et entreprises du Bassin de Pompey.
      </p>
      <ul>
        <li>Siège social : {value(settings.association_address)}</li>
        <li>RNA : {value(settings.association_rna)}</li>
        <li>SIRET : {value(settings.association_siret)}</li>
        <li>Direction de la publication : {value(settings.association_publication_director || settings.association_president)}</li>
      </ul>
      <p>
        Contact : {value(settings.association_email || settings.association_contact)}{" "}
        {settings.association_phone ? `- ${settings.association_phone}` : ""}
      </p>

      <h2>Hébergement</h2>
      <ul>
        <li>Hébergeur : {value(settings.association_host_name)}</li>
        <li>Adresse : {value(settings.association_host_address)}</li>
        <li>Téléphone : {value(settings.association_host_phone)}</li>
      </ul>

      <h2>Propriété intellectuelle</h2>
      <p>
        Structure, textes, éléments graphiques et identité visuelle du site sont protégés. Toute reproduction,
        adaptation ou diffusion sans autorisation préalable de Plein R est interdite, hors exceptions prévues par la loi.
      </p>
      <p>Logos, images et contenus publiés par les adhérents restent la propriété de leurs titulaires respectifs.</p>

      <h2>Responsabilité</h2>
      <p>
        Plein R veille à la qualité des informations publiées, sans pouvoir garantir leur exhaustivité permanente.
        Les offres, coordonnées et contenus des adhérents relèvent de la responsabilité de leurs auteurs.
      </p>
      {settings.legal_updated && <p>Dernière mise à jour : {settings.legal_updated}</p>}
    </LegalPage>
  );
}
