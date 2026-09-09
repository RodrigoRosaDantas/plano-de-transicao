import fs from 'node:fs/promises';

const [syncNotion, enrich, quality] = await Promise.all([
  fs.readFile('scripts/sync-notion.mjs', 'utf8'),
  fs.readFile('scripts/enrich-work-parity.mjs', 'utf8'),
  fs.readFile('.github/workflows/quality.yml', 'utf8'),
]);

const failures = [];
const expect = (label, condition) => {
  if (!condition) failures.push(label);
};

expect(
  'sync-notion só recalcula TDAS com linhas reconhecíveis',
  syncNotion.includes('const tdasRowsUsable = Array.isArray(tdasRows)') &&
    syncNotion.includes('if (tdasRowsUsable) {')
);
expect(
  'sync-notion só recalcula EDAS com linhas concluídas reconhecíveis',
  syncNotion.includes('const edasRowsUsable = Array.isArray(edasRows)') &&
    syncNotion.includes('if (edasRowsUsable) {')
);
expect(
  'histórico mantém último valor confiável quando fonte crítica está vazia',
  syncNotion.includes('const shouldRebuildHistory = Boolean(registryRows?.length && included.length && tdasRowsUsable);') &&
    syncNotion.includes(': (previous.historyCycles || []);')
);
expect(
  'métricas de cadernos e redações não zeram em resposta vazia',
  syncNotion.includes('tdasErrorRows?.length') &&
    syncNotion.includes('tdasEssayRows?.length') &&
    syncNotion.includes('edasErrorRows?.length') &&
    syncNotion.includes('edasCaseRows?.length')
);
expect(
  'enriquecimento financeiro preserva snapshot quando consulta está vazia',
  enrich.includes('if (financeRows?.length) {') &&
    enrich.includes('if (registryRows?.length) {')
);
expect(
  'CI roda a auditoria de resiliência',
  quality.includes('tests/data-resilience-static.mjs')
);

if (failures.length) {
  console.error('Falhas na auditoria de resiliência:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS  resiliência: respostas vazias preservam o último snapshot confiável');
