import { richTextNodes } from "@/lib/rich-text";

/**
 * Une information de l'association. Rendu unique, partagé par le fil de
 * l'espace adhérent et l'aperçu du back-office : une seule carte à maintenir.
 *
 * Le corps passe par `richTextNodes()` : des éléments React, jamais du HTML
 * injecté.
 */

export type InformationCardProps = {
  title: string;
  body: string;
  imageUrl?: string | null;
  publishedAt?: Date | null;
  authorName?: string | null;
  pinned?: boolean;
  unread?: boolean;
  /** Mention d'état supplémentaire (« Brouillon », « Lue par 12 / 40 »…). */
  note?: string | null;
};

function formatDay(value: Date) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function InformationCard({
  title,
  body,
  imageUrl,
  publishedAt,
  authorName,
  pinned,
  unread,
  note,
}: InformationCardProps) {
  // Une seule accentuation à la fois : l'épinglage prime sur la nouveauté,
  // sinon les deux liserés se disputeraient le même bord.
  const accent = pinned ? "#E0A63C" : unread ? "#1F8A5B" : null;

  return (
    <article
      style={{
        background: unread || pinned ? "#fff" : "#fdfcf8",
        border: `1px solid ${pinned ? "#e5cf9a" : "#e6dcc6"}`,
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: 14,
        boxShadow: accent ? `inset 4px 0 0 ${accent}` : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 9 }}>
        {pinned && (
          <span style={{ background: "#fbeede", color: "#9a6638", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>
            Épinglée
          </span>
        )}
        {unread && (
          <span style={{ background: "#e6f4ec", color: "#1f8a5b", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>
            Nouveau
          </span>
        )}
        <span style={{ color: "#9a8d72", fontSize: 12.5 }}>
          {publishedAt ? `Publié le ${formatDay(publishedAt)}` : "Non publiée"}
          {authorName ? ` par ${authorName}` : ""}
        </span>
        {note && (
          <span style={{ background: "#f1efe7", color: "#a99c82", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>
            {note}
          </span>
        )}
      </div>

      <h3 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: 18, color: "#26201a" }}>
        {title}
      </h3>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{ display: "block", width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 10, border: "1px solid #e6dcc6", margin: "13px 0 4px" }}
        />
      )}

      <div className="rich-text" style={{ marginTop: 9 }}>
        {richTextNodes(body)}
      </div>
    </article>
  );
}
