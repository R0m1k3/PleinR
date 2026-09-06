import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { categoryRows } from "./categories";
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

  // ---- Categories (métiers) : référentiel partagé (src/db/categories.ts) ----
  // La migration 0012 insère déjà ce référentiel ; le seed le rejoue par sécurité
  // pour une base créée sans migration, sans jamais écraser un libellé existant.
  const categoryData = categoryRows();

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
