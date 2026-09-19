// One place that turns whatever a call threw into a string the handset can show. The accounts API
// answers with the AuthCode names from lib/auth.ts, which are also i18n keys, so an error raised
// by the Worker prints in the language the phone is set to.

import { ApiError } from "../lib/api";
import type { TKey } from "./i18n";

export function errorKey(e: unknown): TKey {
  const code = e instanceof ApiError ? e.code : undefined;
  return (code as TKey | undefined) ?? "netError";
}
