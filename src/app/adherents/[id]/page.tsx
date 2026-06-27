import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sparkle } from "@/components/Sparkle";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { VitrineImage } from "@/components/VitrineImage";
import { getMemberLivePromotions, getPublicMember } from "@/lib/queries";

export const dynamic = "force-dynamic";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";
const COVER_STRIPE =
  "repeating-linear-gradient(45deg,#e9e1cd,#e9e1cd 16px,#e2d8c1 16px,#e2d8c1 32px)";

const TAG_COLORS = [
  { bg: "#f6efdc", color: "#9a6638" },
  { bg: "#e7f0f3", color: "#3f8aa3" },
  { bg: "#eef0ec", color: "#5a7a5a" },
  { bg: "#eaf0f6", color: "#2C6FB3" },
];

function badgeColor(badge: string | null) {
  if (!badge) return "#1f8a5b";
  return badge.includes("%") ? "#d8472b" : "#1f8a5b";
}

function initialsOf(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const member = await getPublicMember(Number(id));
  if (!member) return { title: "Adhérent — Plein R" };
  return { title: `${member.name} — Plein R`, description: member.description ?? undefined };
}

export default async function FicheAdherentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memberId = Number(id);
  if (!memberId) notFound();

  const member = await getPublicMember(memberId);
  if (!member || member.status !== "active") notFound();

  const promos = await getMemberLivePromotions(memberId);
  const accent = member.accent ?? "#E0A63C";

  const fullAddress = [member.address, [member.postalCode, member.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");
  const mapQuery = encodeURIComponent(
    [member.address, member.postalCode, member.city].filter(Boolean).join(", ")
  );
  const paragraphs = (member.description ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const tags = (member.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const hours = (member.hours ?? "")
    .split("\n")
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter((p) => p[0]);

  const sectionCard: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e6dcc6",
    borderRadius: 18,
    padding: "26px 28px",
  };
  const h2: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 20,
    margin: "0 0 12px",
    color: "#26201a",
  };

  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader active="annuaire" />

      <div className="container" style={{ paddingBottom: 56 }}>
        {/* breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#9a8d72", padding: "6px 0 18px", flexWrap: "wrap" }}>
          <Link href="/annuaire" style={{ textDecoration: "none", color: "#9a6638", fontWeight: 600 }}>Annuaire</Link>
          {member.categoryLabel && (<><span>›</span><span style={{ color: "#9a8d72" }}>{member.categoryLabel}</span></>)}
          <span>›</span>
          <span style={{ color: "#3c3322", fontWeight: 600 }}>{member.name}</span>
        </div>

        {/* cover + identity */}
        <section style={{ position: "relative", borderRadius: 22, overflow: "hidden", border: "1px solid #e6dcc6" }}>
          <VitrineImage
            coverUrl={member.coverUrl}
            logoUrl={member.logoUrl}
            height={230}
            stripe={COVER_STRIPE}
            placeholder="photo de couverture"
          >
            <Sparkle color={accent} size={20} style={{ top: 20, right: 24 }} duration={3.2} />
          </VitrineImage>
          <div style={{ background: "#fff", padding: "0 30px 26px", display: "flex", alignItems: "flex-end", gap: 22, flexWrap: "wrap" }}>
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: 22,
                background: "#fff",
                border: "4px solid #fff",
                marginTop: -54,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxShadow: "0 14px 30px -16px rgba(40,30,15,0.4)",
              }}
            >
              {member.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.logoUrl}
                  alt={member.name}
                  style={{ maxWidth: "86%", maxHeight: "86%", objectFit: "contain", display: "block" }}
                />
              ) : (
                <span className="font-display" style={{ fontWeight: 800, fontSize: 34, color: "#9a6638" }}>{initialsOf(member.name)}</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 240, paddingTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h1 className="font-display" style={{ fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em", margin: 0, color: "#26201a" }}>{member.name}</h1>
                {member.categoryLabel && (
                  <span style={{ background: "#9a6638", color: "#fff", borderRadius: 999, padding: "5px 13px", fontSize: 12, fontWeight: 700 }}>{member.categoryLabel}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: "#6c6150", marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
                {[fullAddress, member.memberSince ? `Adhérent depuis ${member.memberSince}` : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, paddingBottom: 4, flexWrap: "wrap" }}>
              {member.phone && (
                <a href={`tel:${member.phone.replace(/\s/g, "")}`} className="font-display" style={{ textDecoration: "none", background: "#2C6FB3", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 18px", borderRadius: 11 }}>Appeler</a>
              )}
              {mapQuery && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`} target="_blank" rel="noopener" className="font-display" style={{ textDecoration: "none", background: "#fff", border: "1px solid #d8cdb4", color: "#3c3322", fontWeight: 700, fontSize: 14, padding: "11px 18px", borderRadius: 11 }}>Itinéraire</a>
              )}
            </div>
          </div>
        </section>

        {/* two columns */}
        <div className="grid fiche-split" style={{ marginTop: 26 }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* about */}
            <section style={sectionCard}>
              <h2 className="font-display" style={h2}>À propos de l&apos;établissement</h2>
              {paragraphs.length > 0 ? (
                paragraphs.map((p, i) => (
                  <p key={i} style={{ margin: i === paragraphs.length - 1 ? 0 : "0 0 12px", fontSize: 15, lineHeight: 1.65, color: "#5e5444" }}>{p}</p>
                ))
              ) : (
                <p style={{ margin: 0, fontSize: 15, color: "#8c8068" }}>Présentation à venir.</p>
              )}
              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 18 }}>
                  {tags.map((t, i) => {
                    const c = TAG_COLORS[i % TAG_COLORS.length];
                    return (
                      <span key={t} style={{ background: c.bg, color: c.color, fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 999 }}>{t}</span>
                    );
                  })}
                </div>
              )}
            </section>

            {/* practical info */}
            <section style={sectionCard}>
              <h2 className="font-display" style={{ ...h2, marginBottom: 16 }}>Informations pratiques</h2>
              <div className="grid grid-2" style={{ gap: 22 }}>
                <div>
                  <div style={{ fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#a99c82", fontWeight: 700, marginBottom: 10 }}>Horaires</div>
                  {hours.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 14 }}>
                      {hours.map(([label, range], i) => {
                        const closed = (range ?? "").toLowerCase().includes("ferm");
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ color: "#6c6150" }}>{label}</span>
                            <span style={{ color: closed ? "#c0392b" : "#3c3322", fontWeight: 600 }}>{range}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#a99c82" }}>Horaires non communiqués.</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#a99c82", fontWeight: 700, marginBottom: 10 }}>Contact</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 14, color: "#5e5444" }}>
                    {member.phone && (
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E0A63C" }} />{member.phone}</div>
                    )}
                    {member.email && (
                      <a href={`mailto:${member.email}`} style={{ display: "flex", alignItems: "center", gap: 9, color: "#5e5444", textDecoration: "none" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6FB0C6" }} />{member.email}</a>
                    )}
                    {member.website && (
                      <a href={member.website} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: 9, color: "#2C6FB3", textDecoration: "none", fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2C6FB3" }} />{member.website.replace(/^https?:\/\//, "")}</a>
                    )}
                    {!member.phone && !member.email && !member.website && (
                      <div style={{ color: "#a99c82" }}>Coordonnées non communiquées.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* map */}
            {mapQuery && (
              <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 18, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px 14px", gap: 12, flexWrap: "wrap" }}>
                  <h2 className="font-display" style={{ ...h2, margin: 0 }}>Nous situer</h2>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener" style={{ textDecoration: "none", color: "#2C6FB3", fontWeight: 700, fontSize: 13.5 }}>Ouvrir dans Google Maps →</a>
                </div>
                <iframe
                  title={`Carte — ${member.name}`}
                  src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                  style={{ width: "100%", height: 320, border: 0, display: "block", filter: "saturate(0.92)" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                {fullAddress && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 28px", fontSize: 13.5, color: "#6c6150", borderTop: "1px solid #f0e8d6" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9a6638" }} />{fullAddress}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* RIGHT */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 18 }}>
            <section style={{ position: "relative", background: "#fff", border: "1px solid #e6dcc6", borderRadius: 18, padding: "22px 22px 24px", overflow: "hidden" }}>
              <Sparkle color="#E0A63C" size={16} style={{ top: 18, right: 20 }} duration={3} />
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fdeccd", color: "#9a6638", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 800, padding: "5px 12px", borderRadius: 999, marginBottom: 14 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E0A63C" }} />Ses bons plans
              </div>
              <h2 className="font-display" style={{ fontWeight: 800, fontSize: 21, margin: "0 0 4px", color: "#26201a" }}>Promotions en cours</h2>
              <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#8c8068" }}>Réservées aux clients &amp; adhérents Plein R.</p>

              {promos.length === 0 ? (
                <div style={{ border: "1px dashed #d8cdb4", borderRadius: 14, padding: "20px 16px", fontSize: 13.5, color: "#8c8068", textAlign: "center" }}>
                  Pas de promotion en cours.
                </div>
              ) : (
                promos.map((p, idx) => (
                  <article key={p.id} className="lift" style={{ border: "1px solid #ece3d0", borderRadius: 16, overflow: "hidden", marginBottom: idx === promos.length - 1 ? 0 : 14 }}>
                    <div style={{ position: "relative", height: 120, background: p.imageUrl ? `url(${p.imageUrl})` : STRIPE_WARM, backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {!p.imageUrl && (<span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#a99c82", textTransform: "uppercase" }}>photo de l&apos;offre</span>)}
                      {p.badge && (
                        <span className="font-display" style={{ position: "absolute", top: 0, right: 0, background: badgeColor(p.badge), color: "#fff", fontWeight: 800, fontSize: 16, padding: "6px 13px", borderRadius: "0 0 0 14px" }}>{p.badge}</span>
                      )}
                    </div>
                    <div style={{ padding: "14px 15px 15px" }}>
                      <h3 className="font-display" style={{ fontWeight: 700, fontSize: 16, margin: "0 0 5px", color: "#26201a" }}>{p.title}</h3>
                      <p style={{ margin: "0 0 11px", fontSize: 13, color: "#8c8068", lineHeight: 1.5 }}>{p.text}</p>
                      {p.validUntil && (
                        <div style={{ borderTop: "1px solid #f0e8d6", paddingTop: 10, fontSize: 12, color: "#a99c82" }}>{p.validUntil}</div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>

            {/* contact CTA */}
            <section style={{ background: "linear-gradient(120deg,#13324F,#1d4a72)", borderRadius: 18, padding: 22, color: "#fff" }}>
              <h3 className="font-display" style={{ fontWeight: 700, fontSize: 17, margin: "0 0 6px" }}>Une question pour ce commerçant ?</h3>
              <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#bcd3e6" }}>Contactez {member.name} directement.</p>
              <a href={member.email ? `mailto:${member.email}` : "#"} className="font-display" style={{ textDecoration: "none", display: "block", textAlign: "center", background: "#E0A63C", color: "#33291D", fontWeight: 700, fontSize: 14.5, padding: 12, borderRadius: 11 }}>Envoyer un message</a>
            </section>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
