import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryLinks } from "@/components/CategoryLinks";
import { JsonLd } from "@/components/JsonLd";
import { MemberCard } from "@/components/MemberCard";
import { MembershipModalButton } from "@/components/MembershipModalButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Sparkle } from "@/components/Sparkle";
import {
  getActiveMembersByCategory,
  getCategoriesInUse,
  getCategoryBySlug,
  getLiveBadgesByMember,
} from "@/lib/queries";
import {
  NOINDEX,
  breadcrumbJsonLd,
  categoryPath,
  memberListJsonLd,
  metaDescription,
  pageMetadata,
} from "@/lib/seo";
import { publicBaseUrl } from "@/lib/seo-server";

export const dynamic = "force-dynamic";

type Params = Promise<{ categorie: string }>;

/** Communes représentées, dans l'ordre d'effectif, pour le texte d'introduction. */
function listCities(members: { city: string | null }[], max = 4): string[] {
  const counts = new Map<string, number>();
  for (const m of members) if (m.city) counts.set(m.city, (counts.get(m.city) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, max)
    .map(([city]) => city);
}

function joinFr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/** Titre et introduction d'une page métier, réutilisés par les métadonnées et le rendu. */
function categoryCopy(label: string, members: { city: string | null }[]) {
  const n = members.length;
  const cities = listCities(members);
  const where = cities.length > 0 ? ` à ${joinFr(cities)}` : " sur le Bassin de Pompey";
  const title = `${label} sur le Bassin de Pompey`;
  const intro =
    n === 0
      ? `Aucun adhérent Plein R n'est encore référencé dans la catégorie ${label}. Vous exercez ce métier sur le Bassin de Pompey ? Rejoignez l'association pour apparaître ici.`
      : `${n} ${n > 1 ? "professionnels adhérents" : "professionnel adhérent"} Plein R dans la catégorie ${label}${where} : coordonnées, horaires d'ouverture et bons plans du moment. Des commerçants et entreprises de proximité, membres du réseau économique du Bassin de Pompey.`;
  return { title, intro };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categorie } = await params;
  const category = await getCategoryBySlug(categorie);
  if (!category) return { title: "Catégorie introuvable", robots: NOINDEX };
  const members = await getActiveMembersByCategory(category.id);
  const { title, intro } = categoryCopy(category.label, members);
  return pageMetadata({
    title,
    description: metaDescription(intro),
    path: categoryPath(category.slug),
    // Une catégorie sans adhérent n'a rien à offrir aux moteurs : on la laisse
    // visible pour les visiteurs, mais hors index.
    robots: members.length === 0 ? NOINDEX : undefined,
  });
}

export default async function CategoriePage({ params }: { params: Params }) {
  const { categorie } = await params;
  const category = await getCategoryBySlug(categorie);
  if (!category) notFound();

  const [rawMembers, badges, categoriesInUse, baseUrl] = await Promise.all([
    getActiveMembersByCategory(category.id),
    getLiveBadgesByMember(),
    getCategoriesInUse(),
    publicBaseUrl(),
  ]);
  const badgeByMember = new Map<number, string | null>();
  for (const b of badges) {
    if (b.memberId != null && !badgeByMember.has(b.memberId)) badgeByMember.set(b.memberId, b.badge);
  }
  const members = rawMembers.map((m) => ({
    ...m,
    hasPromo: badgeByMember.has(m.id),
    promoBadge: badgeByMember.get(m.id) ?? null,
  }));
  const { title, intro } = categoryCopy(category.label, members);
  const accent = category.accent || "#E0A63C";

  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader active="annuaire" logo />
      <JsonLd
        data={[
          breadcrumbJsonLd(baseUrl, [
            { name: "Accueil", path: "/" },
            { name: "Annuaire", path: "/annuaire" },
            { name: category.label, path: categoryPath(category.slug) },
          ]),
          memberListJsonLd(baseUrl, title, members),
        ]}
      />

      <main className="container" style={{ paddingBottom: 56 }}>
        <nav aria-label="Fil d'Ariane" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#9a8d72", padding: "6px 0 18px", flexWrap: "wrap" }}>
          <Link href="/annuaire" style={{ textDecoration: "none", color: "#9a6638", fontWeight: 600 }}>Annuaire</Link>
          <span>›</span>
          <span style={{ color: "#3c3322", fontWeight: 600 }} aria-current="page">{category.label}</span>
        </nav>

        <section style={{ position: "relative", padding: "6px 0 22px", overflow: "hidden" }}>
          <Sparkle color={accent} size={18} style={{ top: 12, right: 30 }} duration={3.2} />
          <Sparkle color="#6FB0C6" size={12} style={{ top: 52, right: 90 }} duration={2.7} delay={0.5} />
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              background: category.tint || "#fff",
              border: "1px solid #e6dcc6",
              color: "#9a6638",
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 800,
              padding: "6px 13px",
              borderRadius: 999,
              marginBottom: 14,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
            {members.length} {members.length > 1 ? "adhérents" : "adhérent"}
          </div>
          <h1 className="font-display" style={{ fontWeight: 800, fontSize: "clamp(26px, 6vw, 40px)", letterSpacing: "-0.02em", margin: "0 0 10px", color: "#26201a" }}>
            {title}
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: "#6c6150", maxWidth: 680, lineHeight: 1.6 }}>{intro}</p>
        </section>

        {members.length > 0 ? (
          <div className="grid grid-3" style={{ gap: 20 }}>
            {members.map((m, i) => (
              <MemberCard key={m.id} m={m} index={i} />
            ))}
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px dashed #d8cdb4", borderRadius: 18, padding: 44, textAlign: "center" }}>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 19, color: "#26201a", marginBottom: 14 }}>
              Soyez le premier référencé dans cette catégorie
            </div>
            <MembershipModalButton
              label="Adhérer à l'association"
              className="font-display"
              style={{ border: "none", background: "#E0A63C", color: "#33291D", fontWeight: 700, fontSize: 15, padding: "12px 22px", borderRadius: 12 }}
            />
          </div>
        )}

        {categoriesInUse.length > 0 && (
          <section style={{ marginTop: 34, background: "#fff", border: "1px solid #e6dcc6", borderRadius: 18, padding: "22px 24px" }}>
            <h2 className="font-display" style={{ fontWeight: 700, fontSize: 19, margin: "0 0 14px", color: "#26201a" }}>
              Autres métiers de l&apos;annuaire
            </h2>
            <CategoryLinks categories={categoriesInUse} currentSlug={category.slug} />
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
