// pt50 — newcomers see the main record first; dice details remain available on demand.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
function children(n, visible) {
  return visible && n.type === 'details' && !n.props.open ? n.children.filter(c => c?.type === 'summary') : n.children;
}
function nodes(n, visible = false) {
  return !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(x => nodes(x, visible)) : [n, ...children(n, visible).flatMap(x => nodes(x, visible))];
}
function text(n, visible = false) {
  return n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(x => text(x, visible)).join('') : typeof n === 'object' ? text(children(n, visible), visible) : String(n);
}
function game({lang = 'en', badges = [], records = {}, savedGame = null, recordNo = 113, sceneKey, hash = ''} = {}) {
  const states = [], data = new Map(Object.entries({aduventure_lang: lang, aduventure_badges: badges, aduventure_records: records, aduventure_save: savedGame, aduventure_record_no: recordNo}).map(([k,v]) => [k,JSON.stringify(v)]));
  let index = 0;
  const ctx = vm.createContext({console, Date, Math, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    window: {location: {hash, pathname: '/', search: ''}, addEventListener() {}}, document: {documentElement: {}},
    fetch: async () => { throw Error('Network disabled in unit tests'); },
    localStorage: {getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k)},
    React: {Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) { const i=index++; if (!(i in states)) states[i]=typeof initial === 'function' ? initial() : initial; return [states[i], v => states[i]=typeof v==='function' ? v(states[i]) : v]; },
      useRef(initial) { const i=index++; if (!(i in states)) states[i]={current:initial}; return states[i]; }, useEffect() {}}
  });
  vm.runInContext(app.replace('  const pct = choice =>', 'globalThis.testApi = {setRuleKey};\n  const pct = choice =>'),ctx);
  vm.runInContext('window.history = {pushState(a,b,url) { window.location.hash = url; }}',ctx);
  const run = c => vm.runInContext(c,ctx);
  const render = () => { index=0; return run('CRPG()'); };
  if (sceneKey) {
    data.set('aduventure_save',JSON.stringify({v:1,sceneKey,flags:[],ruleKey:'srd20',fate:1,specialLeft:2,breathLeft:1,tutSeen:false,runNo:113,
      pc:{...run('CLASSES.fighter'),classKey:'fighter',name:'QA'},stats:{rolls:0,success:0}}));
    nodes(render()).find(n=>n.props.className==='continueBtn').props.onClick();
  }
  return {render,run, data, api:()=>{render();return ctx.testApi;}};
}

test('onboarding recognizes real chapter-1 completion records and ending saves before an asynchronous badge is stored', () => {
  const sample=game(), ids=sample.run('BADGES.filter(b=>b.ch===1).map(b=>b.id)');
  for(const lang of ['ko','en']) {
    const evidence=ids.map(id=>({records:{[id]:{rolls:2,success:1,rate:50}}}));
    evidence.push({records:{'1s':{rolls:0,success:0,rate:0}}});
    evidence.push({savedGame:{v:1,sceneKey:'ending',pc:{classKey:'fighter',name:'QA'}}});
    for(const proof of evidence) {
      const g=game({lang,...proof}),tree=g.render(),all=nodes(tree),entries=sideEntries(tree);
      assert.ok(!all.some(n=>n.props.className==='openingIntro'),JSON.stringify(proof));
      assert.ok(!all.some(n=>n.props.className==='otherCases'),JSON.stringify(proof));
      assert.equal(entries.length,2);
      assert.ok(entries.every(n=>nodes(tree,true).includes(n)));
      assert.ok(entries.every(n=>all.indexOf(n)<all.findIndex(n=>typeof n.type==='function' && n.type.name==='RecordCard')));
    }
  }
});

