const assert=require('node:assert/strict');
const fs=require('node:fs');

const profile=JSON.parse(fs.readFileSync('public/institution.json','utf8'));
const schedule=JSON.parse(fs.readFileSync('public/schedule.json','utf8'));
const openapi=JSON.parse(fs.readFileSync('public/openapi.json','utf8'));
const worker=fs.readFileSync('dist/worker.mjs','utf8');

assert.equal(profile.schema,1);
assert.equal(profile.integration.apiVersion,'v1');
assert.ok(profile.institution.id && profile.unit.id);
assert.ok(Array.isArray(profile.integration.frameAncestors));
assert.ok(schedule.groups.length>0 && schedule.lessons.length>0);
assert.ok(schedule.groups.every(group=>group.lessons.every(index=>Number.isInteger(index)&&schedule.lessons[index])));
for(const route of ['/api/v1/meta','/api/v1/groups','/api/v1/teachers','/api/v1/schedule','/api/v1/openapi.json']){
  assert.ok(openapi.paths[route],route+' missing from OpenAPI');
  assert.ok(worker.includes(route),route+' missing from worker');
}
assert.ok(worker.includes("frame-ancestors https://rsatu.ru https://*.rsatu.ru"));
assert.ok(worker.includes("'Access-Control-Allow-Origin'"));
console.log(JSON.stringify({api:'v1',institution:profile.institution.id,unit:profile.unit.id,groups:schedule.groups.length,lessons:schedule.lessons.length}));
