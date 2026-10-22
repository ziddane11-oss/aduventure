const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
const plain = x => JSON.parse(JSON.stringify(x));
function harness(saved, prior, hash = '#unsigned-order') {
  const data = new Map([['aduventure_save', '{"pc":{"name":"unchanged"}}']]);
  if (saved) data.set('aduventure_unsigned_order_v1', JSON.stringify(saved));
  if (prior) data.set('aduventure_own_record_v1', JSON.stringify(prior));
  const states = [], effects = [];
  let index = 0;
  const ctx = vm.createContext({console, Date, Math, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    document: {documentElement: {}}, window: {location: {hash, pathname: '/aduventure/', search: ''}, addEventListener() {}},
    localStorage: {getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k)},
    React: {Fragment: 'fragment', createElement: (type,props,...children) => ({type,props:props || {},children}),
      useState(initial) { const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v]; },
      useRef(initial) { const i = index++; if (!(i in states)) states[i] = {current:initial}; return states[i]; },
      useEffect(fn) { effects.push(fn); }
    }});
  vm.runInContext(app, ctx);
  vm.runInContext('window.history = {pushState(a,b,url){window.location.hash=url;},replaceState(a,b,url){window.location.hash="";}}', ctx);
  const run = c => vm.runInContext(c, ctx);
  const render = (lang='en', component='UnsignedOrderTrial') => {
    index = 0; effects.length = 0;
    const tree = run(`${component}({lang:${JSON.stringify(lang)},onLanguage(){},onExit(){},onPrevious(){},onNext(){},sound:false})`);
    if (component === 'UnsignedOrderTrial' || component === 'OwnRecordTrial') effects.splice(0).forEach(fn => fn());
    return tree;
  };
  return {run, render, data, move:(s,a) => plain(run(`unsignedOrderMove(${JSON.stringify(s)},${JSON.stringify(a)})`))};
}
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n,...n.children.flatMap(nodes)];
const text = n => n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(text).join('') : typeof n === 'object' ? text(n.children) : String(n);
function signed(g, authority='equal', relief='strict') {
  let s = g.run('newUnsignedOrder()');
  for (const [field,value] of Object.entries({authority,relief})) s = g.move(s,{type:'pick',field,value});
  s = g.move(s,{type:'signature',value:'기록관 <QA>'});
  return g.move(s,{type:'sign'});
}
function cite(g,s,clause,field) {
  s = g.move(s,{type:'panel',value:'challenge'});
  s = g.move(s,{type:'cite',kind:'clause',value:clause});
  s = g.move(s,{type:'cite',kind:'field',value:field});
  return g.move(s,{type:'challenge'});
}
function amend(g,s,field,value) {
  s = g.move(s,{type:'panel',value:'amend'});
  s = g.move(s,{type:'revise',field,value});
  return g.move(s,{type:'amend'});
}

test('all four signed rules govern both medicine and the chief; every route can finish', () => {
  const g = harness();
  for (const authority of ['equal','seal']) for (const relief of ['strict','witness']) {
    let s = signed(g,authority,relief);
    assert.equal(s.stage,'dawn');
    s = g.move(s,{type:'dawn'});
    const proof = cite(g,s,'relief','witness');
    assert.equal(proof.stage,relief === 'witness' ? 'order' : 'clinic');
    s = relief === 'witness' ? proof : g.move(s,{type:'wait'});
    assert.equal(s.medicine,relief === 'witness' ? 'released' : 'late');
    const response = cite(g,s,'signature','signature');
    assert.equal(response.stage,authority === 'equal' ? 'end' : 'order');
    if (authority === 'equal') assert.equal(response.result,'held');
    const obeyed = g.move(s,{type:'comply'});
    assert.equal(obeyed.stage,'end');
    assert.equal(obeyed.result,'obeyed');
    assert.deepEqual(plain(g.run(`restoreUnsignedOrder(${JSON.stringify(obeyed)})`)),obeyed);
  }
});

