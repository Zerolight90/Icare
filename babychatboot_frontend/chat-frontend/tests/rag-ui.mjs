// All application API calls are intercepted. No accounts, email or AI requests are sent.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.ICARE_UI_BASE_URL || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /hydration|didn't match/i.test(m.text())) errors.push(m.text()); });
  const token = `test.${Buffer.from(JSON.stringify({role:'MOM',sub:'fixture@example.test'})).toString('base64url')}.test`;
  await page.addInitScript(value => localStorage.setItem('accessToken', value), token);
  let pending;
  let requests = 0;
  const sources = JSON.stringify([{title:'검수용 공식 자료',url:'https://example.test/guidance',publisher:'Fixture',revisedOn:'',version:'fixture',page:1,excerpt:'검수용 발췌',jurisdiction:'US',minAgeMonths:0,maxAgeMonths:11}]);
  const send = (route, data) => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  await page.route(`${base}/api/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/users/me') return send(route,{nickname:'검수'});
    if (url.pathname === '/api/users/profile') return send(route,{babies:[{id:101,name:'검수아이A',gender:'U',birthDate:'2026-07-01'},{id:102,name:'검수아이B',gender:'U',birthDate:'2026-07-02'}]});
    if (url.pathname.endsWith('/health-check')) {
      requests++;
      if (requests === 1) { pending = route; return; }
      return send(route,{result:'부모 기록 요약입니다. 일반 안내 [자료 1]\n<img src="x" onerror="window.ragXss=1">',retrievalSources:sources,status:'answered'});
    }
    if (/^\/api\/logs\/10[12]$/.test(url.pathname)) return send(route,[{id:1,recordTime:`${url.searchParams.get('date')}T12:00:00`,formulaAmount:null,breastfed:false,diaperType:'NONE',memo:'관찰 메모',writerNickname:'검수'}]);
    return route.abort();
  });
  await page.goto(`${base}/dailylog`);
  const analyze = page.getByRole('button',{name:'AI 육아 기록 분석',exact:true});
  await analyze.click();
  await page.getByText('선택한 날짜의 기록과 참고자료를 확인하고 있습니다...').waitFor();
  await page.getByRole('button',{name:'검수아이B'}).click();
  await page.getByText('관찰 메모',{exact:true}).waitFor();
  await page.getByRole('button',{name:'검수아이A'}).click();
  await page.getByText('관찰 메모',{exact:true}).waitFor();
  await send(pending,{result:'이전 요청의 지연 응답',retrievalSources:'[]',status:'answered'});
  await analyze.click();
  await page.getByText('부모 기록 요약입니다.',{exact:false}).waitFor();
  assert.equal(await page.getByText('이전 요청의 지연 응답',{exact:true}).count(),0);
  await page.getByText('AI에 전달한 참고자료 1개').click();
  await page.getByRole('link',{name:'[자료 1] 검수용 공식 자료'}).waitFor();
  await page.getByText('검수용 발췌',{exact:true}).waitFor();
  assert.equal(await page.locator('img[src="x"]').count(),0);
  assert.equal(await page.evaluate(() => window.ragXss),undefined);
  assert.ok(await page.getByText('미기록',{exact:true}).count() >= 4);
  assert.equal(await page.getByText('이유식(회)',{exact:true}).count(),0);
  await page.locator('input[type=date]').first().fill('2026-09-01');
  await page.getByText('관찰 메모',{exact:true}).waitFor();
  assert.equal(await page.getByText('AI에 전달한 참고자료 1개').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS daily RAG sources/region, missing observations, safe Markdown, baby away/back and date invalidation, no hydration errors; synthetic APIs only.');
} finally { await browser.close(); }
