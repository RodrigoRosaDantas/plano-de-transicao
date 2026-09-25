import assert from "node:assert/strict";
import { reconcileHistory } from "../scripts/history-reconciliation.mjs";

const rows = [
  { project: "TDAS 202", scope: "Objetivo", type: "Snapshot", auditStatus: "Validado", include: true, record: "TDAS — snapshot revalidado | 27/08/2026", date: "2026-08-27", auditedAt: "2026-08-27", questions: 3319, hits: 3055, errors: 264, withoutResult: 0 },
  { project: "SEDES pré-edital", scope: "Objetivo", type: "Snapshot", auditStatus: "Validado", include: true, record: "Outros bancos validados", questions: 12010, hits: 10921, errors: 1089, withoutResult: 90 },
  { project: "Consolidado geral", scope: "Consolidado", type: "Snapshot", auditStatus: "Ressalva", record: "Consolidado antigo", date: "2026-08-20", questions: 15301, hits: 13952, errors: 1349, withoutResult: 90 },
  { project: "Consolidado geral", scope: "Consolidado", type: "Snapshot", auditStatus: "Validado", record: "Consolidado histórico revalidado | 27/08/2026 — bancos globais", date: "2026-08-27", auditedAt: "2026-08-27", questions: 15329, hits: 13976, errors: 1353, withoutResult: 90 }
];
const { history, reconciliation } = reconcileHistory({
  registryRows: rows, tdasOperational: { questions: 3559, hits: 3258, errors: 301 }
});
assert.deepEqual(history, { questions: 15329, hits: 13976, errors: 1353, withoutResult: 90, rawRecords: 15419 });
assert.equal(reconciliation.status, "pending");
assert.equal(reconciliation.componentsMatch, true);
assert.equal(reconciliation.official.sourceRecord, "Consolidado histórico revalidado | 27/08/2026 — bancos globais");
assert.deepEqual(reconciliation.pendingDelta, { questions: 240, hits: 203, errors: 37 });
assert.equal(reconciliation.tdasValidated.questions, 3319);
const broken = rows.map((row) => row.project === "SEDES pré-edital" ? { ...row, questions: 12011 } : row);
assert.equal(reconcileHistory({ registryRows: broken, tdasOperational: { questions: 3559, hits: 3258, errors: 301 } }).reconciliation.status, "invalid");
console.log("Reconciliação de histórico: 7 verificações aprovadas.");
