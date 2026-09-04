import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, inArray, isNull } from "drizzle-orm";
import * as schema from "./schema";
import {
  demoActivity,
  demoMemberEmails,
  demoPromotionTitles,
  demoRequests,
  demoUserEmails,
} from "./demo-data";

const { activityLog, imageConsents, meetingRegistrations, members, membershipRequests, promotions, users } = schema;

/**
 * Retire les données de démonstration d'une base qui les a reçues (anciens
 * déploiements où le seed les insérait à chaque démarrage).
 *
 * Seuls les enregistrements du jeu de démonstration sont touchés, reconnus par
 * leur e-mail, leur titre, leur nom ou leur message exacts. Tout ce qui a été
 * saisi par l'association reste en place, y compris les catégories et le
 * compte administrateur.
 *
 *   npm run db:purge-demo            (poste de développement)
 *   docker compose exec app node dist/purge-demo.cjs   (conteneur)
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  const memberEmails = demoMemberEmails();
  const promoTitles = demoPromotionTitles();
  const userEmails = demoUserEmails();
  const requestNames = demoRequests.map((r) => r.name);
  const activityMessages = demoActivity.map((a) => a.message);

  const removed = await db.transaction(async (tx) => {
    const demoMemberRows = await tx
      .select({ id: members.id })
      .from(members)
      .where(inArray(members.email, memberEmails));
    const memberIds = demoMemberRows.map((m) => m.id);

    // Comptes de démonstration (staff et adhérent).
    const deletedUsers = await tx
      .delete(users)
      .where(inArray(users.email, userEmails))
      .returning({ id: users.id });

    let deletedPromos: { id: number }[] = [];
    let deletedMembers: { id: number }[] = [];
    if (memberIds.length > 0) {
      // Un compte réel rattaché par erreur à une fiche de démo est détaché,
      // pas supprimé.
      await tx.update(users).set({ memberId: null }).where(inArray(users.memberId, memberIds));
      await tx.delete(imageConsents).where(inArray(imageConsents.memberId, memberIds));
      await tx
        .update(meetingRegistrations)
        .set({ memberId: null })
        .where(inArray(meetingRegistrations.memberId, memberIds));
      // Les publications réseaux liées suivent (clé étrangère en cascade).
      deletedPromos = await tx
        .delete(promotions)
        .where(inArray(promotions.memberId, memberIds))
        .returning({ id: promotions.id });
      deletedMembers = await tx
        .delete(members)
        .where(inArray(members.id, memberIds))
        .returning({ id: members.id });
    }

    // Promotions de démo sans fiche (seed antérieur, fiche déjà retirée).
    const orphanPromos = await tx
      .delete(promotions)
      .where(and(inArray(promotions.title, promoTitles), isNull(promotions.memberId)))
      .returning({ id: promotions.id });

    const deletedRequests = await tx
      .delete(membershipRequests)
      .where(inArray(membershipRequests.name, requestNames))
      .returning({ id: membershipRequests.id });

    const deletedActivity = await tx
      .delete(activityLog)
      .where(inArray(activityLog.message, activityMessages))
      .returning({ id: activityLog.id });

    return {
      comptes: deletedUsers.length,
      adherents: deletedMembers.length,
      promotions: deletedPromos.length + orphanPromos.length,
      demandes: deletedRequests.length,
      journal: deletedActivity.length,
    };
  });

  console.log("Données de démonstration retirées :");
  for (const [key, count] of Object.entries(removed)) console.log(`  ${key} : ${count}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Purge failed:", err);
  process.exit(1);
});
