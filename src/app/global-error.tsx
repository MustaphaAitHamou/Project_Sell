"use client";

/** Dernier recours si la mise en page racine elle-même échoue. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center", background: "#f6f5f2", color: "#1d1b19" }}>
        <h1>Une erreur est survenue</h1>
        <p>Le service est momentanément indisponible.{error.digest ? ` Référence : ${error.digest}` : ""}</p>
        <button type="button" onClick={reset} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1.5px solid #8a5300", background: "#f6a609", color: "#2b1d00", fontWeight: 700 }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
