import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/env";

export const metadata = { robots: { index: false, follow: false } };

/** Outils de développement : inexistants en production (404). */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (!devToolsEnabled) notFound();
  return <div className="container-page py-8">{children}</div>;
}
