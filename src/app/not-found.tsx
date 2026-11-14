// Repli pour les URL hors routage de langue.
export default function GlobalNotFound() {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center", background: "#f6f5f2", color: "#1d1b19" }}>
        <h1>Page introuvable</h1>
        <p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Retour à Tamurt Market</a>
        </p>
      </body>
    </html>
  );
}
