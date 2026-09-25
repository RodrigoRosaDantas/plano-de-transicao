function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function isExplicitNoStudy(row) {
  return /nao\s+estudei\s+nesses\s+dias/i.test(normalize(row.notes));
}

export function deriveTdasProgress(rows = [], fallbackTotal = 0) {
  const unique = new Map();
  for (const row of rows) {
    const id = String(row.id || "").trim();
    if (id) unique.set(id, row);
  }
  const steps = [...unique.values()];
  const notStudied = steps.filter(isExplicitNoStudy).length;
  const done = steps.filter((row) =>
    !isExplicitNoStudy(row) && ["Concluído", "Descanso"].includes(row.status)
  ).length;
  return { stepsTotal: steps.length || fallbackTotal, stepsDone: done, stepsNotStudied: notStudied };
}
