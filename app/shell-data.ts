import type { FooterGroup, HeaderItem } from "./components";

export const headerItems: readonly HeaderItem[] = [
  {
    kind: "group",
    id: "product",
    label: "Platform",
    href: "/product/",
    disclosureLabel: "Platform links",
    links: [
      { label: "Overview", href: "/product/" },
      { label: "Architecture & Core", href: "/product/architecture/" },
      { label: "Compatibility", href: "/product/compatibility/" },
      {
        label: "Availability & Recovery",
        href: "/product/availability-recovery/",
      },
      {
        label: "Operations & Observability",
        href: "/product/operations/",
      },
      {
        label: "Data & Extensions",
        href: "/product/data-platform/",
      },
    ],
  },
  {
    kind: "link",
    id: "migration",
    label: "Migration",
    href: "/oracle-migration-evaluation/",
  },
  {
    kind: "link",
    id: "poc-method",
    label: "Evaluate",
    href: "/evaluation/",
  },
  {
    kind: "group",
    id: "resources",
    label: "Resources",
    href: "/resources/",
    disclosureLabel: "Resources links",
    links: [
      { label: "Documentation", href: "/resources/documentation/" },
      { label: "Evidence & Validation", href: "/resources/evidence/" },
      {
        label: "Evaluation Checklist",
        href: "/resources/evaluation-checklist/",
      },
    ],
  },
  {
    kind: "link",
    id: "company",
    label: "Company",
    href: "/company/",
  },
  {
    kind: "link",
    id: "contact-sales",
    label: "Commercial Planning",
    href: "/contact-sales/",
    presentation: "utility",
  },
  {
    kind: "link",
    id: "request-poc",
    label: "Prepare a PoC",
    href: "/request-poc/",
    presentation: "primary",
  },
] as const;

export const footerGroups: readonly FooterGroup[] = [
  {
    id: "product",
    label: "Platform",
    links: [
      { label: "Overview", href: "/product/" },
      { label: "Architecture & Core", href: "/product/architecture/" },
      { label: "Compatibility", href: "/product/compatibility/" },
      {
        label: "Availability & Recovery",
        href: "/product/availability-recovery/",
      },
      {
        label: "Operations & Observability",
        href: "/product/operations/",
      },
      {
        label: "Data & Extensions",
        href: "/product/data-platform/",
      },
    ],
  },
  {
    id: "evaluate",
    label: "Evaluate",
    links: [
      {
        label: "Oracle Migration Evaluation",
        href: "/oracle-migration-evaluation/",
      },
      {
        label: "PoC Method",
        href: "/evaluation/",
      },
      { label: "Prepare a PoC", href: "/request-poc/" },
      { label: "Plan a Demo", href: "/request-demo/" },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    links: [
      { label: "Documentation", href: "/resources/documentation/" },
      { label: "Evidence & Validation", href: "/resources/evidence/" },
      {
        label: "Evaluation Checklist",
        href: "/resources/evaluation-checklist/",
      },
    ],
  },
  {
    id: "company",
    label: "Company",
    links: [
      { label: "Company", href: "/company/" },
      { label: "Commercial Planning", href: "/contact-sales/" },
    ],
  },
] as const;
