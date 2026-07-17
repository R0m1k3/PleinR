import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Mentions légales — Plein R",
  description: "Mentions légales du site de l'association Plein R.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" intro="Informations relatives à l’édition et à l’utilisation du site Plein R.">
      <h2>Éditeur du site</h2>
      <p>
        Ce site est édité par Plein R, association des commerçants et entreprises du Bassin de Pompey.
      </p>
      <ul>
        <li>Siège social : à compléter par l’association</li>
        <li>Numéro RNA et, le cas échéant, SIREN : à compléter par l’association</li>
        <li>Direction de la publication : à compléter par l’association</li>
      </ul>
      <p>Pour contacter Plein R, utilisez le formulaire « Nous contacter » disponible en pied de page.</p>

      <h2>Hébergement</h2>
      <p>
        Nom, raison sociale, adresse et numéro de téléphone de l’hébergeur : à compléter par l’association
        dès que l’hébergement de production est choisi.
      </p>

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
    </LegalPage>
  );
}
