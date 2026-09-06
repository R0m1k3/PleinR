/**
 * Tags automatiques des fiches adhérents.
 *
 * Module **pur** (aucun accès base, utilisable côté client comme côté serveur) :
 * - un vocabulaire de mots-clés par métier (slug de catégorie) ;
 * - un vocabulaire transversal détecté dans la description (fait maison, bio,
 *   livraison, sur rendez-vous…) ;
 * - `suggestTags()` qui combine métier, commune et description ;
 * - `autoTags()` qui n'intervient que si l'adhérent n'a rien saisi.
 *
 * Les tags s'affichent sur la fiche publique et partent dans les données
 * structurées (`LocalBusiness.keywords`) : ce sont des mots que les clients
 * tapent dans Google, pas des étiquettes internes.
 */

export const MAX_TAGS = 10;

/** Mots-clés par métier. Les slugs sont ceux de `src/db/categories.ts`. */
export const CATEGORY_TAGS: Record<string, string[]> = {
  // Bouche & alimentation
  alimentation: ["Épicerie", "Produits frais", "Produits locaux", "Dépannage"],
  "epicerie-fine": ["Épicerie fine", "Produits du terroir", "Cadeaux gourmands", "Vins"],
  supermarche: ["Supermarché", "Courses", "Drive", "Produits frais"],
  boulangerie: ["Boulangerie", "Pain", "Viennoiseries", "Pâtisserie", "Sandwichs"],
  "boucherie-charcuterie": ["Boucherie", "Charcuterie", "Viande locale", "Plats cuisinés"],
  poissonnerie: ["Poissonnerie", "Poisson frais", "Fruits de mer", "Plateaux"],
  primeur: ["Primeur", "Fruits et légumes", "Produits de saison", "Producteurs locaux"],
  fromagerie: ["Fromagerie", "Fromages", "Crèmerie", "Plateaux de fromages"],
  cave: ["Cave à vins", "Vins", "Spiritueux", "Bières", "Conseils"],
  "brasserie-artisanale": ["Brasserie artisanale", "Bières locales", "Boissons", "Coffrets"],
  chocolaterie: ["Chocolaterie", "Chocolats", "Confiserie", "Cadeaux"],
  "glacier-salon-de-the": ["Glacier", "Salon de thé", "Glaces artisanales", "Goûter"],
  traiteur: ["Traiteur", "Plats à emporter", "Buffets", "Événements", "Repas d'entreprise"],
  restauration: ["Restaurant", "Cuisine maison", "Menu du jour", "Repas de groupe"],
  pizzeria: ["Pizzeria", "Pizzas", "À emporter", "Livraison"],
  "restauration-rapide": ["Restauration rapide", "Snack", "Burgers", "À emporter", "Food truck"],
  "cafe-bar": ["Café", "Bar", "Brasserie", "Terrasse", "Afterwork"],
  // Mode, beauté & soin
  "mode-beaute": ["Mode", "Beauté", "Prêt-à-porter", "Accessoires"],
  "mode-vetements": ["Vêtements", "Prêt-à-porter", "Mode femme", "Mode homme", "Accessoires"],
  lingerie: ["Lingerie", "Sous-vêtements", "Maillots de bain", "Conseil"],
  "vetements-enfants": ["Vêtements enfants", "Mode enfant", "Puériculture", "Cadeaux naissance"],
  "chaussures-maroquinerie": ["Chaussures", "Maroquinerie", "Sacs", "Cordonnerie"],
  bijouterie: ["Bijouterie", "Bijoux", "Montres", "Réparation", "Gravure"],
  coiffure: ["Coiffeur", "Coupe", "Couleur", "Brushing", "Coiffure mariage"],
  barbier: ["Barbier", "Barbe", "Coupe homme", "Rasage"],
  esthetique: ["Institut de beauté", "Soins du visage", "Épilation", "Manucure", "Maquillage"],
  onglerie: ["Onglerie", "Pose d'ongles", "Manucure", "Nail art"],
  parfumerie: ["Parfumerie", "Parfums", "Cosmétiques", "Coffrets cadeaux"],
  "bien-etre": ["Bien-être", "Massage", "Spa", "Relaxation", "Soins"],
  optique: ["Opticien", "Lunettes", "Lentilles", "Examen de vue", "Lunettes de soleil"],
  tatouage: ["Tatoueur", "Tatouage", "Piercing", "Sur rendez-vous"],
  // Maison, équipement & décoration
  "bazar-discount": ["Bazar", "Discount", "Équipement de la maison", "Décoration", "Jouets", "Petits prix"],
  decoration: ["Décoration", "Meubles", "Ameublement", "Luminaires", "Idées cadeaux"],
  cuisiniste: ["Cuisiniste", "Cuisine équipée", "Salle de bain", "Dressing", "Sur mesure"],
  literie: ["Literie", "Matelas", "Sommiers", "Linge de lit"],
  "arts-de-la-table": ["Arts de la table", "Vaisselle", "Cadeaux", "Liste de mariage"],
  "electromenager-multimedia": ["Électroménager", "Multimédia", "TV", "Réparation", "Livraison"],
  fleuriste: ["Fleuriste", "Bouquets", "Plantes", "Mariage", "Deuil", "Livraison de fleurs"],
  jardinerie: ["Jardinerie", "Plantes", "Motoculture", "Terreau", "Conseils jardin"],
  "bricolage-jardinage": ["Bricolage", "Jardinage", "Outillage", "Quincaillerie"],
  animalerie: ["Animalerie", "Alimentation animale", "Toilettage", "Accessoires"],
  // Artisanat & bâtiment
  artisanat: ["Artisan", "Fait main", "Création", "Sur mesure"],
  batiment: ["Bâtiment", "Rénovation", "Travaux", "Devis gratuit"],
  architecte: ["Architecte", "Maître d'œuvre", "Permis de construire", "Rénovation"],
  maconnerie: ["Maçonnerie", "Gros œuvre", "Terrassement", "Rénovation"],
  "couverture-toiture": ["Couvreur", "Toiture", "Zinguerie", "Isolation de toiture", "Urgence"],
  plomberie: ["Plombier", "Chauffagiste", "Chaudière", "Pompe à chaleur", "Dépannage"],
  electricite: ["Électricien", "Installation électrique", "Mise aux normes", "Domotique", "Dépannage"],
  "isolation-energie": ["Isolation", "Énergies renouvelables", "Panneaux solaires", "Rénovation énergétique"],
  menuiserie: ["Menuisier", "Menuiserie", "Ébénisterie", "Sur mesure", "Fenêtres"],
  "serrurerie-metallerie": ["Serrurier", "Métallerie", "Portails", "Garde-corps", "Urgence"],
  "carrelage-sols": ["Carreleur", "Carrelage", "Parquet", "Revêtements de sols"],
  peinture: ["Peintre", "Peinture", "Décoration intérieure", "Papier peint", "Ravalement"],
  paysagiste: ["Paysagiste", "Espaces verts", "Entretien de jardin", "Clôtures", "Élagage"],
  "depannage-multiservices": ["Dépannage", "Multiservices", "Petits travaux", "Homme toutes mains"],
  // Auto & mobilité
  automobile: ["Garage", "Entretien auto", "Réparation", "Pneus", "Contrôle technique"],
  carrosserie: ["Carrosserie", "Peinture auto", "Pare-brise", "Débosselage"],
  "controle-technique": ["Contrôle technique", "Contre-visite", "Sans rendez-vous"],
  "station-service-lavage": ["Station-service", "Carburant", "Lavage auto", "Boutique"],
  "location-vehicules": ["Location de voitures", "Location utilitaire", "Location camionnette"],
  "cycles-motos": ["Vélos", "Motos", "Vélo électrique", "Réparation", "Accessoires"],
  "auto-ecole": ["Auto-école", "Permis B", "Code de la route", "Conduite accompagnée"],
  "taxi-vtc": ["Taxi", "VTC", "Transport de personnes", "Gare", "Aéroport"],
  // Santé
  sante: ["Pharmacie", "Santé", "Parapharmacie", "Orthopédie", "Conseils"],
  medical: ["Médical", "Paramédical", "Soins", "Sur rendez-vous"],
  audioprothese: ["Audioprothésiste", "Appareils auditifs", "Bilan auditif", "Piles"],
  veterinaire: ["Vétérinaire", "Soins animaux", "Vaccination", "Urgences vétérinaires"],
  // Banque, assurance & immobilier
  "banque-assurance": ["Banque", "Assurance", "Crédit", "Épargne", "Professionnels"],
  assurance: ["Assurance", "Assurance auto", "Assurance habitation", "Mutuelle santé", "Prévoyance", "Assurance professionnelle"],
  "courtier-credit": ["Courtier", "Crédit immobilier", "Rachat de crédit", "Financement", "Assurance emprunteur"],
  immobilier: ["Agence immobilière", "Vente", "Location", "Estimation gratuite", "Gestion locative"],
  "diagnostic-immobilier": ["Diagnostic immobilier", "DPE", "Expertise", "Amiante", "Plomb"],
  // Services aux particuliers
  services: ["Services", "Proximité", "Sur devis"],
  "services-a-la-personne": ["Aide à domicile", "Ménage", "Garde d'enfants", "Services à la personne", "Crédit d'impôt"],
  "pressing-retouches": ["Pressing", "Retouches", "Cordonnerie", "Nettoyage à sec", "Clés"],
  photographe: ["Photographe", "Portrait", "Mariage", "Photo d'identité", "Vidéo"],
  "pompes-funebres": ["Pompes funèbres", "Obsèques", "Marbrerie", "Prévoyance obsèques"],
  "agence-voyages": ["Agence de voyages", "Séjours", "Billets", "Croisières", "Voyages de groupe"],
  demenagement: ["Déménagement", "Garde-meubles", "Cartons", "Devis gratuit"],
  // Services aux entreprises
  comptabilite: ["Expert-comptable", "Comptabilité", "Gestion", "Création d'entreprise", "Paie"],
  juridique: ["Notaire", "Juridique", "Avocat", "Conseil", "Succession"],
  conseil: ["Conseil", "Consultant", "Stratégie", "Accompagnement", "Formation"],
  communication: ["Communication", "Site web", "Marketing", "Réseaux sociaux", "Graphisme"],
  "imprimerie-enseignes": ["Imprimerie", "Enseignes", "Signalétique", "Flocage", "Cartes de visite"],
  informatique: ["Informatique", "Dépannage informatique", "Téléphonie", "Réparation", "Réseau"],
  nettoyage: ["Nettoyage", "Entretien de locaux", "Vitres", "Fin de chantier"],
  transport: ["Transport", "Logistique", "Livraison", "Messagerie"],
  securite: ["Sécurité", "Alarme", "Vidéosurveillance", "Gardiennage"],
  coworking: ["Coworking", "Bureaux", "Salle de réunion", "Domiciliation"],
  "interim-rh": ["Intérim", "Recrutement", "Ressources humaines", "Emploi"],
  "recyclage-dechets": ["Recyclage", "Déchets", "Débarras", "Ferraille", "Location de bennes"],
  // Culture, loisirs & formation
  "librairie-papeterie": ["Librairie", "Papeterie", "Presse", "Livres", "Fournitures scolaires"],
  "tabac-presse": ["Tabac", "Presse", "Loto", "FDJ", "Relais colis"],
  "jouets-puericulture": ["Jouets", "Puériculture", "Jeux", "Cadeaux enfants", "Liste de naissance"],
  "sport-loisirs": ["Sport", "Loisirs", "Activités", "Cours", "Stages"],
  "articles-de-sport": ["Articles de sport", "Équipement sportif", "Chaussures de sport", "Textile"],
  fitness: ["Salle de sport", "Fitness", "Musculation", "Cours collectifs", "Coaching"],
  "culture-arts": ["Culture", "Arts", "Galerie", "Cours", "Spectacles"],
  "education-formation": ["Formation", "Cours", "Soutien scolaire", "Formation professionnelle"],
  "tourisme-hotellerie": ["Hôtel", "Hébergement", "Chambres d'hôtes", "Gîte", "Séminaires"],
  evenementiel: ["Événementiel", "Organisation d'événements", "Mariage", "Location de matériel", "Animation"],
  // Entreprise, production & institutions
  industrie: ["Industrie", "Production", "Fabrication", "Sous-traitance"],
  agriculture: ["Producteur local", "Ferme", "Vente directe", "Produits fermiers", "Circuit court"],
  "partenaire-institutionnel": ["Partenaire", "Collectivité", "Institution", "Service public"],
};

