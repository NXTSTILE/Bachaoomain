import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Keep optional audit tools outside the production dependency graph.
// npm install --prefix /tmp/bachaoo-browser-tools playwright @axe-core/playwright
const require = createRequire(join(process.env.BROWSER_TOOLS_DIR || '/tmp/bachaoo-browser-tools', 'package.json'));
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const pilot = process.env.TEST_PILOT === '1';
if (process.env.TEST_MEMBER_FLOW === '1' && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
  throw new Error('The seeded member flow is restricted to the isolated loopback test server.');
}
const browser = await chromium.launch({ headless: true });
const failures = [];

async function checkTouchTargets(page, label) {
  // Allow only floating-point layout noise around the 44 CSS-pixel boundary.
  const undersized = await page.locator('a:not(.skip-link), button, input, select, textarea, summary').evaluateAll(elements => elements.filter(el => el.getClientRects().length && (el.getBoundingClientRect().height < 43.99 || el.getBoundingClientRect().width < 43.99)).map(el => ({ text: el.textContent, height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width })));
  assert.deepEqual(undersized, [], `${label}: touch targets`);
}

try {
  for (const width of [320, 360, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(baseURL, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.match(await page.title(), /Bachaoo/);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('meta[name="description"]').count(), 1);
    assert.equal(await page.locator('meta[property="og:image"]').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Homepage overflows at ${width}px`);
    await page.getByRole('link', { name: 'Log in', exact: true }).waitFor({ state: 'visible' });
    await checkTouchTargets(page, `Homepage ${width}px`);
    await page.locator('summary').filter({ hasText: 'Who is Bachaoo for?' }).click();
    assert.equal(await page.locator('details[open]').count(), 1);
    await page.keyboard.press('Home');
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    failures.push(...result.violations.map(v => ({ width, id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })));
    await page.screenshot({ path: join(tmpdir(), `bachaoo-home-${width}.png`), fullPage: true });
    await page.goto(`${baseURL}/join`, { waitUntil: 'networkidle' });
    if (pilot) {
      await page.getByRole('heading', { name: 'The campus pilot is getting ready.' }).waitFor();
      assert.equal(await page.locator('form').count(), 0);
    } else {
      await page.getByLabel('College email').fill('123456789012@centurionuniv.edu.in');
      await page.getByLabel('What should we call you?').fill('Test Student');
      await page.getByLabel('Password', { exact: true }).fill('isolated-test-password');
      await page.getByRole('button', { name: 'Show password', exact: true }).click();
      assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text');
      await page.getByRole('button', { name: 'Hide password', exact: true }).click();
      // Isolate the OTP input regression; do not send real mail during a UI audit.
      let requests = 0;
      await page.route('**/api/auth/register', route => {
        requests++;
        return route.fulfill({ status: width === 768 ? 429 : 200, contentType: 'application/json', body: width === 768 ? '{"error":"Use the already delivered code","useExistingCode":true,"retryAfter":45}' : '{"message":"sent"}' });
      });
      if (width === 390) {
        await page.getByRole('button', { name: 'I already have a verification code' }).click();
        await page.getByLabel('Email verification code').waitFor();
        assert.equal(requests, 0, 'Recovering a received code must not resend email');
        await page.getByRole('button', { name: 'Edit details' }).click();
        await page.getByRole('button', { name: 'Continue to verification' }).click();
        await page.getByLabel('Email verification code').waitFor();
        assert.equal(requests, 0, 'Editing signup details preserves the received code');
      } else {
        await page.getByRole('button', { name: 'Send my verification code' }).click();
        if (width === 768) await page.getByText('Use the code from your newest verification email. No new email was sent.', { exact: true }).waitFor();
      }
      await page.getByLabel('Email verification code').fill('1a2b3c');
      assert.equal(await page.getByLabel('Email verification code').inputValue(), '123');
      if (width === 360) {
        await page.getByLabel('Email verification code').fill('123456');
        await page.route('**/api/auth/verify', route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Invalid or expired verification code."}' }));
        await page.getByRole('button', { name: 'Verify & join my college' }).click();
        await page.getByRole('alert').filter({ hasText: 'Invalid or expired verification code.' }).waitFor();
        assert.equal(await page.getByLabel('Email verification code').inputValue(), '123456', 'A failed verification preserves the typed code');
        const resend = page.getByRole('button', { name: /^Resend code in/ });
        assert.equal(await resend.isDisabled(), true, 'Resend waits for the published cooldown');
        await page.getByRole('button', { name: 'Edit details' }).click();
        assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), 'isolated-test-password', 'Correcting signup details keeps the password');
        await page.getByRole('button', { name: 'Continue to verification' }).click();
        assert.equal(requests, 1, 'Retrying verification does not send another email');
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Join overflows at ${width}px`);
    await checkTouchTargets(page, `Join ${width}px`);
    const authAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    failures.push(...authAxe.violations.map(v => ({ width, route: '/join', id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(errors, [], `Browser runtime errors at ${width}px`);
    await context.close();
    console.log(`PASS ${width}px: homepage, metadata, FAQ, join, overflow, runtime errors`);
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const path of ['/community', '/privacy', '/login']) {
    assert.equal((await page.goto(`${baseURL}${path}`)).status(), 200);
    assert.equal(await page.locator('h1').count(), 1);
  }
  const notFound = await page.goto(`${baseURL}/this-page-does-not-exist`);
  assert.equal(notFound.status(), 404);
   for (const path of ['/campus', '/poster', '/helper', '/superadmin']) {
     await page.goto(`${baseURL}${path}`);
     assert.match(page.url(), /\/login$/, `${path} directs signed-out members to login`);
     await page.getByRole('heading', { name: 'Good to have you back.' }).waitFor();
   }
  const privateApi = await context.request.get(`${baseURL}/api/posts`);
  assert.equal(privateApi.status(), 401);
  assert.match(privateApi.headers()['cache-control'], /no-store/);
  for (const path of ['/robots.txt', '/sitemap.xml', '/opengraph-image', '/apple-icon', '/icon.svg']) {
    assert.equal((await context.request.get(`${baseURL}${path}`)).status(), 200, path);
  }
  console.log('PASS public routes, 404, auth redirect, private API, robots, sitemap and image endpoints');
  if (pilot) {
    for (const endpoint of ['register', 'verify']) {
      const blocked = await context.request.post(`${baseURL}/api/auth/${endpoint}`, { headers: { Origin: new URL(baseURL).origin }, data: { email: '123456789012@cutm.ac.in' } });
      assert.equal(blocked.status(), 503);
      assert.match((await blocked.json()).error, /registrations are not open/);
    }
    console.log('PASS closed onboarding rejects direct API bypasses');
  }
  if (process.env.TEST_MEMBER_FLOW === '1') {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function loginAs(target, email, password, destination) {
      await target.goto(`${baseURL}/login`);
      await target.getByLabel('Email', { exact: true }).fill(email);
      await target.getByLabel('Password', { exact: true }).fill(password);
      await target.getByRole('button', { name: 'Back to my college' }).click();
      await target.waitForURL(`**/${destination}`);
    }
    async function auditMember(target, route) {
      for (const width of [320, 360, 390, 768, 1440]) {
        await target.setViewportSize({ width, height: 900 });
        assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflows at ${width}px`);
        await checkTouchTargets(target, `${route} ${width}px`);
        const result = await new AxeBuilder({ page: target }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        failures.push(...result.violations.map(v => ({ width, route, id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })));
      }
    }
    await page.goto(`${baseURL}/login`);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.getByLabel('Email', { exact: true }).fill('123456789012@cutm.ac.in');
    await page.getByLabel('Password', { exact: true }).fill('browser-fixture-password');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await checkTouchTargets(page, 'Login 320px');
    await page.route('**/api/auth/login', route => route.fulfill({ status: 503, contentType: 'text/html', body: '<html>Temporary proxy failure</html>' }));
    await page.getByRole('button', { name: 'Back to my college' }).click();
    await page.getByRole('alert').filter({ hasText: 'The server is temporarily unavailable. Please try again.' }).waitFor();
    assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), 'browser-fixture-password', 'Login outages preserve entered credentials and show a readable error');
    await page.unroute('**/api/auth/login');
    await page.getByRole('button', { name: 'Back to my college' }).click();
    await page.waitForURL('**/poster');
    await page.getByRole('heading', { name: 'Your campus. Two ways to connect.' }).waitFor();
    await page.getByLabel('Notice title', { exact: true }).fill('Browser-created campus notice');
    await page.getByLabel('Notice message', { exact: true }).fill('A real browser is publishing a college notice through the Poster dashboard.');
    await page.getByRole('button', { name: /^Private Help/ }).click();
    await page.getByLabel('Help request title').fill('Browser-created private help request');
    await page.getByLabel('Help details').fill('A real browser is requesting private guidance from appointed college Helpers.');
    await page.getByRole('button', { name: /^Notice Board/ }).click();
    assert.equal(await page.getByLabel('Notice title', { exact: true }).inputValue(), 'Browser-created campus notice');
    await page.reload();
    await page.locator('#notice-title:enabled').waitFor();
    assert.equal(await page.getByLabel('Notice title', { exact: true }).inputValue(), 'Browser-created campus notice', 'Notice drafts survive reload');
    await page.goto(`${baseURL}/poster/request-help`);
    await page.getByLabel('Help request title').waitFor({ state: 'visible' });
    await page.locator('#help-title:enabled').waitFor();
    assert.match(page.url(), /\/poster\?section=help/);
    assert.equal(await page.getByLabel('Help request title').inputValue(), 'Browser-created private help request', 'Help drafts survive navigation and the legacy link opens the private form');
    await page.getByRole('button', { name: /^Notice Board/ }).click();
    await page.route('**/api/notice-board', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Temporary fixture failure. Try again."}' }) : route.continue());
    await page.getByRole('button', { name: 'Publish notice ↗' }).click();
    await page.getByRole('alert').filter({ hasText: 'Temporary fixture failure. Try again.' }).waitFor();
    assert.equal(await page.getByLabel('Notice title', { exact: true }).inputValue(), 'Browser-created campus notice');
    await page.getByRole('button', { name: /^Private Help/ }).click();
    await page.getByLabel('Help request title').waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('alert').filter({ hasText: 'Temporary fixture failure. Try again.' }).isVisible(), false, 'Notice errors do not appear in the Help Form');
    await page.getByRole('button', { name: /^Notice Board/ }).click();
    await page.unroute('**/api/notice-board');
    await page.getByRole('button', { name: 'Publish notice ↗' }).click();
    await page.getByRole('heading', { name: 'Browser-created campus notice' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Publish notice ↗' }).isDisabled(), true);
    await auditMember(page, '/poster/notice');
    await page.getByRole('button', { name: /^Private Help/ }).click();
    assert.equal(await page.getByLabel('Help request title').inputValue(), 'Browser-created private help request');
    await page.getByRole('button', { name: 'Send private help request ↗' }).click();
    await page.getByRole('heading', { name: 'Browser-created private help request' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Send private help request ↗' }).isDisabled(), true);
    assert.equal(await page.getByRole('heading', { name: 'Another Poster’s private fixture' }).count(), 0);
    const ownerRequests = (await (await context.request.get(`${baseURL}/api/help-requests`)).json()).requests;
    const privateId = ownerRequests.find(item => item.title === 'Browser-created private help request').id;
    await auditMember(page, '/poster/help');
    await page.reload();
    await page.getByRole('button', { name: /^Private Help/ }).click();
    await page.getByRole('heading', { name: 'Browser-created private help request' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Send private help request ↗' }).isDisabled(), true);
    await page.goto(`${baseURL}/helper`);
    await page.waitForURL('**/poster');
    await page.goto(`${baseURL}/superadmin`);
    await page.waitForURL('**/poster');
    await page.getByRole('link', { name: 'Notice board', exact: true }).click();
    await page.waitForURL('**/campus');
    assert.equal(await page.getByRole('heading', { name: 'Browser-created private help request' }).count(), 0);
    const discussion = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'A fixture question with a long discussion' }) });
    await discussion.locator('summary').click();
    assert.equal(await discussion.locator('.reply-item').count(), 10);
    await discussion.getByRole('button', { name: 'Load older replies' }).click();
    await discussion.getByText('Fixture answer 6', { exact: true }).waitFor();
    assert.equal(await discussion.locator('.reply-item').count(), 30);
    await discussion.getByRole('button', { name: 'Load older replies' }).click();
    await discussion.getByText('Fixture answer 1', { exact: true }).waitFor();
    assert.equal(await discussion.locator('.reply-item').count(), 35);
    const created = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Browser-created campus notice' }) });
    await created.locator('summary').click();
    await created.getByLabel('Write a notice reply').fill('Browser-created notice reply.');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
    assert.equal(await created.getByLabel('Write a notice reply').inputValue(), 'Browser-created notice reply.', 'Refresh keeps reply drafts and open conversations');
    await discussion.getByLabel('Write a notice reply').fill('An unsent reply in a different conversation.');
    await created.getByRole('button', { name: 'Post reply ↗' }).click();
    await page.getByText('Reply saved. The conversation is up to date.', { exact: true }).waitFor();
    assert.equal(await discussion.getByLabel('Write a notice reply').inputValue(), 'An unsent reply in a different conversation.', 'Saving one reply preserves another conversation draft');
    await page.reload();
    await created.locator('summary').click();
    await created.getByText('Browser-created notice reply.', { exact: true }).waitFor();
    await page.getByLabel('Filter by topic').selectOption('Campus life');
    await page.getByRole('heading', { name: 'Browser-created campus notice' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'A fixture question with a long discussion' }).count(), 0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await discussion.getByRole('heading').waitFor();
    await auditMember(page, '/campus');
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('**/login');
    assert.equal((await context.request.get(`${baseURL}/api/me`)).status(), 401);
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith('bachaoo:draft:'))), false, 'Logout removes local conversation drafts');
    await loginAs(page, '123456789013@cutm.ac.in', 'browser-helper-password', 'helper');
    const studentRequest = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Browser-created private help request' }) });
    await studentRequest.locator('summary').click();
    await studentRequest.getByLabel('Your Helper reply').fill('Browser-created private Helper response.');
    await studentRequest.getByRole('button', { name: 'Post reply ↗' }).click();
    await page.getByText('Reply saved. The conversation is up to date.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'My replies', exact: true }).click();
    await studentRequest.locator('summary').click();
    await studentRequest.getByText('Browser-created private Helper response.', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'My replies', exact: true }).click();
    await studentRequest.locator('summary').click();
    await studentRequest.getByText('Browser-created private Helper response.', { exact: true }).waitFor();
    await auditMember(page, '/helper');
    assert.equal(await page.getByRole('button', { name: 'Publish notice ↗' }).count(), 0);
    await page.goto(`${baseURL}/poster`);
    await page.waitForURL('**/helper');
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginAs(ownerPage, '123456789012@cutm.ac.in', 'browser-fixture-password', 'poster');
    await ownerPage.getByRole('button', { name: /^Private Help/ }).click();
    const ownerThread = ownerPage.getByRole('article').filter({ has: ownerPage.getByRole('heading', { name: 'Browser-created private help request' }) });
    await ownerThread.locator('summary').click();
    await ownerThread.getByText('Browser-created private Helper response.', { exact: true }).waitFor();
    assert.equal(await ownerThread.locator('textarea').count(), 0, 'A requester reads Helper replies but cannot write them');
    await ownerContext.close();
    const adminContext = await browser.newContext({ viewport: { width: 320, height: 900 } });
    const adminPage = await adminContext.newPage();
    adminPage.on('pageerror', error => errors.push(error.message));
    await adminPage.goto(`${baseURL}/admin/setup#invite=${'a'.repeat(64)}`);
    await adminPage.getByLabel('Admin display name').fill('Browser Invited Admin');
    await adminPage.getByLabel('Choose password', { exact: true }).fill('browser-invited-admin-password');
    await adminPage.getByLabel('Confirm password', { exact: true }).fill('mismatched-password');
    await adminPage.getByRole('button', { name: 'Activate Admin account ↗' }).click();
    await adminPage.getByRole('alert').filter({ hasText: 'Passwords do not match.' }).waitFor();
    await adminPage.getByLabel('Confirm password', { exact: true }).fill('browser-invited-admin-password');
    await adminPage.getByRole('button', { name: 'Activate Admin account ↗' }).click();
    await adminPage.waitForURL('**/superadmin');
    assert.equal((await adminContext.request.get(`${baseURL}/api/help-requests`)).status(), 403);
    const peerMember = adminPage.locator('.admin-member').filter({ has: adminPage.getByRole('heading', { name: 'Browser Peer', exact: true }) });
    await peerMember.getByRole('button', { name: 'Assign Helper' }).click();
    assert.equal(await adminPage.locator('.admin-confirm').evaluate(el => el === document.activeElement), true, 'Confirmation receives keyboard focus and scrolls into view');
    await adminPage.getByRole('button', { name: 'Cancel', exact: true }).click();
    await peerMember.getByRole('button', { name: 'Assign Helper' }).waitFor();
    assert.equal(await peerMember.getByRole('button', { name: 'Assign Helper' }).evaluate(el => el === document.activeElement), true, 'Cancelling returns focus to the member action');
    await peerMember.getByRole('button', { name: 'Assign Helper' }).click();
    await adminPage.keyboard.press('Escape');
    assert.equal(await adminPage.locator('.admin-confirm').count(), 0, 'Escape dismisses the role confirmation');
    await peerMember.getByRole('button', { name: 'Assign Helper' }).click();
    await adminPage.getByRole('button', { name: 'Confirm role change' }).click();
    await peerMember.getByRole('button', { name: 'Revoke Helper' }).waitFor();
    await adminPage.reload();
    await peerMember.getByRole('button', { name: 'Revoke Helper' }).waitFor();
    const helperMember = adminPage.locator('.admin-member').filter({ has: adminPage.getByRole('heading', { name: 'Browser Helper', exact: true }) });
    await helperMember.getByRole('button', { name: 'Revoke Helper' }).click();
    await adminPage.getByRole('button', { name: 'Confirm role change' }).click();
    await helperMember.getByRole('button', { name: 'Assign Helper' }).waitFor();
    await auditMember(adminPage, '/superadmin');
    assert.equal((await context.request.get(`${baseURL}/api/help-requests/${privateId}`)).status(), 404, 'Revoked Helper loses access with their old session');
    await page.reload();
    await page.waitForURL('**/poster');
    await page.getByRole('button', { name: /^Private Help/ }).click();
    await page.getByRole('heading', { name: 'No help requests in this view.' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Browser-created private help request' }).count(), 0);
    await adminPage.getByRole('button', { name: 'Log out' }).click();
    await adminPage.waitForURL('**/login');
    assert.equal((await adminContext.request.get(`${baseURL}/api/admin/users`)).status(), 401);
    await loginAs(adminPage, 'invited.browser@example.invalid', 'browser-invited-admin-password', 'superadmin');
    await helperMember.getByRole('button', { name: 'Assign Helper' }).waitFor();
    await adminContext.close();
    assert.deepEqual(errors, [], 'Member/Admin flows have no browser runtime errors');
    console.log('PASS independent notice/help drafts, failed-save recovery, daily quotas, private responses, pagination, reload and logout');
    console.log('PASS Admin activation, assignment/revocation/audit, stale-session denial, all member layouts at 320–1440px');
  }
  assert.deepEqual(failures, [], `Accessibility violations: ${JSON.stringify(failures, null, 2)}`);
  console.log('PASS automated WCAG A/AA checks (not a substitute for manual accessibility review)');
  await context.close();
} finally {
  await browser.close();
}
