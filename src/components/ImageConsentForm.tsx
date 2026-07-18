"use client";

import { useRef, useState } from "react";

export function ImageConsentForm({
  saveAction,
  defaultName,
  compact = false,
  currentDecision = null,
}: {
  saveAction: (formData: FormData) => Promise<void>;
  defaultName: string;
  compact?: boolean;
  currentDecision?: "accepted" | "refused" | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const p = point(event);
    const ctx = canvasRef.current?.getContext("2d");
    if (!p || !ctx) return;
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#13324F";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    setSignature(canvasRef.current?.toDataURL("image/png") ?? "");
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const p = point(event);
    const ctx = canvasRef.current?.getContext("2d");
    if (!p || !ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDrawing(true);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
    setError("");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "accepted" && !signature) {
      event.preventDefault();
      setError("Signez dans le cadre pour valider l'autorisation.");
    }
  }

  if (currentDecision === "accepted") {
    return (
      <form action={saveAction} style={{ marginTop: 12 }}>
        <input type="hidden" name="signatoryName" value={defaultName} />
        <input type="hidden" name="signaturePng" value="" />
        <button
          type="submit"
          name="decision"
          value="refused"
          style={{
            border: "1px solid #e0c3bb",
            background: "#fff",
            color: "#d8472b",
            fontWeight: 800,
            borderRadius: 8,
            padding: "9px 14px",
            cursor: "pointer",
          }}
        >
          Retirer mon autorisation
        </button>
      </form>
    );
  }

  return (
    <form
      action={saveAction}
      onSubmit={onSubmit}
      style={{
        background: compact ? "#fff" : "#F6F2E8",
        border: "1px solid #e6dcc6",
        borderRadius: 16,
        padding: compact ? 18 : 24,
      }}
    >
      <input type="hidden" name="signaturePng" value={signature} />
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label className="field-label">Nom du signataire</label>
          <input name="signatoryName" defaultValue={defaultName} className="field" required />
        </div>

        <div style={{ color: "#6c6150", fontSize: 13.5, lineHeight: 1.65 }}>
          J'autorise l'association Plein R à utiliser mon image dans les supports liés à la vie
          associative: site internet, réseaux sociaux et supports imprimés. Autorisation gratuite,
          valable 5 ans, sans vente à des tiers. Je peux retirer mon accord à tout moment.
        </div>

        <div>
          <label className="field-label">Signature</label>
          <canvas
            ref={canvasRef}
            width={760}
            height={190}
            onPointerDown={start}
            onPointerMove={draw}
            onPointerUp={() => setDrawing(false)}
            onPointerCancel={() => setDrawing(false)}
            style={{
              width: "100%",
              height: compact ? 120 : 150,
              display: "block",
              touchAction: "none",
              background: "#fff",
              border: "1px dashed #d6c9ad",
              borderRadius: 12,
            }}
          />
          <button
            type="button"
            onClick={clear}
            style={{
              marginTop: 8,
              border: "none",
              background: "transparent",
              color: "#9a6638",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Effacer la signature
          </button>
          {error && <div style={{ color: "#d8472b", fontSize: 12.5, marginTop: 4 }}>{error}</div>}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="submit"
            name="decision"
            value="accepted"
            style={{
              border: "none",
              background: "#13324F",
              color: "#fff",
              fontWeight: 800,
              borderRadius: 10,
              padding: "11px 17px",
              cursor: "pointer",
            }}
          >
            J'autorise et je signe
          </button>
          <button
            type="submit"
            name="decision"
            value="refused"
            style={{
              border: "1px solid #e0c3bb",
              background: "#fff",
              color: "#d8472b",
              fontWeight: 800,
              borderRadius: 10,
              padding: "11px 17px",
              cursor: "pointer",
            }}
          >
            Je refuse
          </button>
        </div>
      </div>
    </form>
  );
}
