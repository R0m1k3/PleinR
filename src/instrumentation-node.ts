/**
 * Boucles de fond : libération des publications programmées et vidage de la
 * file d'envoi. Fichier séparé de `instrumentation.ts` : il touche la base et
 * `nodemailer`, et ne doit donc jamais entrer dans le bundle edge du
 * middleware — c'est cet import-là que l'`IgnorePlugin` de `next.config.mjs`
 * coupe.
 */
import { releaseDuePromotions } from "@/lib/promo-publish";
import { processOutbox } from "@/lib/mail-outbox";

const PROMO_INTERVAL_MS = 60_000;
// Plus court que la minute des promotions : un mot de passe ou une invitation
// mis en file ne doit pas attendre une minute pleine.
const MAIL_INTERVAL_MS = 20_000;

async function promoTick() {
  try {
    const n = await releaseDuePromotions();
    if (n > 0) console.log(`[promotions] ${n} publication(s) programmée(s) mise(s) en ligne`);
  } catch (error) {
    // `releaseDuePromotions` avale déjà ses erreurs ; ce filet couvre le cas
    // d'une base injoignable au démarrage, qui ne doit pas tuer le serveur.
    console.error("[promotions] libérateur :", error);
  }
}

async function mailTick() {
  try {
    const { sent, failed } = await processOutbox();
    if (sent || failed) console.log(`[mail] ${sent} envoyé(s), ${failed} en échec`);
  } catch (error) {
    console.error("[mail] file d'attente :", error);
  }
}

// Un premier passage au démarrage rattrape les échéances tombées pendant un
// redéploiement ou une coupure.
if (process.env.PROMO_SCHEDULER !== "off") {
  void promoTick();
  setInterval(promoTick, PROMO_INTERVAL_MS).unref();
}

if (process.env.MAIL_WORKER !== "off") {
  void mailTick();
  setInterval(mailTick, MAIL_INTERVAL_MS).unref();
}
