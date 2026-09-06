/**
 * Mise en ligne d'une promotion : diffusion sur les réseaux et libération des
 * publications programmées.
 *
 * Ce module vit hors de `backend/actions.ts` parce qu'il a deux appelants : la
 * validation par un modérateur (une requête HTTP) et le libérateur périodique
 * démarré par `instrumentation.ts` (aucune requête). Il ne fait donc jamais
 * appel à `revalidatePath()`, qui n'a pas de sens hors requête ; les pages
 * publiques sont en `force-dynamic` et relisent la base à chaque affichage.
 */

import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, promotions, socialPosts } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import {
  isNetworkConfigured,
  publishPromoToNetwork,
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  type SocialNetwork,
} from "@/lib/social";

/** Réseaux demandés pour une promo, dans l'ordre d'affichage. */
export function requestedNetworks(promo: {
  shareFacebook: boolean;
  shareLinkedin: boolean;
}): SocialNetwork[] {
  return SOCIAL_NETWORKS.filter((n) =>
    n === "facebook" ? promo.shareFacebook : promo.shareLinkedin
  );
}

/**
 * Publie une promotion sur les réseaux demandés. Ne lève jamais : un réseau
 * indisponible ne doit pas faire échouer la mise en ligne, l'échec est
 * enregistré dans `social_posts` et rattrapable depuis le backoffice.
 *
 * Un réseau déjà publié avec succès est ignoré : c'est ce qui empêche toute
 * republication, y compris sur un cycle suspension → remise en ligne, et ce
 * qui rend le libérateur périodique sans danger s'il repasse sur une promo.
 */
export async function publishPromoShares(
  promoId: number,
  networks: SocialNetwork[],
  userId: number | null
) {
  if (networks.length === 0) return;

  const [promo] = await db
    .select({
      title: promotions.title,
      text: promotions.text,
      badge: promotions.badge,
      validUntil: promotions.validUntil,
      startsOn: promotions.startsOn,
      endsOn: promotions.endsOn,
      imageUrl: promotions.imageUrl,
      memberId: promotions.memberId,
      memberName: members.name,
      memberCity: members.city,
    })
    .from(promotions)
    .leftJoin(members, eq(promotions.memberId, members.id))
    .where(eq(promotions.id, promoId));
  if (!promo) return;

  const done = await db
    .select({ network: socialPosts.network })
    .from(socialPosts)
    .where(and(eq(socialPosts.promotionId, promoId), eq(socialPosts.status, "posted")));
  const alreadyPosted = new Set(done.map((d) => d.network));

  for (const network of networks) {
    if (alreadyPosted.has(network)) continue;

    if (!(await isNetworkConfigured(network))) {
      await db.insert(socialPosts).values({
        promotionId: promoId,
        network,
        status: "failed",
        error: `${SOCIAL_LABELS[network]} n'est pas configuré sur ce serveur.`,
        postedById: userId,
      });
      continue;
    }

    try {
      const result = await publishPromoToNetwork(network, promo);
      await db.insert(socialPosts).values({
        promotionId: promoId,
        network,
        status: "posted",
        externalId: result.externalId,
        url: result.url,
        postedById: userId,
      });
      await logActivity(
        `Promotion « ${promo.title} » publiée sur ${SOCIAL_LABELS[network]}`,
        "#2C6FB3"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      await db.insert(socialPosts).values({
        promotionId: promoId,
        network,
        status: "failed",
        error: message.slice(0, 2000),
        postedById: userId,
      });
    }
  }
}

/**
 * Met en ligne les promotions programmées dont l'échéance est passée.
 *
 * La bascule `scheduled → live` est faite par un `UPDATE … RETURNING` filtré
 * sur le statut : deux instances de l'application qui tourneraient en même
 * temps ne peuvent pas récupérer la même ligne, chacune n'obtient que celles
 * qu'elle a effectivement changées. La diffusion réseaux suit, protégée en
 * plus par la garde anti-republication de `publishPromoShares`.
 *
 * Ne lève jamais : le libérateur tourne en tâche de fond, une erreur ne doit
 * pas arrêter la boucle.
 */
export async function releaseDuePromotions(now = new Date()): Promise<number> {
  let released: { id: number; title: string; memberId: number | null; shareFacebook: boolean; shareLinkedin: boolean }[];
  try {
    released = await db
      .update(promotions)
      .set({ status: "live", publishAt: null })
      .where(
        and(
          eq(promotions.status, "scheduled"),
          isNotNull(promotions.publishAt),
          lte(promotions.publishAt, now)
        )
      )
      .returning({
        id: promotions.id,
        title: promotions.title,
        memberId: promotions.memberId,
        shareFacebook: promotions.shareFacebook,
        shareLinkedin: promotions.shareLinkedin,
      });
  } catch (error) {
    console.error("[promotions] libération programmée impossible :", error);
    return 0;
  }

  for (const promo of released) {
    try {
      await logActivity(
        `Promotion « ${promo.title} » publiée à l'heure programmée`,
        "#1f8a5b"
      );
      // `null` : la publication n'est déclenchée par personne, c'est l'échéance.
      await publishPromoShares(promo.id, requestedNetworks(promo), null);
    } catch (error) {
      console.error(`[promotions] publication programmée #${promo.id} :`, error);
    }
  }

  return released.length;
}

/** Nombre de promotions encore en attente de leur date de publication. */
export async function countScheduledPromotions(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(promotions)
    .where(eq(promotions.status, "scheduled"));
  return row?.n ?? 0;
}
