import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSources } from '../app/lib/retrieval-sources.ts';

const source = { title: 'Guideline', url: 'https://example.test/document', publisher: 'Test', revisedOn: '', version: 'test', page: 1, excerpt: 'Actual retrieved text' };
test('source view accepts stored evidence and rejects unsafe links or malformed records', () => {
  assert.deepEqual(readSources(JSON.stringify([source])), [source]);
  for (const url of ['javascript:alert(1)', 'http://example.test', 'https://user:secret@example.test']) assert.deepEqual(readSources(JSON.stringify([{ ...source, url }])), []);
  for (const value of [null, 'invalid', '{}', '[null]', JSON.stringify([{ ...source, excerpt: 3 }])]) assert.deepEqual(readSources(value), []);
});
