"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModalShell } from "@/components/ModalShell";
import { PHOTO_MAX_BYTES, base64Bytes, chunkByBytes, compressionSummary } from "@/lib/image-compress";
import { prepareImageFile } from "@/lib/image-compress-dom";
import type { ArchiveDraft, DialogPhoto, MeetingOption } from "./draft";
import {
  addPastMeetingPhotos,
  deletePastMeeting,
  savePastMeeting,
  savePastMeetingPhotos,
} from "../actions";

/**
 * Bouton d'ouverture de la fenêtre d'édition. La fenêtre n'est montée qu'à
 * l'ouverture : chaque ouverture repart donc de la fiche telle qu'elle est en
 * base, sans état résiduel de la précédente.
 */
export function PastMeetingDialogButton({
  draft,
  meetings,
  children,
  style,
}: {
  draft: ArchiveDraft;
  meetings: MeetingOption[];
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={style}>
        {children}
      </button>
      {open && <PastMeetingDialog draft={draft} meetings={meetings} onClose={() => setOpen(false)} />}
    </>
  );
}

function PastMeetingDialog({
  draft,
  meetings,
  onClose,
}: {
  draft: ArchiveDraft;
  meetings: MeetingOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState(draft);
  const [photos, setPhotos] = useState<DialogPhoto[]>(draft.photos);
  const [over, setOver] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [closing, setClosing] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  /**
   * On ne referme qu'une fois la page rafraîchie. Sans cette attente, rouvrir la
   * fiche dans la foulée montrerait encore l'état d'avant l'enregistrement — la
   * rencontre liée revenant à « Aucune », par exemple — et on croirait que rien
   * n'a été retenu.
   */
  useEffect(() => {
    if (closing && !refreshing) onClose();
  }, [closing, refreshing, onClose]);

  const linked = meetings.find((meeting) => String(meeting.id) === fields.meetingId);
  const busy = working !== null || closing;

  function set<K extends keyof ArchiveDraft>(key: K, value: ArchiveDraft[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  /**
   * Compression **avant** l'envoi : une photo de téléphone pèse 4 à 12 Mo, la
   * limite d'une server action est à 4 Mo. Le navigateur redimensionne et
   * réencode, en ne descendant en qualité que le strict nécessaire.
   */
  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    setError(null);
    const added: DialogPhoto[] = [];
    const messages: string[] = [];
    for (const [index, file] of files.entries()) {
      setWorking(`Compression de la photo ${index + 1} sur ${files.length}…`);
      try {
        const prepared = await prepareImageFile(file, { maxBytes: PHOTO_MAX_BYTES });
        added.push({
          key: `${Date.now()}-${index}-${file.name}`,
          id: null,
          imageUrl: prepared.dataUri,
          caption: "",
          bytes: prepared.bytes,
        });
        messages.push(`${file.name} — ${compressionSummary(prepared)}`);
      } catch (cause) {
        messages.push(`${file.name} — ${cause instanceof Error ? cause.message : "photo refusée"}`);
      }
    }
    setWorking(null);
    setPhotos((current) => [...current, ...added]);
    setNotes(messages);
    if (fileRef.current) fileRef.current.value = "";
    // La galerie est en bas de la fenêtre : sans cela, on dépose des photos
    // sans jamais voir apparaître ce qu'on vient d'ajouter.
    photosRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function movePhoto(index: number, step: number) {
    setPhotos((current) => {
      const target = index + step;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setError(null);
    setWorking("Enregistrement…");
    try {
      const form = new FormData();
      if (fields.id) form.set("id", String(fields.id));
      form.set("title", fields.title);
      form.set("eventDate", fields.eventDate);
      form.set("location", fields.location);
      form.set("description", fields.description);
      form.set("participants", fields.participants);
      form.set("meetingId", fields.meetingId);
      const saved = await savePastMeeting(form);
      if ("error" in saved) {
        setError(saved.error);
        return;
      }

      // Les nouvelles photos partent en paquets : plusieurs data-URI dans une
      // seule requête dépasseraient la limite de corps des server actions.
      const fresh = photos.filter((photo) => photo.id === null);
      const groups = chunkByBytes(fresh.map((photo) => photo.bytes || base64Bytes(photo.imageUrl)));
      const freshIds: number[] = [];
      let sent = 0;
      for (const group of groups) {
        setWorking(`Envoi des photos ${sent + 1} à ${sent + group.length} sur ${fresh.length}…`);
        const batch = new FormData();
        batch.set("pastMeetingId", String(saved.id));
        for (const index of group) {
          batch.append("imageUrl", fresh[index].imageUrl);
          batch.append("caption", fresh[index].caption);
        }
        const result = await addPastMeetingPhotos(batch);
        if ("error" in result) {
          setError(`${result.error} Les photos déjà envoyées sont conservées.`);
          router.refresh();
          return;
        }
        freshIds.push(...result.ids);
        sent += group.length;
      }

      // Passage final : ordre affiché, légendes, et suppression de ce qui a été
      // retiré de la fenêtre.
      setWorking("Mise en ordre de la galerie…");
      const sync = new FormData();
      sync.set("syncPhotos", "1");
      sync.set("pastMeetingId", String(saved.id));
      let cursor = 0;
      for (const photo of photos) {
        const photoId = photo.id ?? freshIds[cursor++];
        if (!photoId) continue;
        sync.append("photoId", String(photoId));
        sync.append("photoCaption", photo.caption);
      }
      const synced = await savePastMeetingPhotos(sync);
      if ("error" in synced) {
        setError(synced.error);
        router.refresh();
        return;
      }

      setClosing(true);
      startRefresh(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally {
      setWorking(null);
    }
  }

  async function remove() {
    if (!fields.id) return;
    if (!window.confirm("Supprimer définitivement cette rencontre passée et ses photos ?")) return;
    setWorking("Suppression…");
    const form = new FormData();
    form.set("id", String(fields.id));
    await deletePastMeeting(form);
    setWorking(null);
    setClosing(true);
    startRefresh(() => router.refresh());
  }

  return (
    <ModalShell
      label={fields.id ? `Modifier ${fields.title}` : "Nouvelle rencontre passée"}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      panelClassName="pm-panel pm-panel--form"
    >
      <div className="pm-form">
        <div className="pm-form__scroll">
          <h2 className="font-display" style={{ margin: "0 0 4px", fontSize: 22, color: "#26201a", paddingRight: 44 }}>
            {fields.id ? "Modifier la rencontre passée" : "Nouvelle rencontre passée"}
          </h2>
          <p style={{ color: "#8c8068", fontSize: 13, margin: "0 0 18px" }}>
            Tout se remplit ici : le récit, les participants et les photos — y compris pour une rencontre qui n'est pas
            encore publiée.
          </p>

          {fields.refused.length > 0 && (
            <div style={{ background: "#fbe9e6", border: "1px solid #f0c4bb", color: "#b53a25", borderRadius: 8, padding: "11px 13px", fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
              <strong>Droit à l'image refusé :</strong> {fields.refused.join(", ")}. Vérifiez que ces personnes ne
              figurent pas sur les photos publiées.
            </div>
          )}

          <div className="grid grid-2" style={{ gap: 14 }}>
            <div>
              <label className="field-label">Titre</label>
              <input className="field" value={fields.title} onChange={(event) => set("title", event.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="field-label">Date</label>
              <input type="date" className="field" value={fields.eventDate} onChange={(event) => set("eventDate", event.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Lieu</label>
              <input className="field" value={fields.location} onChange={(event) => set("location", event.target.value)} maxLength={240} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Rencontre liée (facultatif)</label>
              <select className="field" value={fields.meetingId} onChange={(event) => set("meetingId", event.target.value)}>
                <option value="">Aucune — participants saisis à la main</option>
                {meetings.map((meeting) => (
                  <option key={meeting.id} value={String(meeting.id)}>
                    {meeting.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12.5, color: "#8c8068", marginTop: 6, lineHeight: 1.5 }}>
                {linked
                  ? `Le site affichera ${linked.registered} participant${linked.registered > 1 ? "s" : ""} d'après les inscriptions ; la liste saisie à la main est alors ignorée.`
                  : "Sans rencontre liée, le nombre affiché est celui des lignes saisies ci-dessous (une personne par ligne)."}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Récit de la rencontre</label>
              <textarea
                className="field"
                rows={12}
                value={fields.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="Déroulé de la matinée, intervenants, décisions prises, prochaines étapes…"
                style={{ minHeight: 260, resize: "vertical", lineHeight: 1.7 }}
              />
              <div style={{ fontSize: 12.5, color: "#8c8068", marginTop: 6 }}>
                Les paragraphes sont conservés tels quels sur le site. {fields.description.length} caractères.
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Participants (une personne par ligne)</label>
              <textarea
                className="field"
                rows={4}
                value={fields.participants}
                onChange={(event) => set("participants", event.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          <div ref={photosRef} style={{ marginTop: 22, borderTop: "1px solid #efe7d6", paddingTop: 18 }}>
            <label className="field-label">Photos ({photos.length})</label>
            <div
              className={over ? "pm-dropzone pm-dropzone--over" : "pm-dropzone"}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                void addFiles(event.dataTransfer.files);
              }}
            >
              <div style={{ marginBottom: 10 }}>
                Glissez plusieurs photos ici, ou choisissez-les sur votre appareil. Elles sont redimensionnées et
                compressées automatiquement : aucune n'est trop lourde.
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                style={{ border: "1px solid #d6c9ad", background: "#fff", color: "#6f6450", fontWeight: 700, fontSize: 13, padding: "9px 16px", borderRadius: 9, cursor: busy ? "progress" : "pointer" }}
              >
                Choisir des photos
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void addFiles(event.target.files)}
                style={{ display: "none" }}
              />
            </div>

            {notes.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#8c8068", fontSize: 12.5, lineHeight: 1.6 }}>
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}

            {photos.length > 0 && (
              <div className="pm-photo-grid">
                {photos.map((photo, index) => (
                  <div key={photo.key} className="pm-photo">
                    <div className="pm-photo__image" style={{ backgroundImage: `url(${photo.imageUrl})` }} />
                    <div className="pm-photo__tools">
                      <button type="button" className="pm-photo__tool" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label="Déplacer avant">←</button>
                      <button type="button" className="pm-photo__tool" onClick={() => movePhoto(index, 1)} disabled={index === photos.length - 1} aria-label="Déplacer après">→</button>
                      <button
                        type="button"
                        className="pm-photo__tool pm-photo__tool--danger"
                        onClick={() => setPhotos((current) => current.filter((item) => item.key !== photo.key))}
                      >
                        Retirer
                      </button>
                    </div>
                    <input
                      className="field"
                      style={{ border: "none", borderTop: "1px solid #efe7d6", borderRadius: 0, fontSize: 12.5 }}
                      placeholder="Légende (facultative)"
                      maxLength={200}
                      value={photo.caption}
                      onChange={(event) =>
                        setPhotos((current) =>
                          current.map((item) => (item.key === photo.key ? { ...item, caption: event.target.value } : item)),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12.5, color: "#8c8068", marginTop: 10 }}>
              La première photo sert de couverture à la carte ; les flèches changent l'ordre de la galerie.
            </div>
          </div>
        </div>

        <div className="pm-form__foot">
          <div style={{ fontSize: 13, color: error ? "#a3372e" : "#6c6150", fontWeight: error ? 700 : 600, flex: "1 1 240px" }}>
            {error ?? working ?? (closing ? "Mise à jour de la page…" : fields.id ? "" : "La rencontre sera visible sur le site dès l'enregistrement.")}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {fields.id && (
              <button type="button" onClick={remove} disabled={busy} style={{ border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", fontWeight: 800, fontSize: 13, padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}>
                Supprimer
              </button>
            )}
            <button type="button" onClick={onClose} disabled={busy} style={{ border: "1px solid #d6c9ad", background: "#fff", color: "#6f6450", fontWeight: 700, fontSize: 13, padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}>
              Annuler
            </button>
            <button type="button" onClick={save} disabled={busy} style={{ border: "none", background: "#13324F", color: "#fff", fontWeight: 800, fontSize: 13.5, padding: "11px 18px", borderRadius: 8, cursor: busy ? "progress" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "Patientez…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
