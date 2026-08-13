import { test, expect, type Page } from '@playwright/test';

/**
 * The Agents workspace (/settings/automation) end to end, with the Configuration
 * Agent's chat stream stubbed so it runs without an API key: ideate -> question
 * card -> proposed configuration -> accept -> back-test / preview -> created list.
 */

const QUESTION_REPLY = `Plenty we could do there. Chasing missing PO references is a good first one — it's the kind of thing that quietly eats a day a week.

Which invoices should this cover?
- All invoices that arrive without a PO number
- Only invoices above a threshold
- Only vendors in a particular group`;

const CONFIG_REPLY = `This emails the vendor whenever an invoice arrives without a purchase order reference, so your team stops chasing by hand.

It runs on Auto apply, since an informational email to a vendor is safe and easily reversible. You can switch it to Suggest or Shadow whenever you like.

Here is the configuration:

\`\`\`json
{
  "outputType": "send-emails",
  "kind": "rule",
  "summary": "Chase vendor for missing PO number",
  "description": "When a workflow invoice arrives from email with no PO number, email the vendor to request the purchase order reference.",
  "examples": ["INV-44712 from Acme Logistics Ltd arrived with no PO reference - emailed accounts@acmelogistics.com"],
  "mode": "auto",
  "conditions": ["PO number is blank", "Source is EMAIL"],
  "actions": ["Email the vendor to request the PO number"],
  "responseSubject": "Purchase order reference required for invoice {{invoiceNumber}}",
  "responseBody": "Dear {{vendorName}},\\n\\nWe have received invoice {{invoiceNumber}}, but no purchase order reference was quoted.\\n\\nKind regards,\\nAccounts Payable"
}
\`\`\``;

const BACKTEST_REPLY = `This is a hypothetical replay on sample data — nothing has actually run.

- **INV-44712 · Acme Logistics Ltd** — Emailed accounts@acmelogistics.com about the missing PO
- **INV-44698 · Northwind Traders** — Emailed accounts@northwind.com about the missing PO
- **INV-44701 · Globex Industrial** — No match, PO-2026-1188 was quoted on the invoice`;

const DEFINITION_REPLY = `This refines how the invoice number is captured, stripping the vendor's "INV-" prefix so it matches your ledger.

\`\`\`json
{
  "outputType": "custom-extraction-instructions",
  "kind": "definition",
  "summary": "Strip the INV- prefix from invoice numbers",
  "description": "Capture the invoice number without the vendor's leading INV- prefix.",
  "instruction": "When the invoice number begins with 'INV-', capture only the characters after the prefix, keeping any leading zeros. Leave numbers without the prefix untouched.",
  "reference": ["Invoice number"],
  "target": "Invoice number",
  "examples": ["INV-20491 becomes 20491", "44712 stays 44712"]
}
\`\`\``;

function sse(text: string) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 300) {
    chunks.push(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 300) } }] })}\n\n`);
  }
  chunks.push('data: [DONE]\n\n');
  return chunks.join('');
}

async function stub(page: Page, replies: string[]) {
  let index = 0;
  await page.route('**/api/agent-builder/chat', (route) => {
    const body = sse(replies[Math.min(index, replies.length - 1)]);
    index += 1;
    return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body });
  });
}

async function send(page: Page, text: string) {
  const input = page.getByLabel('Message the Configuration Agent');
  await input.fill(text);
  await input.press('Enter');
}

test('empty workspace inside the app chrome', async ({ page }) => {
  await stub(page, [QUESTION_REPLY]);
  await page.goto('/settings/automation');
  await expect(page.getByRole('heading', { name: 'What could we automate?' })).toBeVisible();
  await expect(page.getByText('No configuration yet')).toBeVisible();
  await expect(
    page.getByText('This is a prototype only, it is not using any real data and is not built'),
  ).toBeVisible();
  // Sidebar and top-bar pills come from AppLayout, with Agents as the active pill
  await expect(page.getByRole('link', { name: /Agent Builder \(current\)/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Tabs' })).toBeVisible();
  await page.screenshot({ path: 'test-results/auto-1-empty.png' });
});

test('question card', async ({ page }) => {
  await stub(page, [QUESTION_REPLY]);
  await page.goto('/settings/automation');
  await send(page, 'Help me cut down the manual chasing in AP');
  await expect(page.getByText('Which invoices should this cover?')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /All invoices that arrive without a PO number/ })).toBeVisible();
  await expect(page.getByPlaceholder('Something else…')).toBeVisible();
  await page.screenshot({ path: 'test-results/auto-2-question.png' });
});

test('proposed configuration, then accept', async ({ page }) => {
  await stub(page, [QUESTION_REPLY, CONFIG_REPLY]);
  await page.goto('/settings/automation');
  await send(page, 'Chase vendors when an invoice has no PO');
  await page.getByRole('button', { name: /All invoices that arrive without a PO number/ }).click();

  await expect(page.getByRole('heading', { name: 'Proposed configuration' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Your configuration is ready in the Builder')).toBeVisible();
  await expect(page.getByText('External connection')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Auto apply' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Chase vendor for missing PO number')).toBeVisible();
  // The prose reply survives; the raw json block never shows
  await expect(page.getByText(/stops chasing by hand/)).toBeVisible();
  await expect(page.getByText('```json')).toHaveCount(0);
  // The configuration renders as a card, so a line announcing an inline block is dropped
  await expect(page.getByText('Here is the configuration:')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/auto-3-proposed.png' });

  await page.getByRole('button', { name: /Accept & go live/ }).click();
  await expect(page.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Agent enabled' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('heading', { name: 'Chase vendor for missing PO number' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New agent' })).toBeVisible();
  await page.screenshot({ path: 'test-results/auto-4-saved.png' });
});

