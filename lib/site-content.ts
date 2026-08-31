import { manualCorePages } from "./manual-core-pages";
import { manualEnterprisePages } from "./manual-enterprise-pages";
import { manualJourneyPages } from "./manual-journey-pages";

/**
 * Frozen Stage 4 / Stage 5 public content registry.
 *
 * Renderers must consume only entries whose `status` is `active`. An inactive
 * route intentionally has no hero, SEO metadata, or content blocks. Conditional
 * modules are listed only as non-renderable gate records and carry no preview
 * copy, so a missing activation decision cannot leak into public output.
 * Stage 5 R6 makes the whole Partner lane atomic; there is no public
 * non-converting P13 variant. On P15–P17, the Safety note, submission boundary,
 * and submit label stay with the absent form shell until A06 ∧ A12.
 */

export const gateIds = [
  "A01",
  "A02",
  "A03",
  "A04",
  "A05",
  "A06",
  "A07",
  "A08",
  "A09",
  "A10",
  "A11",
  "A12",
  "A13",
  "A14",
] as const;

export type GateId = (typeof gateIds)[number];

export type PageId =
  | "P01"
  | "P02"
  | "P03"
  | "P04"
  | "P05"
  | "P06"
  | "P07"
  | "P08"
  | "P09"
  | "P10"
  | "P11"
  | "P12"
  | "P13"
  | "P14"
  | "P15"
  | "P16"
  | "P17"
  | "P18"
  | "P19"
  | "P20"
  | "P21"
  | "P22"
  | "P23"
  | "P24"
  | "P25"
  | "P26";

export type ActiveRoutePath =
  | "/"
  | "/product/"
  | "/oracle-migration-evaluation/"
  | "/product/compatibility/"
  | "/product/architecture/"
  | "/product/availability-recovery/"
  | "/product/operations/"
  | "/product/performance-diagnostics/"
  | "/product/distributed/"
  | "/product/data-platform/"
  | "/evaluation/"
  | "/resources/"
  | "/resources/documentation/"
  | "/resources/evidence/"
  | "/resources/evaluation-checklist/"
  | "/company/"
  | "/open-halo/"
  | "/request-poc/"
  | "/contact-sales/"
  | "/request-demo/"
  | "/404/";

export type InactiveRoutePath =
  | "/case-studies/"
  | "/partners/"
  | "/partners/apply/"
  | "/privacy/"
  | "/accessibility/";

export type ActionKind = "primary" | "secondary" | "text" | "supporting";

export interface ContentAction {
  readonly label: string;
  readonly href: string;
  readonly kind: ActionKind;
}

export interface ProseParagraph {
  readonly text: string;
  /** Exact approved lead-in that may receive emphasis without rewriting text. */
  readonly emphasizeLeadIn?: string;
}

export interface ProseBlock {
  readonly type: "prose";
  readonly anchor?: string;
  readonly heading: string;
  readonly paragraphs: readonly ProseParagraph[];
  readonly actions?: readonly ContentAction[];
}

export interface CardItem {
  readonly label?: string;
  readonly heading: string;
  readonly body: readonly string[];
  readonly actions?: readonly ContentAction[];
}

export interface CardsBlock {
  readonly type: "cards";
  readonly anchor?: string;
  readonly heading?: string;
  readonly intro?: readonly string[];
  readonly items: readonly CardItem[];
}

export interface EvidenceRecord {
  readonly anchor?: string;
  readonly heading: string;
  readonly statement: string;
  readonly source: string;
  readonly limit: string;
  readonly test: string;
}

export interface EvidenceBlock {
  readonly type: "evidence";
  readonly anchor?: string;
  readonly heading: string;
  readonly intro?: readonly string[];
  /** Exact labels used by each evidence record. */
  readonly fieldLabels: {
    readonly statement: string;
    readonly source: string;
    readonly limit: string;
    readonly test: string;
  };
  readonly legend?: readonly {
    readonly label: string;
    readonly description: string;
  }[];
  readonly records: readonly EvidenceRecord[];
}

export interface StepItem {
  readonly anchor?: string;
  readonly heading: string;
  readonly body?: readonly string[];
}

export interface StepsBlock {
  readonly type: "steps";
  readonly anchor?: string;
  readonly heading?: string;
  readonly items: readonly StepItem[];
}

export interface ComparisonBlock {
  readonly type: "comparison";
  readonly anchor?: string;
  readonly heading: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface ChecklistBlock {
  readonly type: "checklist";
  readonly anchor?: string;
  readonly heading: string;
  readonly ordered?: boolean;
  readonly intro?: readonly string[];
  readonly items: readonly string[];
  readonly outro?: readonly string[];
  readonly actions?: readonly ContentAction[];
}

export interface CalloutBlock {
  readonly type: "callout";
  readonly anchor?: string;
  readonly label?: string;
  readonly heading?: string;
  readonly body: readonly string[];
}

export interface LinksBlock {
  readonly type: "links";
  readonly anchor?: string;
  readonly heading?: string;
  readonly body?: readonly string[];
  readonly actions: readonly ContentAction[];
}

export interface CtaBlock {
  readonly type: "cta";
  readonly anchor?: string;
  readonly heading?: string;
  readonly body?: readonly string[];
  readonly actions: readonly ContentAction[];
}

export interface AccordionItem {
  readonly heading: string;
  readonly summary?: string;
  readonly details: readonly string[];
  readonly tags?: readonly string[];
}

export interface AccordionBlock {
  readonly type: "accordion";
  readonly anchor?: string;
  readonly heading: string;
  readonly intro?: readonly string[];
  readonly items: readonly AccordionItem[];
}

export interface DiagramNode {
  readonly label?: string;
  readonly heading: string;
  readonly body?: readonly string[];
  readonly tone?: "default" | "accent" | "dark" | "muted";
}

export interface DiagramBlock {
  readonly type: "diagram";
  readonly anchor?: string;
  readonly eyebrow?: string;
  readonly heading: string;
  readonly intro?: readonly string[];
  readonly layout: "flow" | "hub" | "split" | "cluster";
  readonly nodes: readonly DiagramNode[];
  readonly caption?: readonly string[];
}

export interface FactItem {
  readonly value: string;
  readonly label: string;
  readonly body?: string;
}

export interface FactsBlock {
  readonly type: "facts";
  readonly anchor?: string;
  readonly heading?: string;
  readonly intro?: readonly string[];
  readonly items: readonly FactItem[];
}

export interface GalleryItem {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly caption?: string;
  readonly href?: string;
}

export interface GalleryBlock {
  readonly type: "gallery";
  readonly anchor?: string;
  readonly heading: string;
  readonly intro?: readonly string[];
  readonly layout: "single" | "grid" | "wall";
  readonly fit: "contain" | "cover";
  readonly items: readonly GalleryItem[];
}

/** Exhaustive renderer union; switch on `type`. */
export type ContentBlock =
  | ProseBlock
  | CardsBlock
  | EvidenceBlock
  | StepsBlock
  | ComparisonBlock
  | ChecklistBlock
  | CalloutBlock
  | LinksBlock
  | CtaBlock
  | AccordionBlock
  | DiagramBlock
  | FactsBlock
  | GalleryBlock;

export interface SeoRecord {
  readonly title: string;
  readonly description: string | null;
  readonly canonicalPath: string | null;
  readonly robots: "index, follow" | "noindex, follow";
}

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: string;
}

export interface LocalNavigationItem {
  readonly label: string;
  readonly anchor: string;
}

export type ConditionalModuleId =
  | "case-proof"
  | "case-studies-link"
  | "partner-strip"
  | "partner-route-copy"
  | "verified-identity"
  | "document-card-d01"
  | "document-card-d02"
  | "product-defect-route"
  | "operating-mode-setup"
  | "support-matrix"
  | "availability-diagram"
  | "benchmark-evidence"
  | "form-shell"
  | "live-analytics";

export interface WithheldModule {
  readonly id: ConditionalModuleId;
  readonly status: "absent";
  readonly requires: readonly GateId[];
}

export interface PageHero {
  readonly eyebrow: string | null;
  readonly h1: string;
  readonly lead: string;
  readonly actions: readonly ContentAction[];
}

export interface ActiveSitePage {
  readonly id: PageId;
  readonly status: "active";
  /** Internal registry name; render `hero.h1`, not this field. */
  readonly name: string;
  readonly path: ActiveRoutePath;
  readonly canonicalPath: ActiveRoutePath | null;
  readonly seo: SeoRecord;
  readonly breadcrumb: readonly BreadcrumbItem[];
  readonly localNavigation: readonly LocalNavigationItem[];
  readonly hero: PageHero;
  readonly blocks: readonly ContentBlock[];
  readonly withheldModules: readonly WithheldModule[];
}

export interface InactiveSitePage {
  readonly id: PageId;
  readonly status: "inactive";
  /** Internal registry name only. No public body or metadata is attached. */
  readonly name: string;
  readonly path: InactiveRoutePath;
  readonly routePattern?: string;
  readonly canonicalPath: null;
  readonly seo: null;
  readonly activation: {
    readonly requires: readonly GateId[];
    readonly atomic: boolean;
  };
}

export type FormIntent = "poc" | "sales" | "demo" | "partner";

export interface OperationalStateEligibility {
  readonly intent: FormIntent;
  readonly requires: readonly GateId[];
}

export interface OperationalStateAction {
  readonly label: string;
  readonly target:
    | "first-invalid-field"
    | "resubmit"
    | "bound-form"
    | "home"
    | "fresh-form";
}

export interface OperationalStateRecord {
  readonly key:
    | "sending"
    | "field-validation"
    | "backend-recording-failure"
    | "definite-pre-transmission-failure"
    | "submission-status-unknown"
    | "poc-receipt"
    | "sales-receipt"
    | "demo-receipt"
    | "partner-receipt"
    | "possible-duplicate"
    | "expired-form"
    | "server-error"
    | "planned-maintenance";
  readonly surface: "inline" | "reduced";
  readonly heading: string;
  readonly body: string;
  readonly action: OperationalStateAction | null;
  readonly eligibility: "base" | readonly OperationalStateEligibility[];
}

