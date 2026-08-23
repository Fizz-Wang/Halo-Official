export type FieldRule =
  | {
      readonly kind: "text" | "email" | "url";
      readonly required: boolean;
      readonly maximumScalars: number;
      readonly multiline?: boolean;
    }
  | {
      readonly kind: "enum";
      readonly required: boolean;
      readonly values: ReadonlySet<string>;
    }
  | {
      readonly kind: "boolean";
      readonly requiredTrue: boolean;
    };

export type ValidationIssueCode =
  | "missing"
  | "too-long"
  | "unsupported-control"
  | "invalid-format"
  | "invalid-enum"
  | "attestation-required"
  | "invalid-type"
  | "invalid-cardinality";

export interface ValidationIssue {
  readonly field: string;
  readonly code: ValidationIssueCode;
}

export interface ValidatedPayload {
  readonly values: Readonly<Record<string, string | boolean>>;
  readonly comparisonValues: Readonly<Record<string, string>>;
  readonly issues: readonly ValidationIssue[];
  /** Unknown names are never retained; only a non-identifying count returns. */
  readonly ignoredKeyCount: number;
}

export interface FieldFormatPolicy {
  readonly email?: (value: string) => boolean;
  readonly url?: (value: string) => boolean;
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function normalizeTextValue(value: string): string {
  return normalizeLineEndings(value).trim();
}

export function unicodeScalarLength(value: string): number {
  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);

    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        index += 1;
      } else {
        throw new RangeError("The value contains an invalid Unicode scalar sequence.");
      }
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      throw new RangeError("The value contains an invalid Unicode scalar sequence.");
    }

    count += 1;
  }

  return count;
}

export function hasInvalidUnicodeScalarSequence(value: string): boolean {
  try {
    unicodeScalarLength(value);
    return false;
  } catch {
    return true;
  }
}

export function containsUnsupportedControl(
  value: string,
  multiline: boolean,
): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }

    const c0OrDelete = codePoint <= 0x1f || codePoint === 0x7f;
    const c1 = codePoint >= 0x80 && codePoint <= 0x9f;
    if (!c0OrDelete && !c1) {
      continue;
    }

    if (multiline && (codePoint === 0x09 || codePoint === 0x0a)) {
      continue;
    }

    return true;
  }

  return false;
}

export function normalizeEmailComparison(value: string): string {
  const separator = value.lastIndexOf("@");
  if (separator < 0) {
    return value;
  }

  return `${value.slice(0, separator)}@${value.slice(separator + 1).toLowerCase()}`;
}

/** Native-email-aligned baseline; owner-approved policy may inject a validator. */
function isEmailFormat(value: string): boolean {
  const separator = value.lastIndexOf("@");
  if (separator <= 0 || separator === value.length - 1) {
    return false;
  }

  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return (
    !/\s|@/.test(local) &&
    !/\s|@/.test(domain) &&
    !domain.startsWith(".") &&
    !domain.endsWith(".")
  );
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function firstTextIssue(
  value: string,
  rule: Extract<FieldRule, { readonly kind: "text" | "email" | "url" }>,
  policy: FieldFormatPolicy,
): ValidationIssueCode | null {
  if (rule.required && value.length === 0) {
    return "missing";
  }

  if (hasInvalidUnicodeScalarSequence(value)) {
    return "unsupported-control";
  }

  if (unicodeScalarLength(value) > rule.maximumScalars) {
    return "too-long";
  }

  if (containsUnsupportedControl(value, rule.multiline === true)) {
    return "unsupported-control";
  }

  if (value.length === 0) {
    return null;
  }

  if (rule.kind === "email" && !(policy.email ?? isEmailFormat)(value)) {
    return "invalid-format";
  }

  if (rule.kind === "url" && !(policy.url ?? isAbsoluteHttpUrl)(value)) {
    return "invalid-format";
  }

  return null;
}

function oneValue(rawValue: unknown):
  | { readonly kind: "missing" }
  | { readonly kind: "invalid-type" }
  | { readonly kind: "invalid-cardinality" }
  | { readonly kind: "value"; readonly value: string | boolean } {
  if (rawValue === undefined) {
    return { kind: "missing" };
  }

  if (Array.isArray(rawValue)) {
    return { kind: "invalid-cardinality" };
  }

  if (typeof rawValue !== "string" && typeof rawValue !== "boolean") {
    return { kind: "invalid-type" };
  }

  return { kind: "value", value: rawValue };
}

/**
 * Projects only schema-owned keys. It emits internal semantic issue codes and
 * deliberately contains no visitor-facing labels or messages.
 */
export function validateKnownPayload(
  rawPayload: Readonly<Record<string, unknown>>,
  schema: Readonly<Record<string, FieldRule>>,
  policy: FieldFormatPolicy = {},
): ValidatedPayload {
  const values: Record<string, string | boolean> = {};
  const comparisonValues: Record<string, string> = {};
  const issues: ValidationIssue[] = [];
  const schemaKeys = new Set(Object.keys(schema));
  const ignoredKeyCount = Object.keys(rawPayload).filter(
    (key) => !schemaKeys.has(key),
  ).length;

  for (const [field, rule] of Object.entries(schema)) {
    const extracted = oneValue(rawPayload[field]);

    if (extracted.kind === "invalid-cardinality") {
      issues.push({ field, code: "invalid-cardinality" });
      continue;
    }

    if (extracted.kind === "invalid-type") {
      issues.push({ field, code: "invalid-type" });
      continue;
    }

    if (rule.kind === "boolean") {
      const value = extracted.kind === "value" ? extracted.value : undefined;
      if (typeof value !== "boolean") {
        if (value !== undefined) {
          issues.push({ field, code: "invalid-type" });
        } else if (rule.requiredTrue) {
          issues.push({ field, code: "attestation-required" });
        }
        continue;
      }

      values[field] = value;
      if (rule.requiredTrue && value !== true) {
        issues.push({ field, code: "attestation-required" });
      }
      continue;
    }

    if (extracted.kind === "missing") {
      if (rule.required) {
        issues.push({ field, code: "missing" });
      }
      continue;
    }

    if (typeof extracted.value !== "string") {
      issues.push({ field, code: "invalid-type" });
      continue;
    }

    const value = normalizeTextValue(extracted.value);

    if (rule.kind === "enum") {
      if (rule.required && value.length === 0) {
        issues.push({ field, code: "missing" });
      } else if (
        hasInvalidUnicodeScalarSequence(value) ||
        containsUnsupportedControl(value, false)
      ) {
        issues.push({ field, code: "unsupported-control" });
      } else if (value.length > 0 && !rule.values.has(value)) {
        issues.push({ field, code: "invalid-enum" });
      } else if (value.length > 0) {
        values[field] = value;
      }
      continue;
    }

    const issue = firstTextIssue(value, rule, policy);
    if (issue !== null) {
      issues.push({ field, code: issue });
      continue;
    }

    if (value.length === 0) {
      continue;
    }

    values[field] = value;
    if (rule.kind === "email") {
      comparisonValues[field] = normalizeEmailComparison(value);
    }
  }

  return Object.freeze({
    values: Object.freeze(values),
    comparisonValues: Object.freeze(comparisonValues),
    issues: Object.freeze(issues),
    ignoredKeyCount,
  });
}
