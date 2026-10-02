// pt17 — 붉은 쪽지(비동기 흔적)와 판결이 바꾸는 첫 화면. GAS doGet도 가짜 시트로 실행해 검증한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
const gas = fs.readFileSync(path.join(__dirname, '..', 'gas', 'notes-doGet.gs'), 'utf8');
const HANGUL = /[가-힣]/;
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

function game({sceneKey = 'top', lang = 'en', fetchImpl} = {}) {
  const states = [], posts = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)]]);
  const ctx = vm.createContext({
    console, Date, Math, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    window: {addEventListener() {}}, document: {documentElement: {}},
    fetch: fetchImpl || (async (url, init) => { posts.push({url, init}); return {text: async () => 'ok', json: async () => ({})}; }),
    localStorage: {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)},
    React: {
      Fragment: 'fragment',
      createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) {
        const i = index++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v];
      },
      useRef(initial) { const i = index++; if (!(i in states)) states[i] = {current: initial}; return states[i]; },
      useEffect() {}
    }
  });
  vm.runInContext(app.replace('  const pct = choice =>', `
    globalThis.api = {setNotes, sceneKey};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags: [], ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 140,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA', hp: 12}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  return {render, posts, data, run: code => vm.runInContext(code, ctx), api: () => { render(); return ctx.api; }};
}
const byClass = (tree, c) => nodes(tree).filter(n => n.props.className === c);

test('notes are word combinations only; anything outside the lists is dropped', () => {
  const g = game();
  const grouped = g.run(`groupNotes([
    {scene:'top', s:'ren', v:'doubt', r:'gear', no:120},
    {scene:'top', s:'seon', v:'trust', r:'none', no:121},
    {scene:'top', s:'bern', v:'keep', r:'water', no:122},
    {scene:'top', s:'<b>hi</b>', v:'doubt', r:'gear'},
    {scene:'nowhere', s:'ren', v:'doubt', r:'gear'},
    {scene:'railing', s:'lens', v:'drop'}
  ])`);
  assert.equal(grouped.top.length, 2, 'At most two per scene');
  assert.equal(grouped.railing.length, 1);
  assert.equal(grouped.nowhere, undefined);
  assert.equal(g.run(`noteText({s:'ren', v:'doubt', r:'gear'}, 'en')`), 'Doubt Ren (clue: the gear)');
  assert.equal(g.run(`noteText({s:'ren', v:'doubt', r:'gear'}, 'ko')`), '렌 — 의심해라 (단서: 톱니)');
  assert.equal(g.run(`noteText({s:'lens', v:'keep', r:'none'}, 'en')`), 'Protect the lens');
});

test('without a notes server, the feature stays hidden', () => {
  const tree = game().render();
  assert.equal(byClass(tree, 'noteBtn').length, 0);
  assert.equal(byClass(tree, 'noteCard').length, 0);
});

test('with notes, a scene shows others\' red notes and lets you leave one through the existing pipe', () => {
  const g = game();
  g.api().setNotes({top: [{scene: 'top', s: 'ren', v: 'doubt', r: 'gear', no: 120}]});
  let tree = g.render();
  const card = byClass(tree, 'noteCard')[0];
  assert.equal(text(card), '🩸 Someone in Record No. 120:Doubt Ren (clue: the gear)');
  byClass(tree, 'noteBtn')[0].props.onClick();
  tree = g.render();
  const pickSelects = t => nodes(byClass(t, 'notePick')[0]).filter(n => n.type === 'select');
  const selects = pickSelects(tree);
  assert.equal(selects.length, 3);
  selects[0].props.onChange({target: {value: 'seon'}});
  pickSelects(g.render())[1].props.onChange({target: {value: 'doubt'}});
  pickSelects(g.render())[2].props.onChange({target: {value: 'hand'}});
  tree = g.render();
  assert.equal(text(byClass(tree, 'notePreview')[0]), 'Doubt Seon (clue: the handwriting)');
  nodes(tree).find(n => n.type === 'button' && text(n) === 'Leave the red note').props.onClick();
  const sent = g.posts.map(p => JSON.parse(p.init.body)).find(b => b.type === 'note');
  assert.deepEqual({...sent, extra: JSON.parse(sent.extra)}, {type: 'note', scene: 'top', who: '', text: 'seon.doubt.hand', extra: {s: 'seon', v: 'doubt', r: 'hand', no: 140}});
  tree = g.render();
  assert.equal(byClass(tree, 'noteBtn').length, 0, 'One note per scene per run');
  assert.ok(text(byClass(tree, 'noteSent')[0]).includes('The next adventurer will find it here'));
});

test('loadNotes groups a good response, and gives up quietly when the server only says alive', async () => {
  const g = game({fetchImpl: async () => ({json: async () => ({ok: true, notes: [{scene: 'top', s: 'ren', v: 'trust', r: 'none', no: 3}]})})});
  const ok = await g.run('loadNotes()');
  assert.equal(ok.top[0].s, 'ren');
  const alive = game({fetchImpl: async () => ({json: async () => { throw new SyntaxError('alive'); }})});
  assert.equal(await alive.run('loadNotes()'), null);
});

test('the verdict you reached permanently rewrites the opening record', () => {
  const g = game();
  const rec = v => g.run(`officialRecord('opening', [], 150, ${JSON.stringify(v)})`);
  const none = rec(null);
  assert.equal(none.signer.en, 'Recorded by: Chief Seon');
  const seon = rec({kind: 'accuseSeon', name: 'Duwon', no: 130});
  assert.equal(seon.signer.en, 'Recorded by: Archivist Duwon');
  assert.equal(seon.rebut.en, 'This is a lie too.');
  assert.equal(seon.lines[0].en, 'The first storm under the new chief.');
  const bern = rec({kind: 'accuseBern', name: 'Duwon'});
  assert.match(bern.lines[0].en, /new lighthouse keeper/);
  assert.equal(bern.rebut.en, 'Old Bern never did a thing.');
  const deal = rec({kind: 'dealSeon', name: 'Duwon'});
  assert.equal(deal.signer.en, 'Recorded by: Chief Seon · Witness: Duwon');
  assert.equal(deal.rebut.ko, '당신도 여기에 서명했다.');
  for (const r of [seon, bern, deal]) for (const l of [r.head, ...r.lines, r.signer, r.rebut]) {
    assert.ok(l.ko && l.en);
    assert.equal(HANGUL.test(l.en), false, l.en);
  }
});

test('all note words and UI are bilingual', () => {
  const g = game();
  const out = g.run(`[...Object.values(NOTE_WORDS).flatMap(m => Object.values(m)), ...['noteFrom','noteLeave','noteSend','noteSent','noteNoClue','noteField_s','noteField_v','noteField_r'].map(k => UI[k])]`);
  for (const w of out) {
    if (w.ko === '' && w.en === '') continue;
    assert.ok(w.ko && w.en, JSON.stringify(w));
    assert.equal(HANGUL.test(w.en), false, w.en);
  }
});

// ---- Apps Script doGet: 가짜 시트로 실행 ----
function runGas(rows, parameter) {
  const ctx = vm.createContext({
    JSON, Math, Number, String,
    ContentService: {
      MimeType: {JSON: 'json', JAVASCRIPT: 'js'},
      createTextOutput: body => ({body, mime: 'text', setMimeType(m) { this.mime = m; return this; }})
    },
    SpreadsheetApp: {openById: id => ({getSheetByName: name => ({
      getLastRow: () => rows.length + 1,
      getRange: (r, c, n) => ({getValues: () => rows.slice(r - 2, r - 2 + n)})
    })})}
  });
  vm.runInContext(gas, ctx);
  return ctx.doGet({parameter});
}

test('GAS doGet keeps the health check and returns only whitelisted notes, newest first, capped per scene', () => {
  assert.equal(runGas([], {}).body, 'alive');
  const row = (scene, extra, type = 'note') => ['t', type, scene, '', '', typeof extra === 'string' ? extra : JSON.stringify(extra)];
  const rows = [
    row('top', {s: 'ren', v: 'doubt', r: 'gear', no: 1}),
    row('top', {s: 'seon', v: 'trust', r: 'none', no: 2}),
    row('top', {s: 'bern', v: 'keep', r: 'water', no: 3}),
    row('top', {s: 'lens', v: 'drop', r: 'hand', no: 4}),
    row('top', {s: 'evil<script>', v: 'doubt', r: 'gear'}),
    row('top', 'not json'),
    row('railing', {s: 'ren', v: 'keep', no: 5}),
    row('bad scene!', {s: 'ren', v: 'keep'}),
    row('top', {s: 'ren', v: 'doubt'}, 'suggest')
  ];
  const res = runGas(rows, {action: 'notes'});
  assert.equal(res.mime, 'json');
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.deepEqual(body.notes.filter(n => n.scene === 'top').map(n => n.no), [4, 3, 2], 'Newest three on top');
  assert.deepEqual(body.notes.find(n => n.scene === 'railing'), {scene: 'railing', s: 'ren', v: 'keep', r: 'none', no: 5});
  assert.equal(body.notes.length, 4);
  const jsonp = runGas(rows, {action: 'notes', callback: 'aduNotes123'});
  assert.equal(jsonp.mime, 'js');
  assert.match(jsonp.body, /^aduNotes123\(\{"ok":true/);
  assert.equal(runGas(rows, {action: 'notes', callback: 'alert(1)//'}).mime, 'json', 'Unsafe callback names are ignored');
});

test('the game and the script share the same word lists', () => {
  const g = game();
  const game_ = g.run(`({s: Object.keys(NOTE_WORDS.s), v: Object.keys(NOTE_WORDS.v), r: Object.keys(NOTE_WORDS.r)})`);
  const ctx = vm.createContext({});
  vm.runInContext(gas.replace(/^function[\s\S]*$/m, ''), ctx);
  const script = vm.runInContext('NOTE_WORDS', ctx);
  for (const k of ['s', 'v', 'r']) assert.deepEqual([...game_[k]], [...script[k]], k);
});
