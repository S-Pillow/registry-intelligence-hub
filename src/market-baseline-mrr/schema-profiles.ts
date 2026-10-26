import type { SchemaProfileId } from "./types";

export const CORE_TRANSACTION_HEADERS = [
  "registrar-name",
  "iana-id",
  "total-domains",
  "total-nameservers",
  "net-adds-1-yr",
  "net-adds-2-yr",
  "net-adds-3-yr",
  "net-adds-4-yr",
  "net-adds-5-yr",
  "net-adds-6-yr",
  "net-adds-7-yr",
  "net-adds-8-yr",
  "net-adds-9-yr",
  "net-adds-10-yr",
  "net-renews-1-yr",
  "net-renews-2-yr",
  "net-renews-3-yr",
  "net-renews-4-yr",
  "net-renews-5-yr",
  "net-renews-6-yr",
  "net-renews-7-yr",
  "net-renews-8-yr",
  "net-renews-9-yr",
  "net-renews-10-yr",
  "transfer-gaining-successful",
  "transfer-gaining-nacked",
  "transfer-losing-successful",
  "transfer-losing-nacked",
  "transfer-disputed-won",
  "transfer-disputed-lost",
  "transfer-disputed-nodecision",
  "deleted-domains-grace",
  "deleted-domains-nograce",
  "restored-domains",
  "restored-noreport",
  "agp-exemption-requests",
  "agp-exemptions-granted",
  "agp-exempted-domains",
  "attempted-adds",
] as const;

export const COM_EXTENDED_HEADERS = [
  ...CORE_TRANSACTION_HEADERS,
  "consolidate-transaction-days",
  "consolidate-transactions",
] as const;

export type SchemaProfile = {
  id: SchemaProfileId;
  headers: readonly string[];
};

export const SCHEMA_PROFILES: SchemaProfile[] = [
  { id: "spec3-core-39", headers: CORE_TRANSACTION_HEADERS },
  { id: "com-extended-41", headers: COM_EXTENDED_HEADERS },
];

export function matchSchemaProfile(
  headers: string[],
): { ok: true; profile: SchemaProfile } | { ok: false; reason: string } {
  for (const profile of SCHEMA_PROFILES) {
    if (headers.length !== profile.headers.length) continue;
    let match = true;
    for (let i = 0; i < profile.headers.length; i++) {
      if (headers[i] !== profile.headers[i]) {
        match = false;
        break;
      }
    }
    if (match) return { ok: true, profile };
  }
  return {
    ok: false,
    reason: `UNSUPPORTED_SCHEMA: header count ${headers.length}; first=${JSON.stringify(headers.slice(0, 5))}`,
  };
}
