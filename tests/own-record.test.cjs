const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
function harness(saved) {
  const data = new Map([['aduventure_save', '{"pc":{"name":"untouched"}}']]);
  if (saved) data.set('aduventure_own_record_v1', JSON.stringify(saved));
  const states = [], effects = [];
  let index = 0;
  const ctx = vm.createContext({
    console, Date, Math, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    window: {addEventListener() {}}, document: {documentElement: {}},
    localStorage: {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)},
    React: {
      Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) { const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v]; },
      useRef(initial) { const i = index++; if (!(i in states)) states[i] = {current: initial}; return states[i]; },
      useEffect(fn) { effects.push(fn); }
    }
  });
  vm.runInContext(app, ctx);
  const run = c => vm.runInContext(c, ctx);
  const render = (lang = 'en') => { index = 0; effects.length = 0; const tree = run(`OwnRecordTrial({lang: '${lang}', onLanguage(){}, onExit(){}, sound: false})`); effects.splice(0).forEach(fn => fn()); return tree; };
  return {run, render, data, move: (s, a) => JSON.parse(JSON.stringify(run(`ownRecordMove(${JSON.stringify(s)}, ${JSON.stringify(a)})`)))};
}
function prepared(g, choices = {status:'refused', identity:'sealed', attachment:'returned'}) {
  let s = g.run('newOwnRecord()');
  for (const [field, value] of Object.entries(choices)) s = g.move(s, {type:'pick', field, value});
  s = g.move(s, {type:'signature', value:'테스터 <QA>'});
  s = g.move(s, {type:'sign'});
  return g.move(s, {type:'turn'});
}
function nodes(n) { return !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...n.children.flatMap(nodes)]; }
function text(n) { return n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(text).join('') : typeof n === 'object' ? text(n.children) : String(n); }

test('all eight signed reports produce the promised access, with an escape route in every case', () => {
  const g = harness();
  for (const status of ['refused','delayed']) for (const identity of ['public','sealed']) for (const attachment of ['filed','returned']) {
    const s = prepared(g, {status, identity, attachment});
    const access = g.run(`ownRecordAccess(${JSON.stringify(s.original)})`);
    assert.equal(access.badge, status === 'delayed');
    assert.equal(access.witness, identity === 'public');
    assert.equal(access.appendix, attachment === 'filed');
    for (const route of ['badge','witness','appendix']) {
      const next = g.move(s, {type:'route', route});
      assert.equal(next.stage, access[route] ? 'letter' : 'courier');
    }
    assert.equal(g.move(s, {type:'route', route:'copy'}).stage, 'letter');
  }
});

test('unsigned, incomplete, out-of-order and unknown actions cannot advance the story', () => {
  const g = harness(); let s = g.run('newOwnRecord()');
  for (const action of [{type:'sign'}, {type:'turn'}, {type:'finish', result:'amend'}, {type:'route',route:'copy'}, {type:'pick',field:'status',value:'invented'}]) {
    assert.deepEqual(g.move(s, action), JSON.parse(JSON.stringify(s)));
  }
  assert.equal(g.move(s, {type:'signature',value:'  a  b  '}).signature, '  a  b  ');
});

test('an amendment changes permissions, preserves the exact original and cannot undo public exposure', () => {
  const g = harness(); let s = prepared(g, {status:'refused', identity:'public', attachment:'returned'});
  const original = JSON.stringify(s.original);
  s = g.move(s, {type:'route',route:'copy'});
  s = g.move(s, {type:'review'});
  for (const [field,value] of Object.entries({status:'delayed', identity:'sealed', attachment:'filed'})) s = g.move(s, {type:'revise',field,value});
  s = g.move(s, {type:'finish',result:'amend'});
  assert.equal(s.stage, 'end');
  assert.equal(JSON.stringify(s.original), original);
  assert.equal(s.signature, '테스터 <QA>');
  const result = g.run(`ownRecordOutcome(${JSON.stringify(s)})`);
  assert.equal(result.badge, true);
  assert.equal(result.petition, true);
  assert.equal(result.exposed, true);
  assert.equal(result.sealed, true);
});

