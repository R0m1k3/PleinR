import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const {
  categories,
  members,
  users,
  promotions,
  membershipRequests,
  activityLog,
} = schema;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  console.log("Seeding database…");

  // ---- Categories (métiers) ----
  const categoryData = [
    { slug: "restauration", label: "Restauration", accent: "#E0A63C", tint: "#f6efdc", sort: 1 },
    { slug: "mode-beaute", label: "Mode & Beauté", accent: "#6FB0C6", tint: "#e7f0f3", sort: 2 },
    { slug: "artisanat", label: "Artisanat", accent: "#9a6638", tint: "#f4ebda", sort: 3 },
    { slug: "services", label: "Services", accent: "#2C6FB3", tint: "#eaf0f6", sort: 4 },
    { slug: "sante", label: "Santé", accent: "#E0A63C", tint: "#f6efdc", sort: 5 },
    { slug: "alimentation", label: "Alimentation", accent: "#6FB0C6", tint: "#e7f0f3", sort: 6 },
    { slug: "boulangerie", label: "Boulangerie", accent: "#9a6638", tint: "#f4ebda", sort: 7 },
  ];

  for (const c of categoryData) {
    await db.insert(categories).values(c).onConflictDoNothing({ target: categories.slug });
  }
  const cats = await db.select().from(categories);
  const catId = (slug: string) => cats.find((c) => c.slug === slug)?.id ?? null;

  // ---- Members (adhérents) ----
  const memberData = [
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

  for (const m of memberData) {
    const existing = await db.select().from(members).where(eq(members.email, m.email));
    if (existing.length === 0) await db.insert(members).values(m);
  }
  const allMembers = await db.select().from(members);
  const memberId = (name: string) => allMembers.find((m) => m.name === name)?.id ?? null;

  // ---- Promotions ----
  const promoData = [
    { title: "Le 13e pain offert", text: "Sur présentation de votre carte adhérent, profitez d'une réduction sur nos pains au levain.", category: "Boulangerie", badge: "-20%", memberId: memberId("Au Bon Pain"), status: "live" as const, validUntil: "Valable jusqu'au 30 juin" },
    { title: "Formule midi du marché", text: "Entrée + plat + café à 15€ tous les midis de semaine. Produits frais et locaux.", category: "Restauration", badge: "Menu 15€", memberId: memberId("Café des Arts"), status: "live" as const, validUntil: "Du lundi au vendredi" },
    { title: "Soin offert dès 2 prestations", text: "Profitez de -30% sur le 2e soin réservé dans le mois. Sur rendez-vous.", category: "Beauté", badge: "-30%", memberId: memberId("Atelier Émilie"), status: "pending" as const, validUntil: "Jusqu'au 15 juillet" },
    { title: "Révision auto à prix réseau", text: "15€ de remise sur votre forfait révision pour tous les adhérents Plein R.", category: "Services", badge: "-15€", memberId: memberId("Garage Moderne"), status: "pending" as const, validUntil: "Toute l'année" },
    { title: "Bouquet du mois en promo", text: "-25% sur la composition florale du mois. Fleurs de saison, cueillies localement.", category: "Artisanat", badge: "-25%", memberId: memberId("Fleurs & Sens"), status: "live" as const, validUntil: "Jusqu'au 30 juin" },
    { title: "2 fromages achetés, 1 offert", text: "Sur une sélection de fromages fermiers. L'occasion de découvrir nos producteurs.", category: "Alimentation", badge: "2+1", memberId: memberId("La Cave Gourmande"), status: "live" as const, validUntil: "Ce week-end" },
  ];

  for (const p of promoData) {
    const existing = await db.select().from(promotions).where(eq(promotions.title, p.title));
    if (existing.length === 0) await db.insert(promotions).values(p);
  }

  // ---- Membership requests ----
  const requestData = [
    { name: "Boutique Indigo", email: "indigo@boutique.fr", message: "Souhaite rejoindre le réseau." },
    { name: "Pizzeria Bella", email: "contact@bella.fr", message: "Demande d'adhésion." },
    { name: "Coworking La Ruche", email: "hello@laruche.fr", message: "Espace de travail partagé." },
  ];
  for (const r of requestData) {
    const existing = await db.select().from(membershipRequests).where(eq(membershipRequests.name, r.name));
    if (existing.length === 0) await db.insert(membershipRequests).values(r);
  }

  // ---- Activity log ----
  const activityData = [
    { dot: "#1f8a5b", message: "<strong>Atelier Émilie</strong> a publié une promotion « Soin offert dès 2 prestations »" },
    { dot: "#E0A63C", message: "<strong>Garage Moderne</strong> a soumis une promotion en attente de validation" },
    { dot: "#2C6FB3", message: "Nouvelle demande d'adhésion : <strong>Boutique Indigo</strong>" },
    { dot: "#9a6638", message: "<strong>Café des Arts</strong> a mis à jour sa fiche annuaire" },
  ];
  const existingActivity = await db.select().from(activityLog);
  if (existingActivity.length === 0) {
    for (const a of activityData) await db.insert(activityLog).values(a);
  }

  // ---- Admin + sample staff/member users ----
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@plein-r.fr";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrateur Plein R";

  const seedUsers = [
    { email: adminEmail, name: adminName, password: adminPassword, role: "admin" as const, memberId: null },
    { email: "claire@plein-r.fr", name: "Claire Martin", password: "changeme123", role: "admin" as const, memberId: null },
    { email: "thomas@plein-r.fr", name: "Thomas Petit", password: "changeme123", role: "moderator" as const, memberId: null },
    { email: "sophie@plein-r.fr", name: "Sophie Aubert", password: "changeme123", role: "editor" as const, memberId: null },
    { email: "contact@aubonpain.fr", name: "Au Bon Pain", password: "changeme123", role: "member" as const, memberId: memberId("Au Bon Pain") },
  ];

  for (const u of seedUsers) {
    const existing = await db.select().from(users).where(eq(users.email, u.email));
    if (existing.length === 0) {
      await db.insert(users).values({
        email: u.email,
        name: u.name,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: u.role,
        memberId: u.memberId,
      });
    }
  }

  console.log("Seed complete.");
  console.log(`  Admin login: ${adminEmail} / ${adminPassword}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
