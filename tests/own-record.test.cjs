const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
function harness(saved, hash = '') {
  const data = new Map([['aduventure_save', '{"pc":{"name":"untouched"}}']]);
  if (saved) data.set('aduventure_own_record_v1', JSON.stringify(saved));
  const states = [], effects = [];
  let index = 0;
  const ctx = vm.createContext({
    console, Date, Math, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    window: {location:{hash,pathname:'/aduventure/',search:''},addEventListener() {}}, document: {documentElement: {}},
    localStorage: {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)},
    React: {
      Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) { const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v]; },
      useRef(initial) { const i = index++; if (!(i in states)) states[i] = {current: initial}; return states[i]; },
      useEffect(fn) { effects.push(fn); }
    }
  });
  vm.runInContext(app, ctx);
  vm.runInContext('window.history = {pushState(a,b,url) { window.location.hash = url; }}', ctx);
  const run = c => vm.runInContext(c, ctx);
  const render = (lang = 'en') => { index = 0; effects.length = 0; const tree = run(`OwnRecordTrial({lang: '${lang}', onLanguage(){}, onExit(){}, sound: false})`); effects.splice(0).forEach(fn => fn()); return tree; };
  const mainRender = () => { index = 0; effects.length = 0; return run('CRPG()'); };
  return {run, render, mainRender, data, move: (s, a) => JSON.parse(JSON.stringify(run(`ownRecordMove(${JSON.stringify(s)}, ${JSON.stringify(a)})`)))};
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

test('entering through the title records the case URL, so a reload opens the same experience', () => {
  const g = harness();
  const entry = nodes(g.mainRender()).find(n => n.props.className === 'or-entry');
  entry.props.onClick();
  assert.equal(g.run('window.location.hash'), '#returned-letter');
  const loaded = harness(null, g.run('window.location.hash'));
  assert.ok(nodes(loaded.mainRender()).some(n => typeof n.type === 'function' && n.type.name === 'OwnRecordTrial'));
});

test('first signing supplies evidence without outcome spoilers; the next day and review reveal consequences', () => {
  for (const lang of ['ko','en']) {
    const g = harness();
    const copy = g.run('OWN_RECORD_COPY');
    const draft = text(g.render(lang));
    assert.ok(draft.includes(copy.fact2[lang]));
    assert.ok(draft.includes(copy.rule[lang]));
    for (const key of ['refused','delayed','public','sealed','filed','returned']) {
      assert.ok(draft.includes(copy[key][lang]), 'The actual sentence remains available');
      assert.equal(draft.includes(copy[key+'Hint'][lang]), false, 'No advance outcome annotation: '+key);
    }
    const mornings = [];
    for (const status of ['refused','delayed']) {
      let s = prepared(g, {status,identity:'sealed',attachment:'returned'});
      mornings.push(text(harness({...s,stage:'turn'}).render(lang)));
      const door = text(harness(s).render(lang));
      assert.ok(door.includes(copy[status === 'refused' ? 'badgeClosed' : 'badgeOpen'][lang]));
      s = g.move(s,{type:'route',route:'copy'}); s = g.move(s,{type:'review'});
      const review = text(harness(s).render(lang));
      assert.ok(review.includes(copy.refusedHint[lang]));
      assert.ok(review.includes(copy.delayedHint[lang]));
    }
    assert.notEqual(mornings[0],mornings[1], 'The next morning reflects the actual signed sentence');
    // The first morning view shows Pip's presence or absence; it does not pre-explain the badge rule.
    for (const morning of mornings) {
      assert.equal(morning.includes(copy.refusedHint[lang]),false);
      assert.equal(morning.includes(copy.delayedHint[lang]),false);
    }
  }
});

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

