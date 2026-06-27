/**
 * Promo image that adapts to any aspect ratio.
 * Sharp `contain` image on top of a blurred `cover` copy of itself,
 * so the whole image is always visible with no flat letterbox bars.
 * Render inside a `position: relative` box; place after it any
 * badges/labels that must sit on top.
 */
export function PromoImage({ src, alt = "" }: { src: string; alt?: string }) {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(18px) saturate(1.15)",
          transform: "scale(1.18)",
        }}
      />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(40,30,15,0.16)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </>
  );
}
