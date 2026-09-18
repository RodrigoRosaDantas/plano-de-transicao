import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, css, app, sw] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('assets/navigation-mobile-v38.css', 'utf8'),
  fs.readFile('assets/work-app.js', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
]);

assert.match(index, /navigation-mobile-v38\.css\?v=38/, 'HTML deve carregar o tratamento móvel v38');
assert.match(index, /__PLANO_UI_RELEASE__ = "v45"/, 'HTML deve declarar o release v45');
assert.ok(!index.includes('id="mobileDock"') && !index.includes('class="mobile-dock"'), 'A barra inferior deve ter sido removida do HTML');
assert.match(css, /body\s*\{[\s\S]*?padding-bottom:\s*0;/, 'Mobile não deve reservar espaço para a barra inferior');
assert.match(css, /\.page-wrap\s*\{[\s\S]*?padding-bottom:\s*32px\s*!important;/, 'Conteúdo não deve terminar com o espaço legado do dock');
assert.match(css, /\.mobile-dock\s*\{[\s\S]*?display:\s*none\s*!important;/, 'Instalações antigas também devem ocultar o dock');
assert.match(app, /function syncMobileNavigation\(\)/, 'App deve sincronizar a aba ativa no trilho horizontal');
assert.match(app, /requestAnimationFrame\(syncMobileNavigation\)/, 'Trilho deve revelar a rota ativa após renderização');
assert.match(app, /#moreTopBtn.*openMoreSheet/, 'Botão Mais do topo deve abrir as áreas secundárias');
assert.ok(!app.includes('moreDockBtn'), 'App não deve manter o acionador da barra removida');
assert.match(sw, /plano-transicao-v45-post-exam-host/, 'Service worker deve usar o cache vigente do Pós-Prova SEDES');
assert.match(sw, /'\.\/assets\/navigation-mobile-v38\.css'/, 'Service worker deve cachear o tratamento móvel v38');
assert.ok(!sw.includes('navigation-mobile-v37.css'), 'Service worker não deve cachear o tratamento removido');

console.log('PASS  v38: barra inferior removida, espaço inferior limpo e navegação superior preservada.');