test('failed or unfinished attempts, later chapters, invented badges and invalid record values are still newcomers', () => {
  const cases=[{badges:['1invented']},{badges:['2p','5']},{records:{'2p':{rolls:2,success:1,rate:50}}},
    {records:{'1invented':{rolls:2,success:1,rate:50}}},{records:{'1pf':{}}},{records:{'1pf':true}},
    {records:{'1pf':{rolls:2,success:3,rate:150}}},{records:{'1pf':{rolls:2,success:1,rate:100}}},
    {records:{'1pf':{rolls:'2',success:1,rate:50}}},{recordNo:999},
    ...['intro','door','gameover','intro2','ending2'].map(sceneKey=>({savedGame:{v:1,sceneKey,pc:{classKey:'fighter',name:'QA'}}})),
    {savedGame:{sceneKey:'ending'}},{savedGame:{sceneKey:'ending',pc:null}}];
  for(const config of cases) {
    const tree=game(config).render();
    assert.ok(nodes(tree).some(n=>n.props.className==='openingIntro'),JSON.stringify(config));
    assert.ok(nodes(tree).some(n=>n.type==='details' && n.props.className==='otherCases' && !n.props.open),JSON.stringify(config));
    assert.ok(sideEntries(tree).every(n=>!nodes(tree,true).includes(n)),JSON.stringify(config));
  }
});
const sideEntries = t => nodes(t).filter(n => /(?:^| )or-entry(?: |$)/.test(n.props.className || ''));
for (const lang of ['ko','en']) {
  test(`${lang}: no chapter-1 clear keeps side cases folded after the record and its two choices, even after repeat attempts`, () => {
    for (const [badges,recordNo] of [[[],113],[[],150],[['2p'],150]]) {
      const g=game({lang,badges,recordNo}), tree=g.render(), all=nodes(tree);
      const fold=all.find(n=>n.type==='details' && n.props.className==='otherCases');
      assert.ok(fold); assert.ok(!fold.props.open); assert.equal(sideEntries(fold).length,2);
      assert.equal(nodes(tree,true).filter(n=>sideEntries(tree).includes(n)).length,0);
      assert.equal(text(fold.children[0]),lang==='ko'?'다른 사건 (1장 이후 추천)':'Other cases (recommended after Ch.1)');
      const record=all.find(n=>typeof n.type==='function' && n.type.name==='RecordCard');
      const choices=all.filter(n=>n.type==='button' && [g.run(`UI.recordLie.${lang}`),g.run(`UI.recordBelieve.${lang}`)].includes(text(n)));
      assert.equal(choices.length,2); assert.ok(all.indexOf(record)<all.indexOf(choices[0])); assert.ok(choices.every(n=>all.indexOf(n)<all.indexOf(fold)));
      for (const [entryClass,hash,component] of [['or-entry','#returned-letter','OwnRecordTrial'],['or-entry uo-entry','#unsigned-order','UnsignedOrderTrial']]) {
        const h=game({lang,badges,recordNo});
        const details=nodes(h.render()).find(n=>n.props.className==='otherCases');
        const expanded={...details,props:{...details.props,open:true}};
        nodes(expanded,true).find(n=>n.props.className===entryClass).props.onClick();
        assert.equal(h.run('window.location.hash'),hash);
        assert.ok(nodes(h.render()).some(n=>typeof n.type==='function' && n.type.name===component));
      }
    }
  });
  test(`${lang}: short, spoiler-free orientation appears above the first official record`, () => {
    const g=game({lang}), tree=g.render(), all=nodes(tree);
    const intro=all.find(n=>n.props.className==='openingIntro'); assert.ok(intro);
    const lines=nodes(intro).filter(n=>n.type==='p').map(text);
    assert.equal(lines.length,3);
    assert.ok(lines.every(line=>line.length>0 && [...line].length<=(lang==='ko'?40:90)),JSON.stringify(lines));
    assert.ok(all.indexOf(intro)<all.findIndex(n=>typeof n.type==='function' && n.type.name==='RecordCard'));
    assert.match(lines[0],lang==='ko'?/소금여울.*모험가/:/adventurer.*Saltmarsh/);
    assert.match(lines[1],lang==='ko'?/어선.*등대|등대.*어선/:/boats.*lighthouse/i);
    assert.match(lines[2],lang==='ko'?/기록.*믿.*쓸/:/record.*[Bb]elieve.*rewrite/);
    assert.doesNotMatch(lines.join(' '),/스컬리|검은 코트|밀수|Black Coat|Scully|smuggl/i);
    if(lang==='en') assert.ok(!/[가-힣]/.test(lines.join(' ')));
  });
  test(`${lang}: chapter-1-cleared players retain both side-case buttons above the record`, () => {
    const seed=game(), ids=seed.run('BADGES.filter(b=>b.ch===1).map(b=>b.id)');
    assert.equal(ids.length,5);
    for (const id of ids) {
      const g=game({lang,badges:[id]}),tree=g.render(),all=nodes(tree),entries=sideEntries(tree);
      assert.equal(entries.length,2); assert.ok(entries.every(n=>nodes(tree,true).includes(n)));
      assert.ok(entries.every(n=>all.indexOf(n)<all.findIndex(n=>typeof n.type==='function' && n.type.name==='RecordCard')));
      assert.ok(!all.some(n=>n.props.className==='otherCases'));
    }
  });
  test(`${lang}: rule window starts with the first-check explanation while both systems' detailed rules stay folded`, () => {
    for (const key of ['srd20','simple2d6']) {
      const g=game({lang,sceneKey:'door'}); g.api().setRuleKey(key);
      const brief=nodes(g.render()).find(n=>n.props.className==='checkBrief'); assert.ok(brief);
      assert.doesNotMatch(text(brief),/%|DC|floor|내림|보정|항상|always/);
      nodes(g.render()).find(n=>n.type==='button' && n.props.title===g.run(`UI.rulesTitle.${lang}`)).props.onClick();
      const tut=nodes(g.render()).find(n=>n.props.className==='tut');
      const easy=nodes(tut).find(n=>n.props.className==='rulesBrief'); assert.ok(easy); assert.equal(text(easy),text(brief));
      const fold=nodes(tut).find(n=>n.type==='details' && n.props.className==='rulesDetails'); assert.ok(fold); assert.ok(!fold.props.open);
      assert.equal(text(fold.children[0]),lang==='ko'?'자세한 규칙':'Detailed rules');
      assert.ok(nodes(tut).indexOf(easy)<nodes(tut).indexOf(fold));
      const paragraphs=g.run(`RULE_SYSTEMS.${key}.tutorial.${lang}`);
      for(const paragraph of paragraphs) { assert.ok(text(fold).includes(paragraph)); assert.ok(!text(tut,true).includes(paragraph)); }
      assert.doesNotMatch(text(tut,true),/%|floor|÷|\+2|\+1/);
      assert.match(text(fold),lang==='ko'?/숫자 보기.*켜면.*%/:/Show numbers.*%/);
      if(lang==='en') assert.ok(!/[가-힣]/.test(text(tut)));
    }
  });
}
