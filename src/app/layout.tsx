import "./globals.css";

// L'élément <html> est rendu par app/[locale]/layout.tsx (attributs lang et dir selon la langue).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
