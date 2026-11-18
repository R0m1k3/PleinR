/**
 * Forme d'une rencontre passée telle que la manipule la fenêtre d'édition.
 *
 * Ce module n'est **pas** marqué `"use client"` à dessein : la page (composant
 * serveur) appelle `emptyDraft()` pour préparer une fiche vierge. Exporté
 * depuis un module client, cet appel deviendrait une référence client, que le
 * serveur ne peut pas exécuter.
 */

export type MeetingOption = { id: number; label: string; registered: number };

export type DialogPhoto = {
  /** Clé stable côté navigateur : une photo pas encore enregistrée n'a pas d'id. */
  key: string;
  id: number | null;
  imageUrl: string;
  caption: string;
  /** Poids de la data-URI, utilisé pour découper les envois en paquets. */
  bytes: number;
};

export type ArchiveDraft = {
  id: number | null;
  title: string;
  eventDate: string;
  location: string;
  description: string;
  participants: string;
  meetingId: string;
  photos: DialogPhoto[];
  /** Personnes ayant refusé le droit à l'image sur la rencontre liée. */
  refused: string[];
};

/** Fiche vierge, datée d'aujourd'hui dans le fuseau du navigateur du serveur. */
export function emptyDraft(): ArchiveDraft {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return {
    id: null,
    title: "",
    eventDate: today.toISOString().slice(0, 10),
    location: "",
    description: "",
    participants: "",
    meetingId: "",
    photos: [],
    refused: [],
  };
}
