/**
 * Boucles de fond : libération des publications programmées, vidage de la
 * file d'envoi et entretien des jetons réseaux sociaux. Fichier séparé de `instrumentation.ts` : il touche la base et
 * `nodemailer`, et ne doit donc jamais entrer dans le bundle edge du
 * middleware — c'est cet import-là que l'`IgnorePlugin` de `next.config.mjs`
 * coupe.
 */
import { releaseDuePromotions } from "@/lib/promo-publish";
import { processOutbox } from "@/lib/mail-outbox";
import { runTokenMaintenance } from "@/lib/social-accounts";

const PROMO_INTERVAL_MS = 60_000;
// Plus court que la minute des promotions : un mot de passe ou une invitation
// mis en file ne doit pas attendre une minute pleine.
const MAIL_INTERVAL_MS = 20_000;
// Un peu moins que le cache de 6 h du contrôle de santé (`tokenHealthCached`) :
// le tableau de bord trouve toujours un résultat frais sans appeler la plateforme.
const TOKEN_INTERVAL_MS = 5 * 3_600_000;
const TOKEN_FIRST_DELAY_MS = 60_000;

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

async function tokenTick() {
  try {
    await runTokenMaintenance();
  } catch (error) {
    console.error("[social] entretien des jetons :", error);
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

// Jetons : renouvellement LinkedIn et contrôle de santé. Premier passage une
// minute après le démarrage, pour ne pas ralentir la mise en route.
if (process.env.SOCIAL_TOKEN_WORKER !== "off") {
  setTimeout(() => {
    void tokenTick();
    setInterval(tokenTick, TOKEN_INTERVAL_MS).unref();
  }, TOKEN_FIRST_DELAY_MS).unref();
}
