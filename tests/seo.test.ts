import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  DESCRIPTION_MAX_LENGTH,
  NOINDEX,
  PRIVATE_PATHS,
  STATIC_ROUTES,
  absoluteUrl,
  breadcrumbJsonLd,
  eventJsonLd,
  localBusinessJsonLd,
  memberListJsonLd,
  metaDescription,
  openingHoursJsonLd,
  organizationJsonLd,
  pageMetadata,
  serializeJsonLd,
  webSiteJsonLd,
} from "../src/lib/seo";
import { parseMemberHours } from "../src/lib/member-profile";
import { SITE_SETTING_DEFAULTS, socialLinks } from "../src/lib/site-settings";

const BASE = "https://pleinr.example.org";

describe("SEO — URLs et descriptions", () => {
  it("construit des URLs absolues propres", () => {
    assert.equal(absoluteUrl(BASE), `${BASE}/`);
    assert.equal(absoluteUrl(`${BASE}//`, "/annuaire"), `${BASE}/annuaire`);
    assert.equal(absoluteUrl(BASE, "adherents/3"), `${BASE}/adherents/3`);
  });

  it("borne la meta description sur un mot entier", () => {
    const long = "Boulangerie artisanale ".repeat(20);
    const out = metaDescription(long);
    assert.ok(out.length <= DESCRIPTION_MAX_LENGTH, `trop long : ${out.length}`);
    assert.ok(out.endsWith("…"));
    assert.ok(!/ …$/.test(out), "pas d'espace avant l'ellipse");
    assert.equal(metaDescription("  Deux   lignes\n\nici "), "Deux lignes ici");
    assert.equal(metaDescription(null, "repli"), "repli");
  });
});

describe("SEO — JSON-LD sûr", () => {
  // Les descriptions viennent des adhérents : un `</script>` ne doit jamais
  // pouvoir sortir du bloc de données structurées.
  it("échappe toute tentative de fermeture de balise", () => {
    const out = serializeJsonLd({ description: `</script><script>alert(1)</script> & <img>` });
    assert.ok(!out.includes("<"), out);
    assert.ok(!out.includes(">"), out);
    assert.ok(!out.includes("&"), out);
    // Le JSON reste valide et fidèle une fois relu.
    assert.equal(JSON.parse(out).description, `</script><script>alert(1)</script> & <img>`);
  });
});

