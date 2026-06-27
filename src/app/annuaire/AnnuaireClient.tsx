"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { VitrineImage } from "@/components/VitrineImage";

export type DirectoryMember = {
  id: number;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  categoryLabel: string | null;
  accent: string | null;
  hasPromo: boolean;
  promoBadge: string | null;
};

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";
const STRIPE_COOL =
  "repeating-linear-gradient(45deg,#eef0ec,#eef0ec 12px,#e2e8e6 12px,#e2e8e6 24px)";

export function AnnuaireClient({
  members,
  categories,
  initialQuery = "",
}: {
  members: DirectoryMember[];
  categories: { label: string; accent: string }[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState("Toutes les communes");
  const [cat, setCat] = useState("Tous");
  const [sort, setSort] = useState<"az" | "promo">("az");

  const communes = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => m.city && set.add(m.city));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [members]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Tous: members.length };
    members.forEach((m) => {
      if (m.categoryLabel) c[m.categoryLabel] = (c[m.categoryLabel] ?? 0) + 1;
    });
    return c;
  }, [members]);

  const chips = useMemo(() => {
    const used = categories.filter((c) => (counts[c.label] ?? 0) > 0);
    return [{ label: "Tous", accent: "#13324F" }, ...used];
  }, [categories, counts]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = members.filter((m) => {
      if (cat !== "Tous" && m.categoryLabel !== cat) return false;
      if (city !== "Toutes les communes" && m.city !== city) return false;
      if (
        q &&
        !(
          m.name.toLowerCase().includes(q) ||
          (m.categoryLabel ?? "").toLowerCase().includes(q) ||
          (m.description ?? "").toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
    if (sort === "az") out = [...out].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    else if (sort === "promo")
      out = [...out].sort((a, b) => Number(b.hasPromo) - Number(a.hasPromo));
    return out;
  }, [members, query, city, cat, sort]);

  const filterLabel =
    (cat !== "Tous" ? " · " + cat : "") +
    (city !== "Toutes les communes" ? " · " + city : "");

  function reset() {
    setQuery("");
    setCity("Toutes les communes");
    setCat("Tous");
    setSort("az");
  }

  const fieldStyle: React.CSSProperties = {
    border: "1px solid #ddd2bb",
    borderRadius: 11,
    padding: "0 13px",
    background: "#faf7ef",
    fontSize: 14,
    fontFamily: "'Public Sans'",
    color: "#3c3322",
  };

  return (
    <>
      {/* search + filters */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e6dcc6",
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 18px 40px -30px rgba(40,30,15,0.4)",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", gap: 11, marginBottom: 14, flexWrap: "wrap" }}>
          <div
            style={{
              flex: "1.6 1 240px",
              display: "flex",
              alignItems: "center",
              gap: 9,
              border: "1px solid #ddd2bb",
              borderRadius: 11,
              padding: "0 13px",
              background: "#faf7ef",
            }}
          >
            <span style={{ width: 10, height: 10, border: "2px solid #9a8d72", borderRadius: "50%", display: "inline-block" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom du commerçant, métier…"
              style={{ border: "none", background: "transparent", outline: "none", padding: "13px 0", fontSize: 14.5, fontFamily: "'Public Sans'", width: "100%", color: "#3c3322" }}
            />
          </div>
          <select value={city} onChange={(e) => setCity(e.target.value)} style={{ ...fieldStyle, flex: "0.9 1 160px", padding: "12px 13px" }}>
            <option>Toutes les communes</option>
            {communes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {chips.map((c) => {
            const active = cat === c.label;
            return (
              <button
                key={c.label}
                onClick={() => setCat(c.label)}
                style={{
                  cursor: "pointer",
                  fontFamily: "'Public Sans'",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "9px 15px",
                  borderRadius: 999,
                  transition: "all .15s",
                  ...(active
                    ? { background: "#13324F", color: "#fff", border: "1px solid #13324F" }
                    : { background: "#faf7ef", color: "#3c3322", border: "1px solid #e6dcc6" }),
                }}
              >
                {c.label}
                <span style={{ opacity: 0.6, marginLeft: 6 }}>{counts[c.label] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* result count + sort */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 4px 18px", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, color: "#6c6150" }}>
          <strong style={{ color: "#26201a" }}>{list.length}</strong> adhérent(s)
          {filterLabel}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#9a8d72" }}>
          Trier par
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "az" | "promo")}
            style={{ border: "1px solid #ddd2bb", borderRadius: 9, padding: "7px 11px", background: "#fff", fontSize: 13.5, fontFamily: "'Public Sans'", color: "#3c3322" }}
          >
            <option value="az">Nom (A–Z)</option>
            <option value="promo">Avec promotions</option>
          </select>
        </div>
      </div>

      {/* grid / empty */}
      {list.length > 0 ? (
        <div className="grid grid-3" style={{ gap: 20 }}>
          {list.map((m, i) => {
            return (
            <Link
              key={m.id}
              href={`/adherents/${m.id}`}
              className="lift-card"
              style={{ textDecoration: "none", color: "inherit", background: "#fff", border: "1px solid #e6dcc6", borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              <VitrineImage
                coverUrl={m.coverUrl}
                logoUrl={m.logoUrl}
                height={150}
                stripe={i % 2 === 0 ? STRIPE_WARM : STRIPE_COOL}
              >
                {m.categoryLabel && (
                  <span style={{ position: "absolute", top: 12, left: 12, background: m.accent ?? "#9a6638", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>
                    {m.categoryLabel}
                  </span>
                )}
                {m.hasPromo && m.promoBadge && (
                  <span className="font-display" style={{ position: "absolute", top: 0, right: 0, background: "#d8472b", color: "#fff", fontWeight: 800, fontSize: 12.5, padding: "6px 12px", borderRadius: "0 0 0 14px" }}>
                    {m.promoBadge}
                  </span>
                )}
              </VitrineImage>
              <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
                <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: 0, color: "#26201a" }}>
                  {m.name}
                </h3>
                <p style={{ margin: "6px 0 12px", fontSize: 13, color: "#8c8068", lineHeight: 1.5, flex: 1 }}>
                  {m.description}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#6c6150", borderTop: "1px solid #f0e8d6", paddingTop: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.accent ?? "#E0A63C" }} />
                  {[m.address, m.city].filter(Boolean).join(" · ")}
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px dashed #d8cdb4", borderRadius: 18, padding: 54, textAlign: "center" }}>
          <div className="font-display" style={{ fontWeight: 700, fontSize: 19, color: "#26201a", marginBottom: 6 }}>
            Aucun adhérent trouvé
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#8c8068" }}>
            Essayez un autre mot-clé, une autre commune ou catégorie.
          </p>
          <button onClick={reset} className="font-display" style={{ border: "none", background: "#9a6638", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 20px", borderRadius: 11, cursor: "pointer" }}>
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </>
  );
}
