// Local synthetic API responses only: no real login/account/email mutations.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.ICARE_UI_BASE_URL || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true, channel: process.env.ICARE_UI_BROWSER_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydration|didn't match/i.test(message.text())) errors.push(message.text()); });
  const token = `test.${Buffer.from(JSON.stringify({role:'MOM',sub:'test@example.test'})).toString('base64url')}.test`;
  let rejectLogin = true;
  let expire = false;
  await page.route(`${base}/api/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/users/login') return route.fulfill({status: rejectLogin ? 400 : 200, body: rejectLogin ? '이메일 또는 비밀번호가 일치하지 않습니다.' : token});
    if (path === '/api/users/me') return route.fulfill({status: expire ? 401 : 200, contentType:'application/json',body: JSON.stringify({nickname:'테스트'})});
    if (path === '/api/session/logout') return route.fulfill({status:200,body:'ok'});
    await route.abort();
  });
  await page.goto(`${base}/login`);
  assert.equal(await page.locator('a[href="/register"]').count(), 0);
  await page.getByPlaceholder('이메일을 입력해주세요').fill('test@example.test');
  await page.getByPlaceholder('비밀번호를 입력해주세요').fill('Synthetic-password');
  await page.getByRole('button', {name:'로그인',exact:true}).click();
  await page.getByText('이메일 또는 비밀번호가 일치하지 않습니다.', {exact:true}).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), null);
  rejectLogin = false;
  await page.getByRole('button', {name:'로그인',exact:true}).click();
  await page.waitForURL(`${base}/`);
  await page.getByRole('button',{name:'로그아웃',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'로그인하기',exact:true}).count(),0);
  await page.reload();
  await page.getByRole('button',{name:'로그아웃',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'로그인하기',exact:true}).count(),0);
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();
  await page.getByRole('link',{name:'로그인하기',exact:true}).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), null);
  // An expired session must also restore the public landing link.
  await page.evaluate(value => localStorage.setItem('accessToken', value), token);
  expire = true;
  await page.reload();
  await page.getByRole('link',{name:'로그인하기',exact:true}).waitFor();
  await page.waitForFunction(() => localStorage.getItem('accessToken') === null);
  assert.deepEqual(errors, []);
  console.log('PASS login failure/success, authenticated reload hydration, same-page logout, expired session, signup link; all API calls intercepted.');
} finally { await browser.close(); }
