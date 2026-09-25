const value = (item, key) => Number.isFinite(Number(item?.[key])) ? Number(item[key]) : 0;
const HISTORY_KEYS = ["questions", "hits", "errors", "withoutResult", "rawRecords"];

function metricsFrom(row = {}) {
  const questions = value(row, "questions");
  const hits = value(row, "hits");
  const errors = row.errors == null ? questions - hits : value(row, "errors");
  const withoutResult = value(row, "withoutResult");
  return { questions, hits, errors, withoutResult, rawRecords: questions + withoutResult };
}

function totalMetrics(rows) {
  return rows.reduce((total, row) => {
    const item = metricsFrom(row);
    for (const key of HISTORY_KEYS) total[key] += item[key];
    return total;
  }, { questions: 0, hits: 0, errors: 0, withoutResult: 0, rawRecords: 0 });
}

function sameMetrics(left, right) {
  return HISTORY_KEYS.every((key) => Number(left?.[key] || 0) === Number(right?.[key] || 0));
}

function latestFirst(rows) {
  return [...rows].sort((a, b) =>
    String(a.auditedAt || a.date || "").localeCompare(String(b.auditedAt || b.date || "")) ||
    String(a.record || "").localeCompare(String(b.record || ""))
  );
}

export function reconcileHistory({ registryRows, tdasOperational, previousHistory = {}, previousReconciliation = null }) {
  if (!Array.isArray(registryRows)) {
    const previousOfficial = previousReconciliation?.official || metricsFrom(previousHistory);
    return {
      history: metricsFrom(previousOfficial),
      reconciliation: previousReconciliation || {
        status: "unavailable", official: previousOfficial, registeredComponents: {},
        tdasValidated: {}, tdasOperational: metricsFrom(tdasOperational), pendingDelta: {}, componentsMatch: false
      }
    };
  }
  const snapshots = registryRows.filter((row) =>
    row.project === "Consolidado geral" && row.scope === "Consolidado" &&
    row.type === "Snapshot" && row.auditStatus === "Validado"
  );
  const canonical = latestFirst(snapshots).at(-1) || null;
  const included = registryRows.filter((row) =>
    row.include && !(row.project === "Consolidado geral" && row.scope === "Consolidado" && row.type === "Snapshot")
  );
  const registeredComponents = totalMetrics(included);
  const fallbackOfficial = previousReconciliation?.official || metricsFrom(previousHistory);
  const official = canonical
    ? { ...metricsFrom(canonical), sourceRecord: canonical.record, asOf: canonical.auditedAt || canonical.date || null }
    : { ...metricsFrom(fallbackOfficial), sourceRecord: fallbackOfficial.sourceRecord || null, asOf: fallbackOfficial.asOf || null };
  const componentsMatch = Boolean(canonical) && sameMetrics(registeredComponents, official);
  const tdasComponents = included.filter((row) => row.project === "TDAS 202" && row.type === "Snapshot");
  const tdasValidated = tdasComponents.length
    ? {
        ...totalMetrics(tdasComponents),
        sourceRecord: tdasComponents.at(-1).record || null,
        asOf: tdasComponents.at(-1).auditedAt || tdasComponents.at(-1).date || null
      }
    : previousReconciliation?.tdasValidated || metricsFrom({});
  const operational = metricsFrom(tdasOperational);
  const pendingDelta = {
    questions: operational.questions - tdasValidated.questions,
    hits: operational.hits - tdasValidated.hits,
    errors: operational.errors - tdasValidated.errors
  };
  const hasPendingDelta = Object.values(pendingDelta).some((amount) => amount !== 0);
  const status = !canonical ? "invalid" : !componentsMatch ? "invalid" : hasPendingDelta ? "pending" : "reconciled";
  return {
    history: metricsFrom(official),
    reconciliation: { status, official, registeredComponents, tdasValidated, tdasOperational: operational, pendingDelta, componentsMatch }
  };
}
