import assert from "node:assert/strict";
import { deriveTdasProgress } from "../scripts/tdas-progress.mjs";
const progress = deriveTdasProgress([
  { id: "PE001", status: "Concluído", notes: "Sessão registrada." },
  { id: "PE002", status: "Descanso", notes: "" },
  { id: "PE003", status: "Concluído", notes: "Registro: não estudei nesses dias." },
  { id: "PE004", status: "Em andamento", notes: "" },
  { id: "PE004", status: "Concluído", notes: "" }
]);
assert.deepEqual(progress, { stepsTotal: 4, stepsDone: 3, stepsNotStudied: 1 });
assert.deepEqual(deriveTdasProgress([], 112), { stepsTotal: 112, stepsDone: 0, stepsNotStudied: 0 });
console.log("Progresso TDAS: 2 verificações aprovadas.");
