import "./load-env";
import { afterAll, beforeAll } from "vitest";
import { resetDatabase } from "./helpers";
import { db } from "@/server/db/client";

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});
