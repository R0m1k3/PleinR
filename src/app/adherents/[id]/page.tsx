import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { Sparkle } from "@/components/Sparkle";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { VitrineImage } from "@/components/VitrineImage";
import { PromoImage } from "@/components/PromoImage";
import { JsonLd } from "@/components/JsonLd";
import { getMemberLivePromotions, getPublicMember } from "@/lib/queries";
import {
  NOINDEX,
  breadcrumbJsonLd,
  localBusinessJsonLd,
  memberPath,
  metaDescription,
  pageMetadata,
  parseMemberParam,
} from "@/lib/seo";
import { publicBaseUrl } from "@/lib/seo-server";
import { autoTags, formatTags, parseTags } from "@/lib/tags";
import {
  formatSlots,
  getOpenStatus,
  normalizeWebsite,
  parseMemberHours,
  websiteLabel,
} from "@/lib/member-profile";
import { formatValidity } from "@/lib/promo-validity";

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

type ContactIconName = "phone" | "mail" | "website" | "pin" | "clock" | "chat";

function ContactIcon({ name }: { name: ContactIconName }) {
  const paths: Record<ContactIconName, React.ReactNode> = {
    phone: <path d="M7.4 3.8 9 7.2 7.2 8.6a14.4 14.4 0 0 0 6.2 6.2L14.8 13l3.4 1.6-.8 3.6c-.2.9-1 1.5-1.9 1.5C8.2 19.7 2.3 13.8 2.3 6.5c0-.9.6-1.7 1.5-1.9l3.6-.8Z" />,
    mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m4 6 8 6 8-6" /></>,
    website: <><circle cx="12" cy="12" r="9.5" /><path d="M2.8 12h18.4M12 2.5c2.4 2.6 3.6 5.8 3.6 9.5S14.4 18.9 12 21.5M12 2.5C9.6 5.1 8.4 8.3 8.4 12s1.2 6.9 3.6 9.5" /></>,
    pin: <><path d="M20 10c0 5.5-8 11.5-8 11.5S4 15.5 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9.5" /><path d="M12 6.6V12l3.6 2.4" /></>,
    chat: <><path d="M20.5 12.6c0 3.9-3.8 7.1-8.5 7.1-.9 0-1.8-.1-2.6-.3l-5.4 1.7 1.7-4.2a6.6 6.6 0 0 1-2.2-4.8c0-3.9 3.8-7.1 8.5-7.1s8.5 3.2 8.5 7.1Z" /><path d="M8.8 11.9h.01M12 11.9h.01M15.2 11.9h.01" /></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function ContactAction({
  href,
  icon,
  label,
  detail,
  external = false,
}: {
  href: string;
  icon: ContactIconName;
  label: string;
  detail: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className="contact-action"
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      <span className="contact-action__icon"><ContactIcon name={icon} /></span>
      <span className="contact-action__copy">
        <strong>{label}</strong>
        <span>{detail}</span>
      </span>
      <span className="contact-action__arrow" aria-hidden="true">{external ? "↗" : "→"}</span>
    </a>
  );
}

/** Titre de la fiche : « Nom · Catégorie à Ville », le plus parlant en résultat de recherche. */
function memberTitle(member: { name: string; categoryLabel: string | null; city: string | null }) {
  const where = member.city ? ` à ${member.city}` : " · Bassin de Pompey";
  return member.categoryLabel ? `${member.name} · ${member.categoryLabel}${where}` : `${member.name}${where}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const memberId = parseMemberParam(id);
  const member = memberId ? await getPublicMember(memberId) : null;
  if (!member || member.status !== "active") {
    return { title: "Adhérent introuvable", robots: NOINDEX };
  }
  const fallback =
    `${member.name}, ${member.categoryLabel ? `${member.categoryLabel.toLowerCase()} ` : ""}` +
    `adhérent Plein R${member.city ? ` à ${member.city}` : " sur le Bassin de Pompey"} : coordonnées, horaires et bons plans.`;
  return pageMetadata({
    title: memberTitle(member),
    description: metaDescription(member.description, fallback),
    path: memberPath(member),
    ogType: "profile",
  });
}

export default async function FicheAdherentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memberId = parseMemberParam(id);
  if (!memberId) notFound();

  const member = await getPublicMember(memberId);
  if (!member || member.status !== "active") notFound();

  // Une seule URL par fiche : l'ancienne forme `/adherents/12` et tout slug
  // périmé (renommage, changement de commune) sont redirigés définitivement.
  const canonical = memberPath(member);
  if (`/adherents/${id}` !== canonical) permanentRedirect(canonical);

  const [promos, baseUrl] = await Promise.all([getMemberLivePromotions(memberId), publicBaseUrl()]);
  const accent = member.accent ?? "#E0A63C";

  const fullAddress = [member.address, [member.postalCode, member.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");
  const mapQuery = encodeURIComponent(
    [member.address, member.postalCode, member.city].filter(Boolean).join(", ")
  );
  const paragraphs = (member.description ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  // Fiche jamais ré-enregistrée depuis l'arrivée des tags automatiques : on
  // affiche les suggestions du métier plutôt qu'une rubrique vide.
  const tags = parseTags(
    autoTags(member.tags, {
      categorySlug: member.categorySlug,
      categoryLabel: member.categoryLabel,
      city: member.city,
      description: member.description,
    })
  );
  const hours = parseMemberHours(member.hours);
  const openStatus = getOpenStatus(hours);
  const normalizedWebsite = normalizeWebsite(member.website);
  const shortWebsite = websiteLabel(member.website);
  // E-mail public : celui saisi pour la fiche, sinon l'e-mail du compte.
  const contactEmail = (member.contactEmail ?? "").trim() || member.email;
  const phoneHref = member.phone ? `tel:${member.phone.replace(/[^\d+]/g, "")}` : null;

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
      <JsonLd
        data={[
          breadcrumbJsonLd(baseUrl, [
            { name: "Accueil", path: "/" },
            { name: "Annuaire", path: "/annuaire" },
            { name: member.name, path: canonical },
          ]),
          localBusinessJsonLd(baseUrl, { ...member, email: contactEmail, tags: formatTags(tags) }, hours, normalizedWebsite),
        ]}
      />

      <main className="container" style={{ paddingBottom: 56 }}>
        {/* breadcrumb */}
        <nav aria-label="Fil d'Ariane" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#9a8d72", padding: "6px 0 18px", flexWrap: "wrap" }}>
          <Link href="/annuaire" style={{ textDecoration: "none", color: "#9a6638", fontWeight: 600 }}>Annuaire</Link>
          {member.categoryLabel && (<><span>›</span><span style={{ color: "#9a8d72" }}>{member.categoryLabel}</span></>)}
          <span>›</span>
          <span style={{ color: "#3c3322", fontWeight: 600 }} aria-current="page">{member.name}</span>
        </nav>

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
                background: "linear-gradient(160deg, #fffdf8 0%, #f6f2e8 100%)",
                border: "1px solid #e6dcc6",
                outline: "4px solid #fff",
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
                <h1 className="font-display" style={{ fontWeight: 800, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em", margin: 0, color: "#26201a" }}>{member.name}</h1>
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
              {phoneHref && (
                <a href={phoneHref} className="font-display profile-hero-action profile-hero-action--primary">Appeler</a>
              )}
              {normalizedWebsite && (
                <a href={normalizedWebsite} target="_blank" rel="noopener noreferrer" className="font-display profile-hero-action">Site web ↗</a>
              )}
              {mapQuery && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="font-display profile-hero-action">Itinéraire</a>
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
            <section className="practical-section">
              <div className="practical-section__heading">
                <div>
                  <span className="eyebrow">Préparer votre visite</span>
                  <h2 className="font-display" style={{ ...h2, margin: "10px 0 0" }}>Informations pratiques</h2>
                </div>
                {openStatus && (
                  <div className={`open-status${openStatus.isOpen ? " is-open" : ""}`}>
                    <span />
                    <div>
                      <strong>{openStatus.label}</strong>
                      {openStatus.detail && <small>{openStatus.detail}</small>}
                    </div>
                  </div>
                )}
              </div>

              <div className="practical-grid">
                <section className="schedule-card" aria-labelledby="schedule-title">
                  <div className="practical-card-title">
                    <span className="practical-card-title__icon" aria-hidden="true"><ContactIcon name="clock" /></span>
                    <div>
                      <span>Cette semaine</span>
                      <h3 id="schedule-title" className="font-display">Horaires d&apos;ouverture</h3>
                    </div>
                  </div>
                  {hours.length > 0 ? (
                    <div className="schedule-list">
                      {hours.map((day) => {
                        const isToday = openStatus?.todayKey === day.key;
                        return (
                          <div
                            key={day.key}
                            className={`schedule-row${isToday ? " is-today" : ""}`}
                            aria-current={isToday ? "date" : undefined}
                          >
                            <span className="schedule-row__day">
                              {day.label}
                              {isToday && <small>Aujourd&apos;hui</small>}
                            </span>
                            <strong className={day.closed ? "is-closed" : undefined}>
                              {day.closed ? "Fermé" : formatSlots(day.slots)}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="practical-empty">Horaires non communiqués.</div>
                  )}
                </section>

                <section className="contact-card" aria-labelledby="contact-title">
                  <div className="practical-card-title">
                    <span className="practical-card-title__icon practical-card-title__icon--blue" aria-hidden="true"><ContactIcon name="chat" /></span>
                    <div>
                      <span>Contact direct</span>
                      <h3 id="contact-title" className="font-display">Joindre l&apos;établissement</h3>
                    </div>
                  </div>
                  <div className="contact-actions">
                    {phoneHref && member.phone && (
                      <ContactAction href={phoneHref} icon="phone" label="Appeler" detail={member.phone} />
                    )}
                    {contactEmail && (
                      <ContactAction href={`mailto:${contactEmail}`} icon="mail" label="Envoyer un e-mail" detail={contactEmail} />
                    )}
                    {normalizedWebsite && shortWebsite && (
                      <ContactAction href={normalizedWebsite} icon="website" label="Visiter le site" detail={shortWebsite} external />
                    )}
                    {mapQuery && fullAddress && (
                      <ContactAction
                        href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
                        icon="pin"
                        label="Itinéraire"
                        detail={fullAddress}
                        external
                      />
                    )}
                    {!phoneHref && !contactEmail && !normalizedWebsite && !fullAddress && (
                      <div className="practical-empty">Coordonnées non communiquées.</div>
                    )}
                  </div>
                </section>
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
                    <div style={{ position: "relative", aspectRatio: "1 / 1", background: STRIPE_WARM, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {p.imageUrl && <PromoImage src={p.imageUrl} alt={p.title} />}
                      {!p.imageUrl && (<span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#a99c82", textTransform: "uppercase" }}>photo de l&apos;offre</span>)}
                      {p.badge && (
                        <span className="font-display" style={{ position: "absolute", top: 0, right: 0, background: badgeColor(p.badge), color: "#fff", fontWeight: 800, fontSize: 16, padding: "6px 13px", borderRadius: "0 0 0 14px" }}>{p.badge}</span>
                      )}
                    </div>
                    <div style={{ padding: "14px 15px 15px" }}>
                      <h3 className="font-display" style={{ fontWeight: 700, fontSize: 16, margin: "0 0 5px", color: "#26201a" }}>{p.title}</h3>
                      <p style={{ margin: "0 0 11px", fontSize: 13, color: "#8c8068", lineHeight: 1.5 }}>{p.text}</p>
                      {formatValidity(p) && (
                        <div style={{ borderTop: "1px solid #f0e8d6", paddingTop: 10, fontSize: 12, color: "#a99c82" }}>{formatValidity(p)}</div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>

            {/* contact CTA */}
            {(contactEmail || phoneHref || normalizedWebsite) && (
              <section style={{ background: "linear-gradient(120deg,#13324F,#1d4a72)", borderRadius: 18, padding: 22, color: "#fff" }}>
                <h3 className="font-display" style={{ fontWeight: 700, fontSize: 17, margin: "0 0 6px" }}>Une question pour ce commerçant ?</h3>
                <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#bcd3e6" }}>Contactez {member.name} directement.</p>
                <a
                  href={contactEmail ? `mailto:${contactEmail}` : phoneHref ?? normalizedWebsite ?? undefined}
                  target={!contactEmail && !phoneHref ? "_blank" : undefined}
                  rel={!contactEmail && !phoneHref ? "noopener noreferrer" : undefined}
                  className="font-display"
                  style={{ textDecoration: "none", display: "block", textAlign: "center", background: "#E0A63C", color: "#33291D", fontWeight: 700, fontSize: 14.5, padding: 12, borderRadius: 11 }}
                >
                  {contactEmail ? "Envoyer un message" : phoneHref ? "Appeler maintenant" : "Visiter le site"}
                </a>
              </section>
            )}
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
