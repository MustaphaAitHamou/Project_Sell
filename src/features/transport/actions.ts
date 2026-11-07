"use server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { hashIp } from "@/server/security/crypto";
import { clientIp } from "@/server/security/request";
import { action } from "@/server/security/action";
import { getTransportQuotes } from "@/server/services/transport";

export const getTransportQuotesAction = action(
  z.object({ listingId: z.uuid(), destinationCountry: z.enum(["FR", "DZ"]), destinationCity: z.string().trim().max(120).optional() }),
  async (input) => {
    const user = await getCurrentUser();
    return getTransportQuotes({ ...input, viewerId: user?.id ?? null, viewerKey: user?.id ?? hashIp(await clientIp()) });
  },
);
