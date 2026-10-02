const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...node.children.flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'object' ? text(node.children) : String(node);
}
let uuid = 0;
function game({sceneKey = 'confront', flags = [], data = new Map(), effects = true, success = true, storageBlocked = false} = {}) {
  const states = [], deps = [], cleanup = [], callbacks = [], sent = [], intervals = [];
  const docListeners = {}, winListeners = {};
  let index = 0, now = 0, dirty = false;
  data.set('aduventure_lang', '"en"');
  const doc = {documentElement: {}, hidden: false,
    addEventListener: (event, fn) => docListeners[event] = fn,
    removeEventListener: event => delete docListeners[event]};
  const ctx = vm.createContext({
    console, Date, Math: Object.assign(Object.create(Math), {random: () => success ? 0.999 : 0}),
    performance: {now: () => now},
    crypto: {randomUUID: () => (++uuid).toString(16).padStart(12, '0') + '-abcd'},
    setTimeout: () => 0, clearTimeout() {},
    setInterval: fn => intervals.push(fn) - 1, clearInterval: id => intervals[id] = null,
    document: doc,
    window: {addEventListener: (event, fn) => winListeners[event] = fn, removeEventListener: event => delete winListeners[event]},
    fetch: async (url, options) => { sent.push({payload: JSON.parse(options.body), keepalive: options.keepalive}); return {text: async () => 'ok'}; },
    localStorage: {
      getItem: key => { if (storageBlocked) throw Error('blocked'); return data.get(key) ?? null; },
      setItem: (key, value) => { if (storageBlocked) throw Error('blocked'); data.set(key, value); },
      removeItem: key => data.delete(key)
    },
    React: {
      Fragment: 'fragment',
      createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) {
        const i = index++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], value => {
          const next = typeof value === 'function' ? value(states[i]) : value;
          if (!Object.is(next, states[i])) { states[i] = next; dirty = true; }
        }];
      },
      useRef(initial) { const i = index++; if (!(i in states)) states[i] = {current: initial}; return states[i]; },
      useEffect(fn, values) {
        const i = index++;
        if (!effects) return;
        if (!values || !deps[i] || values.some((value, n) => !Object.is(value, deps[i][n]))) {
          deps[i] = values;
          callbacks.push(() => { cleanup[i]?.(); cleanup[i] = fn(); });
        }
      }
    }
  });
  // pt15: 렌 숫자 전투는 서사 결투로 대체됐다. 남아 있는 전투 화면은 goto로 직접 연다.
  vm.runInContext(app.replace('  const pct = choice =>', `
    globalThis.testGoto = goto;
    const pct = choice =>`), ctx);
  if (sceneKey && !data.has('aduventure_save')) {
    const saved = {v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 0, specialLeft: 2, breathLeft: 1, tutSeen: true,
      pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'PRIVATE_TEST_NAME', hp: 11}, stats: {rolls: 0, success: 0}};
    vm.runInContext(`store.set('aduventure_save', ${JSON.stringify(saved)})`, ctx);
  }
  function render() {
    let tree;
    for (let tries = 0; tries < 20; tries++) {
      index = 0; dirty = false;
      tree = vm.runInContext('CRPG()', ctx);
      callbacks.splice(0).forEach(fn => fn());
      if (!dirty) return tree;
    }
    throw Error('Effects did not settle');
  }
  if (sceneKey) { nodes(render()).find(node => node.props.className === 'continueBtn').props.onClick(); render(); }
  return {
    render, sent, data, doc,
    run: code => vm.runInContext(code, ctx),
    tick: ms => now += ms,
    hidden(value) { doc.hidden = value; docListeners.visibilitychange?.(); },
    pagehide() { winListeners.pagehide?.(); },
    events: event => sent.filter(x => x.payload.text === event).map(x => JSON.parse(x.payload.extra)),
    finishRoll() { for (let tick = 0; tick < 12; tick++) intervals.forEach(fn => fn && fn()); }
  };
}
const choices = tree => nodes(tree).filter(node => node.type === 'button' && node.props.className === 'choice');

