import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import {
  DEMO_PASSWORD,
  demoActivity,
  demoMembers,
  demoPromotions,
  demoRequests,
  demoUsers,
} from "./demo-data";

const {
  categories,
  members,
  users,
  promotions,
  membershipRequests,
  activityLog,
} = schema;

// Mot de passe initial lisible, tiré avec un aléa cryptographique.
function randomPassword(length = 16): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  console.log("Seeding database…");

  // ---- Categories (métiers) — liste complète ----
  const PALETTE = [
    { accent: "#E0A63C", tint: "#f6efdc" },
    { accent: "#6FB0C6", tint: "#e7f0f3" },
    { accent: "#9a6638", tint: "#f4ebda" },
    { accent: "#2C6FB3", tint: "#eaf0f6" },
    { accent: "#5a7a5a", tint: "#eef0ec" },
    { accent: "#7a6f9c", tint: "#efe9f3" },
    { accent: "#c98a2e", tint: "#f7efe0" },
    { accent: "#3f8aa3", tint: "#e6eff2" },
  ];
  // NB: les slugs existants (alimentation, boulangerie, restauration, mode-beaute,
  // artisanat, services, sante) sont conservés pour ne pas casser les liens existants.
  const categoryList: { slug: string; label: string }[] = [
    // Bouche & alimentation
    { slug: "alimentation", label: "Alimentation / Épicerie" },
    { slug: "boulangerie", label: "Boulangerie – Pâtisserie" },
    { slug: "boucherie-charcuterie", label: "Boucherie – Charcuterie" },
    { slug: "poissonnerie", label: "Poissonnerie" },
    { slug: "primeur", label: "Primeur – Fruits & Légumes" },
    { slug: "fromagerie", label: "Fromagerie – Crèmerie" },
    { slug: "cave", label: "Cave – Vins & Spiritueux" },
    { slug: "chocolaterie", label: "Chocolaterie – Confiserie" },
    { slug: "traiteur", label: "Traiteur" },
    { slug: "restauration", label: "Restauration" },
    { slug: "restauration-rapide", label: "Restauration rapide" },
    { slug: "cafe-bar", label: "Café – Bar – Brasserie" },
    // Mode, beauté & soin
    { slug: "mode-beaute", label: "Mode & Beauté" },
    { slug: "mode-vetements", label: "Mode & Vêtements" },
    { slug: "chaussures-maroquinerie", label: "Chaussures – Maroquinerie" },
    { slug: "bijouterie", label: "Bijouterie – Horlogerie" },
    { slug: "coiffure", label: "Coiffure" },
    { slug: "esthetique", label: "Esthétique – Institut" },
    { slug: "parfumerie", label: "Parfumerie" },
    { slug: "bien-etre", label: "Bien-être – Spa – Massage" },
    { slug: "optique", label: "Optique" },
    { slug: "tatouage", label: "Tatouage – Piercing" },
    // Maison, déco & artisanat / bâtiment
    { slug: "artisanat", label: "Artisanat" },
    { slug: "decoration", label: "Décoration – Ameublement" },
    { slug: "fleuriste", label: "Fleuriste" },
    { slug: "bricolage-jardinage", label: "Bricolage – Jardinage" },
    { slug: "batiment", label: "Bâtiment – Rénovation" },
    { slug: "plomberie", label: "Plomberie – Chauffage" },
    { slug: "electricite", label: "Électricité" },
    { slug: "menuiserie", label: "Menuiserie – Ébénisterie" },
    { slug: "peinture", label: "Peinture – Décoration intérieure" },
    { slug: "paysagiste", label: "Paysagiste – Espaces verts" },
    // Auto & mobilité
    { slug: "automobile", label: "Automobile – Garage" },
    { slug: "carrosserie", label: "Carrosserie" },
    { slug: "cycles-motos", label: "Cycles – Motos" },
    // Santé
    { slug: "sante", label: "Santé – Pharmacie" },
    { slug: "medical", label: "Médical – Paramédical" },
    { slug: "audioprothese", label: "Audioprothèse" },
    // Services aux particuliers & entreprises
    { slug: "services", label: "Services" },
    { slug: "banque-assurance", label: "Banque – Assurance" },
    { slug: "immobilier", label: "Immobilier" },
    { slug: "comptabilite", label: "Comptabilité – Gestion" },
    { slug: "juridique", label: "Juridique – Notaire" },
    { slug: "communication", label: "Communication – Web – Marketing" },
    { slug: "informatique", label: "Informatique – Téléphonie" },
    { slug: "nettoyage", label: "Nettoyage – Entretien" },
    { slug: "transport", label: "Transport – Logistique" },
    { slug: "securite", label: "Sécurité" },
    { slug: "coworking", label: "Coworking – Bureaux" },
    { slug: "interim-rh", label: "Intérim – Ressources humaines" },
    // Loisirs, culture & formation
    { slug: "sport-loisirs", label: "Sport – Loisirs" },
    { slug: "fitness", label: "Salle de sport – Fitness" },
    { slug: "culture-arts", label: "Culture – Arts" },
    { slug: "education-formation", label: "Éducation – Formation" },
    { slug: "tourisme-hotellerie", label: "Tourisme – Hôtellerie" },
    { slug: "evenementiel", label: "Événementiel" },
    { slug: "animalerie", label: "Animalerie – Services animaliers" },
    // Entreprise & production
    { slug: "industrie", label: "Industrie – Production" },
    { slug: "agriculture", label: "Agriculture – Producteur local" },
  ];
  const categoryData = categoryList.map((c, i) => ({
    ...c,
    ...PALETTE[i % PALETTE.length],
    sort: i + 1,
  }));

  for (const c of categoryData) {
    await db.insert(categories).values(c).onConflictDoNothing({ target: categories.slug });
  }
  const cats = await db.select().from(categories);
  const catId = (slug: string) => cats.find((c) => c.slug === slug)?.id ?? null;

  // ---- Données de démonstration (SEED_DEMO=true uniquement) ----
  //
  // Par défaut la base reste vide : seuls le référentiel des catégories et le
  // compte administrateur initial sont créés. Les adhérents, promotions,
  // demandes, entrées de journal et comptes de démonstration ne servent qu'à
  // un poste de développement.
  const demo = (process.env.SEED_DEMO ?? "").trim().toLowerCase() === "true";
  if (demo) {
    for (const m of demoMembers(catId)) {
      const existing = await db.select().from(members).where(eq(members.email, m.email));
      if (existing.length === 0) await db.insert(members).values(m);
    }
    const allMembers = await db.select().from(members);
    const memberId = (name: string) => allMembers.find((m) => m.name === name)?.id ?? null;

    for (const p of demoPromotions(memberId)) {
      const existing = await db.select().from(promotions).where(eq(promotions.title, p.title));
      if (existing.length === 0) await db.insert(promotions).values(p);
    }

    for (const r of demoRequests) {
      const existing = await db.select().from(membershipRequests).where(eq(membershipRequests.name, r.name));
      if (existing.length === 0) await db.insert(membershipRequests).values(r);
    }

    const existingActivity = await db.select().from(activityLog);
    if (existingActivity.length === 0) {
      for (const a of demoActivity) await db.insert(activityLog).values(a);
    }

    for (const u of demoUsers(memberId)) {
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, u.email));
      if (existing.length === 0) {
        await db.insert(users).values({
          email: u.email,
          name: u.name,
          passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
          role: u.role,
          memberId: u.memberId,
        });
      }
    }
    console.log(`  Données de démonstration insérées (SEED_DEMO=true) ; comptes de démo : mot de passe « ${DEMO_PASSWORD} ».`);
  }

  // ---- Comptes de connexion ----
  //
  // Le seed tourne à chaque démarrage du conteneur (SEED_ON_START). Il ne doit
  // donc jamais créer en production de compte dont le mot de passe est connu
  // de tous : les comptes de démonstration sont réservés à SEED_DEMO=true, et
  // l'administrateur initial reçoit un mot de passe aléatoire (affiché une
  // seule fois ici) à changer à la première connexion, sauf si
  // SEED_ADMIN_PASSWORD est fourni explicitement.
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@plein-r.fr").trim().toLowerCase();
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrateur Plein R";
  const providedAdminPassword = (process.env.SEED_ADMIN_PASSWORD ?? "").trim();

  const [existingAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (!existingAdmin) {
    const generated = !providedAdminPassword;
    const adminPassword = providedAdminPassword || randomPassword();
    await db.insert(users).values({
      email: adminEmail,
      name: adminName,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "admin",
      memberId: null,
      mustChangePassword: true,
    });
    if (generated) {
      console.log("  Compte administrateur créé. Mot de passe initial (affiché une seule fois) :");
      console.log(`  ${adminEmail} / ${adminPassword}`);
    } else {
      console.log(`  Compte administrateur créé : ${adminEmail} (mot de passe fourni par SEED_ADMIN_PASSWORD).`);
    }
    console.log("  Un changement de mot de passe sera exigé à la première connexion.");
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
