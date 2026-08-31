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
        label: "Distributed Data",
        href: "/product/distributed/",
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
    id: "open-source",
    label: "Open Source",
    href: "/open-halo/",
  },
  {
    kind: "group",
    id: "about-us",
    label: "About Us",
    href: "/company/",
    disclosureLabel: "About Us links",
    links: [
      { label: "About Us", href: "/company/" },
      { label: "Contact Us", href: "/contact-us/" },
      { label: "Partners", href: "/partners/" },
    ],
  },
  {
    kind: "link",
    id: "contact-sales",
    label: "Product Access",
    href: "/contact-sales/",
    presentation: "utility",
  },
  {
    kind: "link",
    id: "request-poc",
    label: "Plan a PoC",
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
        label: "Distributed Data",
        href: "/product/distributed/",
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
      { label: "Plan a PoC", href: "/request-poc/" },
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
    id: "about-us",
    label: "About Us",
    links: [
      { label: "About Us", href: "/company/" },
      { label: "Contact Us", href: "/contact-us/" },
      { label: "Partners", href: "/partners/" },
    ],
  },
  {
    id: "open-source",
    label: "Open Source",
    links: [
      { label: "openHalo", href: "/open-halo/" },
      {
        label: "View on GitHub",
        href: "https://github.com/HaloTech-Co-Ltd/openHalo",
      },
      { label: "Visit openHalo.org", href: "https://www.openhalo.org/" },
    ],
  },
] as const;
