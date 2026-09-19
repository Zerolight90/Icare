// Run manually against a local frontend with Playwright available via NODE_PATH.
// Every application API request is intercepted: no account, mail or database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.ICARE_UI_BASE_URL || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local frontend required');
const browser = await chromium.launch({ headless: true, channel: process.env.ICARE_UI_BROWSER_CHANNEL || 'chrome' });
let checks = 0;
const passed = label => { checks++; console.log(`PASS ${label}`); };
try {
  const page = await browser.newPage();
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(`${base}/api/**`, async route => {
    requests.push({ path: new URL(route.request().url()).pathname, data: route.request().postDataJSON() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '"test response"' });
  });
  await page.goto(`${base}/signup`);
  await page.getByPlaceholder('본명', { exact: true }).fill('테스트');
  await page.getByPlaceholder('닉네임 (화면에 표시될 이름)').fill('가입검수');
  await page.getByPlaceholder('이메일', { exact: true }).fill('signup-ui@example.test');
  await page.getByPlaceholder('전화번호 (010-0000-0000)').fill('010-0000-0000');
  await page.locator('input[type=date]').fill('1990-01-01');
  await page.getByLabel('주소', { exact: true }).fill('테스트 주소');
  const password = page.getByLabel('비밀번호', { exact: true });
  const confirmation = page.getByLabel('비밀번호 확인', { exact: true });
  const next = page.getByRole('button', { name: '다음 →', exact: true });
  await password.fill('abcdefghi'); await confirmation.fill('abcdefghi'); await next.click();
  assert.ok(await next.isVisible()); assert.equal(requests.length, 0);
  passed('nine-character password cannot advance');
  await password.fill('abcdefghij'); await confirmation.fill('abcdefghik'); await next.click();
  assert.match(await page.getByRole('alert').filter({ hasText: '비밀번호' }).innerText(), /일치하지/);
  assert.equal(requests.length, 0);
  passed('password mismatch is shown before any request');
  await password.fill('가'.repeat(25)); await confirmation.fill('가'.repeat(25)); await next.click();
  assert.match(await page.getByRole('alert').filter({ hasText: '비밀번호' }).innerText(), /72바이트/);
  passed('UTF-8 byte limit matches backend');
  await password.fill('abcdefghij'); await confirmation.fill('abcdefghij');
  await page.getByLabel('상세주소').fill('이전 상세주소');
  await page.getByRole('button', { name: '주소 검색', exact: true }).click();
  const search = page.frameLocator('iframe').frameLocator('iframe');
  await search.getByRole('textbox').fill('세종대로 110');
  await search.getByRole('button', { name: '검색', exact: true }).click();
  // Public building address only, never the user's address.
  const result = search.getByText('서울 중구 세종대로 110', { exact: false });
  try { await result.first().click({ timeout: 15000 }); }
  catch (error) { console.log('ADDRESS_SEARCH_RESULT', await search.locator('body').innerText()); throw error; }
  await page.getByRole('button', { name: '주소 검색', exact: true }).waitFor();
  const selected = await page.getByLabel('주소', { exact: true }).inputValue();
  assert.match(selected, /세종대로 110/);
  assert.equal(await page.getByLabel('상세주소').inputValue(), '');
  passed('live address search selects result and clears old detail');
  await page.getByLabel('상세주소').fill('테스트 상세주소');
  await next.click();
  await page.getByPlaceholder('아기 이름', { exact: true }).waitFor();
  passed('matching ten-character password advances');
  await page.getByRole('button', { name: '← 이전', exact: true }).click();
  assert.equal(await page.getByLabel('주소', { exact: true }).inputValue(), selected);
  assert.equal(await page.getByLabel('상세주소').inputValue(), '테스트 상세주소');
  await next.click();
  await page.locator('input[type=date]').fill('2026-01-01');
  await page.getByPlaceholder('아기 이름', { exact: true }).fill('테스트 아기');
  await page.getByRole('button', { name: '가입 완료', exact: true }).click();
  await page.getByText('이메일 인증을 완료해 주세요', { exact: true }).waitFor();
  const signup = requests.find(request => request.path === '/api/users/signup');
  assert.ok(signup);
  assert.equal(signup.data.address, `${selected} 테스트 상세주소`);
  assert.equal(signup.data.password.length, 10);
  assert.equal('confirmPassword' in signup.data, false);
  assert.equal('detailAddress' in signup.data, false);
  assert.equal(requests.filter(request => request.path === '/api/users/send-email').length, 1);
  passed('back navigation preserves address; mocked signup has correct payload and verification step');
  assert.deepEqual(errors, []);
  passed('no browser JavaScript errors');

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobile.route(`${base}/api/**`, route => route.abort());
  await mobile.goto(`${base}/signup`);
  await mobile.getByRole('button', { name: '주소 검색', exact: true }).click();
  const mobileSearch = mobile.frameLocator('iframe').frameLocator('iframe');
  await mobileSearch.getByRole('textbox').fill('세종대로 110');
  await mobileSearch.getByRole('button', { name: '검색', exact: true }).click();
  await mobileSearch.getByText('서울 중구 세종대로 110', { exact: false }).first().click();
  await mobile.getByRole('button', { name: '주소 검색', exact: true }).waitFor();
  assert.match(await mobile.getByLabel('주소', { exact: true }).inputValue(), /세종대로 110/);
  await mobile.getByRole('button', { name: '주소 검색', exact: true }).click();
  await mobileSearch.getByRole('textbox').waitFor();
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mobile.getByRole('button', { name: '주소 검색 닫기', exact: true }).click();
  assert.equal(await mobile.locator('iframe').count(), 0);
  passed('375px mobile search, reopen, close and horizontal layout');

  const offline = await browser.newPage();
  await offline.route(`${base}/api/**`, route => route.abort());
  await offline.route('**/postcode.v2.js', route => route.abort());
  await offline.goto(`${base}/signup`);
  await offline.getByRole('status').filter({ hasText: '주소 검색을 불러오지 못했습니다' }).waitFor();
  await offline.getByLabel('주소', { exact: true }).fill('직접 입력 테스트 주소');
  await offline.getByLabel('상세주소').fill('직접 입력 상세주소');
  assert.equal(await offline.getByLabel('주소', { exact: true }).inputValue(), '직접 입력 테스트 주소');
  passed('SDK failure displays recovery guidance and allows manual address');
  console.log(`${checks} checks passed; application API requests intercepted, no account or email created.`);
} finally { await browser.close(); }
