"use client";

import { useRef, useState, useTransition } from "react";
import { FIELD_MAX_BYTES, compressionSummary } from "@/lib/image-compress";
import { prepareImageFile } from "@/lib/image-compress-dom";

export function ImageField({
  name,
  label,
  defaultValue = "",
  height = 130,
  fit = "cover",
  maxBytes = FIELD_MAX_BYTES,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  height?: number;
  fit?: "cover" | "contain";
  maxBytes?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      // Plus de refus « image trop lourde » : le navigateur redimensionne et
      // compresse lui-même, en ne descendant que le nécessaire.
      const prepared = await prepareImageFile(file, { maxBytes });
      startTransition(() => {
        setValue(prepared.dataUri);
        setNote(compressionSummary(prepared));
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image refusée.");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setValue("");
    setError(null);
    setNote(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <label className="field-label">{label}</label>
      <input type="hidden" name={name} value={value} />

      <div
        style={{
          height,
          borderRadius: 12,
          border: "1px dashed #d6c9ad",
          background: value && fit === "cover" ? `center/cover no-repeat url(${value})` : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        {value && fit === "contain" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" style={{ maxWidth: "86%", maxHeight: "86%", objectFit: "contain", display: "block" }} />
        )}
        {!value && <span style={{ fontSize: 13, color: "#a99c82" }}>{busy ? "Compression en cours…" : "Aucune image"}</span>}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          style={{ border: "1px solid #d6c9ad", background: "#fff", color: "#6f6450", fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: 9, cursor: busy ? "progress" : "pointer" }}
        >
          {busy ? "Compression…" : value ? "Changer l'image" : "Choisir une image"}
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={clear}
            style={{ border: "none", background: "none", color: "#d8472b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Retirer
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      </div>

      {note && !error && <div style={{ fontSize: 12.5, color: "#8c8068", marginTop: 6 }}>{note}</div>}
      {error && <div style={{ fontSize: 12.5, color: "#a3372e", marginTop: 6 }}>{error}</div>}
    </div>
  );
}
