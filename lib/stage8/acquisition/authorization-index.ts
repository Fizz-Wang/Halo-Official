import type { AcquisitionIntent } from "./types";

export const AUTHORIZATION_ATTESTATION_VERSION = 1 as const;

export type StoredAuthorizationSourceKind =
  | "initial"
  | "validation"
  | "backend_failure"
  | "unknown"
  | "possible_duplicate";

export type ResultAuthorizationProofClass =
  | "validation"
  | "not_recorded"
  | "indeterminate_dispatch"
  | "indeterminate_reconcile"
  | "recorded"
  | "exact_expiry";

export interface CapabilityAuthorizationFacts {
  capabilityDigest: string;
  sessionDigest: string;
  intent: AcquisitionIntent;
  canonicalRoute: string;
  postAction: string;
  logicalId: string;
  generation: number;
  sourceKind: StoredAuthorizationSourceKind;
  issuedAt: number;
  sourceExpiresAt: number;
  validUntil: number;
  proofCleanupAfter: number;
  sourceCleanupAfter: number;
}

export interface ResultAuthorizationFacts {
  handleDigest: string;
  sessionDigest: string;
  intent: AcquisitionIntent;
  canonicalRoute: string;
  postAction: string;
  logicalId: string;
  generation: number;
  representation: "returned_form" | "reduced";
  publicState:
    | "validation"
    | "backend_failure"
    | "return_form"
    | "unknown"
    | "possible_duplicate"
    | "expired"
    | "receipt";
  sourceKind: StoredAuthorizationSourceKind | null;
  proofClass: ResultAuthorizationProofClass;
  resultSetKey: string;
  returnHandleDigest: string | null;
  deliveryProofDigest: string | null;
  operationKey: string | null;
  observationKey: string | null;
  issuedAt: number;
  expiresAt: number;
  cleanupAfter: number;
}

export interface AuthorizationAttestation {
  version: typeof AUTHORIZATION_ATTESTATION_VERSION;
  keyId: string;
  value: string;
}

export interface AuthorizationIndexCodec {
  attestCapability(
    facts: CapabilityAuthorizationFacts,
  ): Promise<AuthorizationAttestation>;
  verifyCapability(
    facts: CapabilityAuthorizationFacts,
    attestation: AuthorizationAttestation,
  ): Promise<boolean>;
  attestResult(facts: ResultAuthorizationFacts): Promise<AuthorizationAttestation>;
  verifyResult(
    facts: ResultAuthorizationFacts,
    attestation: AuthorizationAttestation,
  ): Promise<boolean>;
  digestDeliveryProof(operationKey: string, observationKey: string): Promise<string>;
}

type AttestationKind = "capability" | "result" | "delivery-proof";

function capabilityMessage(facts: CapabilityAuthorizationFacts): string {
  return JSON.stringify([
    "capability",
    AUTHORIZATION_ATTESTATION_VERSION,
    facts.capabilityDigest,
    facts.sessionDigest,
    facts.intent,
    facts.canonicalRoute,
    facts.postAction,
    facts.logicalId,
    facts.generation,
    facts.sourceKind,
    facts.issuedAt,
    facts.sourceExpiresAt,
    facts.validUntil,
    facts.proofCleanupAfter,
    facts.sourceCleanupAfter,
  ]);
}

