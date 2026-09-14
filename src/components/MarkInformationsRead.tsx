"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markInformationsRead } from "@/app/backend/actions";

/**
 * Marque les informations affichées comme lues, une fois la page rendue.
 *
 * Le marquage ne peut pas se faire pendant le rendu de la page : le compteur
 * de la barre latérale est calculé par le gabarit, un composant serveur
 * distinct dont l'ordre de rendu n'est pas garanti — la pastille de l'onglet
 * et celle du menu auraient pu se contredire sur la même page. Ici les deux
 * retombent ensemble au rafraîchissement.
 */
export function MarkInformationsRead({ ids }: { ids: number[] }) {
  const router = useRouter();
  const handled = useRef("");
  const key = ids.join(",");

  useEffect(() => {
    if (!key || handled.current === key) return;
    handled.current = key;
    void markInformationsRead(key.split(",").map(Number)).then(() => router.refresh());
  }, [key, router]);

  return null;
}