test('back-test results post into the chat', async ({ page }) => {
  await stub(page, [CONFIG_REPLY, BACKTEST_REPLY]);
  await page.goto('/settings/automation');
  await send(page, 'Chase vendors when an invoice has no PO');
  await expect(page.getByRole('button', { name: 'Run back-test' })).toBeEnabled({ timeout: 15000 });
  await page.getByRole('button', { name: 'Run back-test' }).click();

  await expect(page.getByText('INV-44712 · Acme Logistics Ltd')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('No match, PO-2026-1188 was quoted on the invoice')).toBeVisible();
  await expect(page.getByText(/illustrative only, nothing has actually run/)).toBeVisible();
  await page.screenshot({ path: 'test-results/auto-5-backtest.png' });
});

test('definition renders instruction sections', async ({ page }) => {
  await stub(page, [DEFINITION_REPLY]);
  await page.goto('/settings/automation');
  await send(page, 'Strip the INV- prefix off invoice numbers');
  await expect(page.getByText('Custom extraction instructions').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Instruction', { exact: true })).toBeVisible();
  await expect(page.getByText('Refines', { exact: true })).toBeVisible();
  await expect(page.getByText(/keeping any leading zeros/)).toBeVisible();
  // Definitions have no mode
  await expect(page.getByRole('radiogroup', { name: 'Mode' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/auto-6-definition.png' });
});

test('created agents list', async ({ page }) => {
  await stub(page, [CONFIG_REPLY]);
  await page.goto('/settings/automation');
  await send(page, 'Chase vendors when an invoice has no PO');
  await page.getByRole('button', { name: /Accept & go live/ }).click({ timeout: 15000 });

  await page.goto('/settings/automation/created');
  await expect(page.getByRole('heading', { name: 'Active agents' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Active Agents \(current\)/ })).toBeVisible();
  await expect(page.getByText('Chase vendor for missing PO number').first()).toBeVisible();
  await expect(page.getByText('“Chase vendors when an invoice has no PO”')).toBeVisible();
  await expect(page.getByText('Send emails · Created')).toBeVisible();
  await page.screenshot({ path: 'test-results/auto-7-created.png' });

  // Row deep-links back into the workspace with that agent loaded
  await page.getByRole('link', { name: /Chase vendor for missing PO number/ }).click();
  await expect(page.getByRole('heading', { name: 'Chase vendor for missing PO number' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/auto-8-deeplink.png' });
});

test('empty created list', async ({ page }) => {
  await page.goto('/settings/automation/created');
  await expect(page.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible();
  await expect(
    page.getByText('This is a prototype only, it is not using any real data and is not built'),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/auto-9-created-empty.png' });
});

const PREVIEW_REPLY = `Here's how that email would read for a sample invoice.

To: accounts@acmelogistics.com
Subject: Purchase order reference required for invoice INV-44712

Dear Acme Logistics Ltd,

We have received invoice INV-44712 for £2,340.00, but no purchase order reference was quoted.

Could you confirm the PO number so we can process it for payment?

Kind regards,
Accounts Payable`;

test('email preview posts into the chat and applies to the config', async ({ page }) => {
  await stub(page, [CONFIG_REPLY, PREVIEW_REPLY]);
  await page.goto('/settings/automation');
  await send(page, 'Chase vendors when an invoice has no PO');
  await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Preview' }).click();

  await expect(page.getByText('Purchase order reference required for invoice INV-44712')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('accounts@acmelogistics.com')).toBeVisible();
  await expect(page.getByText(/Could you confirm the PO number/)).toBeVisible();
  // The preview fills the placeholders; the stored template in the Builder keeps them
  const preview = page.locator('[class*="panelCard"]').first();
  await expect(preview.getByText('{{invoiceNumber}}')).toHaveCount(0);
  await expect(page.getByText(/Sends the email .*\{\{invoiceNumber\}\}/)).toBeVisible();
  await page.screenshot({ path: 'test-results/auto-10-preview.png' });

  await page.getByRole('button', { name: 'Apply to Proposed config' }).click();
  await expect(page.getByText('Applied to the configuration')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply to Proposed config' })).toHaveCount(0);
});

test('top nav shows only the two pills, hash deep links still resolve', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/settings/automation');
  await page.waitForTimeout(600);

  const pills = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav[aria-label="Tabs"] a')).map((a) => a.textContent),
  );
  expect(pills).toEqual(['Agent Builder', 'Active Agents']);
  await expect(page.getByRole('link', { name: /Agent Builder \(current\)/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/nav-builder.png', clip: { x: 0, y: 0, width: 1600, height: 120 } });

  // Active Agents pill goes to the saved-agent list and shows as current
  await page.getByRole('link', { name: /Active Agents/ }).click();
  await expect(page.getByRole('heading', { name: 'Active agents' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Active Agents \(current\)/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/nav-active.png' });

  // /settings lands on the workspace
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/settings\/automation$/);

  // The previous screens are unlinked but still reachable at /settings-old
  await page.goto('/settings-old#agent-builder-2');
  await page.waitForTimeout(900);
  await expect(page.getByRole('button', { name: /New Agent/i }).first()).toBeVisible({ timeout: 15000 });
  const legacyPills = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav[aria-label="Tabs"] a')).map((a) => a.textContent),
  );
  expect(legacyPills).toEqual(['Dashboard', 'Agent Builder', 'Back Testing', 'Documents', 'General Settings']);
  await page.goto('/settings-old#general-settings');
  await page.waitForTimeout(900);
  await expect(page.locator('#main-content')).not.toBeEmpty();
});

// A reply that lists the sample items first and their outcomes afterwards must not
// render an item twice, and a non-matching item must not read as though it acted
const SPLIT_BACKTEST_REPLY = `To run a back-test, here are 3 sample invoice line items:

- **INV-20491**: 2 bags of cement, description "Cement Bags"
- **INV-20492**: 3 bags of cement, description "Portland Cement"
- **INV-20494**: 4 bags of aggregate, description "Aggregate Bags"
- **INV-20491**: 10 kg (2 bags x 5 kg), written to custom field cement_weight_kg
- **INV-20492**: 15 kg (3 bags x 5 kg), written to custom field cement_weight_kg
- **INV-20494**: No derivation (not cement), custom field cement_weight_kg not populated`;

test('back-test folds split input/outcome lines into one row per item', async ({ page }) => {
  await stub(page, [CONFIG_REPLY, SPLIT_BACKTEST_REPLY]);
  await page.goto('/settings/automation');
  await send(page, 'Convert each bag of cement into 5kg');
  await expect(page.getByRole('button', { name: 'Run back-test' })).toBeEnabled({ timeout: 15000 });
  await page.getByRole('button', { name: 'Run back-test' }).click();

  const rows = page.locator('[class*="resultRow"]');
  await expect(rows).toHaveCount(3, { timeout: 15000 });
  // Each row carries the item and what would happen to it
  await expect(rows.nth(0)).toContainText('2 bags of cement');
  await expect(rows.nth(0)).toContainText('10 kg');
  await expect(page.getByText('INV-20491').first()).toBeVisible();
  // The non-matching item is marked as not acted on
  await expect(rows.nth(2)).toContainText('No derivation');
});