test('disclosure has a cost the player lives through before the review, not only in the ending', () => {
  for (const lang of ['ko','en']) {
    const g = harness();
    const copy = g.run('OWN_RECORD_COPY');
    const seen = {};
    for (const identity of ['public','sealed']) {
      const other = identity === 'public' ? 'Sealed' : 'Public';
      const own = identity === 'public' ? 'Public' : 'Sealed';
      let s = prepared(g, {status:'delayed', identity, attachment:'returned'});
      const morning = text(harness({...s, stage:'turn'}).render(lang));
      assert.ok(morning.includes(copy['board'+own][lang]), 'The next morning shows the posted or sealed notice');
      assert.equal(morning.includes(copy['board'+other][lang]), false);
      for (const route of ['badge','copy']) {
        const letter = text(harness(g.move(s, {type:'route', route})).render(lang));
        assert.ok(letter.includes(copy['bern'+own][lang]), 'Bern reacts to the disclosure on every route: '+route);
        assert.equal(letter.includes(copy['bern'+other][lang]), false);
      }
      seen[identity] = morning;
    }
    assert.notEqual(seen.public, seen.sealed);
    const draft = text(harness().render(lang));
    for (const key of ['boardPublic','boardSealed','bernPublic','bernSealed']) assert.equal(draft.includes(copy[key][lang]), false, 'No spoiler before signing: '+key);
  }
});

test('the ending offers a shareable record of the signed sentences in the chosen language', () => {
  const g = harness();
  let s = prepared(g, {status:'refused', identity:'public', attachment:'returned'});
  s = g.move(s, {type:'route', route:'witness'}); s = g.move(s, {type:'review'});
  s = g.move(s, {type:'revise', field:'attachment', value:'filed'}); s = g.move(s, {type:'finish', result:'amend'});
  const copy = g.run('OWN_RECORD_COPY');
  for (const lang of ['ko','en']) {
    const share = g.run(`ownRecordShareText(${JSON.stringify(s)}, '${lang}', 'https://example.test/aduventure/#returned-letter')`);
    assert.ok(share.includes(copy.title[lang]));
    assert.ok(share.includes(copy.refused[lang]) && share.includes(copy.public[lang]) && share.includes(copy.filed[lang]), 'The corrected sentences are shared');
    assert.ok(share.includes(copy.amended[lang]));
    assert.ok(share.includes(copy.petitionYes[lang]));
    assert.ok(share.endsWith('https://example.test/aduventure/#returned-letter'));
    assert.equal(share.includes('테스터'), false, 'The private signature is not shared');
    if (lang === 'en') assert.doesNotMatch(share, /[가-힣]/);
  }
  const end = nodes(harness(s).render('ko'));
  assert.ok(end.some(n => n.props['data-action'] === 'share'), 'The end screen has a share button');
  for (const stage of ['draft','turn','courier']) assert.equal(nodes(harness({...prepared(g), stage}).render('ko')).some(n => n.props['data-action'] === 'share'), false);
});

test('sharing uses a stable public link and falls back to selectable text when the clipboard is blocked', async () => {
  const g = harness();
  let s = prepared(g, {status:'delayed', identity:'sealed', attachment:'filed'});
  s = g.move(s, {type:'route', route:'appendix'}); s = g.move(s, {type:'review'}); s = g.move(s, {type:'finish', result:'maintain'});
  const end = harness(s);
  const url = end.run('ownRecordShareUrl()');
  assert.match(url, /^https:\/\//, 'Never the embedding page (e.g. an itch.io iframe) or localhost');
  end.run('window.ADU_SHARE_URL = "https://someone.itch.io/returned-letter"');
  assert.equal(end.run('ownRecordShareUrl()'), 'https://someone.itch.io/returned-letter');
  // No navigator in this context: the share must fail gracefully and expose the text instead.
  await nodes(end.render('ko')).find(n => n.props['data-action'] === 'share').props.onClick();
  const after = nodes(end.render('ko'));
  const box = after.find(n => n.type === 'textarea');
  assert.ok(box, 'A selectable copy of the share text appears');
  assert.ok(box.props.value.endsWith('https://someone.itch.io/returned-letter'));
  assert.ok(text(after).includes(end.run('OWN_RECORD_COPY.shareManual.ko')));
});
