/**
 * Boucle de libération des publications programmées. Fichier séparé de
 * `instrumentation.ts` : il touche la base et ne doit donc jamais entrer dans
 * le bundle edge du middleware.
 */
import { releaseDuePromotions } from "@/lib/promo-publish";

const INTERVAL_MS = 60_000;

async function tick() {
  try {
    const n = await releaseDuePromotions();
    if (n > 0) console.log(`[promotions] ${n} publication(s) programmée(s) mise(s) en ligne`);
  } catch (error) {
    // `releaseDuePromotions` avale déjà ses erreurs ; ce filet couvre le cas
    // d'une base injoignable au démarrage, qui ne doit pas tuer le serveur.
    console.error("[promotions] libérateur :", error);
  }
}

// Un premier passage au démarrage rattrape les échéances tombées pendant un
// redéploiement ou une coupure.
void tick();
setInterval(tick, INTERVAL_MS).unref();
