import fs from 'fs';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';

const ajv = new Ajv2020({ allErrors: true, strict: false });

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const base = path.resolve('docs/spec/schema');
const files = fs.readdirSync(base).filter((f) => f.endsWith('.json'));

for (const f of files) {
  const schema = loadJson(path.join(base, f));
  ajv.addSchema(schema, schema.$id || f);
}

console.log(`Loaded ${files.length} schemas.`);

console.log('All schemas loaded.');
