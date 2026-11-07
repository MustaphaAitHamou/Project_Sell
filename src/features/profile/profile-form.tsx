"use client";
import { Camera } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { compressImage } from "@/features/listings/image-upload";
import { updateProfileAction, uploadAvatarAction } from "./actions";
import { LocationFields, type RegionOption } from "./location-fields";

export function ProfileForm({
  initial,
  avatar,
  countries,
  regionsByCountry,
}: {
  initial: { displayName: string; handle: string; bio: string; countryCode: string; regionId: string; cityName: string };
  avatar: string | null;
  countries: { code: string; name: string; regionLabel: string }[];
  regionsByCountry: Record<string, RegionOption[]>;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Avatar name={v.displayName} src={avatar} size={72} />
        <Button type="button" variant="outline" onClick={() => file.current?.click()} disabled={pending}>
          <Camera /> Changer la photo
        </Button>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Photo de profil"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            start(async () => {
              const data = new FormData();
              data.set("file", await compressImage(f, 800, 0.85), "avatar.jpg");
              const res = await uploadAvatarAction(data);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Photo mise à jour.");
              router.refresh();
            });
          }}
        />
      </div>
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await updateProfileAction({ ...v, bio: v.bio || null, cityName: v.cityName || null });
            if (!res.ok) {
              setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, m]) => [k, m[0]])));
              return void toast.error(res.error);
            }
            toast.success("Profil enregistré.");
            router.refresh();
          });
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Pseudonyme public" htmlFor="p-name" error={errors.displayName} required>
            <Input id="p-name" value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} maxLength={40} />
          </Field>
          <Field label="Adresse du profil" htmlFor="p-handle" error={errors.handle} hint={`/vendeur/${v.handle}`} required>
            <Input id="p-handle" value={v.handle} onChange={(e) => setV({ ...v, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} maxLength={40} />
          </Field>
        </div>
        <Field label="Présentation" htmlFor="p-bio" hint="Ce que vous vendez, comment vous préférez échanger. N'indiquez ni téléphone ni adresse.">
          <Textarea id="p-bio" value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} maxLength={1000} rows={4} />
        </Field>
        <LocationFields countries={countries} regionsByCountry={regionsByCountry} value={v} onChange={(loc) => setV({ ...v, ...loc })} errors={errors} />
        <Button type="submit" loading={pending} className="w-fit">
          Enregistrer le profil
        </Button>
      </form>
    </div>
  );
}
