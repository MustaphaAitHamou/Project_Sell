"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { declareBusinessAction } from "./actions";

export function BusinessForm({ initial }: { initial?: Partial<Record<string, string>> }) {
  const router = useRouter();
  const [v, setV] = useState({ legalName: "", tradeName: "", legalForm: "", registrationNumber: "", vatNumber: "", addressLine1: "", postalCode: "", city: "", contactEmail: "", contactPhone: "", ...initial });
  const [declaration, setDeclaration] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const field = (k: keyof typeof v, label: string, required = false, hint?: string) => (
    <Field label={label} htmlFor={`b-${k}`} error={errors[k]} required={required} hint={hint}>
      <Input id={`b-${k}`} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  );
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await declareBusinessAction({ ...v, tradeName: v.tradeName || null, legalForm: v.legalForm || null, vatNumber: v.vatNumber || null, postalCode: v.postalCode || null, contactPhone: v.contactPhone || null, traderDeclaration: declaration as true });
          if (!res.ok) {
            setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, m]) => [k, m[0]!])));
            return void toast.error(res.error);
          }
          toast.success("Déclaration enregistrée : vérification en attente.");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field("legalName", "Dénomination sociale", true)}
        {field("tradeName", "Nom commercial")}
        {field("legalForm", "Forme juridique")}
        {field("registrationNumber", "N° d'immatriculation (SIREN, RC…)", true)}
        {field("vatNumber", "N° de TVA intracommunautaire")}
        {field("contactEmail", "Email de contact public", true, "Affiché aux acheteurs (traçabilité des professionnels).")}
      </div>
      {field("addressLine1", "Adresse du siège", true)}
      <div className="grid gap-4 sm:grid-cols-3">
        {field("postalCode", "Code postal")}
        {field("city", "Ville", true)}
        {field("contactPhone", "Téléphone professionnel")}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} />
        Je m&apos;engage à ne proposer que des produits conformes aux règles applicables du droit de l&apos;Union et du pays de vente, et à fournir les informations exigées des vendeurs professionnels.
      </label>
      <Button type="submit" loading={pending} disabled={!declaration} className="w-fit">
        Déclarer mon activité professionnelle
      </Button>
    </form>
  );
}
