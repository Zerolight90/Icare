import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLog, napMinutes, durationLabel } from '../app/lib/daily-log.ts';
const base = { recordTime: '2026-09-18T23:30:00', formulaAmount: null, breastfed: null, diaperType: 'NONE', memo: null };
test('food amount can be unknown; amount without food and empty records are rejected', () => {
  assert.equal(validateLog({...base, solidFoodName:'채소죽', solidFoodAmount:null}), null);
  assert.ok(validateLog({...base, solidFoodAmount:80}));
  assert.ok(validateLog(base));
  assert.ok(validateLog({...base, solidFoodName:'죽', solidFoodAmount:1.5}));
});
test('nap crosses midnight with explicit end date and has a bounded positive duration', () => {
  const nap = {...base, napEndTime:'2026-09-19T01:00:00'};
  assert.equal(validateLog(nap), null); assert.equal(napMinutes(nap),90); assert.equal(durationLabel(90),'1시간 30분');
  for (const end of ['2026-09-18T23:30:00','2026-09-18T12:00:00','2026-09-20T01:00:00','bad']) assert.ok(validateLog({...base,napEndTime:end}));
});
