"use client";

import { useActionState } from "react";
import Link from "next/link";
import { authenticate } from "./actions";

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#EDE7D7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Public Sans',sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.png" alt="Plein R" style={{ height: 92, width: "auto" }} />
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e6dcc6",
            borderRadius: 18,
            padding: 30,
            boxShadow: "0 26px 60px -40px rgba(40,30,15,0.5)",
          }}
        >
          <h1
            className="font-display"
            style={{ fontWeight: 800, fontSize: 24, margin: "0 0 4px", color: "#26201a" }}
          >
            Espace adhérent
          </h1>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: "#9a8d72" }}>
            Connectez-vous pour accéder à votre espace.
          </p>

          <form action={formAction}>
            <label className="field-label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="prenom@plein-r.fr"
              className="field"
              style={{ marginBottom: 16 }}
            />

            <label className="field-label" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="field"
              style={{ marginBottom: 18 }}
            />

            {errorMessage && (
              <div
                style={{
                  background: "#fbe9e6",
                  border: "1px solid #f0c4bb",
                  color: "#d8472b",
                  borderRadius: 10,
                  padding: "10px 13px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="font-display"
              style={{
                width: "100%",
                border: "none",
                background: "#13324F",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                padding: 14,
                borderRadius: 11,
                cursor: isPending ? "default" : "pointer",
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <Link href="/" style={{ fontSize: 13.5, color: "#6f6450", textDecoration: "none" }}>
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}
