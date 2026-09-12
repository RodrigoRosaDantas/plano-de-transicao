import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, css, app, examCss, sw] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('assets/navigation-mobile-v37.css', 'utf8'),
  fs.readFile('assets/work-app.js', 'utf8'),
  fs.readFile('assets/exam-day-v21.css', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
]);

assert.match(index, /navigation-mobile-v37\.css\?v=37/, 'HTML deve carregar o acabamento móvel v37');
assert.match(index, /__PLANO_UI_RELEASE__ = "v37"/, 'HTML deve declarar o release v37');
assert.match(css, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/, 'Dock deve manter cinco colunas uniformes');
assert.match(css, /\.mobile-dock button\s*\{[\s\S]*?width:\s*100%;/, 'Itens do dock devem ocupar toda a célula');
assert.match(css, /\.mobile-dock button > span\s*\{[\s\S]*?flex:\s*0 0 24px;/, 'Ícones devem ter caixa de tamanho estável');
assert.match(css, /\.mobile-dock button\.active\s*\{[\s\S]*?border-color:/, 'Estado ativo não pode alterar a geometria do item');
assert.match(css, /body:not\(\.exam-day-active\) \.mobile-dock \[data-view="journey"\]/, 'Jornada deve continuar visível fora do Dia da Prova');
assert.match(examCss, /body\.exam-day-active \.mobile-dock \[data-view="journey"\]/, 'Ocultação de Jornada deve ser exclusiva do Dia da Prova');
assert.match(app, /function syncMobileNavigation\(\)/, 'App deve sincronizar a aba ativa no trilho horizontal');
assert.match(app, /requestAnimationFrame\(syncMobileNavigation\)/, 'Trilho deve revelar a rota ativa após renderização');
assert.match(app, /document\.body\.classList\.remove\('exam-day-active'\)/, 'Navegação comum deve limpar o estado do Dia da Prova');
assert.match(sw, /plano-transicao-v37-pre-edital/, 'Service worker deve invalidar o cache anterior');
assert.match(sw, /'\.\/assets\/navigation-mobile-v37\.css'/, 'Service worker deve cachear o novo acabamento móvel');

console.log('PASS  v37: dock móvel uniforme, Jornada preservada e rota ativa revelada.');