test('careful first decisions really help; maintaining and deferring have different effects', () => {
  const g = harness();
  for (const result of ['maintain','defer']) {
    let s = prepared(g); s = g.move(s, {type:'route',route:'copy'}); s = g.move(s, {type:'review'}); s = g.move(s, {type:'finish',result});
    const o = g.run(`ownRecordOutcome(${JSON.stringify(s)})`);
    assert.equal(o.badge, result === 'defer');
    assert.equal(o.petition, false, 'A stay does not magically file a returned enclosure');
  }
  let s = prepared(g, {status:'delayed',identity:'sealed',attachment:'filed'});
  s = g.move(s, {type:'route',route:'badge'}); s = g.move(s, {type:'review'});
  assert.equal(g.move(s, {type:'finish',result:'amend'}).stage, 'review', 'An unchanged draft is not an amendment');
  s = g.move(s, {type:'finish',result:'maintain'});
  const o = g.run(`ownRecordOutcome(${JSON.stringify(s)})`);
  assert.equal(o.petition, true); assert.equal(o.badge, true); assert.equal(o.exposed, false);
});

test('returning a previously filed original cannot erase its filing history', () => {
  const g = harness(); let s = prepared(g, {status:'delayed',identity:'sealed',attachment:'filed'});
  s = g.move(s, {type:'route',route:'appendix'}); s = g.move(s, {type:'review'});
  s = g.move(s, {type:'revise',field:'attachment',value:'returned'});
  s = g.move(s, {type:'reread'});
  const restored = JSON.parse(JSON.stringify(g.run(`restoreOwnRecord(${JSON.stringify(s)})`)));
  assert.deepEqual(restored,s, 'Rereading and reloading does not discard the correction draft');
  s = g.move(restored, {type:'review'}); s = g.move(s, {type:'finish',result:'amend'});
  const o = g.run(`ownRecordOutcome(${JSON.stringify(s)})`);
  assert.equal(o.petition,true); assert.equal(o.returnedAfterFiling,true);
});

test('every reachable stage reloads, corrupted saves reset safely, and replay retains a comparison', () => {
  const g = harness(); let s = prepared(g);
  const restore = value => JSON.parse(JSON.stringify(g.run(`restoreOwnRecord(${JSON.stringify(value)})`)));
  assert.deepEqual(restore(s), s);
  for (const action of [{type:'route',route:'copy'},{type:'review'},{type:'finish',result:'defer'}]) { s = g.move(s, action); assert.deepEqual(restore(s), s); }
  const again = g.move(s,{type:'replay'});
  assert.equal(again.stage,'draft'); assert.equal(again.previous.result,'defer'); assert.deepEqual(again.draft,s.original);
  for (const bad of [null, [], {v:42}, {...s, signature:{}}, {...s, original:{status:'bad'}}, {...s, route:'bad'}, {...s, result:null}]) assert.equal(restore(bad).stage,'draft');
});

test('the actual UI signs, blocks a forbidden route, switches language, reloads and preserves the main save', () => {
  const g = harness();
  let tree = g.render('ko');
  for (const [field,value] of Object.entries({status:'refused',identity:'sealed',attachment:'returned'})) {
    nodes(tree).find(n => n.props['data-pick'] === `${field}:${value}`).props.onChange(); tree = g.render('ko');
  }
  nodes(tree).find(n => n.props.id === 'or-signature').props.onChange({target:{value:'Ada'}}); tree = g.render('ko');
  nodes(tree).find(n => n.props['data-action'] === 'sign').props.onClick(); tree = g.render('en');
  assert.doesNotMatch(text(nodes(tree).find(n => n.type === 'main')), /[가-힣]/);
  nodes(tree).find(n => n.props['data-action'] === 'turn').props.onClick(); tree = g.render('en');
  const blocked = nodes(tree).find(n => n.props['data-route'] === 'badge');
  assert.equal(blocked.props['aria-disabled'], true); blocked.props.onClick(); tree = g.render('en');
  assert.match(text(tree), /Ada/); assert.match(text(tree), /refused delivery/);
  assert.equal(JSON.parse(g.data.get('aduventure_own_record_v1')).stage, 'courier');
  const loaded = harness(JSON.parse(g.data.get('aduventure_own_record_v1')));
  assert.match(text(loaded.render('en')), /Ada/);
  nodes(tree).find(n => n.props['data-route'] === 'copy').props.onClick(); tree = g.render('en');
  nodes(tree).find(n => n.props['data-action'] === 'review').props.onClick(); tree = g.render('en');
  nodes(tree).find(n => n.props['data-action'] === 'maintain').props.onClick(); tree = g.render('en');
  assert.doesNotMatch(text(nodes(tree).find(n => n.type === 'main')), /[가-힣]/);
  assert.equal(JSON.parse(g.data.get('aduventure_own_record_v1')).stage, 'end');
  assert.equal(g.data.get('aduventure_save'), '{"pc":{"name":"untouched"}}');
});
