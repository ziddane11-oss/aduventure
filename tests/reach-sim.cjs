'use strict';

// Adapted from the reach-sim.cjs supplied by the user with Claude's review.
// Actual SCENES/checks/combat handlers; scene navigation is a small, explicit
// first-run model. It does not measure real readers or visiting Chapter 2.
// Usage: node tests/reach-sim.cjs index.html 3000 [seed=20261001] [--json]
const vm = require('node:vm');
const {readOptions, readGame, sandbox, BATTLE_STATE} = require('./sim-harness.cjs');
const opts = readOptions(3000);
const game = readGame(opts.file);
const results = [];

function makeJourney(seed) {
  const ctx = sandbox(game, seed, game.scenes());
  vm.runInContext(BATTLE_STATE + game.handlers + `
    // pt11: the clue is the sabotage flag. Every branch that grants it must also show the wording.
    const shows = branch => /빼낸 것/.test(branch?.text?.ko || '') && /pulled out/.test(branch?.text?.en || '');
    const gains = branch => [branch?.flag, ...(branch?.flags || [])].filter(Boolean);
    for (const s of Object.values(SCENES)) for (const ch of s.choices || []) for (const b of [ch.success, ch.fail, ch.result]) {
      if (b && gains(b).includes('sabotage') && !shows(b)) throw new Error('Sabotage flag without the displayed clue wording.');
    }
    function runChapter1(cls, pick, chosenRule, combatLimit = 80, sceneLimit = 50) {
      ruleKey = chosenRule; rules = RULE_SYSTEMS[ruleKey];
      const c = CLASSES[cls];
      pc = {...c, classKey: cls, name: 'SIM', hp: c.maxHp}; flags = [];
      let fate = 1, key = 'intro', trapPayoff = false, foughtRen = false, lostToRen = false;
      const addFlag = f => { if (f && !flags.includes(f)) flags.push(f); };
      const result = outcome => ({outcome, flags: [...flags], trapPayoff, sabotageClue: flags.includes('sabotage'), foughtRen, lostToRen, endingAtZeroHp: outcome === 'ending' && pc.hp === 0});
      for (let step = 0; step < sceneLimit; step++) {
        const s = SCENES[key];
        if (!s) throw new Error('Unknown scene: ' + key);
        if (s.revive) pc.hp = Math.max(pc.hp, s.revive);
        if (s.gameover) return result('death');
        if (s.ending) return result('ending');
        if (s.combat) {
          if (s.enemy !== 'looter') throw new Error('Unexpected combat outside Chapter 1');
          foughtRen = true; resetBattle(s.enemy);
          for (let t = 0; t < combatLimit && !enemy.done && !enemy.playerDown; t++) {
            let action = enemyIntent === 'hook' ? 'guard' : 'strike';
            if (flags.includes('sawTrap') && !trapUsed) { action = 'trap'; trapPayoff = true; }
            looterAction(action);
            if (![pc.hp, enemy.hp].every(Number.isFinite)) throw new Error('Non-finite combat HP');
          }
          if (!enemy.done && !enemy.playerDown) return result('combat_timeout');
          if (trapUsed) addFlag('wireUsed');
          lostToRen = !!enemy.playerDown;
          key = enemy.playerDown ? s.defeat.goto : s.victory.goto;
          continue;
        }
        const visible = (s.choices || []).filter(ch => (!ch.classOnly || ch.classOnly === cls) && !ch.loreReq && !ch.artifactReq && (!ch.echoReq || flags.includes(ch.echoReq)) && (!ch.flagNot || !flags.includes(ch.flagNot)));
        const ch = pick(key, visible);
        if (!ch || !visible.includes(ch)) throw new Error('Policy cannot select a visible choice at ' + key);
        if (ch.result) { gains(ch.result).forEach(addFlag); key = ch.result.goto; continue; }
        if (!ch.check) { addFlag(ch.flagDirect); key = ch.goto; continue; }
        let check = rules.check({actor: pc, ...ch.check});
        if (!check.success && fate > 0) { fate--; check = rules.check({actor: pc, ...ch.check}); }
        const branch = check.success ? ch.success : ch.fail;
        // Mirrors applyBranch's narrative damage, not a second combat engine.
        if (branch.damage) pc.hp = Math.max(0, pc.hp - (d(branch.damage[1]) + branch.damage[0] - 1));
        gains(branch).forEach(addFlag); key = branch.goto;
      }
      return result('scene_timeout');
    }
    function chance(ch) { return ch.check ? rules.successChance({actor: pc, ...ch.check}) : 1; }
  `, ctx);
  return ctx;
}

const PATHS = {
  perception_persuade: {label: '살핀다→설득', door: 'perception', stairs: 'persuasion', railing: 'caughtRen'},
  athletics_persuade: {label: '내달린다→설득', door: 'athletics', stairs: 'persuasion', railing: 'caughtRen'},
  perception_fight: {label: '살핀다→바로 전투→렌', door: 'perception', stairs: null, railing: 'caughtRen'},
  perception_fight_lens: {label: '살핀다→바로 전투→렌즈', door: 'perception', stairs: null, railing: 'keptLens'}
};

