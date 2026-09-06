/**
 * Référentiel des catégories de métiers.
 *
 * Source unique pour le seed, la migration d'insertion (drizzle/0012_*) et le
 * bouton « Ajouter » du backend. Les slugs sont stables : ils servent de clé
 * d'unicité (`ON CONFLICT (slug)`) et ne doivent jamais être renommés, sinon la
 * catégorie serait dupliquée. Un libellé renommé depuis le backend est conservé :
 * la migration ne touche qu'à l'ordre d'affichage (`sort`).
 */

export const CATEGORY_PALETTE = [
  { accent: "#E0A63C", tint: "#f6efdc" },
  { accent: "#6FB0C6", tint: "#e7f0f3" },
  { accent: "#9a6638", tint: "#f4ebda" },
  { accent: "#2C6FB3", tint: "#eaf0f6" },
  { accent: "#5a7a5a", tint: "#eef0ec" },
  { accent: "#7a6f9c", tint: "#efe9f3" },
  { accent: "#c98a2e", tint: "#f7efe0" },
  { accent: "#3f8aa3", tint: "#e6eff2" },
] as const;

export type CategoryDefinition = { slug: string; label: string };

// NB : les slugs historiques (alimentation, boulangerie, restauration, mode-beaute,
// artisanat, services, sante) sont conservés pour ne pas casser les liens existants.
export const CATEGORY_REFERENTIAL: CategoryDefinition[] = [
  // ---- Bouche & alimentation ----
  { slug: "alimentation", label: "Alimentation / Épicerie" },
  { slug: "epicerie-fine", label: "Épicerie fine – Produits du terroir" },
  { slug: "supermarche", label: "Supermarché – Grande distribution" },
  { slug: "boulangerie", label: "Boulangerie – Pâtisserie" },
  { slug: "boucherie-charcuterie", label: "Boucherie – Charcuterie" },
  { slug: "poissonnerie", label: "Poissonnerie" },
  { slug: "primeur", label: "Primeur – Fruits & Légumes" },
  { slug: "fromagerie", label: "Fromagerie – Crèmerie" },
  { slug: "cave", label: "Cave – Vins & Spiritueux" },
  { slug: "brasserie-artisanale", label: "Brasserie artisanale – Boissons" },
  { slug: "chocolaterie", label: "Chocolaterie – Confiserie" },
  { slug: "glacier-salon-de-the", label: "Glacier – Salon de thé" },
  { slug: "traiteur", label: "Traiteur" },
  { slug: "restauration", label: "Restauration" },
  { slug: "pizzeria", label: "Pizzeria" },
  { slug: "restauration-rapide", label: "Restauration rapide – Food truck" },
  { slug: "cafe-bar", label: "Café – Bar – Brasserie" },
  // ---- Mode, beauté & soin ----
  { slug: "mode-beaute", label: "Mode & Beauté" },
  { slug: "mode-vetements", label: "Mode & Vêtements" },
  { slug: "lingerie", label: "Lingerie" },
  { slug: "vetements-enfants", label: "Vêtements enfants" },
  { slug: "chaussures-maroquinerie", label: "Chaussures – Maroquinerie" },
  { slug: "bijouterie", label: "Bijouterie – Horlogerie" },
  { slug: "coiffure", label: "Coiffure" },
  { slug: "barbier", label: "Barbier" },
  { slug: "esthetique", label: "Esthétique – Institut" },
  { slug: "onglerie", label: "Onglerie – Prothésie ongulaire" },
  { slug: "parfumerie", label: "Parfumerie" },
  { slug: "bien-etre", label: "Bien-être – Spa – Massage" },
  { slug: "optique", label: "Optique" },
  { slug: "tatouage", label: "Tatouage – Piercing" },
  // ---- Maison, équipement & décoration ----
  { slug: "bazar-discount", label: "Bazar – Discount – Équipement de la maison" },
  { slug: "decoration", label: "Décoration – Ameublement" },
  { slug: "cuisiniste", label: "Cuisines – Salles de bain" },
  { slug: "literie", label: "Literie" },
  { slug: "arts-de-la-table", label: "Arts de la table – Cadeaux" },
  { slug: "electromenager-multimedia", label: "Électroménager – Multimédia" },
  { slug: "fleuriste", label: "Fleuriste" },
  { slug: "jardinerie", label: "Jardinerie – Motoculture" },
  { slug: "bricolage-jardinage", label: "Bricolage – Jardinage" },
  { slug: "animalerie", label: "Animalerie – Services animaliers" },
  // ---- Artisanat & bâtiment ----
  { slug: "artisanat", label: "Artisanat" },
  { slug: "batiment", label: "Bâtiment – Rénovation" },
  { slug: "architecte", label: "Architecte – Maître d'œuvre" },
  { slug: "maconnerie", label: "Maçonnerie – Gros œuvre" },
  { slug: "couverture-toiture", label: "Couverture – Toiture – Zinguerie" },
  { slug: "plomberie", label: "Plomberie – Chauffage" },
  { slug: "electricite", label: "Électricité" },
  { slug: "isolation-energie", label: "Isolation – Énergies renouvelables" },
  { slug: "menuiserie", label: "Menuiserie – Ébénisterie" },
  { slug: "serrurerie-metallerie", label: "Serrurerie – Métallerie" },
  { slug: "carrelage-sols", label: "Carrelage – Revêtements de sols" },
  { slug: "peinture", label: "Peinture – Décoration intérieure" },
  { slug: "paysagiste", label: "Paysagiste – Espaces verts" },
  { slug: "depannage-multiservices", label: "Dépannage – Multiservices" },
  // ---- Auto & mobilité ----
  { slug: "automobile", label: "Automobile – Garage" },
  { slug: "carrosserie", label: "Carrosserie" },
  { slug: "controle-technique", label: "Contrôle technique" },
  { slug: "station-service-lavage", label: "Station-service – Lavage auto" },
  { slug: "location-vehicules", label: "Location de véhicules" },
  { slug: "cycles-motos", label: "Cycles – Motos" },
  { slug: "auto-ecole", label: "Auto-école" },
  { slug: "taxi-vtc", label: "Taxi – VTC" },
  // ---- Santé ----
  { slug: "sante", label: "Santé – Pharmacie" },
  { slug: "medical", label: "Médical – Paramédical" },
  { slug: "audioprothese", label: "Audioprothèse" },
  { slug: "veterinaire", label: "Vétérinaire" },
  // ---- Banque, assurance & immobilier ----
  { slug: "banque-assurance", label: "Banque – Assurance" },
  { slug: "assurance", label: "Assurance – Mutuelle – Prévoyance" },
  { slug: "courtier-credit", label: "Courtier – Crédit – Financement" },
  { slug: "immobilier", label: "Immobilier" },
  { slug: "diagnostic-immobilier", label: "Diagnostic immobilier – Expertise" },
  // ---- Services aux particuliers ----
  { slug: "services", label: "Services" },
  { slug: "services-a-la-personne", label: "Services à la personne – Aide à domicile" },
  { slug: "pressing-retouches", label: "Pressing – Retouches – Cordonnerie" },
  { slug: "photographe", label: "Photographe – Vidéo" },
  { slug: "pompes-funebres", label: "Pompes funèbres" },
  { slug: "agence-voyages", label: "Agence de voyages" },
  { slug: "demenagement", label: "Déménagement – Garde-meubles" },
  // ---- Services aux entreprises ----
  { slug: "comptabilite", label: "Comptabilité – Gestion" },
  { slug: "juridique", label: "Juridique – Notaire" },
  { slug: "conseil", label: "Conseil aux entreprises" },
  { slug: "communication", label: "Communication – Web – Marketing" },
  { slug: "imprimerie-enseignes", label: "Imprimerie – Enseignes – Signalétique" },
  { slug: "informatique", label: "Informatique – Téléphonie" },
  { slug: "nettoyage", label: "Nettoyage – Entretien" },
  { slug: "transport", label: "Transport – Logistique" },
  { slug: "securite", label: "Sécurité" },
  { slug: "coworking", label: "Coworking – Bureaux" },
  { slug: "interim-rh", label: "Intérim – Ressources humaines" },
  { slug: "recyclage-dechets", label: "Recyclage – Gestion des déchets" },
  // ---- Culture, loisirs & formation ----
  { slug: "librairie-papeterie", label: "Librairie – Papeterie – Presse" },
  { slug: "tabac-presse", label: "Tabac – Presse – Loto" },
  { slug: "jouets-puericulture", label: "Jouets – Puériculture" },
  { slug: "sport-loisirs", label: "Sport – Loisirs" },
  { slug: "articles-de-sport", label: "Articles de sport" },
  { slug: "fitness", label: "Salle de sport – Fitness" },
  { slug: "culture-arts", label: "Culture – Arts" },
  { slug: "education-formation", label: "Éducation – Formation" },
  { slug: "tourisme-hotellerie", label: "Tourisme – Hôtellerie" },
  { slug: "evenementiel", label: "Événementiel" },
  // ---- Entreprise, production & institutions ----
  { slug: "industrie", label: "Industrie – Production" },
  { slug: "agriculture", label: "Agriculture – Producteur local" },
  { slug: "partenaire-institutionnel", label: "Partenaire institutionnel – Collectivité" },
];

/** Lignes prêtes à insérer : couleur tournante et ordre d'affichage. */
export function categoryRows() {
  return CATEGORY_REFERENTIAL.map((c, i) => ({
    ...c,
    ...CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
    sort: i + 1,
  }));
}
