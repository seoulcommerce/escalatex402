import Ajv2020 from 'ajv/dist/2020.js';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.ESCALATEX_BASE_URL || 'http://127.0.0.1:8787';

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const base = path.resolve('docs/spec/schema');
  const files = fs.readdirSync(base).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const schema = loadJson(path.join(base, f));
    ajv.addSchema(schema, schema.$id || f);
  }
  return ajv;
}

async function httpJson(method, url, body = null, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function validateOrThrow(ajv, schemaId, data, label) {
  const ok = ajv.validate(schemaId, data);
  if (!ok) {
    const errs = ajv.errorsText(ajv.errors, { separator: '\n' });
    throw new Error(`${label} failed schema ${schemaId}:\n${errs}`);
  }
}

const ajv = loadSchemas();

// 1) Capabilities
{
  const { status, json } = await httpJson('GET', `${BASE_URL}/.well-known/escalatex`);
  assert(status === 200, `capabilities status expected 200, got ${status}`);
  validateOrThrow(ajv, 'https://escalatex.to/schema/0.1/capabilities.json', json, 'capabilities');
}

// 2) Intake requires_payment (best-effort: most providers will require payment)
{
  const idem = `conf-${Date.now()}`;
  const body = { subject: 'Conformance test', details: 'Please ignore', desired_tier: '24h' };
  const { status, json } = await httpJson('POST', `${BASE_URL}/.well-known/escalatex`, body, {
    'Idempotency-Key': idem,
  });
  assert(status === 200, `intake status expected 200, got ${status}`);
  assert(json && json.protocol === 'escalatex/0.1', 'intake must include protocol escalatex/0.1');
  assert(json.request && json.request.id, 'intake must include request.id');

  if (json.status === 'requires_payment') {
    validateOrThrow(ajv, 'https://escalatex.to/schema/0.1/response-requires-payment.json', json, 'requires_payment');
  } else if (json.status === 'accepted') {
    validateOrThrow(ajv, 'https://escalatex.to/schema/0.1/response-accepted.json', json, 'accepted');
  } else if (json.status === 'busy') {
    validateOrThrow(ajv, 'https://escalatex.to/schema/0.1/response-busy.json', json, 'busy');
  } else {
    throw new Error(`unexpected intake status: ${json.status}`);
  }

  // 3) Idempotency: same key should return same request id
  const again = await httpJson('POST', `${BASE_URL}/.well-known/escalatex`, body, {
    'Idempotency-Key': idem,
  });
  assert(again.status === 200, `idempotent retry expected 200, got ${again.status}`);
  assert(again.json.request.id === json.request.id, 'Idempotency-Key retry must return same request.id');
}

console.log('Escalatex conformance checks passed.');