test('clock accumulates active periods and does not reset on unchanged decision', () => {
  const g = game({sceneKey: null});
  g.run('globalThis.clock = createDecisionClock(); clock.sync("a", false)');
  g.tick(1200); g.run('clock.sync("a", false)');
  g.tick(300); g.run('clock.sync("a", true)');
  g.tick(9000); assert.equal(g.run('clock.read("a")'), 1500);
  g.run('clock.sync("a", false)'); g.tick(700);
  assert.equal(g.run('clock.read("a")'), 2200);
  g.run('clock.sync("b", false)');
  assert.equal(g.run('clock.read("b")'), 0);
  assert.equal(g.run('clock.read("a")'), null);
});

test('real choice payload excludes hidden, tutorial and feedback time; language toggle retains elapsed time', () => {
  const g = game({flags: ['ledger']});
  g.tick(1000); g.hidden(true); g.tick(10000); g.hidden(false); g.tick(500);
  nodes(g.render()).find(n => n.props['aria-label'] === 'language').props.onClick(); g.render();
  g.tick(200);
  nodes(g.render()).find(n => n.type === 'button' && text(n) === '🗒').props.onClick();
  let tree = g.render(); g.tick(9000);
  nodes(tree).find(n => n.type.name === 'PlaytestFeedback').props.onClose(); g.render();
  g.tick(300);
  nodes(g.render()).find(n => n.type === 'button' && n.props.title === g.run('UI.rulesTitle.ko')).props.onClick();
  tree = g.render(); g.tick(8000);
  const tut = nodes(tree).find(n => n.props.className === 'tut');
  nodes(tut).find(n => n.type === 'button').props.onClick(); g.render();
  g.tick(400);
  choices(g.render())[0].props.onClick();
  const [event] = g.events('choice');
  assert.equal(event.dwell_ms, 2400);
  assert.equal(event.lang, 'ko');
  assert.deepEqual(event.available_ids, ['confront:0', 'confront:3', 'confront:4']);
  assert.equal(event.choice_id, 'confront:0');
  assert.equal(event.class, 'fighter');
  assert.equal(event.hp, 11);
  assert.ok(!JSON.stringify(g.sent).includes('PRIVATE_TEST_NAME'));
});

test('a repeated click from the same decision emits and resolves only once', () => {
  const g = game({flags: ['ledger']});
  const click = choices(g.render())[0].props.onClick;
  click(); click();
  assert.equal(g.events('choice').length, 1);
  g.finishRoll();
  g.render();
});

test('effect-free first click and blocked storage still allow gameplay, with unknown dwell', () => {
  for (const storageBlocked of [false, true]) {
    const g = game({effects: false, storageBlocked, flags: ['ledger']});
    choices(g.render())[0].props.onClick();
    assert.equal(g.events('choice')[0].dwell_ms, null);
    g.finishRoll();
    assert.ok(g.render());
  }
});

test('legacy save upgrades, reload continues the same run, restart gets a new run with the same anonymous player', () => {
  const first = game({sceneKey: 'confront'});
  const a = first.events('run_continue')[0];
  assert.equal(a.legacy_save, true);
  assert.equal(JSON.parse(first.data.get('aduventure_save')).telemetry.id, a.run_id);
  const loaded = game({sceneKey: 'confront', data: first.data});
  const b = loaded.events('run_continue')[0];
  assert.equal(b.run_id, a.run_id);
  assert.equal(b.player_id, a.player_id);
  assert.equal(b.legacy_save, false);
  const ending = game({sceneKey: 'ending', data: new Map([['aduventure_anon_player', JSON.stringify(a.player_id)]])});
  const oldRun = ending.events('run_continue')[0].run_id;
  nodes(ending.render()).find(n => n.type === 'button' && n.props.className === 'restart').props.onClick();
  nodes(ending.render()).find(n => n.props.className === 'choice primaryChoice').props.onClick(); // pt14: 기록 화면
  nodes(ending.render()).find(n => n.props.className === 'card').props.onClick(); ending.render();
  const restarted = ending.events('run_start')[0];
  assert.notEqual(restarted.run_id, oldRun);
  assert.equal(restarted.player_id, a.player_id);
  assert.equal(restarted.previous_run_id, oldRun);
  assert.equal(restarted.reason, 'restart');
});

