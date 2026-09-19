// Synthetic API only: never create real user records or call Gemini.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.ICARE_UI_BASE_URL || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const token = `test.${Buffer.from(JSON.stringify({role:'MOM',sub:'fixture@example.test'})).toString('base64url')}.test`;
  await page.addInitScript(value => localStorage.setItem('accessToken', value), token);
  const records = [];
  let writes = 0, failSave = false;
  const send = (route, data, status = 200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) });
  await page.route(`${base}/api/**`, route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/api/users/me') return send(route, {nickname:'검수'});
    if (url.pathname === '/api/users/profile') return send(route, {babies:[{id:101,name:'검수아이',gender:'U',birthDate:'2026-01-01'}]});
    if (url.pathname === '/api/logs/101' && request.method() === 'GET') return send(route, records.filter(log => log.recordTime.startsWith(url.searchParams.get('date'))));
    if (request.method() === 'POST' || request.method() === 'PUT') {
      writes++;
      if (failSave) return send(route, '검수용 저장 실패', 400);
      const log = {...request.postDataJSON(),id:request.method() === 'PUT' ? Number(url.pathname.split('/').at(-1)) : records.length+1,writerNickname:'검수'};
      const index = records.findIndex(item => item.id === log.id);
      if (index < 0) records.push(log); else records[index] = log;
      return send(route, log);
    }
    if (request.method() === 'DELETE') { records.splice(records.findIndex(log => log.id === Number(url.pathname.split('/').at(-1))),1); return send(route,{}); }
    return route.abort();
  });
  await page.goto(`${base}/dailylog`);
  await page.getByRole('button',{name:'이유식 기록'}).click();
  const dialog = page.getByRole('dialog');
  await page.getByLabel('기록 시각',{exact:true}).fill('2026-09-18T12:00');
  await page.getByRole('button',{name:'저장',exact:true}).click();
  assert.equal(writes,0);
  await page.getByLabel('먹은 음식 (필수)',{exact:true}).fill('소고기 채소죽');
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await page.getByText('이유식 · 소고기 채소죽 · 섭취량 미기록',{exact:true}).waitFor();
  assert.equal(records[0].solidFoodAmount,null);
  await page.reload();
  await page.getByRole('button',{name:'이유식 기록'}).waitFor();
  await page.getByLabel('일과 조회 날짜',{exact:true}).fill('2026-09-18');
  await page.getByRole('button',{name:'12:00 기록 수정',exact:true}).click();
  assert.equal(await page.getByLabel('먹은 음식 (필수)',{exact:true}).inputValue(),'소고기 채소죽');
  await page.getByLabel('섭취량 (g, 선택)',{exact:true}).fill('80');
  failSave = true;
  await page.getByRole('button',{name:'수정 완료',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'검수용 저장 실패'}).waitFor();
  assert.equal(await page.getByLabel('섭취량 (g, 선택)',{exact:true}).inputValue(),'80');
  failSave = false;
  await page.getByRole('button',{name:'수정 완료',exact:true}).click();
  await page.getByText('이유식 · 소고기 채소죽 · 80g',{exact:true}).waitFor();
  await page.getByRole('button',{name:'낮잠 기록'}).click();
  await page.getByLabel('기록 시각 / 낮잠 시작',{exact:true}).fill('2026-09-18T23:30');
  await page.getByLabel('낮잠 종료 (필수)',{exact:true}).fill('2026-09-18T22:30');
  const before = writes;
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'낮잠 종료는'}).waitFor();
  assert.equal(writes,before);
  await page.getByLabel('낮잠 종료 (필수)',{exact:true}).fill('2026-09-19T01:00');
  await page.getByRole('status').filter({hasText:'낮잠 시간: 1시간 30분'}).waitFor();
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await page.getByText('낮잠 · 23:30 → 09-19 01:00 · 1시간 30분',{exact:true}).waitFor();
  assert.equal(records[1].napEndTime,'2026-09-19T01:00:00');
  for (const width of [375,320]) {
    await page.setViewportSize({width,height:812});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button',{name:'이유식 기록'}).click();
    for(let i=0;i<14;i++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)),true); }
    assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
    if (process.env.ICARE_UI_ARTIFACTS && width === 375) {
      await mkdir(process.env.ICARE_UI_ARTIFACTS,{recursive:true});
      await page.screenshot({path:`${process.env.ICARE_UI_ARTIFACTS}/dailylog-food-mobile.png`});
    }
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(),0);
    assert.equal(await page.getByRole('button',{name:'이유식 기록'}).evaluate(element => element === document.activeElement),true);
  }
  if (process.env.ICARE_UI_ARTIFACTS) {
    await page.setViewportSize({width:1280,height:900});
    await page.evaluate(() => window.scrollTo(0,0));
    await page.screenshot({path:`${process.env.ICARE_UI_ARTIFACTS}/dailylog-desktop.png`,fullPage:true});
  }
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button',{name:'23:30 기록 삭제',exact:true}).click();
  await page.getByRole('article',{name:'23:30 기록',exact:true}).waitFor({state:'detached'});
  assert.equal(records.length,1);
  assert.deepEqual(errors,[]);
  console.log('PASS food create/edit/reload/unknown amount, failed-save retention, overnight nap, invalid duration, delete, 320/375px overflow, keyboard focus trap/Escape/return, no JS errors; synthetic APIs only.');
} finally { await browser.close(); }
