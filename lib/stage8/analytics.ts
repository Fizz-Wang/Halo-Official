export const analyticsEventNames = [
  "page_view",
  "cta_select",
  "evidence_select",
  "form_start",
  "form_validation",
  "form_recorded",
  "form_indeterminate",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsDimension =
  | "page_group"
  | "canonical_path"
  | "audience_intent"
  | "conversion_intent"
  | "cta_source"
  | "source_workload"
  | "evidence_interaction"
  | "error_count_bucket";

const allowedDimensions = new Set<AnalyticsDimension>([
  "page_group",
  "canonical_path",
  "audience_intent",
  "conversion_intent",
  "cta_source",
  "source_workload",
  "evidence_interaction",
  "error_count_bucket",
]);

const fixedValues: Readonly<Partial<Record<AnalyticsDimension, ReadonlySet<string>>>> = {
  page_group: new Set([
    "home",
    "product",
    "oracle-evaluation",
    "capability",
    "evaluation",
    "resource",
    "evidence",
    "case",
    "partner",
    "company",
    "conversion",
    "legal",
  ]),
  audience_intent: new Set(["economic", "technical", "partner", "existing-user", "unknown"]),
  conversion_intent: new Set(["poc", "sales", "demo", "partner"]),
  source_workload: new Set(["oracle", "mysql", "postgresql", "mixed", "unknown"]),
  evidence_interaction: new Set([
    "documentation",
    "compatibility",
    "availability-recovery",
    "performance-diagnostics",
    "case",
    "checklist",
  ]),
  error_count_bucket: new Set(["1", "2-3", "4+"]),
};

const allowedCtaSources = new Set([
  "404",
  "availability-recovery",
  "availability-recovery-final",
  "checklist",
  "checklist-final",
  "company",
  "company-final",
  "compatibility",
  "compatibility-final",
  "contact-sales",
  "contact-sales-final",
  "evaluation",
  "evaluation-final",
  "evidence",
  "evidence-final",
  "home",
  "home-final",
  "oracle-evaluation",
  "oracle-evaluation-final",
  "open-halo",
  "open-halo-final",
  "performance-diagnostics",
  "performance-diagnostics-final",
  "product",
  "product-final",
  "request-demo",
  "request-poc",
  "resources",
]);

const allowedCanonicalPaths = new Set([
  "/",
  "/product/",
  "/oracle-migration-evaluation/",
  "/product/compatibility/",
  "/product/availability-recovery/",
  "/product/performance-diagnostics/",
  "/evaluation/",
  "/resources/",
  "/resources/documentation/",
  "/resources/evidence/",
  "/resources/evaluation-checklist/",
  "/company/",
  "/open-halo/",
  "/request-poc/",
  "/contact-sales/",
  "/request-demo/",
]);

const eventDimensionContract: Readonly<Record<AnalyticsEventName, {
  readonly required: ReadonlySet<AnalyticsDimension>;
  readonly optional: ReadonlySet<AnalyticsDimension>;
}>> = {
  page_view: {
    required: new Set(["page_group", "canonical_path"]),
    optional: new Set(["audience_intent"]),
  },
  cta_select: {
    required: new Set(["page_group", "conversion_intent", "cta_source"]),
    optional: new Set(["source_workload"]),
  },
  evidence_select: {
    required: new Set(["page_group", "evidence_interaction"]),
    optional: new Set(),
  },
  form_start: {
    required: new Set(["conversion_intent"]),
    optional: new Set(["cta_source"]),
  },
  form_validation: {
    required: new Set(["conversion_intent", "error_count_bucket"]),
    optional: new Set(),
  },
  form_recorded: {
    required: new Set(["conversion_intent"]),
    optional: new Set(),
  },
  form_indeterminate: {
    required: new Set(["conversion_intent"]),
    optional: new Set(),
  },
};

function isAllowedDimensionValue(key: AnalyticsDimension, value: string) {
  if (fixedValues[key]) return fixedValues[key]!.has(value);
  if (key === "cta_source") return allowedCtaSources.has(value);
  if (key === "canonical_path") return allowedCanonicalPaths.has(value);
  return false;
}

export interface AnalyticsEvent {
  readonly name: AnalyticsEventName;
  readonly dimensions: Readonly<Record<string, string>>;
}

export function isClosedAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== "object") return false;
  if (
    Object.keys(value).length !== 2 ||
    !Object.hasOwn(value, "name") ||
    !Object.hasOwn(value, "dimensions")
  ) {
    return false;
  }
  const candidate = value as { name?: unknown; dimensions?: unknown };
  if (
    typeof candidate.name !== "string" ||
    !analyticsEventNames.includes(candidate.name as AnalyticsEventName) ||
    !candidate.dimensions ||
    typeof candidate.dimensions !== "object" ||
    Array.isArray(candidate.dimensions)
  ) {
    return false;
  }
  const contract = eventDimensionContract[candidate.name as AnalyticsEventName];
  const entries = Object.entries(candidate.dimensions);
  const keys = new Set(entries.map(([key]) => key as AnalyticsDimension));
  if (![...contract.required].every((key) => keys.has(key))) return false;
  if (
    ![...keys].every(
      (key) => contract.required.has(key) || contract.optional.has(key),
    )
  ) {
    return false;
  }
  return entries.every(
    ([key, dimension]) =>
      allowedDimensions.has(key as AnalyticsDimension) &&
      typeof dimension === "string" &&
      dimension.length > 0 &&
      dimension.length <= 80 &&
      isAllowedDimensionValue(key as AnalyticsDimension, dimension),
  );
}

/** Deliberately records nothing until A06 and a platform/consent decision exist. */
export function noOpAnalyticsSink(event: AnalyticsEvent): false {
  void event;
  return false;
}
