"use client";

/** Dernier recours si la mise en page racine elle-même échoue. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center", background: "#f8faf8", color: "#202a25" }}>
        <h1>Une erreur est survenue</h1>
        <p>Le service est momentanément indisponible.{error.digest ? ` Référence : ${error.digest}` : ""}</p>
        <button type="button" onClick={reset} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #126b50", background: "#126b50", color: "#fff" }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
