import Link from "next/link";
import { ContactModalButton } from "./ContactModalButton";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: "#EFE9DA", borderTop: "1px solid #e2d6bd" }}>
      <div className="container" style={{ paddingTop: 34, paddingBottom: 24 }}>
        <div className="footer-grid">
          <div>
            <Link href="/" aria-label="Plein R — accueil" style={{ display: "inline-flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo.png" alt="Plein R" style={{ width: 118, height: "auto", display: "block" }} />
            </Link>
            <p style={{ margin: "12px 0 0", maxWidth: 370, fontSize: 13.5, lineHeight: 1.65, color: "#6c6150" }}>
              Association des commerçants et entreprises du Bassin de Pompey.
              Réseau · Rencontre · Réussite.
            </p>
          </div>

          <div>
            <div className="footer-title">Accès rapide</div>
            <div className="footer-links">
              <Link href="/annuaire">Annuaire</Link>
              <Link href="/#promotions">Promotions</Link>
              <Link href="/association">Association</Link>
              <Link href="/login">Connexion</Link>
            </div>
          </div>

          <div>
            <div className="footer-title">Informations</div>
            <div className="footer-links">
              <ContactModalButton
                label="Nous contacter"
                style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", textAlign: "left" }}
              />
              <Link href="/mentions-legales">Mentions légales</Link>
              <Link href="/confidentialite">Confidentialité</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} Plein R. Tous droits réservés.</span>
          <span>Bassin de Pompey</span>
        </div>
      </div>
    </footer>
  );
}
