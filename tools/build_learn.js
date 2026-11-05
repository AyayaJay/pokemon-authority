// level-up moves per species (latest generation that has them) -> world/learn.json  {species: [lv, moveid, lv, moveid, ...]}
const {Dex} = require('@pkmn/dex'); const toID = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); const fs = require('fs');
(async () => {
  const dex = Dex.forGen(9), out = {};
  for (const sp of Dex.species.all()) {
    if (sp.num <= 0) continue;
    let ls = null; for (const id of [sp.id, toID(sp.changesFrom || ''), toID(sp.baseSpecies)]) { if (!id) continue; const l = await Dex.learnsets.get(id); if (l && l.learnset) { ls = l.learnset; break; } }
    if (!ls) continue;
    const rows = [];
    for (const [mv, src] of Object.entries(ls)) {
      let best = null; for (const s of src) { const m = s.match(/^(\d)L(\d+)$/); if (m && (!best || +m[1] > best[0])) best = [+m[1], +m[2]]; }
      if (best) rows.push([best[1], mv]);
    }
    rows.sort((a, b) => a[0] - b[0]); out[sp.id] = rows.flat();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out)); console.log(Object.keys(out).length, 'species', out.torchic.slice(0, 16));
})();
