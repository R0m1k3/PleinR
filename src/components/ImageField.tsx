"use client";

import { useRef, useState } from "react";

export function ImageField({
  name,
  label,
  defaultValue = "",
  height = 130,
  fit = "cover",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  height?: number;
  fit?: "cover" | "contain";
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    // Limite raisonnable : les data-URL transitent par une server action (~1 Mo max).
    if (f.size > 900_000) {
      setError("Image trop lourde (max ~900 Ko). Compressez-la d'abord.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setValue(String(reader.result));
    reader.readAsDataURL(f);
  }

  function clear() {
    setValue("");
    setError(null);
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
        {!value && <span style={{ fontSize: 13, color: "#a99c82" }}>Aucune image</span>}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{ border: "1px solid #d6c9ad", background: "#fff", color: "#6f6450", fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: 9, cursor: "pointer" }}
        >
          {value ? "Changer l'image" : "Choisir une image"}
        </button>
        {value && (
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

      {error && <div style={{ fontSize: 12.5, color: "#a3372e", marginTop: 6 }}>{error}</div>}
    </div>
  );
}
