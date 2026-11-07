"use server";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { action } from "@/server/security/action";
import { createReport } from "@/server/services/reports";

export const reportAction = action(
  z.object({
    targetType: z.enum(["LISTING", "USER", "MESSAGE", "REVIEW"]),
    targetId: z.string().min(1).max(80),
    reason: z.enum(["PROHIBITED_ITEM", "COUNTERFEIT", "SCAM", "MISLEADING", "OFFENSIVE", "SPAM", "WRONG_CATEGORY", "OTHER"]),
    details: z.string().max(2000).optional(),
  }),
  async (input) => {
    const user = await requireUser({ onboarded: false });
    await createReport(user, input);
    return { reported: true };
  },
);
