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
function game({sceneKey = 'confront', flags = [], data = new Map(), effects = true, success = true, storageBlocked = false, lang = 'en', hash = '', network = 'ok', search = '', browser} = {}) {
  const states = [], deps = [], cleanup = [], callbacks = [], sent = [], intervals = [];
  const docListeners = {}, winListeners = {};
  let index = 0, now = 0, dirty = false;
  if (lang !== null) data.set('aduventure_lang', JSON.stringify(lang));
  const doc = {documentElement: {}, hidden: false,
    addEventListener: (event, fn) => docListeners[event] = fn,
    removeEventListener: event => delete docListeners[event]};
  const ctx = vm.createContext({
    console, Date, URLSearchParams, ...(browser === undefined ? {} : {navigator: browser}), Math: Object.assign(Object.create(Math), {random: () => success ? 0.999 : 0}),
    performance: {now: () => now},
    crypto: {randomUUID: () => (++uuid).toString(16).padStart(12, '0') + '-abcd'},
    setTimeout: () => 0, clearTimeout() {},
    setInterval: fn => intervals.push(fn) - 1, clearInterval: id => intervals[id] = null,
    document: doc,
    window: {location: {hash, search}, addEventListener: (event, fn) => winListeners[event] = fn, removeEventListener: event => delete winListeners[event]},
    fetch: (url, options) => {
      if (!options?.body) return Promise.reject(Error('GET disabled in unit tests'));
      if (network === 'throw') throw Error('Network blocked');
      if (network === 'reject') return Promise.reject(Error('Network unavailable'));
      sent.push({payload: JSON.parse(options.body), keepalive: options.keepalive}); return Promise.resolve({text: async () => 'ok'}); },
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
    pageshow() { winListeners.pageshow?.(); },
    hashchange(hash) { ctx.window.location.hash = hash; winListeners.hashchange?.(); },
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
  // pt16: 스컬리 실패 분기는 서사 결투로 간다. 숫자 전투(combat2)는 직접 열어 검증한다.
  const g = game({sceneKey: 'confront', success: false});
  g.render(); g.run('testGoto("combat2")'); g.render();
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
    const choice = choices(g.render()).find(b => !b.props.disabled);
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

// pt49: page visits exist before a run, including direct standalone-case entries.
test('index page opens once before gameplay for both languages and every entry route', () => {
  for (const lang of ['ko', 'en']) for (const [hash, entry] of [
    ['', 'main'], ['#returned-letter', 'returned-letter'], ['#unsigned-order', 'unsigned-order'],
    ['#PRIVATE_FRAGMENT', 'main']
  ]) {
    const g = game({sceneKey: null, lang, hash});
    g.render(); g.render(); g.render();
    const events = g.events('page_open');
    assert.equal(events.length, 1, `${lang}/${hash}`);
    const [event] = events;
    assert.equal(event.v, 1);
    assert.equal(event.build, g.run('BUILD'));
    assert.equal(event.page, 'index.html');
    assert.equal(event.entry, entry);
    assert.equal(event.lang, lang);
    assert.match(event.player_id, /^p[a-z0-9]{8,20}$/i);
    assert.match(event.visit_id, /^v[a-z0-9]{8,20}$/i);
    assert.equal(event.run_id, undefined);
    assert.equal(g.events('run_start').length, 0);
    assert.equal(g.data.has('aduventure_save'), false);
    assert.equal(g.sent[0].payload.type, 'telemetry');
    assert.equal(g.sent[0].payload.scene, 'index.html');
    assert.equal(g.sent[0].payload.who, event.player_id);
    assert.equal(g.sent[0].keepalive, true);
    assert.doesNotMatch(JSON.stringify(g.sent), /PRIVATE_FRAGMENT/);
  }
});

test('page opens are not repeated by language/route changes or continuing; reload keeps player and gets a new visit', () => {
  const g = game();
  const [first] = g.events('page_open');
  assert.ok(first);
  assert.equal(first.player_id, g.events('run_continue')[0].player_id);
  nodes(g.render()).find(n => n.props['aria-label'] === 'language').props.onClick();
  g.render(); g.hidden(true); g.hidden(false); g.render();
  for (const hash of ['#returned-letter', '#unsigned-order', '']) { g.hashchange(hash); g.render(); }
  assert.equal(g.events('page_open').length, 1);
  const loaded = game({data: g.data});
  const [second] = loaded.events('page_open');
  assert.equal(second.player_id, first.player_id);
  assert.notEqual(second.visit_id, first.visit_id);
});

test('page-open storage and network failures never prevent rendering or continuing', async () => {
  for (const network of ['ok', 'throw', 'reject']) {
    const g = game({sceneKey: null, storageBlocked: true, network});
    assert.ok(g.render());
    assert.ok(g.render());
    if (network === 'ok') assert.equal(g.events('page_open').length, 1);
    const continuing = game({network});
    assert.ok(continuing.render());
    assert.ok(choices(continuing.render()).length > 0);
  }
  await new Promise(resolve => setImmediate(resolve));
});

const letterHTML = fs.readFileSync(path.join(__dirname, '..', 'letter.html'), 'utf8');
const letterScript = [...letterHTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
function openLetter({data = new Map(), storageBlocked = false, network = 'ok', withCrypto = true, search = '', browser} = {}) {
  const sent = [], order = [];
  const ctx = {
    Date, Math, URLSearchParams, ...(browser === undefined ? {} : {navigator: browser}),
    location: {search, replace: url => order.push({action: 'redirect', url})},
    localStorage: {
      getItem: key => { if (storageBlocked) throw Error('blocked'); return data.get(key) ?? null; },
      setItem: (key, value) => { if (storageBlocked) throw Error('blocked'); data.set(key, value); }
    }
  };
  if (withCrypto) ctx.crypto = {randomUUID: () => (++uuid).toString(16).padStart(12, '0') + '-abcd'};
  if (network !== 'missing') ctx.fetch = (url, options) => {
    order.push({action: 'send'});
    if (network === 'throw') throw Error('Network blocked');
    sent.push({url, payload: JSON.parse(options.body), ...options});
    if (network === 'reject') return Promise.reject(Error('Network unavailable'));
    if (network === 'pending') return new Promise(() => {});
    return Promise.resolve({text: async () => 'ok'});
  };
  vm.runInNewContext(letterScript, ctx);
  return {data, sent, order};
}

test('letter page sends a localized page_open before redirect, then index reuses the anonymous player', () => {
  for (const lang of ['ko', 'en']) {
    const data = new Map([
      ['aduventure_lang', JSON.stringify(lang)],
      ['aduventure_save', '{"private":"PRIVATE_SAVE"}'],
      ['aduventure_own_record_v1', '{"private":"PRIVATE_CASE"}']
    ]);
    const letter = openLetter({data, network: 'pending'});
    assert.deepEqual(letter.order.map(x => x.action), ['send', 'redirect']);
    assert.equal(letter.order[1].url, `./?lang=${lang}#returned-letter`, 'redirect never waits for the request');
    assert.equal(letter.sent.length, 1);
    const [sent] = letter.sent;
    const event = JSON.parse(sent.payload.extra);
    assert.equal(sent.payload.type, 'telemetry');
    assert.equal(sent.payload.text, 'page_open');
    assert.equal(sent.payload.scene, 'letter.html');
    assert.equal(sent.payload.who, event.player_id);
    assert.equal(sent.method, 'POST');
    assert.equal(sent.headers['Content-Type'], 'text/plain;charset=utf-8');
    assert.equal(sent.keepalive, true);
    assert.equal(event.v, 1);
    assert.equal(event.page, 'letter.html');
    assert.equal(event.entry, 'returned-letter');
    assert.equal(event.lang, lang);
    assert.equal(event.run_id, undefined);
    assert.match(event.visit_id, /^v[a-z0-9]{8,20}$/i);
    assert.equal(JSON.parse(data.get('aduventure_anon_player')), event.player_id);
    assert.ok(Buffer.byteLength(sent.payload.extra) <= 950);
    assert.doesNotMatch(sent.body, /PRIVATE_SAVE|PRIVATE_CASE/);
    assert.equal(data.get('aduventure_save'), '{"private":"PRIVATE_SAVE"}');
    assert.equal(data.get('aduventure_own_record_v1'), '{"private":"PRIVATE_CASE"}');
    const index = game({sceneKey: null, data, lang, hash: '#returned-letter'});
    index.render();
    assert.equal(sent.url, index.run('GAS_URL'), 'both pages use the same existing sink');
    assert.equal(event.build, index.run('BUILD'), 'letter build stays synchronized with index');
    const [opened] = index.events('page_open');
    assert.equal(opened.page, 'index.html');
    assert.equal(opened.player_id, event.player_id);
    assert.notEqual(opened.visit_id, event.visit_id);
    assert.equal(index.events('run_start').length, 0);
  }
});

test('letter reload reuses a valid player and generates a distinct visit each time', () => {
  const data = new Map([['aduventure_anon_player', '"pexisting1234"']]);
  const first = JSON.parse(openLetter({data}).sent[0]?.payload.extra || '{}');
  const second = JSON.parse(openLetter({data}).sent[0]?.payload.extra || '{}');
  assert.equal(first.player_id, 'pexisting1234');
  assert.equal(second.player_id, first.player_id);
  assert.notEqual(second.visit_id, first.visit_id);
});

test('letter handles blocked or malformed storage and missing crypto without losing telemetry or redirect', () => {
  for (const storageBlocked of [false, true]) for (const bad of ['{broken', '"PRIVATE_BAD_ID"', 'null']) {
    const data = new Map([['aduventure_anon_player', bad], ['aduventure_lang', bad]]);
    const letter = openLetter({data, storageBlocked, withCrypto: false});
    assert.equal(letter.sent.length, 1);
    const event = JSON.parse(letter.sent[0].payload.extra);
    assert.match(event.player_id, /^p[a-z0-9]{8,20}$/i);
    assert.match(event.visit_id, /^v[a-z0-9]{8,20}$/i);
    assert.equal(event.lang, 'ko');
    assert.doesNotMatch(letter.sent[0].body, /PRIVATE_BAD_ID|broken/);
    assert.equal(letter.order.at(-1).url, './?lang=ko#returned-letter');
  }
});

test('letter redirects immediately even when fetch is missing, throws, rejects or never settles', async () => {
  for (const network of ['missing', 'throw', 'reject', 'pending']) {
    const letter = openLetter({network});
    assert.equal(letter.order.filter(x => x.action === 'redirect').length, 1, network);
    assert.equal(letter.order.at(-1).url, './?lang=ko#returned-letter');
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('letter preserves a no-JavaScript redirect and bilingual manual link without racing the telemetry script', () => {
  const withoutFallback = letterHTML.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
  assert.doesNotMatch(withoutFallback, /<meta[^>]+http-equiv=["']refresh/i);
  assert.match(letterHTML, /<noscript>\s*<meta[^>]+http-equiv="refresh"[^>]+url=\.\/#returned-letter[^>]*>\s*<\/noscript>/i);
  assert.match(letterHTML, /<a href="\.\/#returned-letter">반송된 편지 열기 · Open The Returned Letter<\/a>/);
});


// pt49.1: identical first-language selection on both entry pages.
const languageCases = [
  {name: 'URL English overrides Korean storage and browser', search: '?lang=en', stored: '"ko"', browser: {languages: ['ko-KR']}, expected: 'en', persist: true},
  {name: 'URL Korean overrides English storage and browser', search: '?lang=ko&from=PRIVATE_URL', stored: '"en"', browser: {language: 'en-US'}, expected: 'ko', persist: true},
  {name: 'valid decoded URL values work', search: '?lang=%65n', stored: '"ko"', expected: 'en', persist: true},
  {name: 'invalid URL falls through to saved Korean', search: '?lang=fr', stored: '"ko"', browser: {languages: ['en-US']}, expected: 'ko'},
  {name: 'empty URL falls through to saved English', search: '?lang=', stored: '"en"', browser: {language: 'ko-KR'}, expected: 'en'},
  {name: 'saved English overrides Korean browser', stored: '"en"', browser: {languages: ['ko-KR']}, expected: 'en'},
  {name: 'saved Korean overrides English browser', stored: '"ko"', browser: {language: 'en-GB'}, expected: 'ko'},
  {name: 'Korean primary browser language', browser: {languages: ['ko-KR', 'en-US'], language: 'en-US'}, expected: 'ko'},
  {name: 'English primary wins over secondary Korean', browser: {languages: ['en-US', 'ko-KR'], language: 'ko-KR'}, expected: 'en'},
  {name: 'other languages default to English', browser: {languages: ['fr-FR', 'ko']}, expected: 'en'},
  {name: 'empty languages falls back to language', browser: {languages: [], language: 'ko-KR'}, expected: 'ko'},
  {name: 'language alone works case insensitively', browser: {language: 'KO-kr'}, expected: 'ko'},
  {name: 'malformed JSON falls through', stored: '{broken', browser: {languages: ['en-US']}, expected: 'en'},
  {name: 'unsupported saved language falls through', stored: '"ja"', browser: {language: 'ko'}, expected: 'ko'},
  {name: 'non-string saved value falls through', stored: '{"lang":"ko"}', browser: {language: 'en'}, expected: 'en'},
  {name: 'browser with no usable language defaults to English', browser: {}, expected: 'en'},
  {name: 'no navigator defaults to Korean', expected: 'ko'},
  {name: 'no navigator still honors valid saved language', stored: '"en"', expected: 'en'}
];
for (const page of ['index', 'letter']) {
  test(`${page}: URL > saved language > primary browser language > no-navigator fallback`, () => {
    for (const row of languageCases) {
      const data = new Map(row.stored === undefined ? [] : [['aduventure_lang', row.stored]]);
      let event;
      if (page === 'index') {
        const g = game({sceneKey: null, lang: null, data, search: row.search, browser: row.browser});
        g.render();
        event = g.events('page_open')[0];
        assert.equal(g.doc.documentElement.lang, row.expected, row.name + ': UI');
        assert.match(g.doc.title, new RegExp('^' + (row.expected === 'en' ? 'Aduventure' : '어두밴처')));
      } else {
        const g = openLetter({data, search: row.search, browser: row.browser});
        event = JSON.parse(g.sent[0].payload.extra);
        assert.equal(g.order.at(-1).url, `./?lang=${row.expected}#returned-letter`, row.name + ': redirect');
      }
      assert.equal(event.lang, row.expected, row.name + ': telemetry');
      assert.equal(data.get('aduventure_lang'), row.persist ? JSON.stringify(row.expected) : row.stored, row.name + ': storage');
      assert.doesNotMatch(JSON.stringify(event), /PRIVATE_URL|fr-FR|ko-KR|broken/);
    }
  });
}

test('explicit URL language persists for later direct visits without a language query', () => {
  for (const lang of ['ko', 'en']) for (const page of ['index', 'letter']) {
    const opposite = lang === 'en' ? 'ko' : 'en';
    const data = new Map([['aduventure_lang', JSON.stringify(opposite)]]);
    if (page === 'index') game({sceneKey: null, lang: null, data, search: `?lang=${lang}`}).render();
    else openLetter({data, search: `?lang=${lang}`});
    const reopened = game({sceneKey: null, lang: null, data, browser: {language: opposite}});
    reopened.render();
    assert.equal(reopened.doc.documentElement.lang, lang);
    assert.equal(reopened.events('page_open')[0].lang, lang);
    const redirected = openLetter({data, browser: {language: opposite}});
    assert.equal(redirected.order.at(-1).url, `./?lang=${lang}#returned-letter`);
  }
});

test('letter preserves resolved language through redirects when storage is blocked', () => {
  for (const lang of ['ko', 'en']) for (const withQuery of [false, true]) {
    const letter = openLetter({storageBlocked: true, search: withQuery ? `?lang=${lang}` : '', browser: {language: lang}});
    const url = new URL(letter.order.at(-1).url, 'https://example.test/aduventure/letter.html');
    const index = game({sceneKey: null, lang: null, storageBlocked: true, search: url.search, hash: url.hash,
      browser: {language: lang === 'ko' ? 'en' : 'ko'}});
    index.render();
    assert.equal(index.doc.documentElement.lang, lang);
    assert.equal(JSON.parse(letter.sent[0].payload.extra).lang, lang);
    assert.equal(index.events('page_open')[0].lang, lang);
    assert.equal(index.events('page_open')[0].entry, 'returned-letter');
  }
});

test('letter keeps the resolved English redirect on all telemetry failure paths', async () => {
  for (const network of ['missing', 'throw', 'reject', 'pending']) {
    const letter = openLetter({network, storageBlocked: true, search: '?lang=en', browser: {language: 'ko-KR'}});
    assert.equal(letter.order.at(-1).url, './?lang=en#returned-letter');
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('URL initialization does not undo in-page language toggles or duplicate page_open', () => {
  const data = new Map();
  const g = game({sceneKey: null, lang: null, data, search: '?lang=en', browser: {language: 'ko-KR'}});
  g.render();
  assert.equal(g.doc.documentElement.lang, 'en');
  nodes(g.render()).find(n => n.props['aria-label'] === 'language').props.onClick();
  g.render(); g.render();
  assert.equal(g.doc.documentElement.lang, 'ko');
  assert.equal(data.get('aduventure_lang'), '"ko"');
  assert.equal(g.events('page_open').length, 1);
  assert.equal(g.events('page_open')[0].lang, 'en');
});

test('pt50 build tags agree with both static page titles', () => {
  const build = game({sceneKey: null}).run('BUILD');
  assert.equal(build, 'v0.7.3-pt50');
  assert.ok(html.match(/<title>([^<]*)<\/title>/)[1].includes(build));
  assert.ok(letterHTML.match(/<title>([^<]*)<\/title>/)[1].includes(build));
});

// pt50: the first actionable control on the main opening, before class selection.
const openingAction = (g, action) => nodes(g.render()).find(n => {
  const p = n.props;
  if (action === 'lie') return p.className === 'choice primaryChoice';
  if (action === 'believe') return n.type === 'button' && text(n) === g.run(`UI.recordBelieve.${g.doc.documentElement.lang || 'en'}`);
  if (action === 'case_letter') return p.className === 'or-entry';
  if (action === 'case_order') return p.className === 'or-entry uo-entry';
  if (action === 'rules') return n.type === 'button' && p.title === g.run(`UI.rulesTitle.${g.doc.documentElement.lang || 'en'}`);
  if (action === 'lang') return p['aria-label'] === 'language';
  if (action === 'feedback') return n.type === 'button' && text(n) === '🗒';
  if (action === 'case_board') return p['aria-label'] === 'case board';
  if (action === 'sound') return n.type === 'button' && ['🔊', '🔇'].includes(text(n));
  if (action === 'numbers') return p['aria-label'] === 'numbers';
  if (action === 'more') return p.className === 'hMoreBtn';
  if (action === 'other_cases') return n.type === 'summary' && /Other cases|다른 사건/.test(text(n));
  if (action === 'rule_mode') return n.type === 'select' && p.className === 'hMore';
  if (action === 'credits') return n.type === 'summary' && text(n).includes('v0.7.3-pt50');
});
for (const lang of ['en', 'ko']) {
  test(`${lang}: every main-opening control emits the first_click page envelope with fixed action and seconds`, () => {
    for (const action of ['lie', 'believe', 'case_letter', 'case_order', 'rules', 'lang', 'feedback', 'case_board', 'sound', 'numbers', 'more', 'other_cases', 'rule_mode', 'credits']) {
      const data = new Map([['aduventure_numbers', 'true']]);
      if (action.startsWith('case_') && action !== 'case_board') data.set('aduventure_badges', '["1pf"]');
      const g = game({sceneKey: null, lang, data, search: '?from=PRIVATE_URL'});
      const control = openingAction(g, action); assert.ok(control, action);
      g.tick(2750);
      control.props.onClick();
      g.render();
      const opened = g.events('page_open')[0], events = g.events('first_click');
      assert.equal(events.length, 1, action);
      assert.deepEqual(events[0], {...opened, first_click: action, dwell_seconds: 2.75}, action);
      const sent = g.sent.find(x => x.payload.text === 'first_click');
      assert.deepEqual(Object.keys(sent.payload).sort(), ['extra', 'scene', 'text', 'type', 'who']);
      assert.equal(sent.payload.type, 'telemetry'); assert.equal(sent.payload.scene, 'index.html');
      assert.equal(sent.payload.who, opened.player_id); assert.equal(sent.keepalive, true);
      assert.ok(Buffer.byteLength(sent.payload.extra, 'utf8') <= 950);
      assert.equal(events[0].run_id, undefined);
      assert.equal(g.events('run_start').length, 0, 'opening actions never create a fake game run');
      assert.doesNotMatch(JSON.stringify(events[0]), /PRIVATE_URL|PRIVATE_TEST_NAME/);
    }
  });
}
test('keyboard-only rule selection also counts once, before the next opening action', () => {
  const g = game({sceneKey: null, data: new Map([['aduventure_numbers', 'true']])});
  openingAction(g, 'rule_mode').props.onChange({target: {value: 'simple2d6'}});
  openingAction(g, 'believe').props.onClick();
  assert.equal(g.events('first_click').length, 1);
  assert.equal(g.events('first_click')[0].first_click, 'rule_mode');
});
test('first-click dwell excludes hidden tabs, pagehide and time routed away; rerenders do not reset it', () => {
  const g = game({sceneKey: null});
  g.render(); g.tick(1000); g.hidden(true); g.tick(10000); g.render(); g.hidden(false);
  g.tick(400); g.pagehide(); g.tick(7000); g.pageshow();
  g.tick(600); g.hashchange('#returned-letter'); g.render(); g.tick(8000);
  g.hashchange(''); g.render(); g.tick(250);
  openingAction(g, 'believe').props.onClick();
  assert.equal(g.events('first_click')[0].dwell_seconds, 2.25);
});
test('first action is fixed across repeated clicks, language changes, rules, class selection and restart', () => {
  const g = game({sceneKey: null});
  const langClick = openingAction(g, 'lang').props.onClick;
  g.tick(500); langClick(); langClick(); g.render();
  assert.equal(g.events('first_click')[0].lang, 'en', 'record the language before toggling');
  openingAction(g, 'rules').props.onClick(); g.render();
  openingAction(g, 'lie').props.onClick();
  nodes(g.render()).find(n => n.props.className === 'card').props.onClick(); g.render();
  g.run('testGoto("ending")');
  nodes(g.render()).find(n => n.type === 'button' && n.props.className === 'restart').props.onClick();
  openingAction(g, 'believe').props.onClick(); g.render();
  assert.equal(g.events('first_click').length, 1);
  assert.equal(g.events('first_click')[0].first_click, 'lang');
  assert.equal(g.events('first_click')[0].dwell_seconds, 0.5);
});
test('opening the other-cases fold wins over the later side-case button as the first click', () => {
  const g = game({sceneKey: null});
  openingAction(g, 'other_cases').props.onClick();
  openingAction(g, 'case_letter').props.onClick(); g.render();
  assert.equal(g.events('first_click').length, 1);
  assert.equal(g.events('first_click')[0].first_click, 'other_cases');
});
test('direct case links stay immediate and never become main-opening first clicks, even after returning', () => {
  for (const lang of ['ko', 'en']) for (const [hash, component] of [['#returned-letter', 'OwnRecordTrial'], ['#unsigned-order', 'UnsignedOrderTrial']]) {
    const g = game({sceneKey: null, lang, hash});
    assert.ok(nodes(g.render()).some(n => n.type.name === component));
    g.tick(9000); g.hashchange(''); g.render();
    openingAction(g, 'lie').props.onClick(); g.render();
    assert.equal(g.events('first_click').length, 0);
    assert.equal(g.events('page_open').length, 1);
    assert.equal(g.events('page_open')[0].entry, hash.slice(1));
  }
});
test('continue counts only at the opening, and a reload has its own first click and visit', () => {
  const first = game();
  assert.equal(first.events('first_click')[0].first_click, 'continue');
  assert.equal(first.events('first_click')[0].visit_id, first.events('page_open')[0].visit_id);
  nodes(first.render()).find(n => n.props['aria-label'] === 'language').props.onClick(); first.render();
  assert.equal(first.events('first_click').length, 1);
  const loaded = game({data: first.data});
  assert.equal(loaded.events('first_click').length, 1);
  assert.equal(loaded.events('first_click')[0].player_id, first.events('first_click')[0].player_id);
  assert.notEqual(loaded.events('first_click')[0].visit_id, first.events('first_click')[0].visit_id);
});
test('unmeasured dwell is null and blocked storage or failed telemetry never block opening actions', async () => {
  for (const effects of [false, true]) for (const network of ['ok', 'throw', 'reject']) {
    const g = game({sceneKey: null, effects, storageBlocked: true, network});
    openingAction(g, 'lie').props.onClick();
    assert.ok(nodes(g.render()).some(n => n.props.className === 'card'));
    if (network === 'ok') {
      assert.equal(g.events('first_click').length, 1);
      assert.equal(g.events('first_click')[0].dwell_seconds, effects ? 0 : null);
    }
  }
  await new Promise(resolve => setImmediate(resolve));
});
test('main run starts and chapter clears join their page visit while resumed clears retain the original run', () => {
  const first = game({sceneKey: null});
  openingAction(first, 'believe').props.onClick();
  nodes(first.render()).find(n => n.props.className === 'card').props.onClick(); first.render();
  const started = first.events('run_start')[0];
  assert.equal(started.visit_id, first.events('page_open')[0].visit_id);
  const resumed = game({sceneKey: 'intro', data: first.data});
  resumed.run('testGoto("ending")'); resumed.render();
  const clear = resumed.events('chapter_clear')[0];
  assert.equal(clear.chapter, 1); assert.equal(clear.run_id, started.run_id);
  assert.equal(clear.visit_id, resumed.events('page_open')[0].visit_id);
  assert.notEqual(clear.visit_id, started.visit_id);
  resumed.run('testGoto("ending2")'); resumed.render();
  const restart = nodes(resumed.render()).find(n => n.type === 'button' && String(n.props.onClick).includes('restart("intro2")'));
  assert.ok(restart); restart.props.onClick(); resumed.render();
  assert.equal(resumed.events('run_start')[0].visit_id, clear.visit_id);
  assert.notEqual(resumed.events('run_start')[0].run_id, started.run_id);
});