test('pagehide records an unfinished decision using keepalive, but never after its click', () => {
  const g = game();
  g.tick(700); g.hidden(true); g.tick(900); g.pagehide();
  const [event] = g.events('decision_unfinished');
  assert.equal(event.dwell_ms, 700);
  assert.equal(event.choice_id, null);
  assert.equal(g.sent.at(-1).keepalive, true);
  g.hidden(false); choices(g.render())[0].props.onClick(); g.pagehide();
  assert.equal(g.events('decision_unfinished').length, 1);
  g.render(); // Commit the rolling state and its incremented decision sequence.
  g.tick(200); g.pagehide();
  assert.equal(g.events('decision_unfinished').length, 1, 'A dice animation is not a new unfinished decision');
});

test('combat decisions include the available actions and pre-action resources, and exclude dice animation time', () => {
  const g = game({sceneKey: 'confront', success: false});
  g.tick(1200); choices(g.render())[0].props.onClick(); g.render();
  g.tick(20000); g.finishRoll(); g.render();
  g.tick(850);
  const attack = choices(g.render()).find(n => String(n.props.onClick).includes('combatAction("attack")'));
  assert.ok(attack);
  attack.props.onClick(); g.render();
  const [event] = g.events('combat_action');
  assert.equal(event.dwell_ms, 850);
  assert.equal(event.choice_id, 'attack');
  assert.deepEqual(event.available_ids, ['attack', 'special', 'defend', 'breath']);
  assert.equal(event.special_left, 2);
  assert.equal(event.breath_left, 1);
  assert.equal(event.hp, 11);
  assert.ok(event.enemy_hp > 0);
});

test('Ren cooldown rejects a forced second disruption without telemetry, then records cooldown and readiness on subsequent turns', () => {
  const g = game({sceneKey: 'stairs'});
  const action = (tree, id) => choices(tree).find(n => String(n.props.onClick).includes(`looterAction("${id}")`));
  g.render(); g.run('testGoto("combat")');
  g.render(); g.tick(250);
  action(g.render(), 'disrupt').props.onClick();
  let tree = g.render();
  const blocked = action(tree, 'disrupt');
  assert.equal(blocked.props.disabled, true);
  const afterFirst = text(tree);
  g.tick(1000);
  blocked.props.onClick(); // Call the disabled button's handler to verify its guard as well as its UI.
  tree = g.render();
  assert.equal(text(tree), afterFirst, 'A blocked attempt changes neither combat state nor its log');
  assert.equal(g.events('combat_action').length, 1, 'A blocked action is not recorded as a player choice');
  g.tick(250); action(tree, 'guard').props.onClick();
  tree = g.render();
  assert.equal(action(tree, 'disrupt').props.disabled, false, 'The intervening guard makes disruption available again');
  g.tick(400); action(tree, 'disrupt').props.onClick(); g.render();
  const [first, guard, readyAgain] = g.events('combat_action');
  assert.equal(first.choice_id, 'disrupt');
  assert.equal(first.disrupt_ready, true);
  assert.ok(first.available_ids.includes('disrupt'));
  assert.equal(guard.choice_id, 'guard');
  assert.equal(guard.disrupt_ready, false);
  assert.deepEqual(guard.available_ids, ['strike', 'guard']);
  assert.equal(guard.dwell_ms, 1250, 'A rejected attempt does not reset the current decision timer');
  assert.equal(guard.seq, first.seq + 1, 'A rejected attempt does not advance the decision sequence');
  assert.equal(readyAgain.choice_id, 'disrupt');
  assert.equal(readyAgain.disrupt_ready, true);
  assert.ok(readyAgain.available_ids.includes('disrupt'));
  assert.equal(readyAgain.dwell_ms, 400);
});

test('all current narrative payloads fit the legacy extra field and use original, unfiltered choice indexes', () => {
  const base = game({sceneKey: null});
  const keys = base.run('Object.keys(SCENES).filter(k => SCENES[k].choices?.length)');
  for (const sceneKey of keys) {
    const g = game({sceneKey, flags: ['ledger', 'grip', 'ren_tip', 'sawTrap']});
    const choice = choices(g.render())[0];
    if (!choice) continue;
    choice.props.onClick();
    const event = g.events('choice')[0];
    assert.ok(event, `${sceneKey} emits an event`);
    assert.ok(event.available_ids.includes(event.choice_id));
    for (const {payload} of g.sent) {
      assert.ok(payload.extra.length <= 950);
      assert.ok(Buffer.byteLength(payload.extra, 'utf8') <= 950);
      assert.doesNotThrow(() => JSON.parse(payload.extra));
      assert.match(payload.who, /^p[a-z0-9]+$/i);
    }
  }
});
