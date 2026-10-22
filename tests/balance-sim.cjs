'use strict';

// Adapted from the balance-sim.cjs supplied by the user with Claude's review.
// This is a policy simulation of actual game handlers, not measured player data
// and not a search for the optimal strategy.
// Usage: node tests/balance-sim.cjs index.html 3000 [seed=20261001] [--json]
const {readOptions, readGame, makeArena, fight, LOOTER, NORMAL} = require('./sim-harness.cjs');
const opts = readOptions(3000);
const game = readGame(opts.file);
const results = [];

function measure(rule, cls, foe, policyId, policy, sawTrap = false) {
  const caseSeed = `${opts.seed}|balance|${rule}|${cls}|${foe}|${policyId}|trap=${sawTrap}`;
  const arena = makeArena(game, rule, foe, cls, caseSeed);
  const totals = {wins: 0, deaths: 0, unresolved: 0, turns: 0, winTurns: 0, halfDecisions: 0, suddenDeaths: 0};
  for (let i = 0; i < opts.trials; i++) {
    const r = fight(arena, foe === 'looter', policy.choose, {sawTrap});
    totals.wins += r.win; totals.deaths += r.dead; totals.unresolved += r.unresolved;
    totals.turns += r.turns; totals.winTurns += r.win ? r.turns : 0;
    totals.halfDecisions += r.sawHalf; totals.suddenDeaths += r.suddenDeath;
  }
  return {rule, cls, foe, policy: policyId, policyLabel: policy.label, sawTrap, trials: opts.trials, ...totals,
    winRate: totals.wins / opts.trials, deathRate: totals.deaths / opts.trials,
    unresolvedRate: totals.unresolved / opts.trials, meanTurns: totals.turns / opts.trials,
    meanWinTurns: totals.wins ? totals.winTurns / totals.wins : null};
}

for (const rule of ['srd20', 'simple2d6']) {
  for (const cls of ['fighter', 'rogue', 'wizard']) {
    for (const [id, policy] of Object.entries(LOOTER)) results.push(measure(rule, cls, 'looter', id, policy));
    results.push(measure(rule, cls, 'looter', 'guard_hook', LOOTER.guard_hook, true));
    for (const foe of ['smuggler', 'falsemonk']) {
      for (const [id, policy] of Object.entries(NORMAL)) results.push(measure(rule, cls, foe, id, policy));
    }
  }
}

const report = {
  kind: 'combat-policy-simulation', build: game.build, sourceSha256: game.sha256,
  seed: opts.seed, trialsPerCase: opts.trials, turnLimit: 80,
  assumptions: [
    'Each isolated fight starts at full class HP, two specials, one breath, no prepared riposte.',
    'No trap except rows marked sawTrap; when available it is always spent on the first turn.',
    'Fixed policies read the current intent; these are neither optimal strategies nor observed testers.',
    'Unresolved fights at 80 turns count in the denominator and never count as wins or deaths.',
    'meanTurns includes wins, losses and timeouts; meanWinTurns includes wins only.',
    'Seeded RNG is reset independently for each case, not each fight; changed code may consume rolls differently.'
  ], results
};
if (opts.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`${game.build} · ${opts.trials}판/조건 · seed ${opts.seed} · SHA-256 ${game.sha256}`);
  console.log('가정: 만피 전투, 특수 2회·숨 1회, 함정은 표시된 행에서 첫 턴 사용. 실제 플레이 통계/최적 전략 증명 아님.');
  console.log('미해결: 80턴 제한. 전체 평균은 사망·미해결 포함, 승리 평균은 승리만 포함.');
  const p = n => `${(100 * n).toFixed(1)}%`;
  for (const r of results) {
    console.log(`${r.rule} ${r.cls} ${r.foe} [${r.policyLabel}${r.sawTrap ? '+함정' : ''}] ` +
      `승 ${p(r.winRate)} | 사망 ${p(r.deathRate)} | 미해결 ${r.unresolved} | ` +
      `평균 ${r.meanTurns.toFixed(1)}턴/승리 ${r.meanWinTurns?.toFixed(1) ?? '—'}턴 | ` +
      `절반국면 ${p(r.halfDecisions / r.trials)} | 한방사망 ${p(r.suddenDeaths / r.trials)}`);
  }
}
