import type { GateId } from "../site-content";

export type GateState = Readonly<Record<GateId, boolean>>;

export const closedGateState: GateState = Object.freeze({
  A01: false,
  A02: false,
  A03: false,
  A04: false,
  A05: false,
  A06: false,
  A07: false,
  A08: false,
  A09: false,
  A10: false,
  A11: false,
  A12: false,
  A13: false,
  A14: false,
});

export function enterpriseFormGraphActive(gates: GateState) {
  return gates.A06 && gates.A12;
}

export function privacyGraphActive(gates: GateState) {
  return gates.A06;
}

export function partnerGraphActive(gates: GateState) {
  return gates.A08 && gates.A06 && gates.A12;
}

export function documentGraphActive(gates: GateState) {
  return gates.A03;
}

export function defectGraphActive(gates: GateState) {
  return gates.A14;
}