test('a correction changes only pending transfers; the exact original, signature and prior delay remain', () => {
  const g = harness();
  let s = g.move(signed(g,'seal','strict'),{type:'dawn'});
  const original = JSON.stringify(s.original);
  const early = amend(g,s,'relief','witness');
  assert.equal(cite(g,early,'relief','witness').medicine,'released');
  s = g.move(s,{type:'wait'});
  s = amend(g,s,'authority','equal');
  assert.equal(s.medicine,'late');
  assert.equal(JSON.stringify(s.original),original);
  assert.equal(s.signature,'기록관 <QA>');
  assert.equal(s.amendments[0].at,'order');
  s = cite(g,s,'authority','signature');
  assert.equal(s.result,'held');
  assert.equal(s.medicine,'late');
  assert.deepEqual(g.move(s,{type:'wait'}),s,'No retroactive change after completion');
});

test('claims need two selected lines; irrelevant evidence cannot win and failure gives a reason', () => {
  const g = harness(); let s = g.move(g.move(signed(g),{type:'dawn'}),{type:'wait'});
  assert.equal(g.move(s,{type:'challenge'}).stage,'order');
  s = cite(g,s,'relief','purpose');
  assert.equal(s.stage,'order'); assert.ok(s.notice);
  assert.equal(cite(g,s,'signature','signature').result,'held');
});

test('invalid saves reset safely; missing signatures, impossible outcomes and unknown actions do not advance', () => {
  const g = harness(), fresh = plain(g.run('newUnsignedOrder()'));
  for (const raw of [null,{}, {...fresh,v:2}, {...fresh,stage:'order'}, {...fresh,stage:'end',result:'held'}])
    assert.equal(g.run(`restoreUnsignedOrder(${JSON.stringify(raw)}).stage`),'draft');
  for (const a of [{type:'sign'},{type:'dawn'},{type:'wait'},{type:'comply'},{type:'pick',field:'authority',value:'whatever'}])
    assert.deepEqual(g.move(fresh,a),fresh);
  const s = g.move(g.move(signed(g,'seal'),{type:'dawn'}),{type:'wait'});
  assert.equal(g.run(`restoreUnsignedOrder(${JSON.stringify({...s,stage:'end',result:'held'})}).stage`),'draft');
});

test('draft, comparison and correction survive reload and language changes without touching other saves', () => {
  const g = harness(); let s = g.move(signed(g,'seal'),{type:'dawn'});
  s = g.move(s,{type:'panel',value:'amend'}); s = g.move(s,{type:'revise',field:'relief',value:'witness'});
  const h = harness(s); h.render('ko');
  const saved = h.data.get('aduventure_unsigned_order_v1');
  h.render('en'); assert.equal(h.data.get('aduventure_unsigned_order_v1'),saved);
  assert.equal(h.data.get('aduventure_save'),'{"pc":{"name":"unchanged"}}');
  assert.equal(JSON.parse(saved).revision.relief,'witness');
  assert.deepEqual(plain(h.run(`restoreUnsignedOrder(${saved})`)),JSON.parse(saved));
});

test('the first case carries its signature and actual credential outcome, never pretending suspension was lifted', () => {
  const g = harness();
  const prior = {v:1,stage:'end',draft:{status:'refused',identity:'sealed',attachment:'returned'},signature:'Pip tester',
    original:{status:'refused',identity:'sealed',attachment:'returned'},revision:{status:'refused',identity:'sealed',attachment:'returned'},route:'copy',result:'maintain',previous:null};
  const h = harness(null,prior); const tree = h.render();
  const s = JSON.parse(h.data.get('aduventure_unsigned_order_v1'));
  assert.equal(s.signature,'Pip tester'); assert.equal(s.prior.badge,false);
  assert.ok(text(tree).includes(h.run('UNSIGNED_ORDER_COPY.priorSuspended.en')));
  assert.equal(h.data.get('aduventure_own_record_v1'),JSON.stringify(prior));
  const incomplete = g.run(`newUnsignedOrder(${JSON.stringify({...prior,stage:'review'})})`);
  assert.equal(incomplete.prior,null);
});

test('all copy is bilingual; no reversal hint appears before the unsigned order arrives', () => {
  const g = harness();
  const copy = g.run('UNSIGNED_ORDER_COPY');
  for (const [id,c] of Object.entries(copy)) {
    assert.ok(c.ko && c.en,id); assert.doesNotMatch(c.en,/[가-힣]/,id);
  }
  const draft = text(g.render());
  assert.ok(!draft.includes(copy.heldEnding.en));
  assert.ok(!draft.includes(copy.orderText.en));
  assert.equal(nodes(g.render()).some(n => n.props['data-proof-field']),false);
});