function resultMessage(facts: ResultAuthorizationFacts): string {
  return JSON.stringify([
    "result",
    AUTHORIZATION_ATTESTATION_VERSION,
    facts.handleDigest,
    facts.sessionDigest,
    facts.intent,
    facts.canonicalRoute,
    facts.postAction,
    facts.logicalId,
    facts.generation,
    facts.representation,
    facts.publicState,
    facts.sourceKind,
    facts.proofClass,
    facts.resultSetKey,
    facts.returnHandleDigest,
    facts.deliveryProofDigest,
    facts.operationKey,
    facts.observationKey,
    facts.issuedAt,
    facts.expiresAt,
    facts.cleanupAfter,
  ]);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function messageFor(kind: AttestationKind, value: string): string {
  return JSON.stringify([kind, AUTHORIZATION_ATTESTATION_VERSION, value]);
}

/**
 * Versioned HMAC authorization-index codec. Production callers must inject a
 * server-only key ring; there is deliberately no default or source-tree key.
 */
export class HmacAuthorizationIndexCodec implements AuthorizationIndexCodec {
  private readonly activeKeyId: string;
  private readonly keys: ReadonlyMap<string, Uint8Array>;
  private readonly importedKeys = new Map<string, Promise<CryptoKey>>();

  constructor(activeKeyId: string, keys: ReadonlyMap<string, Uint8Array>) {
    if (activeKeyId.length === 0 || !keys.has(activeKeyId)) {
      throw new TypeError("An active authorization-attestation key is required.");
    }
    for (const [keyId, key] of keys) {
      if (keyId.length === 0 || key.byteLength < 32) {
        throw new TypeError(
          "Authorization-attestation keys require an ID and at least 256 bits.",
        );
      }
    }
    this.activeKeyId = activeKeyId;
    this.keys = new Map(
      [...keys].map(([keyId, key]) => [keyId, new Uint8Array(key)] as const),
    );
  }

  private key(keyId: string): Promise<CryptoKey> | null {
    const material = this.keys.get(keyId);
    if (material === undefined) return null;
    const existing = this.importedKeys.get(keyId);
    if (existing !== undefined) return existing;
    const imported = crypto.subtle.importKey(
      "raw",
      new Uint8Array(material).buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    this.importedKeys.set(keyId, imported);
    return imported;
  }

  private async sign(kind: AttestationKind, value: string): Promise<AuthorizationAttestation> {
    const key = this.key(this.activeKeyId);
    if (key === null) throw new TypeError("The active attestation key is unavailable.");
    const signature = await crypto.subtle.sign(
      "HMAC",
      await key,
      new TextEncoder().encode(messageFor(kind, value)),
    );
    return Object.freeze({
      version: AUTHORIZATION_ATTESTATION_VERSION,
      keyId: this.activeKeyId,
      value: bytesToBase64Url(new Uint8Array(signature)),
    });
  }

  private async verify(
    kind: AttestationKind,
    value: string,
    attestation: AuthorizationAttestation,
  ): Promise<boolean> {
    if (
      attestation.version !== AUTHORIZATION_ATTESTATION_VERSION ||
      attestation.keyId.length === 0 ||
      attestation.value.length === 0
    ) {
      return false;
    }
    const key = this.key(attestation.keyId);
    if (key === null) return false;
    const signature = base64UrlToBytes(attestation.value);
    if (signature === null) return false;
    return crypto.subtle.verify(
      "HMAC",
      await key,
      signature.buffer as ArrayBuffer,
      new TextEncoder().encode(messageFor(kind, value)),
    );
  }

  attestCapability(facts: CapabilityAuthorizationFacts): Promise<AuthorizationAttestation> {
    return this.sign("capability", capabilityMessage(facts));
  }

  verifyCapability(
    facts: CapabilityAuthorizationFacts,
    attestation: AuthorizationAttestation,
  ): Promise<boolean> {
    return this.verify("capability", capabilityMessage(facts), attestation);
  }

  attestResult(facts: ResultAuthorizationFacts): Promise<AuthorizationAttestation> {
    return this.sign("result", resultMessage(facts));
  }

  verifyResult(
    facts: ResultAuthorizationFacts,
    attestation: AuthorizationAttestation,
  ): Promise<boolean> {
    return this.verify("result", resultMessage(facts), attestation);
  }

  async digestDeliveryProof(
    operationKey: string,
    observationKey: string,
  ): Promise<string> {
    if (operationKey.length === 0 || observationKey.length === 0) {
      throw new TypeError("Delivery-proof keys must be non-empty.");
    }
    const attestation = await this.sign(
      "delivery-proof",
      JSON.stringify([operationKey, observationKey]),
    );
    return `${attestation.keyId}.${attestation.value}`;
  }
}
