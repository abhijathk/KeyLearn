import { SiteConfigHistory } from "@keylearn/database";
import { certificateCriteria } from "./readers.ts";

/**
 * Certificate criteria are versioned (spec §6.3): a certificate records the
 * version it was issued under and the public check shows it. The version
 * is 1 for the shipped criteria and goes up by one for every change to a
 * `certificates.*` key in the history — a number a person can read on a
 * certificate, not a hash.
 */
export async function criteriaVersion(): Promise<number> {
  const rows = await SiteConfigHistory.query()
    .where("key", "like", "certificates.%")
    .resultSize();
  return 1 + rows;
}

/** The criteria in force plus their version, as one snapshot. */
export async function criteriaSnapshot(): Promise<{
  readonly version: number;
  readonly criteria: ReturnType<typeof certificateCriteria>;
}> {
  return { version: await criteriaVersion(), criteria: certificateCriteria() };
}
