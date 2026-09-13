import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, app, styles, sw] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('assets/work-app.js', 'utf8'),
  fs.readFile('assets/transition-now-v39.css', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
]);

for (const value of [
  'transitionNextAction',
  'followUp.nextAction',
  'resourceProtocol.end',
  'transition-action-card',
  'O QUE FAZER AGORA',
]) assert.ok(app.includes(value), `app sem ${value}`);

for (const value of [
  '.transition-action-card',
  '.transition-action-status',
  '.transition-action-meta',
  '@media (max-width: 430px)',
]) assert.ok(styles.includes(value), `CSS da ação atual sem ${value}`);

assert.match(index, /__PLANO_UI_RELEASE__ = "v39"/, 'HTML deve declarar o release v39');
assert.match(index, /work-app\.js\?v=39&home=37/, 'App deve invalidar o cache com a versão v39');
assert.match(index, /transition-now-v39\.css\?v=39/, 'CSS da ação atual deve estar ligado');
assert.match(sw, /plano-transicao-v39-pre-edital/, 'Service worker deve usar o cache v39');
assert.match(sw, /\.\/assets\/transition-now-v39\.css/, 'Service worker deve cachear a ação atual');

console.log('PASS  v39: Home destaca a ação prioritária e o prazo do snapshot.');
