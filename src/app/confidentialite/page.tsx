import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Confidentialité — Plein R",
  description: "Politique de confidentialité et traitement des données personnelles par Plein R.",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Confidentialité" intro="Cette page explique quelles données sont recueillies et comment Plein R les utilise.">
      <h2>Données recueillies</h2>
      <p>Selon votre utilisation du site, Plein R peut recevoir :</p>
      <ul>
        <li>vos nom, e-mail, téléphone et message lors d’une prise de contact ou demande d’adhésion ;</li>
        <li>les informations professionnelles publiées dans l’annuaire et les promotions ;</li>
        <li>les données nécessaires à la connexion et à la sécurisation des espaces privés.</li>
      </ul>

      <h2>Finalités</h2>
      <p>
        Ces données servent à répondre aux demandes, gérer les adhésions, administrer l’annuaire,
        modérer les promotions et sécuriser l’accès aux comptes. Elles ne sont pas vendues à des tiers.
      </p>

      <h2>Responsable, bases légales et destinataires</h2>
      <p>
        Plein R est responsable des traitements réalisés par ce site. Les traitements reposent, selon le cas,
        sur les démarches précontractuelles liées à l’adhésion, l’exécution de la relation avec les adhérents,
        l’intérêt légitime de l’association à répondre aux demandes et administrer son réseau, ou une obligation légale.
      </p>
      <p>
        Seules les personnes habilitées au sein de Plein R et les prestataires techniques nécessaires au fonctionnement
        du site peuvent accéder aux données, dans la limite de leurs missions.
      </p>

      <h2>Durée et sécurité</h2>
      <p>
        Les données sont conservées pendant la durée nécessaire au traitement demandé, à la gestion de la relation
        avec l’association et au respect de ses obligations. Des mesures adaptées limitent accès, perte ou divulgation non autorisée.
      </p>

      <h2>Cookies</h2>
      <p>
        Le site utilise uniquement les éléments techniques nécessaires à son fonctionnement, notamment pour maintenir
        une session sécurisée dans l’espace adhérent ou l’administration.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander accès, rectification, effacement, limitation, opposition ou portabilité concernant vos données,
        selon les conditions prévues par la réglementation.
        Envoyez votre demande via le formulaire « Nous contacter » en précisant votre identité et l’objet de votre demande.
      </p>
      <p>Vous pouvez également saisir la CNIL si vous estimez que vos droits ne sont pas respectés.</p>
    </LegalPage>
  );
}
