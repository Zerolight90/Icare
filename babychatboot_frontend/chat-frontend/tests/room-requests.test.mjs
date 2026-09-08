import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomRequests } from '../app/lib/room-requests.ts';

test('late response cannot cross rooms, including switching away and back', () => {
  const requests = new RoomRequests();
  requests.select('first');
  const old = requests.begin('first');
  requests.select('second');
  assert.equal(requests.accepts(old), false);
  requests.select('first');
  assert.equal(requests.accepts(old), false);
  const fresh = requests.begin('first');
  assert.equal(requests.accepts(fresh), true);
});
test('message refresh after a send takes precedence over an older history read', () => {
  const requests = new RoomRequests(); requests.select('first');
  const loading = requests.begin('first'); const afterSend = requests.begin('first');
  assert.equal(requests.accepts(loading), false);
  assert.equal(requests.accepts(afterSend), true);
});
