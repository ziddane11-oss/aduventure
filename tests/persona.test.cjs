// pt29 — 가상 플레이어(tools/persona-sim.cjs)가 실제 게임 코드를 끝까지 눌러 본다.
// 성향 모델은 가정이지만, 오류·막힘·도달 불가는 진짜 문제다. 빌드마다 12명으로 확인한다.
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = process.env.GAME_HTML || path.join(__dirname, '..', 'index.html');
const run = (n, seed) => JSON.parse(execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'persona-sim.cjs'), html, String(n), seed], {encoding: 'utf8', maxBuffer: 1 << 24}));

test('twelve simulated players never crash, never get stuck, and all reach the end of Ch.1', () => {
  const s = run(12, 'ci-12');
  assert.deepEqual(s.crashes, []);
  assert.deepEqual(s.runtimeErrors, []);
  assert.deepEqual(s.stuck, []);
  assert.equal(s.reach.ch1end, 100);
});

// pt29 이전: 3장 끝의 강조 버튼이 '3장 다시'라 베른의 진술(2장)을 못 얻어 판결 도달 2%. 고친 뒤 30%대.
test('the case can be closed: of sixty players, at least 15% reach the verdict', () => {
  const s = run(60, 'ci-60');
  assert.deepEqual(s.stuck, []);
  assert.ok(s.reach.verdict >= 15, 'verdict reach ' + s.reach.verdict + '%');
});