test('the standalone route and first-case ending provide a real second-case entry', () => {
  const g = harness();
  assert.ok(nodes(g.render('en','CRPG')).some(n => typeof n.type === 'function' && n.type.name === 'UnsignedOrderTrial'));
  const main = harness(null,null,'');
  const entry = nodes(main.render('en','CRPG')).find(n => n.props.className === 'or-entry uo-entry');
  assert.ok(entry); entry.props.onClick(); assert.equal(main.run('window.location.hash'),'#unsigned-order');
  const first = g.run(`(() => { let s = newOwnRecord();
    for (const [field,value] of Object.entries({status:'delayed',identity:'sealed',attachment:'filed'})) s = ownRecordMove(s,{type:'pick',field,value});
    for (const a of [{type:'signature',value:'QA'},{type:'sign'},{type:'turn'},{type:'route',route:'badge'},{type:'review'},{type:'finish',result:'maintain'}]) s = ownRecordMove(s,a);
    return s; })()`);
  const letter = harness(null,first);
  const ending = letter.render('en','OwnRecordTrial');
  const next = nodes(ending).find(n => n.props['data-action'] === 'nextCase');
  assert.ok(next); assert.equal(typeof next.props.onClick,'function');
});

test('real document controls can save a correction, pair lines and finish without outcome previews', () => {
  const g = harness(); let s = g.move(g.move(signed(g,'equal','strict'),{type:'dawn'}),{type:'wait'});
  const h = harness(s);
  const press = id => {const n = nodes(h.render()).find(n => n.props['data-action'] === id); assert.ok(n,id); n.props.onClick();};
  press('challengeOpen');
  let tree = h.render();
  nodes(tree).find(n => n.props['data-proof-clause'] === 'signature').props.onClick();
  tree = h.render(); nodes(tree).find(n => n.props['data-proof-field'] === 'signature').props.onClick();
  press('challengeSubmit'); h.render();
  assert.equal(JSON.parse(h.data.get('aduventure_unsigned_order_v1')).result,'held');
});

test('rendered amendment controls preserve the failed objection, correct the rule, and accept a new objection', () => {
  const g = harness(); let s = g.move(g.move(signed(g,'seal','strict'),{type:'dawn'}),{type:'wait'});
  s = cite(g,s,'signature','signature');
  const h = harness(s);
  const press = id => {const n = nodes(h.render()).find(n => n.props['data-action'] === id); assert.ok(n,id); n.props.onClick();};
  assert.ok(text(h.render()).includes(g.run('UNSIGNED_ORDER_COPY.chiefSealNotice.en')));
  press('close'); press('amendOpen');
  const equal = nodes(h.render()).find(n => n.props['data-pick'] === 'authority:equal'); equal.props.onChange();
  const before = h.data.get('aduventure_unsigned_order_v1');
  h.render('ko'); assert.equal(JSON.parse(h.data.get('aduventure_unsigned_order_v1')).revision.authority,'equal');
  press('amend'); h.render();
  const corrected = JSON.parse(h.data.get('aduventure_unsigned_order_v1'));
  assert.equal(corrected.original.authority,'seal'); assert.equal(corrected.amendments[0].clauses.authority,'equal');
  assert.equal(corrected.medicine,'late');
  press('challengeOpen');
  nodes(h.render()).find(n => n.props['data-proof-clause'] === 'authority').props.onClick();
  nodes(h.render()).find(n => n.props['data-proof-field'] === 'seal').props.onClick();
  h.render();
  const reload = harness(JSON.parse(h.data.get('aduventure_unsigned_order_v1')));
  assert.equal(nodes(reload.render('ko')).find(n => n.props['data-proof-clause'] === 'authority').props['aria-pressed'],true);
  const submit = nodes(reload.render('en')).find(n => n.props['data-action'] === 'challengeSubmit'); submit.props.onClick(); reload.render();
  assert.equal(JSON.parse(reload.data.get('aduventure_unsigned_order_v1')).result,'held');
  assert.ok(before,'Original pending save existed');
});
