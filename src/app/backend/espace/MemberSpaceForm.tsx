"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publishPromo } from "../actions";
import { PromoImage } from "@/components/PromoImage";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

export function MemberSpaceForm({
  memberName,
  categories,
}: {
  memberName: string;
  categories: string[];
}) {
  const CATEGORIES = categories.length > 0 ? categories : ["Autre"];
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [badge, setBadge] = useState("");
  const [imgData, setImgData] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImgData(String(reader.result));
      setSubmitted(false);
    };
    reader.readAsDataURL(f);
  }

  function reset() {
    setTitle("");
    setText("");
    setBadge("");
    setImgData("");
    setSubmitted(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!title.trim()) return;
    setPending(true);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("text", text);
    fd.set("category", cat);
    fd.set("badge", badge);
    fd.set("imageUrl", imgData);
    await publishPromo(fd);
    setPending(false);
    setSubmitted(true);
    reset();
    setSubmitted(true);
    router.refresh();
  }

  const hasImg = !!imgData;
  const hasBadge = !!badge.trim();

  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      {/* FORM */}
      <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 24 }}>
        <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: "0 0 4px", color: "#26201a" }}>
          Publier une promotion
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#9a8d72" }}>
          Ajoutez une image et un texte. Votre promotion sera visible après validation par
          l&apos;association.
        </p>

        <label className="field-label">Image de l&apos;offre</label>
        <label style={{ display: "block", cursor: "pointer", marginBottom: 18 }}>
          <div
            style={{
              position: "relative",
              border: "2px dashed #d8cdb4",
              borderRadius: 14,
              background: "#faf7ef",
              height: 170,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              textAlign: "center",
              overflow: "hidden",
            }}
          >
            {hasImg && <PromoImage src={imgData} alt="" />}
            {!hasImg && (
              <>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: "#f0e8d6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 15, height: 15, border: "2px solid #b3a888", borderRadius: 4 }} />
                </span>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#6c6150" }}>
                  Cliquez pour choisir une image
                </div>
                <div style={{ fontSize: 12, color: "#a99c82" }}>JPG ou PNG · 1200×800 conseillé</div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </label>

        <label className="field-label">Titre de la promotion</label>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSubmitted(false);
          }}
          placeholder="ex : Le 13e pain offert"
          className="field"
          style={{ marginBottom: 16 }}
        />

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Catégorie</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="field">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Réduction (badge)</label>
            <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="ex : -20%" className="field" />
          </div>
        </div>

        <label className="field-label">Texte de la promotion</label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, 240));
            setSubmitted(false);
          }}
          placeholder="Décrivez votre offre, les conditions, la durée…"
          rows={4}
          className="field"
          style={{ resize: "vertical", marginBottom: 6 }}
        />
        <div style={{ fontSize: 12, color: "#a99c82", marginBottom: 18 }}>{text.length} / 240 caractères</div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={submit}
            disabled={pending}
            className="font-display"
            style={{ flex: 1, border: "none", background: "#9a6638", color: "#fff", fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 11, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
          >
            {pending ? "Envoi…" : "Soumettre pour validation"}
          </button>
          <button
            onClick={reset}
            type="button"
            className="font-display"
            style={{ border: "1px solid #d8cdb4", background: "#fff", color: "#6c6150", fontWeight: 700, fontSize: 15, padding: "14px 18px", borderRadius: 11, cursor: "pointer" }}
          >
            Effacer
          </button>
        </div>

        {submitted && (
          <div style={{ marginTop: 14, background: "#e6f4ec", border: "1px solid #b6e0c8", color: "#1f8a5b", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, fontWeight: 600 }}>
            ✓ Promotion envoyée ! Elle apparaîtra sur le site une fois validée par l&apos;association.
          </div>
        )}
      </div>

      {/* LIVE PREVIEW */}
      <div>
        <div style={{ fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 700, marginBottom: 12 }}>
          Aperçu en direct
        </div>
        <article style={{ background: "#fff", border: "1px solid #ece3d0", borderRadius: 18, overflow: "hidden", boxShadow: "0 18px 40px -26px rgba(40,30,15,0.5)" }}>
          <div
            style={{
              position: "relative",
              height: 175,
              background: STRIPE_WARM,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {hasImg && <PromoImage src={imgData} alt={title} />}
            {!hasImg && (
              <span style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "#a99c82", textTransform: "uppercase" }}>
                photo de l&apos;offre
              </span>
            )}
            {hasBadge && (
              <span className="font-display" style={{ position: "absolute", top: 0, right: 0, background: "#d8472b", color: "#fff", fontWeight: 800, fontSize: 18, padding: "8px 15px", borderRadius: "0 0 0 16px" }}>
                {badge}
              </span>
            )}
            <span style={{ position: "absolute", top: 12, left: 12, background: "#9a6638", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>
              {cat}
            </span>
          </div>
          <div style={{ padding: "17px 18px 18px" }}>
            <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: "0 0 5px", color: "#26201a" }}>
              {title.trim() || "Titre de votre promotion"}
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#8c8068", lineHeight: 1.5 }}>
              {text.trim() ||
                "Le texte de votre offre apparaîtra ici au fur et à mesure que vous le rédigez."}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f0e8d6", paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3c3322" }}>{memberName}</div>
              <span style={{ color: "#2C6FB3", fontWeight: 700, fontSize: 13 }}>Voir l&apos;offre →</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
