"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Enveloppe commune aux fenêtres du site et du backoffice : fond assombri,
 * fermeture au clic extérieur, à la touche Échap et par le bouton de fermeture,
 * page figée derrière.
 *
 * Le blocage du défilement de l'arrière-plan compte plus qu'il n'en a l'air :
 * sans lui, la molette dans une galerie plein écran fait défiler la page
 * *derrière* la fenêtre, et on la retrouve ailleurs en refermant.
 *
 * Le rendu passe par un **portail** vers `<body>`, et ce n'est pas un détail :
 * une carte survolée porte un `transform`, qui redéfinit le bloc conteneur des
 * éléments `position: fixed` qu'elle contient. Rendue sur place, la fenêtre
 * s'ouvrirait donc *dans* la carte. Le portail la sort aussi du bouton qui
 * l'ouvre, où des champs de saisie n'auraient rien à faire.
 */
export function ModalShell({
  label,
  onClose,
  panelClassName = "pm-panel",
  children,
}: {
  label: string;
  onClose: () => void;
  panelClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="pm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={{ position: "relative", outline: "none" }}
      >
        <button type="button" className="pm-panel__close" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