describe("SEO — données structurées", () => {
  const settings = {
    ...SITE_SETTING_DEFAULTS,
    association_email: "contact@pleinr.fr",
    association_address: "1 place de la Mairie, 54340 Pompey",
  };

  it("décrit l'association avec ses réseaux et son logo", () => {
    const org = organizationJsonLd(BASE, settings, socialLinks(settings)) as Record<string, unknown>;
    assert.equal(org["@type"], "Organization");
    assert.equal(org.url, `${BASE}/`);
    assert.equal(org.email, "contact@pleinr.fr");
    assert.deepEqual(org.sameAs, [settings.association_facebook, settings.association_linkedin]);
    assert.equal((org.logo as { url: string }).url, `${BASE}/assets/logo.png`);
    assert.ok(!("telephone" in org), "les champs vides sont retirés");
  });

  it("expose la recherche de l'annuaire au moteur", () => {
    const site = webSiteJsonLd(BASE);
    assert.equal(
      site.potentialAction.target.urlTemplate,
      `${BASE}/annuaire?q={search_term_string}`
    );
    assert.equal(site.publisher["@id"], `${BASE}/#organization`);
  });

  it("numérote le fil d'Ariane", () => {
    const crumbs = breadcrumbJsonLd(BASE, [
      { name: "Accueil", path: "/" },
      { name: "Annuaire", path: "/annuaire" },
    ]);
    assert.deepEqual(
      crumbs.itemListElement.map((i) => [i.position, i.item]),
      [[1, `${BASE}/`], [2, `${BASE}/annuaire`]]
    );
  });

  it("traduit les horaires en OpeningHoursSpecification", () => {
    const hours = parseMemberHours("Lundi – Vendredi|9h-12h / 14h-18h30\nSamedi|9h-12h\nDimanche|Fermé");
    const spec = openingHoursJsonLd(hours);
    const monday = spec.filter((s) => s.dayOfWeek === "https://schema.org/Monday");
    assert.equal(monday.length, 2);
    assert.deepEqual(monday.map((s) => [s.opens, s.closes]), [["09:00", "12:00"], ["14:00", "18:30"]]);
    assert.ok(spec.every((s) => s.dayOfWeek !== "https://schema.org/Sunday"));
  });

  it("décrit une fiche adhérent en LocalBusiness", () => {
    const member = {
      id: 7,
      name: "Au Bon Pain",
      description: "Boulangerie artisanale.",
      address: "12 rue du Four",
      postalCode: "54340",
      city: "Pompey",
      phone: "03 83 00 00 00",
      email: null,
      website: null,
      categoryLabel: "Boulangerie",
      tags: "pain, viennoiseries",
    };
    const biz = localBusinessJsonLd(BASE, member, [], null) as Record<string, unknown>;
    assert.equal(biz["@type"], "LocalBusiness");
    assert.equal(biz.url, `${BASE}/adherents/7`);
    assert.equal((biz.address as { addressLocality: string }).addressLocality, "Pompey");
    assert.equal(biz.keywords, "pain, viennoiseries");
    assert.ok(!("email" in biz));
    assert.ok(!("openingHoursSpecification" in biz), "pas d'horaires vides");

    const withSite = localBusinessJsonLd(BASE, member, [], "https://aubonpain.fr") as Record<string, unknown>;
    assert.equal(withSite.url, "https://aubonpain.fr");
    assert.equal(withSite.mainEntityOfPage, `${BASE}/adherents/7`);
  });

  it("décrit une rencontre à venir avec ses places restantes", () => {
    const event = eventJsonLd(BASE, {
      id: 3,
      title: "Afterwork de rentrée",
      startsAt: new Date("2026-09-24T17:30:00Z"),
      location: "Salle des fêtes, Frouard",
      description: null,
      capacity: 30,
      registered: 30,
    }) as Record<string, unknown>;
    assert.equal(event.startDate, "2026-09-24T17:30:00.000Z");
    assert.equal(event.remainingAttendeeCapacity, 0);
    assert.equal((event.offers as { availability: string }).availability, "https://schema.org/SoldOut");
    assert.equal((event.offers as { url: string }).url, `${BASE}/inscription/3`);
  });

  it("liste les adhérents de l'annuaire", () => {
    const list = memberListJsonLd(BASE, "Annuaire", [{ id: 1, name: "A" }, { id: 2, name: "B" }]);
    assert.equal(list.numberOfItems, 2);
    assert.equal(list.itemListElement[1].url, `${BASE}/adherents/2`);
  });
});

describe("SEO — indexation", () => {
  it("exclut l'espace privé et les pages transactionnelles", () => {
    for (const path of ["/backend", "/api", "/login", "/inscription"]) {
      assert.ok(PRIVATE_PATHS.includes(path), `${path} doit être exclu des robots`);
    }
    assert.ok(STATIC_ROUTES.every((r) => !PRIVATE_PATHS.some((p) => r.path.startsWith(p))));
    assert.equal((NOINDEX as { index: boolean }).index, false);
  });

  it("pose canonique, Open Graph et Twitter sur chaque page", () => {
    const meta = pageMetadata({ title: "Annuaire", description: "Desc", path: "/annuaire" });
    assert.equal(meta.alternates?.canonical, "/annuaire");
    assert.equal((meta.openGraph as { url: string }).url, "/annuaire");
    assert.equal((meta.openGraph as { locale: string }).locale, "fr_FR");
    assert.equal((meta.openGraph as { title: string }).title, "Annuaire · Plein R");
    assert.equal((meta.twitter as { card: string }).card, "summary_large_image");
    // L'image de partage doit survivre au remplacement du bloc openGraph du layout.
    assert.equal((meta.openGraph as { images: { url: string }[] }).images[0].url, "/opengraph-image");
    assert.equal((meta.twitter as { images: { url: string }[] }).images[0].url, "/opengraph-image");
    assert.equal((meta.robots as { index: boolean }).index, true);
  });
});
