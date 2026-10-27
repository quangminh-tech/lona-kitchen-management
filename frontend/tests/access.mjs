import test from 'node:test';import assert from 'node:assert/strict';
// Pure permissions separated from DOM-backed session helpers by extracting the exported dependency source.
import fs from 'node:fs';const src=fs.readFileSync(new URL('../src/services/access.js',import.meta.url),'utf8');const depsSource=src.slice(src.indexOf('export const dependencies'));
const {dependencies,togglePermission}=await import('data:text/javascript,'+encodeURIComponent(depsSource));
test('granting write permissions includes exact view prerequisites; revocation removes dependants',()=>{let p=togglePermission([],'stock.issue',true);for(const need of ['reports.view','menus.view','recipes.view','items.view','stock.view','purchase.view'])assert.ok(p.includes(need));p=togglePermission(p,'recipes.view',false);assert.ok(!p.includes('stock.issue'));assert.ok(!p.includes('reports.view'));assert.ok(!p.includes('menus.view'));assert.ok(p.includes('stock.view'))});
