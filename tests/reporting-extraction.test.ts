import { test } from "node:test";
import assert from "node:assert/strict";
import { convertMinor } from "../src/lib/reporting";
import { extractionProposal, extractDocument } from "../src/lib/extraction";
import {
  reorderSuggestion,
  prepaidAllocation,
} from "../src/lib/operations-engine";
test("FX conversion uses exact integer rounding and fails on missing/invalid rates", () => {
  assert.equal(convertMinor(100, "1.2345678901"), 123);
  assert.equal(convertMinor(1, "0.5"), 1);
  assert.equal(convertMinor(-1, "0.5"), -1);
  assert.throws(() => convertMinor(100, "not a rate"));
  assert.equal(
    prepaidAllocation(9007199254740900, 1000000000, 1000000000, 1),
    9007199,
  );
});
test("invoice extraction proposes fields but never confirms or infers legal attribution", () => {
  const p = extractionProposal(
    "TEST Supplier\nInvoice # TEST-123\nTOTAL USD 12.34",
  );
  assert.equal(p.status, "UNREVIEWED");
  assert.equal(p.invoiceReferenceCandidate, "TEST-123");
  assert.deepEqual(p.totalCandidates, ["12.34"]);
  assert.equal("entityId" in p, false);
});
test("reorder uses physical demand, explicit MOQ/lead time and eligible dated inbound", () => {
  const r = reorderSuggestion({
    available: 10,
    daily: 10,
    leadDays: 3,
    safetyDays: 2,
    moq: 12,
    unitMinor: 500,
    freightMinor: 1000,
    inbound: [
      { quantity: 20, eta: "2026-10-02T00:00:00Z", status: "IN_TRANSIT" },
    ],
    asOf: "2026-10-01T00:00:00Z",
  });
  assert.equal(r.quantity, 24);
  assert.equal(r.cashRequired, 13000);
  assert.equal(
    reorderSuggestion({
      available: 10,
      daily: null,
      leadDays: 3,
      safetyDays: 2,
      moq: 12,
      unitMinor: 500,
      freightMinor: 1000,
      inbound: [],
      asOf: "2026-10-01",
    }).quantity,
    null,
  );
});
