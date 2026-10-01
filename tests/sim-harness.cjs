'use strict';

// Shared support for the supplied balance/reach simulators. We execute the
// shipped functions, replacing React setters and side effects with memory only.
const fs = require('node:fs');
const vm = require('node:vm');
const {createHash} = require('node:crypto');

function readOptions(defaultTrials) {
  const args = process.argv.slice(2).filter(arg => arg !== '--json');
  const file = args[0] || 'index.html';
  const trials = Number(args[1] || defaultTrials);
  const seed = args[2] || '20261001';
  if (!Number.isSafeInteger(trials) || trials < 1) throw new Error('Trials must be a positive integer.');
  return {file, trials, seed, json: process.argv.includes('--json')};
}

function seedNumber(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seedNumber(seed);
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function readGame(file) {
  const source = fs.readFileSync(file, 'utf8');
  const cut = (start, end) => {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    if (from < 0 || to <= from) throw new Error('Source section not found: ' + start);
    return source.slice(from, to);
  };
  return {
    source,
    sha256: createHash('sha256').update(source).digest('hex'),
    build: source.match(/const BUILD\s*=\s*["']([^"']+)/)?.[1] || 'unknown',
    core: cut('const wname =', '/* ---------- 다국어 UI') + cut('const SRD20 =', 'const SCENE_TITLES ='),
    handlers: cut('  function looterAction(action)', '  function restart('),
    scenes: () => cut('const SCENES =', 'function buildEnding1(')
  };
}

function sandbox(game, seed, extra = '') {
  const random = seededRandom(seed);
  const math = Object.create(Math);
  math.random = random;
  const ctx = vm.createContext({
    Math: math,
    bi: (ko, en) => ({ko, en}),
    d: sides => Math.floor(random() * sides) + 1
  });
  vm.runInContext(game.core + extra, ctx);
  return ctx;
}

// All action handlers run unchanged. Telemetry/audio/React scheduling are not
// measured. Assignments are synchronous, as one settled user turn would be.
const BATTLE_STATE = `
  let ruleKey, rules, pc, scene, enemy, enemyIntent, guardBonus, trapUsed, disruptReady;
  let specialLeft, breathLeft, stats, clog, flags;
  const lang = 'ko', tx = value => value?.ko || value;
  const SFX = {good() {}, bad() {}}, recordDecision = () => true, setLastResult = () => {};
  const setPc = value => pc = value, setEnemy = value => enemy = value;
  const setClog = fn => clog = fn(clog), setStats = fn => stats = fn(stats);
  const setSpecialLeft = fn => specialLeft = fn(specialLeft), setBreathLeft = value => breathLeft = value;
  const setEnemyIntent = value => enemyIntent = value, setGuardBonus = value => guardBonus = value;
  const setTrapUsed = value => trapUsed = value, setDisruptReady = value => disruptReady = value;
  function resetBattle(enemyKey) {
    scene = {enemy: enemyKey};
    enemy = {...ENEMIES[enemyKey], hp: ENEMIES[enemyKey].maxHp};
    enemyIntent = enemyKey === 'looter' ? rollLooterIntent(enemy.maxHp, enemy.maxHp) : null;
    guardBonus = 0; trapUsed = false; disruptReady = true;
    specialLeft = 2; breathLeft = 1; stats = {rolls: 0, success: 0}; clog = [];
  }
  function state() {
    return {hp: pc.hp, maxHp: pc.maxHp, ehp: enemy.hp, emax: enemy.maxHp,
      done: !!enemy.done, down: !!enemy.playerDown, intent: enemyIntent,
      disruptReady, specialLeft, breathLeft, trapUsed, guardBonus, sawTrap: flags.includes('sawTrap')};
  }
`;

function makeArena(game, rule, foe, cls, seed) {
  const ctx = sandbox(game, seed);
  vm.runInContext(BATTLE_STATE + `
    function reset(startHp = null, sawTrap = false) {
      ruleKey = ${JSON.stringify(rule)}; rules = RULE_SYSTEMS[ruleKey];
      const c = CLASSES[${JSON.stringify(cls)}];
      pc = {...c, classKey: ${JSON.stringify(cls)}, name: 'SIM', hp: startHp == null ? c.maxHp : startHp};
      flags = sawTrap ? ['sawTrap'] : [];
      resetBattle(${JSON.stringify(foe)});
    }
    ${game.handlers}
  `, ctx);
  return ctx;
}

const LOOTER = {
  strike_only: {label: '공격만', choose: () => 'strike'},
  guard_hook: {label: '강타방어·나머지공격', choose: s => s.intent === 'hook' ? 'guard' : 'strike'},
  guard_disrupt: {label: '강타방어·방해·공격', choose: s => s.intent === 'hook' ? 'guard' : s.disruptReady ? 'disrupt' : 'strike'},
  disrupt_guard: {label: '방해↔방어', choose: s => s.disruptReady ? 'disrupt' : 'guard'}
};
const NORMAL = {
  attack_only: {label: '공격만', choose: () => 'attack'},
  special_first: {label: '특수기먼저', choose: s => s.specialLeft > 0 ? 'special' : 'attack'}
};

function fight(arena, looter, choose, {startHp = null, sawTrap = false, turnLimit = 80} = {}) {
  arena.reset(startHp, sawTrap);
  let turns = 0, sawHalf = false, suddenDeath = false;
  while (turns < turnLimit) {
    const before = arena.state();
    if (before.done || before.down) break;
    if (before.ehp <= Math.ceil(before.emax / 2)) sawHalf = true;
    const action = looter && before.sawTrap && !before.trapUsed ? 'trap' : choose(before);
    if (looter) arena.looterAction(action); else arena.combatAction(action);
    turns++;
    const after = arena.state();
    if (![after.hp, after.ehp].every(Number.isFinite)) throw new Error('Non-finite combat HP');
    if (after.down && before.hp >= Math.ceil(before.maxHp / 2)) suddenDeath = true;
  }
  const end = arena.state();
  if (end.done && end.down) throw new Error('Fight marked both won and lost');
  return {turns, win: end.done, dead: end.down, unresolved: !end.done && !end.down, sawHalf, suddenDeath};
}

module.exports = {readOptions, readGame, sandbox, BATTLE_STATE, makeArena, fight, LOOTER, NORMAL, seededRandom};