export interface StateContractPage {
  readonly id: "P22";
  readonly status: "state-contract";
  readonly name: string;
  readonly path: null;
  readonly canonicalPath: null;
  readonly seo: null;
  readonly states: readonly OperationalStateRecord[];
}

export type SitePage = ActiveSitePage | InactiveSitePage | StateContractPage;

const enterpriseFormEligibility = [
  { intent: "poc", requires: ["A06", "A12"] },
  { intent: "sales", requires: ["A06", "A12"] },
  { intent: "demo", requires: ["A06", "A12"] },
  { intent: "partner", requires: ["A08", "A06", "A12"] },
] as const satisfies readonly OperationalStateEligibility[];

const legacySitePages = [
  {
    id: "P01",
    status: "active",
    name: "Home",
    path: "/",
    canonicalPath: "/",
    seo: {
      title: "Halo Database | One Platform for Mixed Database Estates",
      description:
        "Understand Halo Database across Oracle, MySQL, and PostgreSQL compatibility, migration, availability, distributed data, and database operations.",
      canonicalPath: "/",
      robots: "index, follow",
    },
    breadcrumb: [],
    localNavigation: [],
    hero: {
      eyebrow: "HALO DATABASE",
      h1: "Bring mixed database workloads onto one Halo platform.",
      lead: "Halo is a general-purpose commercial database. Halo 1.0.16 documents Oracle, MySQL, and PostgreSQL operating modes within one cluster, while enterprise services cover migration, recovery, read scaling, distributed data, and day-to-day operations.",
      actions: [
        {
          label: "Explore the platform",
          href: "/product/",
          kind: "primary",
        },
        {
          label: "Plan a workload PoC",
          href: "/evaluation/",
          kind: "secondary",
        },
        {
          label: "Evaluate an Oracle migration",
          href: "/oracle-migration-evaluation/",
          kind: "text",
        },
      ],
    },
    blocks: [
      {
        type: "cards",
        heading: "Start with the outcome you need",
        items: [
          {
            label: "MIGRATION",
            heading: "Reduce application rewriting",
            body: [
              "Halo’s E5 engine addresses protocol, SQL semantics, optimization, and execution for Oracle and MySQL modes, alongside a native PostgreSQL mode. Validate the objects and behaviors your applications actually use.",
            ],
            actions: [
              {
                label: "Review compatibility",
                href: "/product/compatibility/",
                kind: "text",
              },
            ],
          },
          {
            label: "RESILIENCE",
            heading: "Design for recovery, not just replication",
            body: [
              "Physical and logical replication, grouped durability choices, RMAN2 backup and point-in-time recovery, and Halo Shield address different parts of service continuity and data recovery.",
            ],
            actions: [
              {
                label: "Explore availability and recovery",
                href: "/product/availability-recovery/",
                kind: "text",
              },
            ],
          },
          {
            label: "SCALE & OPERATE",
            heading: "Choose the right data pattern",
            body: [
              "DLB distributes reads, TWR forwards writes from read-only endpoints, HSM manages shared storage, and HDS routes partitioned data across nodes. HWR and catalog-level telemetry help DBAs see how the platform behaves.",
            ],
            actions: [
              {
                label: "Explore distributed data",
                href: "/product/distributed/",
                kind: "text",
              },
              {
                label: "Explore operations",
                href: "/product/operations/",
                kind: "text",
              },
            ],
          },
        ],
      },
      {
        type: "cards",
        heading: "One database platform, three application entry points",
        intro: [
          "Each operating mode has its own protocol and behavior layer. Compatibility is evaluated at the workload level; it is not a promise that every application moves unchanged.",
        ],
        items: [
          {
            heading: "Oracle mode",
            body: [
              "Oracle-oriented types, functions, SQL behavior, PL/oraSQL packages, dictionary views, DBLINK, global temporary tables, and historical-query capabilities.",
            ],
          },
          {
            heading: "MySQL mode",
            body: [
              "A MySQL protocol endpoint with documented common features from MySQL 5.6–8.0, including familiar types, functions, operators, and insert/update patterns.",
            ],
          },
          {
            heading: "PostgreSQL mode",
            body: [
              "Native PostgreSQL protocol and core type, function, index, partition, view, trigger, role, and constraint families without an added compatibility extension.",
            ],
          },
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Compare compatibility modes",
            href: "/product/compatibility/",
            kind: "text",
          },
        ],
      },
      {
        type: "comparison",
        heading: "Match the requirement to the Halo capability",
        columns: ["Requirement", "Halo capability", "Where to go deeper"],
        rows: [
          [
            "Preserve database behavior during migration",
            "E5 compatibility modes, query mapping, DBLINK and workload validation",
            "Compatibility and migration",
          ],
          [
            "Protect data and restore service",
            "Streaming and logical replication, RMAN2, grouped replication and Shield",
            "Availability and recovery",
          ],
          [
            "Scale reads or distribute data",
            "DLB, TWR, HSM shared storage and HDS sharding",
            "Distributed data",
          ],
          [
            "Diagnose workload behavior",
            "HWR snapshots and HTML reports, system views and diagnostic extensions",
            "Operations and observability",
          ],
        ],
      },
      {
        type: "callout",
        label: "SOURCE-BACKED POSITIONING",
        heading: "A product map grounded in the Halo 1.0.16 manual",
        body: [
          "This website reorganizes documented product knowledge for enterprise evaluation. It does not publish SQL, commands, configuration recipes, or unqualified migration and performance guarantees. Where the manual leaves a version, topology, or workload boundary open, the site keeps that boundary visible.",
        ],
      },
      {
        type: "cards",
        heading: "Follow the technical path that fits your role",
        items: [
          {
            heading: "For database architects",
            body: ["Trace instance architecture, transaction semantics, indexing, partitioning, replication, and distributed data flows."],
            actions: [{ label: "Explore architecture", href: "/product/architecture/", kind: "text" }],
          },
          {
            heading: "For DBAs",
            body: ["Review backup, failover, diagnostic, resource-governance, catalog, and maintenance capabilities."],
            actions: [{ label: "Explore operations", href: "/product/operations/", kind: "text" }],
          },
          {
            heading: "For decision makers",
            body: ["Turn the target workload, recovery objectives, operating model, and unresolved gaps into explicit acceptance criteria."],
            actions: [{ label: "Use the PoC method", href: "/evaluation/", kind: "text" }],
          },
        ],
      },
      {
        type: "cta",
        heading: "Bring a real workload. Leave with a defensible decision.",
        body: [
          "Scope the compatibility, recovery, performance, and operating evidence your team needs before committing to a migration or new deployment.",
        ],
        actions: [
          {
            label: "Request a workload PoC",
            href: "/request-poc/?source=home-final",
            kind: "primary",
          },
          {
            label: "Request a demo",
            href: "/request-demo/?source=home-final",
            kind: "supporting",
          },
        ],
      },
    ],
    withheldModules: [
      { id: "case-proof", status: "absent", requires: ["A01"] },
      {
        id: "partner-strip",
        status: "absent",
        requires: ["A08", "A06", "A12"],
      },
    ],
  },
  {
    id: "P02",
    status: "active",
    name: "Product overview",
    path: "/product/",
    canonicalPath: "/product/",
    seo: {
      title: "Halo 1.0.16 Product Overview",
      description:
        "Review Halo 1.0.16 operating modes, replication and recovery, performance diagnostics, and the product questions a workload test must answer.",
      canonicalPath: "/product/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Product" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "HALO 1.0.16",
      h1: "One Halo version. Three operating modes to evaluate.",
      lead: "Halo 1.0.16 is a database management system that supports Oracle, MySQL, and PostgreSQL operating modes within one cluster. The product documentation also describes replication, backup and recovery, the HWR diagnostic extension for snapshot collection and HTML reporting, and an SQL firewall mechanism.",
      actions: [
        {
          label: "Explore compatibility",
          href: "/product/compatibility/",
          kind: "primary",
        },
        {
          label: "Request a proof of concept (PoC)",
          href: "/request-poc/?source=product",
          kind: "secondary",
        },
        {
          label: "Request a Demo",
          href: "/request-demo/?source=product",
          kind: "text",
        },
      ],
    },
    blocks: [
      {
        type: "cards",
        heading: "Start with Oracle. Include the mixed estate when it matters.",
        items: [
          {
            heading: "Oracle operating mode",
            body: [
              "The user manual contains dedicated sections for Oracle-oriented functions, packages, views, syntax, and behavior. Those sections define test candidates; they do not establish complete Oracle equivalence.",
            ],
            actions: [
              {
                label: "Test an Oracle application",
                href: "/oracle-migration-evaluation/",
                kind: "text",
              },
            ],
          },
          {
            heading: "MySQL operating mode",
            body: [
              "Halo 1.0.16 documentation describes a MySQL operating mode and MySQL connections. Verify application behavior, client dependencies, and the applicable configuration for the intended Halo build.",
            ],
            actions: [
              {
                label: "Plan compatibility testing",
                href: "/product/compatibility/",
                kind: "text",
              },
            ],
          },
          {
            heading: "PostgreSQL operating mode",
            body: [
              "PostgreSQL is listed as an operating mode in Halo 1.0.16. Treat that as a product-scope fact, then evaluate the PostgreSQL behavior and extensions the workload actually uses.",
            ],
            actions: [
              {
                label: "Define the workload",
                href: "/resources/evaluation-checklist/",
                kind: "text",
              },
            ],
          },
        ],
      },
      {
        type: "cards",
        heading: "Database operations belong in the product decision",
        items: [
          {
            heading: "Replication and recovery",
            body: [
              "Halo 1.0.16 documents physical and logical replication, plus logical and physical backup, restore, backup validation, incremental backup, and point-in-time recovery. Architecture-specific recovery results must be tested.",
            ],
            actions: [
              {
                label: "Plan continuity and recovery tests",
                href: "/product/availability-recovery/",
                kind: "text",
              },
            ],
          },
          {
            heading: "Performance diagnosis",
            body: [
              "The manual describes the HWR diagnostic extension, which collects snapshots and generates HTML reports for examining database activity over a selected interval. Representative performance still depends on the workload and environment.",
            ],
            actions: [
              {
                label: "Measure and diagnose a workload",
                href: "/product/performance-diagnostics/",
                kind: "text",
              },
            ],
          },
          {
            heading: "SQL firewall",
            body: [
              "The manual documents an SQL firewall mechanism and related test cases. This is a database control to inspect during evaluation, not a certification or a guarantee that attacks will be prevented.",
            ],
            actions: [
              {
                label: "Review the evidence record",
                href: "/resources/evidence/",
                kind: "text",
              },
            ],
          },
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Review documentation",
            href: "/resources/documentation/",
            kind: "text",
          },
        ],
      },
      {
        type: "prose",
        heading: "The product and the PoC are different",
        paragraphs: [
          {
            text: "Halo is the database product. A PoC is the method used to test a defined application and operating model. The PoC should connect documented product behavior to representative data, dependencies, failure scenarios, performance criteria, and a decision record.",
          },
        ],
        actions: [
          {
            label: "See the PoC method",
            href: "/evaluation/",
            kind: "text",
          },
        ],
      },
      {
        type: "checklist",
        heading: "What your workload still has to prove",
        items: [
          "Required SQL, PL/SQL, functions, packages, objects, and transaction behavior work as expected.",
          "Drivers, frameworks, integration points, and administrative tools behave as required.",
          "Representative data, queries, concurrency, and infrastructure meet agreed performance criteria.",
          "Replication, backup, restore, point-in-time recovery, and operating procedures meet the target architecture’s requirements.",
          "Exceptions, remediation, ownership, and retest criteria are understood before a production decision.",
        ],
      },
      {
        type: "cta",
        heading: "Move from product facts to workload evidence.",
        body: [
          "Start with compatibility if you are still defining scope, or request a PoC when the workload and decision criteria are ready.",
        ],
        actions: [
          {
            label: "Explore compatibility",
            href: "/product/compatibility/",
            kind: "primary",
          },
          {
            label: "Request a PoC",
            href: "/request-poc/?source=product-final",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [],
  },
  {
    id: "P03",
    status: "active",
    name: "Oracle workload evaluation",
    path: "/oracle-migration-evaluation/",
    canonicalPath: "/oracle-migration-evaluation/",
    seo: {
      title: "Oracle Workload Evaluation for Halo Database",
      description:
        "Evaluate an Oracle application on Halo 1.0.16 using its actual database behavior, dependencies, workload, recovery needs, and acceptance criteria.",
      canonicalPath: "/oracle-migration-evaluation/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Oracle Workload Evaluation" },
    ],
    localNavigation: [
      {
        label: "Know when to evaluate—and when to stop early",
        anchor: "fit-and-stop",
      },
      {
        label: "Start with the dependencies that make the application yours",
        anchor: "application-dependencies",
      },
      {
        label: "Test documented Oracle behavior",
        anchor: "documented-oracle-behavior",
      },
      {
        label: "Turn documented Oracle behavior into test cases",
        anchor: "oracle-test-cases",
      },
      {
        label: "Answer the questions that decide the project",
        anchor: "decision-questions",
      },
      {
        label: "Leave with a usable answer",
        anchor: "usable-answer",
      },
      {
        label: "Use the evidence to refine migration planning",
        anchor: "migration-planning",
      },
    ],
    hero: {
      eyebrow: "ORACLE ALTERNATIVE ASSESSMENT",
      h1: "Test whether Halo fits your Oracle application.",
      lead: "Use a proof of concept (PoC) to evaluate the schemas, SQL and PL/SQL, database objects, drivers, integrations, data, transactions, and operating requirements your application actually depends on. The outcome is a workload-specific decision, not a blanket replacement claim.",
      actions: [
        {
          label: "Request an Oracle Workload PoC",
          href: "/request-poc/?source=oracle-evaluation&focus=oracle",
          kind: "primary",
        },
        {
          label: "See how the PoC works",
          href: "/evaluation/",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "prose",
        anchor: "fit-and-stop",
        heading: "Know when to evaluate—and when to stop early",
        paragraphs: [
          {
            text: "This path is useful when an organization has a formal Oracle-alternative question, a defined application, known decision owners, and requirements that can be tested.",
            emphasizeLeadIn: "This path is useful when",
          },
          {
            text: "Rescope or stop early when a non-negotiable requirement is unsupported, representative inputs cannot be provided, acceptance criteria cannot be agreed, or required commercial or regional coverage cannot be established during qualification.",
            emphasizeLeadIn: "Rescope or stop early when",
          },
        ],
      },
      {
        type: "prose",
        anchor: "application-dependencies",
        heading: "Start with the dependencies that make the application yours",
        paragraphs: [
          {
            text: "An Oracle application is more than its SQL dialect. Inventory the source version, schemas, tables, views, indexes, sequences, procedures, functions, packages, triggers, jobs, database links, transaction patterns, drivers, frameworks, integrations, data profile, query mix, and operational dependencies. Identify which items are business-critical and which can be changed.",
          },
        ],
        actions: [
          {
            label: "Open the evaluation checklist",
            href: "/resources/evaluation-checklist/",
            kind: "text",
          },
        ],
      },
      {
        type: "prose",
        anchor: "documented-oracle-behavior",
        heading: "Test documented Oracle behavior",
        paragraphs: [
          {
            text: "The Halo 1.0.16 user manual documents an Oracle operating mode and sections covering Oracle-oriented functions, packages, views, and syntax. Use those documented areas to build a behavior-level test list. Do not replace the list with a single compatibility percentage.",
          },
        ],
      },
      {
        type: "checklist",
        anchor: "oracle-test-cases",
        heading: "Turn documented Oracle behavior into test cases",
        intro: [
          "Use the application’s own expected results to test documented areas such as:",
        ],
        items: [
          "Configurable NULL-comparison behavior",
          "Oracle-style date behavior",
          "Empty-string and NULL handling",
          "Parser fallback behavior",
          "Flashback queries",
          "Global temporary tables",
        ],
        outro: [
          "These are concrete starting points, not a complete support matrix or a claim of Oracle equivalence. Record outcomes using the canonical result terms in the proof-of-concept method.",
        ],
        actions: [
          {
            label: "Review compatibility and limitations",
            href: "/product/compatibility/",
            kind: "text",
          },
        ],
      },
      {
        type: "cards",
        anchor: "decision-questions",
        heading: "Answer the questions that decide the project",
        items: [
          {
            heading: "Application behavior",
            body: [
              "Do required database objects, SQL and PL/SQL, transactions, error handling, and integrations behave as the application expects?",
            ],
          },
          {
            heading: "Change scope",
            body: [
              "Which items require configuration, code changes, replacement, operational redesign, or further investigation? Who owns each action?",
            ],
          },
          {
            heading: "Representative performance",
            body: [
              "Do the relevant data volume, query mix, concurrency, infrastructure, and response criteria meet the agreed threshold under controlled test conditions?",
            ],
          },
          {
            heading: "Continuity and recovery",
            body: [
              "Can the proposed architecture replicate, back up, restore, and recover to a point in time in the way the business requires?",
            ],
          },
          {
            heading: "Day-to-day operations",
            body: [
              "Can the team install, configure, observe, diagnose, secure, maintain, and recover the system with an acceptable operating model?",
            ],
          },
        ],
      },
      {
        type: "prose",
        anchor: "usable-answer",
        heading: "Leave with a usable answer",
        paragraphs: [
          {
            text: "The evaluation record should include the tested source and Halo versions, environment, workload, acceptance criteria, observations, evidence, exceptions, remediation, open questions, owners, and retest needs. The decision is then to proceed, proceed after remediation, or stop.",
          },
        ],
      },
      {
        type: "prose",
        anchor: "migration-planning",
        heading: "Use the evidence to refine migration planning",
        paragraphs: [
          {
            text: "Migration difficulty cannot be stated generically. It depends on the compatibility findings, data movement, application change, performance work, operating-model change, rehearsal, cutover, rollback, and assurance required for the defined system. Treat assessment, remediation, rehearsal, cutover, and rollback as planning activities—not as promised automation or an included global service.",
          },
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Review continuity and recovery testing",
            href: "/product/availability-recovery/",
            kind: "text",
          },
          {
            label: "Plan representative performance testing",
            href: "/product/performance-diagnostics/",
            kind: "text",
          },
          {
            label: "Review documentation",
            href: "/resources/documentation/",
            kind: "text",
          },
          {
            label: "Review documented evidence",
            href: "/resources/evidence/",
            kind: "text",
          },
        ],
      },
      {
        type: "cta",
        heading: "Bring the application and the decision criteria.",
        body: [
          "Use the proof of concept to determine whether the evidence supports proceeding, remediation, or stopping for the defined workload.",
        ],
        actions: [
          {
            label: "Request an Oracle Workload PoC",
            href: "/request-poc/?source=oracle-evaluation-final&focus=oracle",
            kind: "primary",
          },
          {
            label: "Contact Sales",
            href: "/contact-sales/?source=oracle-evaluation",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [],
  },
  {
    id: "P04",
    status: "active",
    name: "Compatibility and workload validation",
    path: "/product/compatibility/",
    canonicalPath: "/product/compatibility/",
    seo: {
      title: "Halo 1.0.16 Compatibility and Workload Validation",
      description:
        "Assess Halo compatibility at behavior level across Oracle, MySQL, and PostgreSQL operating modes, application dependencies, and known test limits.",
      canonicalPath: "/product/compatibility/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Product", href: "/product/" },
      { label: "Compatibility" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "COMPATIBILITY",
      h1: "Compatibility is a workload question.",
      lead: "Halo 1.0.16 is a database management system that supports Oracle, MySQL, and PostgreSQL operating modes within one cluster. Application fit still depends on exact versions, required behavior, client dependencies, integrations, and operating requirements.",
      actions: [
        {
          label: "Request a proof of concept (PoC)",
          href: "/request-poc/?source=compatibility",
          kind: "primary",
        },
        {
          label: "Review documentation",
          href: "/resources/documentation/",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "cards",
        heading: "What to test in each operating mode",
        items: [
          {
            heading: "Oracle",
            body: [
              "The Halo 1.0.16 user manual contains dedicated Oracle sections covering functions, packages, views, syntax, and behavior. Use the specific items your application requires as test cases.",
            ],
          },
          {
            heading: "MySQL",
            body: [
              "Halo 1.0.16 documentation describes a MySQL operating mode and MySQL connections. Verify the applicable Halo build, configuration, client behavior, data types, statements, and application dependencies in the intended environment.",
            ],
          },
          {
            heading: "PostgreSQL",
            body: [
              "PostgreSQL is listed as an operating mode in Halo 1.0.16. Test the precise PostgreSQL behavior, extensions, drivers, and tools the application uses before drawing an application-fit conclusion.",
            ],
          },
        ],
      },
      {
        type: "checklist",
        heading: "Build the compatibility record at behavior level",
        intro: ["For every required item, capture:"],
        items: [
          "Source database and version",
          "Halo version and build tested",
          "Application or component that depends on the item",
          "Required behavior and test case",
          "Result recorded with the canonical terms defined in the proof-of-concept method",
          "Configuration, remediation, or replacement required",
          "Known limitation and operational impact",
          "Evidence and owner",
        ],
        outro: [
          "This record is more useful than a single percentage because it shows where change exists and whether that change affects the business decision.",
        ],
      },
      {
        type: "prose",
        heading: "Include the dependencies around the database",
        paragraphs: [
          {
            text: "Check drivers and connection handling, frameworks and object-relational mapping, stored code, jobs, database links, data types and encoding, transaction and locking behavior, error handling, administrative scripts, monitoring, backup, security controls, and deployment platforms. A database behavior can work while an application dependency still fails.",
          },
        ],
      },
      {
        type: "prose",
        heading: "Use the result to scope remediation",
        paragraphs: [
          {
            text: "Group findings into required configuration, code change, object conversion, integration change, operating-model change, unsupported requirement, or further test. Assign an owner and retest condition to every item that can change the decision.",
          },
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Evaluate an Oracle application",
            href: "/oracle-migration-evaluation/",
            kind: "text",
          },
          {
            label: "See the PoC method",
            href: "/evaluation/",
            kind: "text",
          },
          {
            label: "Prepare the checklist",
            href: "/resources/evaluation-checklist/",
            kind: "text",
          },
        ],
      },
      {
        type: "cta",
        heading: "Test the dependencies that decide application fit.",
        body: [
          "Bring the source versions, required behaviors, integrations, and acceptance criteria to a scoped proof of concept.",
        ],
        actions: [
          {
            label: "Request a PoC",
            href: "/request-poc/?source=compatibility-final",
            kind: "primary",
          },
          {
            label: "Review evidence and limitations",
            href: "/resources/evidence/",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      { id: "support-matrix", status: "absent", requires: ["A09"] },
    ],
  },
  {
    id: "P05",
    status: "active",
    name: "Availability and recovery",
    path: "/product/availability-recovery/",
    canonicalPath: "/product/availability-recovery/",
    seo: {
      title: "Halo Availability and Recovery Evaluation",
      description:
        "Review documented Halo 1.0.16 replication, backup, restore, validation, incremental backup, and point-in-time recovery workflows.",
      canonicalPath: "/product/availability-recovery/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Product", href: "/product/" },
      { label: "Availability & Recovery" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "CONTINUITY AND RECOVERY",
      h1: "Test how your target architecture recovers.",
      lead: "Halo 1.0.16 documents physical and logical replication and logical and physical backup, restore, backup validation, incremental backup, and point-in-time recovery workflows. Your architecture, failure scenarios, and acceptance criteria determine the result.",
      actions: [
        {
          label: "Include continuity in a proof of concept (PoC)",
          href: "/request-poc/?source=availability-recovery&focus=continuity",
          kind: "primary",
        },
        {
          label: "Review documentation",
          href: "/resources/documentation/",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "prose",
        heading: "Start with the failure the business needs to survive",
        paragraphs: [
          {
            text: "Define the component or site failure, the data-loss tolerance, the time available to restore service, application reconnection behavior, operator responsibilities, validation steps, and evidence required for approval. Do not infer a recovery-point objective, recovery-time objective, uptime commitment, or service-level agreement from the presence of a product mechanism.",
          },
        ],
      },
      {
        type: "prose",
        heading: "Replication",
        paragraphs: [
          {
            text: "The user manual documents physical and logical replication. It also explains asynchronous and synchronous replication behavior. The selected approach, topology, network, configuration, failure mode, and operating procedure must be tested for the proposed environment.",
          },
        ],
      },
      {
        type: "prose",
        heading: "Backup and recovery",
        paragraphs: [
          {
            text: "The manual documents logical backup and recovery, physical backup and restore, backup-set validation, full and incremental backup, and point-in-time recovery. A recovery test should verify that the intended data can be restored, checked, and returned to the application under the conditions the team expects to operate.",
          },
        ],
      },
      {
        type: "checklist",
        heading: "Build a recovery test that can fail honestly",
        ordered: true,
        intro: ["For each scenario, record:"],
        items: [
          "Initial state and architecture",
          "Failure or recovery event",
          "Data and transaction state before the event",
          "Operator and automated actions",
          "Time and checkpoints observed",
          "Data validation and application checks",
          "Exceptions, manual intervention, and follow-up work",
        ],
      },
      {
        type: "prose",
        heading: "Make the evidence architecture-specific",
        paragraphs: [
          {
            text: "The result should identify the exact Halo build, dependencies, configuration, infrastructure, test date, observations, and limitations. A result from one topology must not be generalized to another.",
          },
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "See the PoC method",
            href: "/evaluation/",
            kind: "text",
          },
          {
            label: "Measure and diagnose the workload",
            href: "/product/performance-diagnostics/",
            kind: "text",
          },
          {
            label: "Review the evidence record",
            href: "/resources/evidence/",
            kind: "text",
          },
        ],
      },
      {
        type: "cta",
        heading: "Put recovery requirements into the PoC scope.",
        body: [
          "Define the failures, data checks, application behavior, and acceptance criteria that matter to your organization.",
        ],
        actions: [
          {
            label: "Include continuity in a PoC",
            href: "/request-poc/?source=availability-recovery-final&focus=continuity",
            kind: "primary",
          },
          {
            label: "Open the evaluation checklist",
            href: "/resources/evaluation-checklist/",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      {
        id: "availability-diagram",
        status: "absent",
        requires: ["A02"],
      },
    ],
  },
  {
    id: "P06",
    status: "active",
    name: "Performance diagnostics and workload testing",
    path: "/product/performance-diagnostics/",
    canonicalPath: "/product/performance-diagnostics/",
    seo: {
      title: "Halo Performance Diagnostics and Workload Testing",
      description:
        "Use Halo 1.0.16 diagnostic snapshots, HTML reports, and representative workload tests to measure database behavior in a defined environment.",
      canonicalPath: "/product/performance-diagnostics/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Product", href: "/product/" },
      { label: "Performance Diagnostics" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "PERFORMANCE EVIDENCE",
      h1: "Measure the workload. Diagnose what changes.",
      lead: "The Halo 1.0.16 user manual describes the HWR diagnostic extension, which collects snapshots and generates HTML reports for examining database activity over a selected interval. Production fit still has to be measured with representative data, queries, concurrency, infrastructure, and acceptance criteria.",
      actions: [
        {
          label: "Include performance in a proof of concept (PoC)",
          href: "/request-poc/?source=performance-diagnostics&focus=performance",
          kind: "primary",
        },
        {
          label: "See how the PoC works",
          href: "/evaluation/",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "prose",
        heading: "Use diagnostics to explain the measurement",
        paragraphs: [
          {
            text: "The documented HWR diagnostic extension captures database statistics in snapshots and generates an HTML report for a selected period. Use that evidence to investigate resource use, query behavior, and changes between test runs. A report does not by itself establish that the workload meets a production target.",
          },
        ],
      },
      {
        type: "prose",
        heading: "Make the test representative",
        paragraphs: [
          {
            text: "Define the data volume and distribution, query and transaction mix, concurrency, run duration, warm-up, infrastructure, storage, network, software versions, configuration, monitoring, and background activity. State which conditions are controlled and which are not.",
          },
        ],
      },
      {
        type: "prose",
        heading: "Agree on criteria before the run",
        paragraphs: [
          {
            text: "The buyer should supply the latency, throughput, resource, stability, and business-process criteria that matter to the application. Record how each metric is measured, how long it must hold, and what result would trigger remediation or rejection.",
          },
        ],
      },
      {
        type: "checklist",
        heading: "Produce evidence that can be compared",
        intro: ["The test record should contain:"],
        items: [
          "Environment and version inventory",
          "Workload and data definition",
          "Test controls and acceptance criteria",
          "Measurements and HWR reports",
          "Bottleneck observations and configuration changes",
          "Exceptions and invalid runs",
          "Retest decisions and owners",
        ],
        outro: [
          "A benchmark from another workload is not a substitute for a representative test under disclosed conditions.",
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Prepare the workload checklist",
            href: "/resources/evaluation-checklist/",
            kind: "text",
          },
          {
            label: "Review continuity and recovery",
            href: "/product/availability-recovery/",
            kind: "text",
          },
          {
            label: "Review documentation",
            href: "/resources/documentation/",
            kind: "text",
          },
          {
            label: "Review evidence and limitations",
            href: "/resources/evidence/",
            kind: "text",
          },
        ],
      },
      {
        type: "cta",
        heading: "Measure the performance question your application needs answered.",
        body: [
          "Include the data, query mix, concurrency, infrastructure, and acceptance criteria in the PoC scope.",
        ],
        actions: [
          {
            label: "Include performance in a PoC",
            href: "/request-poc/?source=performance-diagnostics-final&focus=performance",
            kind: "primary",
          },
          {
            label: "See the PoC method",
            href: "/evaluation/",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      {
        id: "benchmark-evidence",
        status: "absent",
        requires: ["A05"],
      },
    ],
  },
  {
    id: "P07",
    status: "active",
    name: "Proof-of-concept method",
    path: "/evaluation/",
    canonicalPath: "/evaluation/",
    seo: {
      title: "Halo Database Proof-of-Concept Method",
      description:
        "Define a representative Halo workload test, agree on acceptance criteria, record evidence and exceptions, and make a proceed, remediate, or stop decision.",
      canonicalPath: "/evaluation/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Proof of concept (PoC) method" },
    ],
    localNavigation: [
      { label: "1. Frame the decision", anchor: "frame-the-decision" },
      {
        label: "2. Build a representative test",
        anchor: "build-a-representative-test",
      },
      {
        label: "3. Test the application and operations",
        anchor: "test-application-and-operations",
      },
      { label: "4. Record the decision", anchor: "record-the-decision" },
      {
        label: "Demo and PoC serve different questions",
        anchor: "demo-and-poc",
      },
      {
        label: "What a useful PoC produces",
        anchor: "useful-poc-outputs",
      },
      {
        label: "Use evidence to estimate migration difficulty",
        anchor: "migration-difficulty",
      },
      { label: "Responsibility note", anchor: "responsibility-note" },
    ],
    hero: {
      eyebrow: "PROOF OF CONCEPT",
      h1: "A proof of concept should support a decision.",
      lead: "A proof of concept (PoC) defines the workload, agrees on acceptance criteria, runs representative tests, and leaves a clear record of what worked, what changed, and what remains unsupported or untested.",
      actions: [
        {
          label: "Request a PoC",
          href: "/request-poc/?source=evaluation",
          kind: "primary",
        },
        {
          label: "Open the evaluation checklist",
          href: "/resources/evaluation-checklist/",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "steps",
        items: [
          {
            anchor: "frame-the-decision",
            heading: "1. Frame the decision",
            body: [
              "State the source database and version, the application, the reason for evaluation, the business owner, the technical owner, and the decision the PoC must support. Identify disqualifying requirements early so the team does not confuse activity with progress.",
            ],
          },
          {
            anchor: "build-a-representative-test",
            heading: "2. Build a representative test",
            body: [
              "Inventory the schemas, database objects and code, drivers, integrations, data profile, query and transaction mix, concurrency, infrastructure, recovery requirements, security controls, and day-to-day operating tasks that matter. Identify the relevant Halo operating mode and exact build, then confirm the applicable configuration before testing. Agree on acceptance criteria, evidence, and test ownership before execution.",
            ],
          },
          {
            anchor: "test-application-and-operations",
            heading: "3. Test the application and operations",
            body: [
              "Run the behavior, integration, performance, replication, backup, restore, recovery, diagnostic, security-control, and administrative tests that can change the decision. Produce a compatibility-gap record for the tested requirements. Record the environment and conditions so that another reviewer can understand what the result does—and does not—show.",
            ],
          },
          {
            anchor: "record-the-decision",
            heading: "4. Record the decision",
            body: [
              "For every material requirement, record whether it worked as tested, worked with configuration or remediation, was unsupported in scope, or was not tested. Add evidence, limitations, owners, and retest conditions. Conclude with one of three recommendations: proceed, proceed after remediation, or stop.",
            ],
          },
        ],
      },
      {
        type: "comparison",
        anchor: "demo-and-poc",
        heading: "Demo and PoC serve different questions",
        columns: ["Demo", "PoC"],
        rows: [
          [
            "Introduces Halo and its documented capabilities",
            "Tests a defined workload against agreed criteria",
          ],
          [
            "Uses prepared product material",
            "Uses representative application inputs and conditions",
          ],
          [
            "Helps a buyer decide whether to investigate further",
            "Helps a buyer decide whether to proceed, remediate, or stop",
          ],
          [
            "Does not establish application fit",
            "Produces a scoped test report and decision record",
          ],
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Request a Demo",
            href: "/request-demo/?source=evaluation",
            kind: "text",
          },
        ],
      },
      {
        type: "checklist",
        anchor: "useful-poc-outputs",
        heading: "What a useful PoC produces",
        items: [
          "A source and target version inventory",
          "A workload and dependency definition",
          "Agreed functional, performance, continuity, recovery, security-control, and operating criteria",
          "Test evidence and observations",
          "A compatibility and exception record",
          "Remediation, owner, and retest actions",
          "A proceed, remediate, or stop recommendation",
        ],
      },
      {
        type: "prose",
        anchor: "migration-difficulty",
        heading: "Use evidence to estimate migration difficulty",
        paragraphs: [
          {
            text: "Migration difficulty is the combined effect of behavior gaps, application and integration change, data movement, performance work, architecture and operating-model change, rehearsal, cutover, rollback, and assurance. Estimate it from the test record; do not infer it from a generic compatibility label.",
          },
          {
            text: "If the evidence supports continuing, use the findings to plan remediation, schema and data movement, application change, representative retesting, cutover rehearsal, rollback criteria, production change, and post-change assurance. This is a planning sequence, not a promise that Halo automates or delivers every step.",
          },
        ],
      },
      {
        type: "callout",
        anchor: "responsibility-note",
        label: "Responsibility note",
        body: [
          "A scoped PoC requires agreed inputs, environments, access, owners, and acceptance criteria. Engagement scope and regional availability are confirmed during qualification. Submission does not confirm that an engagement will be accepted.",
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Evaluate an Oracle workload",
            href: "/oracle-migration-evaluation/",
            kind: "text",
          },
          {
            label: "Plan compatibility testing",
            href: "/product/compatibility/",
            kind: "text",
          },
          {
            label: "Plan continuity and recovery testing",
            href: "/product/availability-recovery/",
            kind: "text",
          },
          {
            label: "Plan performance testing",
            href: "/product/performance-diagnostics/",
            kind: "text",
          },
        ],
      },
      {
        type: "cta",
        heading: "Tell us what the PoC needs to prove.",
        body: [
          "Bring the application context, representative workload, and decision criteria.",
        ],
        actions: [
          {
            label: "Request a PoC",
            href: "/request-poc/?source=evaluation-final",
            kind: "primary",
          },
          {
            label: "Contact Sales",
            href: "/contact-sales/?source=evaluation",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [],
  },
  {
    id: "P08",
    status: "active",
    name: "Resources hub",
    path: "/resources/",
    canonicalPath: "/resources/",
    seo: {
      title: "Halo 1.0.16 Evaluation Resources",
      description:
        "Find versioned Halo documentation, source-backed evidence, technical evaluation pages, and a practical workload checklist.",
      canonicalPath: "/resources/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Resources" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "RESOURCES",
      h1: "Technical sources for evaluating Halo 1.0.16.",
      lead: "Use versioned documentation, explicit evidence limits, and a representative workload to decide whether Halo deserves to progress for your application. A proof of concept (PoC) connects those inputs to a decision.",
      actions: [
        {
          label: "Review documentation",
          href: "/resources/documentation/",
          kind: "primary",
        },
        {
          label: "View evidence and validation",
          href: "/resources/evidence/",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "cards",
        items: [
          {
            label: "Documentation",
            heading: "Start with the versioned product source.",
            body: [
              "Check the product version, document date, applicable build, and topic before using a manual statement in an evaluation.",
            ],
            actions: [
              {
                label: "Review documentation",
                href: "/resources/documentation/",
                kind: "text",
              },
            ],
          },
          {
            label: "Evidence and validation",
            heading: "See what the source establishes—and what it does not.",
            body: [
              "Review documented product facts, their scope, the limits of each source, and the questions a workload test still has to answer.",
            ],
            actions: [
              {
                label: "View evidence and validation",
                href: "/resources/evidence/",
                kind: "text",
              },
            ],
          },
          {
            label: "Evaluation checklist",
            heading: "Prepare the workload before the proof of concept.",
            body: [
              "Capture versions, application dependencies, database code, data, query mix, infrastructure, continuity requirements, operating tasks, and decision criteria.",
            ],
            actions: [
              {
                label: "Open the evaluation checklist",
                href: "/resources/evaluation-checklist/",
                kind: "text",
              },
            ],
          },
          {
            label: "Product evaluation pages",
            heading: "Go directly to the technical question.",
            body: [],
            actions: [
              {
                label: "Compatibility and workload validation",
                href: "/product/compatibility/",
                kind: "text",
              },
              {
                label: "Availability and recovery",
                href: "/product/availability-recovery/",
                kind: "text",
              },
              {
                label: "Performance diagnostics and workload testing",
                href: "/product/performance-diagnostics/",
                kind: "text",
              },
            ],
          },
        ],
      },
      {
        type: "cta",
        heading: "Move from reading to a decision",
        body: [
          "Documentation can define test candidates. It cannot establish the result for your application. When the workload and acceptance criteria are ready, use a PoC to connect product facts to representative evidence.",
        ],
        actions: [
          {
            label: "Request a PoC",
            href: "/request-poc/?source=resources",
            kind: "primary",
          },
          {
            label: "See the PoC method",
            href: "/evaluation/",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      {
        id: "case-studies-link",
        status: "absent",
        requires: ["A01"],
      },
    ],
  },
  {
    id: "P09",
    status: "active",
    name: "Documentation",
    path: "/resources/documentation/",
    canonicalPath: "/resources/documentation/",
    seo: {
      title: "Halo 1.0.16 Documentation",
      description:
        "Review the version, date, scope, and evaluation use of Halo 1.0.16 product and installation documentation.",
      canonicalPath: "/resources/documentation/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Resources", href: "/resources/" },
      { label: "Documentation" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "DOCUMENTATION",
      h1: "Use the source that matches the version you intend to test.",
      lead: "Product documentation is useful only when its version, date, build, scope, and deployment context match the evaluation. Verify applicability before turning a documented mechanism into an acceptance assumption or a proof-of-concept (PoC) test.",
      actions: [
        {
          label: "Explore compatibility",
          href: "/product/compatibility/",
          kind: "primary",
        },
        {
          label: "Prepare a PoC",
          href: "/resources/evaluation-checklist/",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "cards",
        heading: "Read by question, not by file name",
        items: [
          {
            heading: "Application behavior",
            body: [
              "Use the compatibility material to identify the Oracle, MySQL, or PostgreSQL behavior the application requires, then turn each requirement into a test case.",
            ],
            actions: [
              {
                label: "Plan compatibility testing",
                href: "/product/compatibility/",
                kind: "text",
              },
            ],
          },
          {
            heading: "Continuity and recovery",
            body: [
              "Use the replication and backup/recovery material to define architecture-specific failure, restore, validation, and point-in-time recovery tests.",
            ],
            actions: [
              {
                label: "Plan continuity and recovery testing",
                href: "/product/availability-recovery/",
                kind: "text",
              },
            ],
          },
          {
            heading: "Performance diagnosis",
            body: [
              "Use the material about the HWR diagnostic extension, snapshot collection, and HTML reporting to plan evidence around a representative performance run. Define workload and acceptance criteria separately.",
            ],
            actions: [
              {
                label: "Plan performance testing",
                href: "/product/performance-diagnostics/",
                kind: "text",
              },
            ],
          },
        ],
      },
      {
        type: "checklist",
        heading: "Check four things before relying on a document",
        ordered: true,
        items: [
          "Product version and build",
          "Document date and language",
          "Topic scope and prerequisites",
          "Applicability to the intended package, platform, and architecture",
        ],
      },
      {
        type: "callout",
        label: "Source note",
        body: [
          "The English Halo 1.0.16 User Manual gives a document update date of January 28, 2026. Check the edition, version, and date shown on every published document before using it in an evaluation.",
        ],
      },
      {
        type: "cta",
        heading: "Turn the relevant documentation into a test scope.",
        body: [
          "Record the exact behavior, conditions, and evidence your application needs.",
        ],
        actions: [
          {
            label: "Open the evaluation checklist",
            href: "/resources/evaluation-checklist/",
            kind: "primary",
          },
          {
            label: "Review evidence and limitations",
            href: "/resources/evidence/",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      {
        id: "document-card-d01",
        status: "absent",
        requires: ["A03"],
      },
      {
        id: "document-card-d02",
        status: "absent",
        requires: ["A03", "A11", "A02"],
      },
      {
        id: "operating-mode-setup",
        status: "absent",
        requires: ["A11"],
      },
      {
        id: "product-defect-route",
        status: "absent",
        requires: ["A14"],
      },
    ],
  },
  {
    id: "P10",
    status: "active",
    name: "Evidence and validation",
    path: "/resources/evidence/",
    canonicalPath: "/resources/evidence/",
    seo: {
      title: "Halo 1.0.16 Evidence and Validation",
      description:
        "Review source-backed Halo product facts, their limits, and the workload evidence needed for an enterprise decision.",
      canonicalPath: "/resources/evidence/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Resources", href: "/resources/" },
      { label: "Evidence & Validation" },
    ],
    localNavigation: [
      {
        label: "How to read an evidence record",
        anchor: "how-to-read-evidence",
      },
      {
        label: "Evidence record: Product identity and operating modes",
        anchor: "product-identity-and-modes",
      },
      {
        label: "Evidence record: Oracle-oriented behavior",
        anchor: "oracle-oriented-behavior",
      },
      {
        label: "Evidence record: Replication and recovery",
        anchor: "replication-and-recovery",
      },
      {
        label: "Evidence record: Performance diagnosis",
        anchor: "performance-diagnosis",
      },
      {
        label: "Evidence record: SQL firewall",
        anchor: "sql-firewall",
      },
      {
        label: "Evidence should end in a decision",
        anchor: "evidence-decision",
      },
      {
        label: "Serviceability boundary",
        anchor: "serviceability-boundary",
      },
    ],
    hero: {
      eyebrow: "EVIDENCE",
      h1: "See what is documented, what it proves, and what still needs testing.",
      lead: "Trust starts with a versioned source, an explicit scope, and a result that can be checked. This page separates documented Halo 1.0.16 facts from workload conclusions.",
      actions: [
        {
          label: "See the proof-of-concept method",
          href: "/evaluation/",
          kind: "primary",
        },
        {
          label: "Request a proof of concept",
          href: "/request-poc/?source=evidence",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "evidence",
        anchor: "how-to-read-evidence",
        heading: "How to read an evidence record",
        fieldLabels: {
          statement: "Statement",
          source: "Source",
          limit: "Limit",
          test: "Test",
        },
        legend: [
          {
            label: "Statement:",
            description: "the narrow fact the source supports",
          },
          {
            label: "Source:",
            description: "document, version, date, and page range",
          },
          {
            label: "Limit:",
            description: "what the source does not establish",
          },
          {
            label: "Test:",
            description: "the workload question that remains",
          },
        ],
        records: [
          {
            anchor: "product-identity-and-modes",
            heading: "Evidence record: Product identity and operating modes",
            statement:
              "Halo 1.0.16 is a database management system that supports Oracle, MySQL, and PostgreSQL operating modes within one cluster.",
            source:
              "Halo 1.0.16 User Manual, January 28, 2026, PDF pages 2–3 and 22.",
            limit:
              "This does not establish complete compatibility, unchanged applications, or a migration outcome for any workload.",
            test: "Verify the exact behavior, dependencies, build, and operating requirements used by the application.",
          },
          {
            anchor: "oracle-oriented-behavior",
            heading: "Evidence record: Oracle-oriented behavior",
            statement:
              "The Halo 1.0.16 user manual contains an Oracle operating mode and sections covering Oracle-oriented functions, packages, views, syntax, and behavior.",
            source:
              "Halo 1.0.16 User Manual, Chapter 7, PDF pages 126–130 and 130–217; flashback queries appear on pages 211–213 and global temporary tables on pages 213–217. Chapter 8 begins later on page 217.",
            limit:
              "The chapter does not establish complete Oracle equivalence, unchanged drivers or applications, or a universal compatibility percentage.",
            test: "Turn the required Oracle behavior and surrounding application dependencies into behavior-level test cases.",
          },
          {
            anchor: "replication-and-recovery",
            heading: "Evidence record: Replication and recovery",
            statement:
              "Halo 1.0.16 documents physical and logical replication and logical and physical backup, restore, backup validation, incremental backup, and point-in-time recovery workflows.",
            source:
              "Halo 1.0.16 User Manual, Chapters 9–10, PDF pages 245–256.",
            limit:
              "These mechanisms do not establish an uptime commitment, service-level agreement, recovery-point objective, recovery-time objective, zero data loss, or a result for an untested architecture.",
            test: "Define architecture-specific failure and recovery scenarios, data checks, application behavior, operator actions, and acceptance criteria.",
          },
          {
            anchor: "performance-diagnosis",
            heading: "Evidence record: Performance diagnosis",
            statement:
              "The Halo 1.0.16 user manual documents the HWR diagnostic extension, which collects snapshots and generates HTML reports for a selected interval.",
            source:
              "Halo 1.0.16 User Manual, Chapter 13, PDF pages 281–293.",
            limit:
              "The HWR diagnostic extension does not establish performance superiority, production capacity, or a workload result without a representative test.",
            test: "Use disclosed data, queries, concurrency, infrastructure, controls, and acceptance criteria; preserve measurements and diagnostic reports.",
          },
          {
            anchor: "sql-firewall",
            heading: "Evidence record: SQL firewall",
            statement:
              "The Halo 1.0.16 user manual documents an SQL firewall mechanism and related test cases.",
            source:
              "Halo 1.0.16 User Manual, Chapter 17, PDF pages 317–319.",
            limit:
              "The source is not a security certification and does not guarantee that an attack or breach will be prevented.",
            test: "Verify configuration, expected and unexpected SQL behavior, false-positive handling, operating ownership, and application impact.",
          },
        ],
      },
      {
        type: "prose",
        anchor: "evidence-decision",
        heading: "Evidence should end in a decision",
        paragraphs: [
          {
            text: "A useful evaluation connects each requirement to a source, a representative test, an observation, a limitation, and an owner. It makes unsupported and untested areas visible without turning them into marketing claims.",
          },
        ],
      },
      {
        type: "callout",
        anchor: "serviceability-boundary",
        label: "Serviceability boundary",
        body: [
          "An English inquiry route is not evidence of service coverage. Commercial scope and regional availability are confirmed during qualification.",
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Open the evaluation checklist",
            href: "/resources/evaluation-checklist/",
            kind: "text",
          },
          {
            label: "Evaluate an Oracle workload",
            href: "/oracle-migration-evaluation/",
            kind: "text",
          },
          {
            label: "Review the product",
            href: "/product/",
            kind: "text",
          },
          {
            label: "Review documentation",
            href: "/resources/documentation/",
            kind: "text",
          },
        ],
      },
      {
        type: "cta",
        heading: "Use the sources to define the test—not to skip it.",
        actions: [
          {
            label: "Request a PoC",
            href: "/request-poc/?source=evidence-final",
            kind: "primary",
          },
          {
            label: "See the PoC method",
            href: "/evaluation/",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      { id: "case-proof", status: "absent", requires: ["A01"] },
    ],
  },
  {
    id: "P11",
    status: "active",
    name: "Evaluation checklist",
    path: "/resources/evaluation-checklist/",
    canonicalPath: "/resources/evaluation-checklist/",
    seo: {
      title: "Halo Database Proof-of-Concept Checklist",
      description:
        "Prepare versions, dependencies, workload, infrastructure, recovery needs, operating tasks, and decision criteria for a Halo proof of concept.",
      canonicalPath: "/resources/evaluation-checklist/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Resources", href: "/resources/" },
      { label: "Evaluation Checklist" },
    ],
    localNavigation: [
      {
        label: "1. Source and target context",
        anchor: "source-and-target-context",
      },
      {
        label: "2. Application dependencies",
        anchor: "application-dependencies",
      },
      {
        label: "3. Database objects and code",
        anchor: "database-objects-and-code",
      },
      { label: "4. Data and workload", anchor: "data-and-workload" },
      {
        label: "5. Environment and performance criteria",
        anchor: "environment-and-performance",
      },
      {
        label: "6. Continuity, recovery, security controls, and operations",
        anchor: "continuity-recovery-and-operations",
      },
      {
        label: "7. Decision context and acceptance inputs",
        anchor: "decision-context",
      },
    ],
    hero: {
      eyebrow: "PROOF-OF-CONCEPT CHECKLIST",
      h1: "Bring a workload, not a generic benchmark.",
      lead: "Define the application, representative conditions, and decision criteria before drawing a conclusion about Halo fit.",
      actions: [
        {
          label: "Request a proof of concept with this scope",
          href: "/request-poc/?source=checklist",
          kind: "primary",
        },
        {
          label: "See the proof-of-concept method",
          href: "/evaluation/",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "checklist",
        anchor: "source-and-target-context",
        heading: "1. Source and target context",
        items: [
          "Source database product, edition, version, build, and deployment model",
          "Intended Halo version, build, package, and environment",
          "Application name, business purpose, criticality, owners, and reason for evaluation",
          "Decision date and decision makers",
        ],
      },
      {
        type: "checklist",
        anchor: "application-dependencies",
        heading: "2. Application dependencies",
        items: [
          "Drivers, frameworks, connection pools, and object-relational mapping",
          "Interfaces, integrations, jobs, reports, administrative tools, and monitoring",
          "Authentication, authorization, encryption, and SQL-control requirements",
          "External services and operational dependencies",
        ],
      },
      {
        type: "checklist",
        anchor: "database-objects-and-code",
        heading: "3. Database objects and code",
        items: [
          "Schemas, tables, views, indexes, sequences, and partitions",
          "SQL and PL/SQL, procedures, functions, packages, and triggers",
          "Jobs, database links, extensions, data types, encoding, and collation",
          "Transactions, locking, isolation, error handling, and concurrency behavior",
        ],
      },
      {
        type: "checklist",
        anchor: "data-and-workload",
        heading: "4. Data and workload",
        items: [
          "Data volume, distribution, growth, and sensitive-data handling",
          "Representative query and transaction mix",
          "Concurrency, run duration, batch windows, and peak conditions",
          "Business processes that must be exercised end to end",
        ],
      },
      {
        type: "checklist",
        anchor: "environment-and-performance",
        heading: "5. Environment and performance criteria",
        items: [
          "CPU, memory, storage, network, operating system, and topology",
          "Test controls, monitoring, warm-up, and invalid-run rules",
          "Latency, throughput, resource, stability, and business-process criteria",
          "Measurement method and evidence to retain",
        ],
      },
      {
        type: "checklist",
        anchor: "continuity-recovery-and-operations",
        heading: "6. Continuity, recovery, security controls, and operations",
        items: [
          "Replication and recovery scenarios",
          "Backup, restore, validation, retention, and point-in-time recovery tests",
          "Application reconnect and data-validation checks",
          "Installation, configuration, observation, diagnosis, maintenance, and recovery tasks",
          "SQL-firewall behavior and other required database controls",
        ],
      },
      {
        type: "checklist",
        anchor: "decision-context",
        heading: "7. Decision context and acceptance inputs",
        items: [
          "Business owner, technical owner, and decision makers",
          "Acceptance thresholds and measurement methods",
          "Non-negotiable or disqualifying requirements",
          "Evidence required to approve, remediate, or stop",
          "Target decision date and downstream approval steps",
          "Secure-transfer and test-data constraints",
        ],
      },
      {
        type: "callout",
        label: "Safety note",
        body: [
          "Do not place credentials, personal data beyond the requested business contact details, confidential production records, or customer data in a web form. Discuss secure transfer and test-data handling during qualification.",
        ],
      },
      {
        type: "cta",
        heading: "Ready to turn the checklist into a decision?",
        actions: [
          {
            label: "Request a proof of concept with this scope",
            href: "/request-poc/?source=checklist-final",
            kind: "primary",
          },
          {
            label: "Review evidence and limitations",
            href: "/resources/evidence/",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [],
  },
  {
    id: "P12",
    status: "inactive",
    name: "Case studies",
    path: "/case-studies/",
    routePattern: "/case-studies/{approved-case-slug}/",
    canonicalPath: null,
    seo: null,
    activation: { requires: ["A01"], atomic: true },
  },
  {
    id: "P13",
    status: "inactive",
    name: "Partners",
    path: "/partners/",
    canonicalPath: null,
    seo: null,
    activation: {
      requires: ["A08", "A06", "A12"],
      atomic: true,
    },
  },
  {
    id: "P14",
    status: "active",
    name: "Company",
    path: "/company/",
    canonicalPath: "/company/",
    seo: {
      title: "About Halo Database",
      description:
        "Review the documented provenance of Halo 1.0.16 and follow the product, evidence, and commercial paths relevant to an enterprise evaluation.",
      canonicalPath: "/company/",
      robots: "index, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Company" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "COMPANY AND PRODUCT PROVENANCE",
      h1: "About Halo Database.",
      lead: "Halo Database is evaluated through versioned product sources, explicit evidence limits, and representative workload testing. Use those inputs to determine whether Halo deserves further consideration for an enterprise application.",
      actions: [
        {
          label: "View evidence and validation",
          href: "/resources/evidence/",
          kind: "primary",
        },
        {
          label: "Contact Sales",
          href: "/contact-sales/?source=company",
          kind: "secondary",
        },
      ],
    },
    blocks: [
      {
        type: "prose",
        heading: "Documented product provenance",
        paragraphs: [
          {
            text: "The English user manual is titled Halo 1.0.16 User Manual and gives a document update date of January 28, 2026. It documents the three operating modes, replication, backup and recovery, performance diagnosis, and SQL firewall topics summarized in this evaluation guide.",
          },
        ],
        actions: [
          {
            label: "Review documentation",
            href: "/resources/documentation/",
            kind: "text",
          },
        ],
      },
      {
        type: "prose",
        heading: "Verify the product through sources and tests",
        paragraphs: [
          {
            text: "Product documentation establishes a versioned starting point. Evidence records show what each source does and does not establish. A representative proof of concept (PoC) determines how the defined application behaves in the intended environment.",
          },
        ],
      },
      {
        type: "prose",
        heading: "Service scope is qualified, not assumed",
        paragraphs: [
          {
            text: "An English website and inquiry route do not establish service coverage. Commercial scope and regional availability are confirmed during qualification.",
          },
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Review evidence and limitations",
            href: "/resources/evidence/",
            kind: "text",
          },
          {
            label: "See the PoC method",
            href: "/evaluation/",
            kind: "text",
          },
          {
            label: "Evaluate an Oracle workload",
            href: "/oracle-migration-evaluation/",
            kind: "text",
          },
        ],
      },
      {
        type: "prose",
        heading: "Choose the right conversation",
        paragraphs: [
          {
            text: "Use Contact Sales for licensing, procurement, commercial, or regional-fit questions. Use Request a PoC for a defined workload and decision criteria.",
          },
        ],
      },
      {
        type: "cta",
        actions: [
          {
            label: "View evidence and validation",
            href: "/resources/evidence/",
            kind: "primary",
          },
          {
            label: "Contact Sales",
            href: "/contact-sales/?source=company-final",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      {
        id: "verified-identity",
        status: "absent",
        requires: ["A04"],
      },
      {
        id: "partner-route-copy",
        status: "absent",
        requires: ["A08", "A06", "A12"],
      },
    ],
  },
  {
    id: "P15",
    status: "active",
    name: "Request a PoC",
    path: "/request-poc/",
    canonicalPath: "/request-poc/",
    seo: {
      title: "Request a Halo Database Proof of Concept",
      description:
        "Tell us which workload, application dependencies, and decision criteria you need to evaluate on Halo.",
      canonicalPath: "/request-poc/",
      robots: "noindex, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Request a proof of concept (PoC)" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "REQUEST A PROOF OF CONCEPT",
      h1: "Tell us what you need to prove.",
      lead: "Share the source database, application context, representative workload, and decision criteria. A proof-of-concept (PoC) request is reviewed for scope and regional availability before any engagement is confirmed.",
      actions: [],
    },
    blocks: [
      {
        type: "checklist",
        heading: "A PoC is the right next step when",
        items: [
          "A specific application or workload is in scope.",
          "The source database and version are known.",
          "The team can identify the behavior, performance, continuity, recovery, security-control, or operating questions that affect the decision.",
          "Representative inputs and decision owners can be defined.",
        ],
      },
      {
        type: "checklist",
        heading: "Have this information ready",
        items: [
          "Organization, country or region, and business contact",
          "Source database, version, application, and reason for evaluation",
          "Required database behavior and application dependencies",
          "Representative data, query mix, concurrency, and infrastructure",
          "Continuity, recovery, security-control, and operating requirements",
          "Acceptance criteria, target decision date, and stakeholders",
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Review the evaluation checklist",
            href: "/resources/evaluation-checklist/",
            kind: "secondary",
          },
          {
            label: "Ask a commercial question",
            href: "/contact-sales/?source=request-poc",
            kind: "text",
          },
        ],
      },
    ],
    withheldModules: [
      {
        id: "form-shell",
        status: "absent",
        requires: ["A06", "A12"],
      },
      {
        id: "live-analytics",
        status: "absent",
        requires: ["A06", "A12"],
      },
    ],
  },
  {
    id: "P16",
    status: "active",
    name: "Contact Sales",
    path: "/contact-sales/",
    canonicalPath: "/contact-sales/",
    seo: {
      title: "Contact Halo Database Sales",
      description:
        "Ask about Halo licensing, procurement, commercial fit, or regional availability. Workload-specific evaluations use the proof-of-concept route.",
      canonicalPath: "/contact-sales/",
      robots: "noindex, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Contact Sales" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "CONTACT SALES",
      h1: "Discuss commercial and regional fit.",
      lead: "Use this route for licensing, procurement, commercial, or regional-service questions. Use the proof-of-concept (PoC) route when you already have a defined workload and acceptance criteria.",
      actions: [],
    },
    blocks: [
      {
        type: "checklist",
        heading: "Use Contact Sales for",
        items: [
          "Licensing or commercial questions",
          "Procurement and vendor-review questions",
          "Country or regional availability",
          "Early product-fit discussions before a workload is defined",
        ],
      },
      {
        type: "links",
        heading: "Use a different route for",
        actions: [
          {
            label: "Request a proof of concept for a defined workload",
            href: "/request-poc/?source=contact-sales",
            kind: "text",
          },
          {
            label: "A product introduction",
            href: "/request-demo/?source=contact-sales",
            kind: "text",
          },
        ],
      },
      {
        type: "checklist",
        heading: "Have this information ready",
        items: [
          "Organization, role, country or region, and business contact",
          "The commercial or procurement question",
          "Relevant application or database context, if known",
          "Expected decision stage and stakeholders",
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Request a PoC",
            href: "/request-poc/?source=contact-sales-final",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      {
        id: "partner-route-copy",
        status: "absent",
        requires: ["A08", "A06", "A12"],
      },
      {
        id: "form-shell",
        status: "absent",
        requires: ["A06", "A12"],
      },
      {
        id: "live-analytics",
        status: "absent",
        requires: ["A06", "A12"],
      },
    ],
  },
  {
    id: "P17",
    status: "active",
    name: "Request a Demo",
    path: "/request-demo/",
    canonicalPath: "/request-demo/",
    seo: {
      title: "Request a Halo Database Demo",
      description:
        "Request a product introduction to Halo Database. Use a proof of concept when you need to validate a defined application or workload.",
      canonicalPath: "/request-demo/",
      robots: "noindex, follow",
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Request a Demo" },
    ],
    localNavigation: [],
    hero: {
      eyebrow: "REQUEST A DEMO",
      h1: "See the product before you scope a workload test.",
      lead: "A demo introduces Halo and its documented capabilities. It does not validate your application. If you already have a workload and acceptance criteria, request a proof of concept (PoC).",
      actions: [],
    },
    blocks: [
      {
        type: "checklist",
        heading: "A demo can help you",
        items: [
          "Understand what Halo 1.0.16 is",
          "Learn which operating modes and documented database operations are relevant to your evaluation",
          "Identify which technical questions deserve deeper evaluation",
          "Decide whether to prepare a workload-specific PoC",
        ],
      },
      {
        type: "checklist",
        heading: "A demo does not establish",
        items: [
          "Application compatibility",
          "Required code or integration change",
          "Representative performance or capacity",
          "Recovery outcomes or production readiness",
          "Migration effort or success",
        ],
      },
      {
        type: "checklist",
        heading: "Have this information ready",
        items: [
          "Organization, role, country or region, and business contact",
          "Current database environment",
          "Topics and operating modes of interest",
          "Evaluation stage and intended audience",
        ],
      },
      {
        type: "links",
        actions: [
          {
            label: "Request a PoC instead",
            href: "/request-poc/?source=request-demo",
            kind: "secondary",
          },
        ],
      },
    ],
    withheldModules: [
      {
        id: "form-shell",
        status: "absent",
        requires: ["A06", "A12"],
      },
      {
        id: "live-analytics",
        status: "absent",
        requires: ["A06", "A12"],
      },
    ],
  },
  {
    id: "P18",
    status: "inactive",
    name: "Partner application",
    path: "/partners/apply/",
    canonicalPath: null,
    seo: null,
    activation: {
      requires: ["A08", "A06", "A12"],
      atomic: true,
    },
  },
  {
    id: "P19",
    status: "inactive",
    name: "Privacy notice",
    path: "/privacy/",
    canonicalPath: null,
    seo: null,
    activation: { requires: ["A06"], atomic: true },
  },
  {
    id: "P20",
    status: "active",
    name: "Page not found",
    path: "/404/",
    canonicalPath: null,
    seo: {
      title: "Page not found | Halo Database",
      description: null,
      canonicalPath: null,
      robots: "noindex, follow",
    },
    breadcrumb: [],
    localNavigation: [],
    hero: {
      eyebrow: null,
      h1: "Page not found.",
      lead: "The page may have moved, or the address may be incorrect. Continue with one of the destinations below.",
      actions: [
        { label: "Go to Home", href: "/", kind: "primary" },
        {
          label: "Explore the product",
          href: "/product/",
          kind: "text",
        },
        {
          label: "Evaluate an Oracle workload",
          href: "/oracle-migration-evaluation/",
          kind: "text",
        },
        {
          label: "Review documentation",
          href: "/resources/documentation/",
          kind: "text",
        },
        {
          label: "Contact Sales",
          href: "/contact-sales/?source=404",
          kind: "text",
        },
      ],
    },
    blocks: [],
    withheldModules: [],
  },
  {
    id: "P21",
    status: "inactive",
    name: "Accessibility statement",
    path: "/accessibility/",
    canonicalPath: null,
    seo: null,
    activation: { requires: ["A07"], atomic: true },
  },
  {
    id: "P22",
    status: "state-contract",
    name: "Operational and form states",
    path: null,
    canonicalPath: null,
    seo: null,
    states: [
      {
        key: "sending",
        surface: "inline",
        heading: "Sending your request…",
        body: "Keep this page open until the submission finishes.",
        action: null,
        eligibility: enterpriseFormEligibility,
      },
      {
        key: "field-validation",
        surface: "inline",
        heading: "Check the highlighted fields.",
        body: "Correct the information shown and try again.",
        action: {
          label: "Review fields",
          target: "first-invalid-field",
        },
        eligibility: enterpriseFormEligibility,
      },
      {
        key: "backend-recording-failure",
        surface: "inline",
        heading: "We could not record this request.",
        body: "Review the information and try again.",
        action: { label: "Try again", target: "resubmit" },
        eligibility: enterpriseFormEligibility,
      },
      {
        key: "definite-pre-transmission-failure",
        surface: "inline",
        heading: "The request was not sent.",
        body: "Check your connection, then try again.",
        action: { label: "Try again", target: "resubmit" },
        eligibility: enterpriseFormEligibility,
      },
      {
        key: "submission-status-unknown",
        surface: "reduced",
        heading: "We could not confirm the submission.",
        body: "The request may have been received. Wait and check before submitting the same information again.",
        action: { label: "Return to the form", target: "bound-form" },
        eligibility: enterpriseFormEligibility,
      },
      {
        key: "poc-receipt",
        surface: "reduced",
        heading: "Your proof-of-concept request was received for review.",
        body: "This does not confirm engagement acceptance, scope, timing, price, or regional availability.",
        action: { label: "Return to Home", target: "home" },
        eligibility: [
          { intent: "poc", requires: ["A06", "A12"] },
        ],
      },
      {
        key: "sales-receipt",
        surface: "reduced",
        heading: "Your sales inquiry was received.",
        body: "This does not confirm a response time, regional availability, product availability, licensing, or commercial terms.",
        action: { label: "Return to Home", target: "home" },
        eligibility: [
          { intent: "sales", requires: ["A06", "A12"] },
        ],
      },
      {
        key: "demo-receipt",
        surface: "reduced",
        heading: "Your demo request was received for review.",
        body: "This does not confirm scheduling, timing, or regional availability.",
        action: { label: "Return to Home", target: "home" },
        eligibility: [
          { intent: "demo", requires: ["A06", "A12"] },
        ],
      },
      {
        key: "partner-receipt",
        surface: "reduced",
        heading: "Your partner application was received for review.",
        body: "This does not appoint or authorize a partner or confirm acceptance, territory, terms, lead supply, or a response time.",
        action: { label: "Return to Home", target: "home" },
        eligibility: [
          {
            intent: "partner",
            requires: ["A08", "A06", "A12"],
          },
        ],
      },
      {
        key: "possible-duplicate",
        surface: "reduced",
        heading: "This request may already have been received.",
        body: "Wait before submitting the same information again.",
        action: { label: "Return to the form", target: "bound-form" },
        eligibility: enterpriseFormEligibility,
      },
      {
        key: "expired-form",
        surface: "reduced",
        heading: "This form has expired.",
        body: "Reload the page before trying again.",
        action: { label: "Reload form", target: "fresh-form" },
        eligibility: enterpriseFormEligibility,
      },
      {
        key: "server-error",
        surface: "reduced",
        heading: "We could not load this page.",
        body: "Try again later or return to a main destination.",
        action: { label: "Go to Home", target: "home" },
        eligibility: "base",
      },
      {
        key: "planned-maintenance",
        surface: "reduced",
        heading: "This service is temporarily unavailable.",
        body: "Try again later.",
        action: { label: "Go to Home", target: "home" },
        eligibility: "base",
      },
    ],
  },
] as const satisfies readonly SitePage[];

function isActiveSitePage(page: SitePage): page is ActiveSitePage {
  return page.status === "active";
}

/** All public, routable base-release pages. */
const retainedNonPublicPages: readonly SitePage[] = legacySitePages.filter(
  (page) => page.status !== "active",
);

export const sitePages: readonly SitePage[] = [
  ...manualJourneyPages,
  ...manualCorePages,
  ...manualEnterprisePages,
  ...retainedNonPublicPages,
];

const allSitePages: readonly SitePage[] = sitePages;
export const activeSitePages: readonly ActiveSitePage[] =
  allSitePages.filter(isActiveSitePage);

/** Canonical route paths that may be emitted into the base public build. */
export const activePaths: readonly ActiveRoutePath[] = activeSitePages.map(
  (page) => page.path,
);

function normalizePath(path: string): string {
  const pathOnly = path.split(/[?#]/, 1)[0] || "/";
  if (pathOnly === "/") return "/";
  const rootedPath = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return `${rootedPath.replace(/\/+$/, "")}/`;
}

/** Returns only public base-release route content; gated and state-only entries are never returned. */
export function getPageByPath(path: string): ActiveSitePage | undefined {
  const normalizedPath = normalizePath(path);
  return activeSitePages.find((page) => page.path === normalizedPath);
}

/** Internal gate-aware lookup. Callers must still discriminate `status` before rendering. */
export function getPageById(id: PageId): SitePage | undefined {
  return allSitePages.find((page) => page.id === id);
}
