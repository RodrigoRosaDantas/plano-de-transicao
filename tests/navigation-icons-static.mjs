import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, app, manager] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('assets/work-app.js', 'utf8'),
  fs.readFile('assets/work-manager-v9.js', 'utf8'),
]);

const mainTabs = index.slice(index.indexOf('<nav class="main-tabs"'), index.indexOf('</nav>', index.indexOf('<nav class="main-tabs"')));
const moreAreas = index.slice(index.indexOf('<div class="sheet-grid sheet-grid--secondary">'), index.indexOf('</div>', index.indexOf('<div class="sheet-grid sheet-grid--secondary">')));

assert.match(mainTabs, /data-view="post-exam"[^>]*>[\s\S]*?data-icon="flag"/, 'Pós-prova deve manter a bandeira como marco');
assert.match(mainTabs, /data-view="exams"[^>]*>[\s\S]*?data-icon="trophy"/, 'Concursos deve usar troféu');
assert.match(mainTabs, /aria-label="Áreas do plano"/, 'Barra superior deve ter nome acessível');
assert.match(mainTabs, /data-view="command"[^>]*aria-current="page"/, 'Barra superior deve expor o estado ativo');
assert.ok(!index.includes('id="mobileDock"') && !index.includes('class="mobile-dock"'), 'Barra inferior não deve existir no HTML');
assert.match(moreAreas, /data-view="exams"[^>]*>[\s\S]*?data-icon="trophy"/, 'Concursos no Mais deve usar troféu');
assert.ok(app.includes("trophy:"), 'work-app deve definir o ícone de troféu');
assert.match(app, /item\.view === "exams" \? "trophy"/, 'Busca deve usar o ícone de concursos');
assert.match(manager, /icon\('trophy'\)/, 'Acesso rápido de Concursos deve usar troféu');

console.log('PASS  ícones do trilho superior e do menu Mais distinguem pós-prova e concursos; barra inferior removida.');
