import Link from "next/link";
import { categoryPath } from "@/lib/seo";

export type CategoryLink = { slug: string; label: string; accent: string; memberCount: number };

/** Pastilles-liens vers les pages métier : contenu statique, lisible sans JavaScript. */
export function CategoryLinks({ categories, currentSlug }: { categories: CategoryLink[]; currentSlug?: string }) {
  return (
    <nav aria-label="Parcourir par métier" style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      {categories.map((c) => {
        const active = c.slug === currentSlug;
        return (
          <Link
            key={c.slug}
            href={categoryPath(c.slug)}
            aria-current={active ? "page" : undefined}
            style={{
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${active ? "#13324F" : "#e6dcc6"}`,
              background: active ? "#13324F" : "#fff",
              color: active ? "#fff" : "#3c3322",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#E0A63C" : c.accent, flexShrink: 0 }} />
            {c.label}
            <span style={{ opacity: 0.6 }}>{c.memberCount}</span>
          </Link>
        );
      })}
    </nav>
  );
}
