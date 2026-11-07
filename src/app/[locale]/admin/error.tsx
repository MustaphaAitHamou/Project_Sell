"use client";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

/** Erreur inattendue : message neutre (aucun détail technique), identifiant de corrélation. */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={AlertTriangle}
        title="Une erreur est survenue"
        description={
          <>
            Le service a rencontré un problème inattendu. Réessayez dans un instant.
            {error.digest ? <span className="mt-1 block text-xs">Référence : {error.digest}</span> : null}
          </>
        }
        action={<Button onClick={reset}>Réessayer</Button>}
      />
    </div>
  );
}
