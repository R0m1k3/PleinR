"use client";

import { useMemo, useState } from "react";
import { MemberCard, type MemberCardData } from "@/components/MemberCard";

export type DirectoryMember = MemberCardData & {
  hasPromo: boolean;
  promoBadge: string | null;
};

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
          {list.map((m, i) => (
            <MemberCard key={m.id} m={m} index={i} />
          ))}
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
