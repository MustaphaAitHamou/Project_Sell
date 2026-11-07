import { FileWarning } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/misc";

/**
 * Gabarit des pages éditoriales et juridiques. `draft` affiche l'avertissement de
 * validation professionnelle : ces textes sont des modèles de travail, pas des
 * documents juridiques définitifs.
 */
export function ContentPage({
  title,
  intro,
  updated,
  draft,
  toc,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  updated?: string;
  draft?: boolean;
  toc?: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="container-page grid gap-8 py-6 md:py-10 lg:grid-cols-[minmax(0,1fr)_240px]">
      <article className="grid min-w-0 content-start gap-5">
        <Breadcrumb items={[{ href: "/", label: "Accueil" }, { label: title }]} />
        <header className="grid gap-2">
          <h1 className="text-3xl font-bold text-balance md:text-4xl">{title}</h1>
          {intro ? <p className="max-w-3xl text-base text-muted-foreground md:text-lg">{intro}</p> : null}
          {updated ? <p className="text-xs text-muted-foreground">Dernière mise à jour : {updated}</p> : null}
        </header>
        {draft ? (
          <Alert tone="warning" title="[À VALIDER] Modèle de travail non définitif">
            <span className="inline-flex items-start gap-1.5">
              <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
              Ce texte est un modèle rédigé pour la préparation du service. Il doit être relu et validé par un professionnel du droit (et, selon les sections, par un expert-comptable ou un spécialiste des douanes) avant
              toute ouverture au public. Les mentions entre crochets sont à compléter.
            </span>
          </Alert>
        ) : null}
        <div className="prose-legal max-w-3xl">{children}</div>
      </article>
      {toc?.length ? (
        <aside className="hidden lg:block">
          <nav aria-label="Sommaire" className="sticky top-24 grid gap-1 text-sm">
            <p className="mb-1 font-semibold">Sommaire</p>
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                {t.label}
              </a>
            ))}
          </nav>
        </aside>
      ) : null}
    </div>
  );
}

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24">
      {children}
    </h2>
  );
}
