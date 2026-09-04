/**
 * Données de démonstration.
 *
 * Elles ne sont insérées que par `npm run db:seed` avec `SEED_DEMO=true`, et
 * `npm run db:purge-demo` sait les retirer d'une base qui les a reçues. Tout
 * ce qui identifie ces enregistrements (e-mails, titres, noms, messages) vit
 * ici pour que les deux scripts restent alignés.
 */

export const DEMO_PASSWORD = "changeme123";

export function demoMembers(catId: (slug: string) => number | null) {
  return [
    {
      name: "Au Bon Pain",
      email: "contact@aubonpain.fr",
      categoryId: catId("boulangerie"),
      city: "Frouard",
      address: "12 rue de la République",
      postalCode: "54390",
      phone: "03 83 49 00 00",
      website: "https://www.aubonpain-frouard.fr",
      memberSince: 2021,
      tags: "Levain naturel, Produits locaux, Fait maison, Sans conservateur",
      hours: "Mardi – Vendredi|7h – 19h30\nSamedi|7h – 19h\nDimanche|7h – 13h\nLundi|Fermé",
      description:
        "Boulangerie artisanale familiale installée au cœur de Frouard depuis trois générations. Nous travaillons chaque jour des farines locales et un levain naturel pour vous proposer pains, viennoiseries et pâtisseries faits maison.\nNotre équipe vous accueille du mardi au dimanche matin. Spécialités : pain au levain, baguette de tradition, kouglof et tartes aux fruits de saison.",
      status: "active" as const,
      highlighted: true,
    },
    {
      name: "Café des Arts",
      email: "hello@cafedesarts.fr",
      categoryId: catId("restauration"),
      city: "Pompey",
      address: "3 place Stanislas",
      postalCode: "54340",
      phone: "03 83 24 00 00",
      memberSince: 2019,
      tags: "Cuisine de saison, Brunch, Terrasse, Produits frais",
      hours: "Lundi – Vendredi|9h – 18h\nSamedi|9h – 19h\nDimanche|10h – 15h",
      description: "Cuisine de saison, brunch le dimanche, terrasse au cœur du bourg.",
      status: "active" as const,
      highlighted: true,
    },
    {
      name: "Atelier Émilie",
      email: "emilie@atelier.fr",
      categoryId: catId("mode-beaute"),
      city: "Champigneulles",
      address: "7 av. des Tilleuls",
      description: "Salon de coiffure & soins, sur rendez-vous du mardi au samedi.",
      status: "active" as const,
      highlighted: true,
    },
    {
      name: "Garage Moderne",
      email: "contact@garagemoderne.fr",
      categoryId: catId("services"),
      city: "Custines",
      description: "Entretien et réparation toutes marques.",
      status: "active" as const,
    },
    {
      name: "Boutique Indigo",
      email: "indigo@boutique.fr",
      categoryId: catId("mode-beaute"),
      city: "Liverdun",
      description: "Prêt-à-porter et accessoires.",
      status: "pending" as const,
    },
    {
      name: "Fleurs & Sens",
      email: "contact@fleursetsens.fr",
      categoryId: catId("artisanat"),
      city: "Pompey",
      description: "Compositions florales, fleurs de saison cueillies localement.",
      status: "active" as const,
    },
    {
      name: "La Cave Gourmande",
      email: "bonjour@cavegourmande.fr",
      categoryId: catId("alimentation"),
      city: "Frouard",
      description: "Fromages fermiers, vins et produits du terroir.",
      status: "active" as const,
    },
  ];
}

export function demoPromotions(memberId: (name: string) => number | null) {
  return [
    { title: "Le 13e pain offert", text: "Sur présentation de votre carte adhérent, profitez d'une réduction sur nos pains au levain.", category: "Boulangerie", badge: "-20%", memberId: memberId("Au Bon Pain"), status: "live" as const, validUntil: "Valable jusqu'au 30 juin" },
    { title: "Formule midi du marché", text: "Entrée + plat + café à 15€ tous les midis de semaine. Produits frais et locaux.", category: "Restauration", badge: "Menu 15€", memberId: memberId("Café des Arts"), status: "live" as const, validUntil: "Du lundi au vendredi" },
    { title: "Soin offert dès 2 prestations", text: "Profitez de -30% sur le 2e soin réservé dans le mois. Sur rendez-vous.", category: "Beauté", badge: "-30%", memberId: memberId("Atelier Émilie"), status: "pending" as const, validUntil: "Jusqu'au 15 juillet" },
    { title: "Révision auto à prix réseau", text: "15€ de remise sur votre forfait révision pour tous les adhérents Plein R.", category: "Services", badge: "-15€", memberId: memberId("Garage Moderne"), status: "pending" as const, validUntil: "Toute l'année" },
    { title: "Bouquet du mois en promo", text: "-25% sur la composition florale du mois. Fleurs de saison, cueillies localement.", category: "Artisanat", badge: "-25%", memberId: memberId("Fleurs & Sens"), status: "live" as const, validUntil: "Jusqu'au 30 juin" },
    { title: "2 fromages achetés, 1 offert", text: "Sur une sélection de fromages fermiers. L'occasion de découvrir nos producteurs.", category: "Alimentation", badge: "2+1", memberId: memberId("La Cave Gourmande"), status: "live" as const, validUntil: "Ce week-end" },
  ];
}

export const demoRequests = [
  { name: "Boutique Indigo", email: "indigo@boutique.fr", message: "Souhaite rejoindre le réseau." },
  { name: "Pizzeria Bella", email: "contact@bella.fr", message: "Demande d'adhésion." },
  { name: "Coworking La Ruche", email: "hello@laruche.fr", message: "Espace de travail partagé." },
];

export const demoActivity = [
  { dot: "#1f8a5b", message: "<strong>Atelier Émilie</strong> a publié une promotion « Soin offert dès 2 prestations »" },
  { dot: "#E0A63C", message: "<strong>Garage Moderne</strong> a soumis une promotion en attente de validation" },
  { dot: "#2C6FB3", message: "Nouvelle demande d'adhésion : <strong>Boutique Indigo</strong>" },
  { dot: "#9a6638", message: "<strong>Café des Arts</strong> a mis à jour sa fiche annuaire" },
];

export function demoUsers(memberId: (name: string) => number | null) {
  return [
    { email: "claire@plein-r.fr", name: "Claire Martin", role: "admin" as const, memberId: null },
    { email: "thomas@plein-r.fr", name: "Thomas Petit", role: "moderator" as const, memberId: null },
    { email: "sophie@plein-r.fr", name: "Sophie Aubert", role: "editor" as const, memberId: null },
    { email: "contact@aubonpain.fr", name: "Au Bon Pain", role: "member" as const, memberId: memberId("Au Bon Pain") },
  ];
}

/** E-mails des fiches adhérent de démonstration. */
export function demoMemberEmails(): string[] {
  return demoMembers(() => null).map((m) => m.email);
}

/** Titres des promotions de démonstration. */
export function demoPromotionTitles(): string[] {
  return demoPromotions(() => null).map((p) => p.title);
}

/** E-mails des comptes de démonstration. */
export function demoUserEmails(): string[] {
  return demoUsers(() => null).map((u) => u.email);
}