for (const rule of ['srd20', 'simple2d6']) {
  for (const [pathId, path] of Object.entries(PATHS)) {
    for (const cls of ['fighter', 'rogue', 'wizard']) {
      const ctx = makeJourney(`${opts.seed}|reach|${rule}|${pathId}|${cls}`);
      const pick = (key, list) => {
        if (key === 'door') return list.find(ch => ch.check?.skill === path.door);
        if (key === 'stairs') return path.stairs ? list.find(ch => ch.check?.skill === path.stairs) : list.find(ch => !ch.check);
        if (key === 'railing') return list.find(ch => ch.result.flags.includes(path.railing));
        if (key === 'top') return list.filter(ch => ch.check).sort((a, b) => ctx.chance(b) - ctx.chance(a))[0] || list[0];
        return list[0];
      };
      const counts = {endings: 0, deaths: 0, combatTimeouts: 0, sceneTimeouts: 0, trapPayoffs: 0,
        reunionEligible: 0, sabotageClues: 0, perfectRepairs: 0, foughtRen: 0, endingAtZeroHp: 0,
        lostToRen: 0, beaconEndings: 0, intactLens: 0, wireRepairs: 0};
      for (let i = 0; i < opts.trials; i++) {
        const r = ctx.runChapter1(cls, pick, rule);
        counts.endings += r.outcome === 'ending'; counts.deaths += r.outcome === 'death';
        counts.combatTimeouts += r.outcome === 'combat_timeout'; counts.sceneTimeouts += r.outcome === 'scene_timeout';
        counts.trapPayoffs += r.trapPayoff;
        counts.reunionEligible += r.flags.includes('peaceful') || r.flags.includes('caughtRen');
        counts.lostToRen += r.lostToRen; counts.beaconEndings += r.flags.includes('signal');
        counts.intactLens += r.outcome === 'ending' && !['signal', 'lensCracked'].some(f => r.flags.includes(f));
        counts.wireRepairs += r.flags.includes('wired');
        counts.sabotageClues += r.sabotageClue; counts.perfectRepairs += r.flags.includes('fixed');
        counts.foughtRen += r.foughtRen; counts.endingAtZeroHp += r.endingAtZeroHp;
      }
      results.push({rule, path: pathId, pathLabel: path.label, cls, trials: opts.trials, ...counts});
    }
  }
}

const report = {
  kind: 'chapter1-path-simulation', build: game.build, sourceSha256: game.sha256,
  seed: opts.seed, trialsPerCase: opts.trials, combatLimit: 80, sceneLimit: 50,
  assumptions: [
    'Fresh Chapter 1 at full HP; no prior lore/artifacts. First failed narrative check is rerolled once.',
    'The fixed path selects the highest displayed success chance at repair; ties follow source choice order.',
    'Ren policy guards hook and strikes otherwise, spending a discovered trap on the first turn.',
    'Actual combat handlers/check functions/scene data are executed; scene navigation and choice availability are modeled.',
    'Dice-animation draws are excluded; a simulation seed is reproducible here, not a replay seed for a browser session.',
    'All rates use all started runs as denominator, including explicit unresolved timeouts.',
    'reunionEligible is peaceful or caughtRen (the Ch.2 bond choice opens), not an observed Chapter 2 reunion.',
    'sabotageClues counts the sabotage flag; the simulator refuses to run if any branch grants it without the displayed wording.',
    'pt11: losing to Ren continues to the beacon ending (lostToRen/beaconEndings); death follows the gameover scene only.',
    'The repair policy only compares checked choices, so the no-check wire repair is never chosen; wireRepairs stays 0 by design.',
    'No metric is required to reach 100%; optional scenes are expected to differ by path.'
  ], results
};
if (opts.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`${game.build} · ${opts.trials}회차/조건 · seed ${opts.seed} · SHA-256 ${game.sha256}`);
  console.log('첫 실패만 운명 재굴림, 수리는 성공 확률 최고 선택. 실제 테스터 행동/2장 방문률 아님.');
  console.log('단서=sabotage 플래그(표시 대사와 일치 검사); 완전수리=fixed. 재회조건=peaceful 또는 caughtRen이며 재회를 봤다는 뜻 아님.');
  console.log('pt11: 렌에게 지면 봉화 엔딩으로 이어짐(패배→봉화). 온전렌즈=금 가거나 도둑맞지 않고 1장을 끝낸 비율.');
  console.log('분모는 시작한 모든 회차. 전투 80턴·장면 50회 초과는 미해결이며 승리로 처리하지 않음.');
  const p = (n, total) => `${(100 * n / total).toFixed(1)}%`;
  for (const r of results) {
    console.log(`${r.rule} [${r.pathLabel}] ${r.cls} | 끝 ${p(r.endings, r.trials)} | 사망 ${p(r.deaths, r.trials)} | ` +
      `미해결 ${r.combatTimeouts + r.sceneTimeouts} | 철사사용 ${p(r.trapPayoffs, r.trials)} | ` +
      `재회조건 ${p(r.reunionEligible, r.trials)} | 파괴단서 ${p(r.sabotageClues, r.trials)} | ` +
      `완전수리 ${p(r.perfectRepairs, r.trials)} | 패배→봉화 ${p(r.beaconEndings, r.trials)} | 온전렌즈 ${p(r.intactLens, r.trials)} | HP0엔딩 ${p(r.endingAtZeroHp, r.trials)}`);
  }
}
