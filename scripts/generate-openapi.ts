/**
 * Génère les spécifications OpenAPI dans docs/openapi/ depuis les schémas Zod :
 *   pnpm openapi
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { buildHqOpenApi, buildPublicOpenApi, buildTransportPartnerOpenApi } from "../src/lib/openapi/build";

const base = "https://market.tamurt.example";
mkdirSync("docs/openapi", { recursive: true });
const write = (name: string, doc: unknown) => {
  writeFileSync(`docs/openapi/${name}`, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`docs/openapi/${name}`);
};
write("tamurt-market-public-v1.json", buildPublicOpenApi(base));
write("tamurt-hq-internal-v1.json", buildHqOpenApi(base));
write("tamurt-transport-partner-v1.json", buildTransportPartnerOpenApi());
