import Link from "next/link";
import { getSiteSettings, socialLinks } from "@/lib/site-settings";
import { ContactModalButton } from "./ContactModalButton";
import { SOCIAL_BRAND, SocialIcon } from "./SocialIcons";

export async function SiteFooter() {
  const year = new Date().getFullYear();
  const settings = await getSiteSettings();
  const socials = socialLinks(settings);

  const email = settings.association_email.trim();
  const phone = settings.association_phone.trim();
  const address = settings.association_address.trim();
  const hasContact = !!(email || phone || address);

  return (
    <footer className="site-footer">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 26 }}>
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" aria-label="Plein R — accueil" style={{ display: "inline-flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo.png" alt="Plein R" />
            </Link>
            <p className="footer-tagline">
              Association des commerçants et entreprises du Bassin de Pompey.
              Réseau · Rencontre · Réussite.
            </p>
          </div>

          <div>
            <div className="footer-title">Accès rapide</div>
            <div className="footer-links">
              <Link href="/annuaire">Annuaire</Link>
              <Link href="/promotions">Promotions</Link>
              <Link href="/association">L&apos;association</Link>
              <Link href="/rencontres-passees">Rencontres passées</Link>
              <Link href="/login">Espace adhérent</Link>
            </div>
          </div>

          <div>
            <div className="footer-title">Informations</div>
            <div className="footer-links">
              <ContactModalButton label="Nous contacter" />
              <Link href="/mentions-legales">Mentions légales</Link>
              <Link href="/confidentialite">Confidentialité</Link>
            </div>
          </div>

          <div>
            {socials.length > 0 && (
              <>
                <div className="footer-title">Nous suivre</div>
                <div className="footer-social">
                  {socials.map((s) => (
                    <a
                      key={s.network}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Plein R sur ${s.label}`}
                    >
                      <span style={{ color: SOCIAL_BRAND[s.network], display: "inline-flex", width: 17, flexShrink: 0 }}>
                        <SocialIcon network={s.network} size={17} />
                      </span>
                      {s.label}
                    </a>
                  ))}
                </div>
              </>
            )}

            {hasContact && (
              <div className="footer-contact">
                {email && <a href={`mailto:${email}`}>{email}</a>}
                {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>}
                {address && <span>{address}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} Plein R. Tous droits réservés.</span>
          <span className="footer-bottom__place">Bassin de Pompey</span>
        </div>
      </div>
    </footer>
  );
}
