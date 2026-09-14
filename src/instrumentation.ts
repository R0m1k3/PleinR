/**
 * Démarrage du serveur : boucles de fond.
 *
 * Le déploiement est un conteneur unique et permanent (`docker-compose`), il
 * n'y a donc ni cron ni file d'attente. Une boucle minute suffit : elle relit
 * les promotions `scheduled` dont l'échéance est passée, les met en ligne et
 * lance la diffusion réseaux. La minute est aussi la précision annoncée dans
 * le formulaire.
 *
 * Sûr à plusieurs instances : la bascule passe par un `UPDATE … RETURNING`
 * filtré sur le statut (voir `releaseDuePromotions`), une seule instance
 * récupère chaque promotion.
 */
export async function register() {
  // `register()` est aussi appelé pour le runtime edge, où il n'y a ni base
  // ni `setInterval` durable : le module Node est chargé à la demande pour ne
  // pas entrer dans ce bundle.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Chaque boucle a son propre interrupteur, appliqué à l'intérieur du module :
  // couper le libérateur de promotions ici couperait aussi l'envoi des
  // e-mails, qui n'a rien à voir avec lui.
  if (process.env.PROMO_SCHEDULER === "off" && process.env.MAIL_WORKER === "off") return;
  await import("./instrumentation-node");
}
