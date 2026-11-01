import { ERROR_CATALOG, type ErrorCode } from "./errors.generated.ts";

export type Lang = "en" | "fil";

export function isErrorCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_CATALOG, code);
}

/**
 * Returns the user-facing message for an error code in the chosen language, filling
 * {placeholders} from params. Unknown codes fall back to INTERNAL_ERROR so the user never
 * sees a raw code.
 */
export function errorMessage(
  code: string,
  lang: Lang = "en",
  params: Record<string, string | number> = {},
): string {
  const entry = isErrorCode(code) ? ERROR_CATALOG[code] : ERROR_CATALOG.INTERNAL_ERROR;
  const template = entry[lang];
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}
