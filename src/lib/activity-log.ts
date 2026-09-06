import { db } from "@/db";
import { activityLog } from "@/db/schema";
import { sanitizeActivityMessage } from "@/lib/activity";

/**
 * Écrit une ligne du journal d'activité.
 *
 * Le message agrège des saisies de tiers (jusqu'au formulaire de contact
 * public) : il ne laisse passer que `<strong>`.
 */
export async function logActivity(message: string, dot = "#2C6FB3") {
  await db.insert(activityLog).values({ message: sanitizeActivityMessage(message), dot });
}