/**
 * Vocabulaire transversal détecté dans la description. Chaque motif est testé
 * sur le texte normalisé (minuscules, sans accents).
 */
export const DESCRIPTION_VOCABULARY: { tag: string; patterns: RegExp[] }[] = [
  { tag: "Fait maison", patterns: [/\bfaite?s? maison\b/, /\bmaison\b.*\b(pain|plat|patisserie|gateau|cuisine)/] },
  { tag: "Artisanal", patterns: [/\bartisanal(e|es|aux)?\b/, /\bartisan\b/] },
  { tag: "Bio", patterns: [/\bbio(logique|logiques)?\b/] },
  { tag: "Produits locaux", patterns: [/\blocal(e|es)?\b/, /\blocaux\b/, /\bterroir\b/, /\bcircuit court\b/] },
  { tag: "Sur commande", patterns: [/\bsur commande\b/, /\bcommandes?\b/] },
  { tag: "Livraison", patterns: [/\blivraisons?\b/, /\blivr(e|ons|ez)\b/] },
  { tag: "À emporter", patterns: [/\ba emporter\b/, /\bvente a emporter\b/] },
  { tag: "Click & collect", patterns: [/\bclick\s*(&|and|et)\s*collect\b/, /\bretrait en magasin\b/] },
  { tag: "Sur rendez-vous", patterns: [/\bsur rendez[- ]vous\b/, /\brdv\b/] },
  { tag: "Sans rendez-vous", patterns: [/\bsans rendez[- ]vous\b/] },
  { tag: "Devis gratuit", patterns: [/\bdevis gratuits?\b/, /\bdevis\b/] },
  { tag: "Dépannage", patterns: [/\bdepannages?\b/, /\burgences?\b/, /\b7j\s*\/\s*7\b/, /\b24h\s*\/\s*24\b/] },
  { tag: "Sur mesure", patterns: [/\bsur[- ]mesure\b/, /\bpersonnalis(e|es|ee|ees|ation)\b/] },
  { tag: "Terrasse", patterns: [/\bterrasses?\b/] },
  { tag: "Parking", patterns: [/\bparking\b/, /\bstationnement\b/] },
  { tag: "Ouvert le dimanche", patterns: [/\bdimanche\b/] },
  { tag: "Accessible PMR", patterns: [/\bpmr\b/, /\bhandicap/, /\baccessible\b/] },
  { tag: "Événements", patterns: [/\bevenements?\b/, /\bmariages?\b/, /\bseminaires?\b/, /\banniversaires?\b/] },
  { tag: "Professionnels", patterns: [/\bprofessionnels\b/, /\bentreprises\b/, /\bb ?to ?b\b/, /\bb2b\b/] },
  { tag: "Cadeaux", patterns: [/\bcadeaux?\b/, /\bcoffrets?\b/, /\bcartes? cadeau\b/] },
  { tag: "Conseil", patterns: [/\bconseils?\b/, /\baccompagnement\b/] },
  { tag: "Formation", patterns: [/\bformations?\b/, /\bcours\b/, /\bateliers?\b/, /\bstages?\b/] },
  { tag: "Nouveau", patterns: [/\bnouveau\b/, /\bnouvelle\b/, /\bouverture\b/] },
];

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** « a, b ,, c » → ["a", "b", "c"], sans doublons (accents et casse ignorés). */
export function parseTags(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (value ?? "").split(/[,;\n]/)) {
    const tag = raw.replace(/\s+/g, " ").trim();
    if (!tag) continue;
    const key = normalizeText(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function formatTags(tags: string[]): string {
  return parseTags(tags.join(", ")).join(", ");
}

/** Tags du métier : depuis le vocabulaire, sinon dérivés du libellé de la catégorie. */
export function categoryTags(categorySlug: string | null | undefined, categoryLabel: string | null | undefined): string[] {
  if (categorySlug && CATEGORY_TAGS[categorySlug]) return [...CATEGORY_TAGS[categorySlug]];
  if (!categoryLabel) return [];
  return categoryLabel
    .split(/\s*(?:–|—|-|\/|&|,)\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

/** Termes du vocabulaire transversal présents dans la description. */
export function tagsFromDescription(description: string | null | undefined): string[] {
  const text = normalizeText(description ?? "");
  if (!text) return [];
  return DESCRIPTION_VOCABULARY.filter((entry) => entry.patterns.some((p) => p.test(text))).map((e) => e.tag);
}

export type TagSuggestionInput = {
  categorySlug?: string | null;
  categoryLabel?: string | null;
  city?: string | null;
  description?: string | null;
};

/**
 * Suggestions ordonnées : le métier d'abord (c'est ce que l'on cherche le plus),
 * puis la commune, puis ce que la description révèle. Plafonné à `MAX_TAGS`.
 */
export function suggestTags(input: TagSuggestionInput, max = MAX_TAGS): string[] {
  const fromCategory = categoryTags(input.categorySlug, input.categoryLabel);
  const city = (input.city ?? "").trim();
  const fromDescription = tagsFromDescription(input.description);
  // Un mot-clé métier qui figure aussi dans la description remonte en tête : il
  // décrit vraiment l'activité, pas seulement la famille de métier.
  const text = normalizeText(input.description ?? "");
  const ranked = [...fromCategory].sort((a, b) => Number(text.includes(normalizeText(b))) - Number(text.includes(normalizeText(a))));
  return parseTags([...ranked, city, ...fromDescription].join(", ")).slice(0, max);
}

/**
 * Tags à enregistrer : la saisie de l'adhérent si elle existe, sinon les
 * suggestions. Ne modifie jamais des tags renseignés.
 */
export function autoTags(existing: string | null | undefined, input: TagSuggestionInput): string | null {
  const own = parseTags(existing);
  if (own.length > 0) return formatTags(own);
  const suggested = suggestTags(input);
  return suggested.length > 0 ? formatTags(suggested) : null;
}
