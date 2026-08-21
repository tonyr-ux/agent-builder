import { test, expect, type Page } from '@playwright/test';

/**
 * The hidden session log at /settings/automation/log, backed by
 * /api/agent-builder/log and migration 206.
 *
 * Needs a database, so it skips when the API can't reach one — the rest of the
 * suite stays green without DATABASE_URL set.
 */

const CONFIG_REPLY = `This emails the vendor when an invoice arrives with no PO reference.

\`\`\`json
{"outputType":"send-emails","kind":"rule","summary":"Chase vendor for missing PO number","mode":"auto","conditions":["PO number is blank"],"actions":["Email the vendor to request the PO number"],"responseSubject":"PO required for {{invoiceNumber}}","responseBody":"Dear {{vendorName}}, please confirm the PO."}
\`\`\``;

function sse(text: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
}

/** Each run writes rows that stay in the table, so messages carry a unique marker */
function marker() {
  return `probe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function requireLogApi(page: Page) {
  const probe = await page.request.get('/api/agent-builder/log?limit=1');
  test.skip(!probe.ok(), 'Session log needs a database — set DATABASE_URL and apply migration 206');
}

async function send(page: Page, text: string) {
  const input = page.getByLabel('Message the Configuration Agent');
  await input.fill(text);
  await input.press('Enter');
}

async function findEvent(page: Page, message: string) {
  const response = await page.request.get('/api/agent-builder/log?limit=500');
  expect(response.ok()).toBe(true);
  const payload = await response.json();
  return payload.events.find((event: { user_message: string }) => event.user_message === message);
}

test('records a turn, then shows and downloads it on the hidden page', async ({ page }) => {
  await requireLogApi(page);
  const message = `Chase vendors when an invoice has no PO ${marker()}`;

  await page.route('**/api/agent-builder/chat', (route) =>
    route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: sse(CONFIG_REPLY) }),
  );
  await page.goto('/settings/automation');
  await send(page, message);
  await expect(page.getByRole('heading', { name: 'Proposed configuration' })).toBeVisible({ timeout: 15000 });

  // The POST is fire-and-forget, so wait for the row to land
  await expect.poll(async () => !!(await findEvent(page, message)), { timeout: 10000 }).toBe(true);

  const event = await findEvent(page, message);
  expect(event.raw_response).toContain('outputType');
  expect(event.parsed_json.config.summary).toBe('Chase vendor for missing PO number');
  expect(event.parsed_json.prose).toContain('emails the vendor');
  expect(event.request_json.messages.length).toBeGreaterThanOrEqual(1);
  expect(event.action).toBe('build');
  expect(event.duration_ms).toBeGreaterThanOrEqual(0);

  await page.goto('/settings/automation/log');
  await expect(page.getByRole('heading', { name: 'Session log' })).toBeVisible();

  const entry = page.getByRole('button', { name: new RegExp(message) });
  await entry.click();
  await expect(page.getByText('Model response (raw, before parsing)')).toBeVisible();
  await expect(page.getByText('Parsed by the UI')).toBeVisible();
  await expect(page.getByText('Request sent to the model')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download JSON/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^config-agent-sessions-.*\.json$/);
});

test('records a failed turn with its error', async ({ page }) => {
  await requireLogApi(page);
  const message = `this turn will fail ${marker()}`;

  await page.route('**/api/agent-builder/chat', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Groq API key not configured.' }),
    }),
  );
  await page.goto('/settings/automation');
  await send(page, message);
  await expect(page.getByText(/couldn't reach the Configuration Agent/i)).toBeVisible({ timeout: 15000 });

  await expect.poll(async () => !!(await findEvent(page, message)), { timeout: 10000 }).toBe(true);
  const event = await findEvent(page, message);
  expect(event.error).toContain('Groq API key not configured');
  expect(event.raw_response).toBeNull();
});

test('the log is not linked from the workspace', async ({ page }) => {
  await page.goto('/settings/automation');
  await expect(page.getByRole('link', { name: /log/i })).toHaveCount(0);
  await page.goto('/settings/automation/created');
  await expect(page.getByRole('link', { name: /log/i })).toHaveCount(0);
});
