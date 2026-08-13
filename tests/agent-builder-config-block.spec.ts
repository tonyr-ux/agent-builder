import { test, expect } from '@playwright/test';

/**
 * Locks the Configuration Agent's output contract in the UI: a reply containing a
 * fenced json configuration block must render as prose + a configuration card, and
 * applying it must name the agent, set its module and set its mode.
 * The chat stream is stubbed, so this needs no API key.
 */
const REPLY = `This emails the vendor whenever an invoice arrives without a matching purchase order, so your team stops chasing by hand.

It runs on Auto apply, since an informational email to a vendor is safe and easily reversible. You can switch it to Suggest or Shadow whenever you like.

\`\`\`json
{
  "outputType": "send-emails",
  "kind": "rule",
  "summary": "Chase vendor for missing PO number",
  "description": "When a workflow invoice arrives from email with no PO number, email the vendor to request the purchase order reference before the invoice goes any further.",
  "examples": ["INV-44712 from Acme Logistics Ltd arrived with no PO reference - emailed accounts@acmelogistics.com"],
  "mode": "auto",
  "conditions": ["PO number is blank", "Source is EMAIL"],
  "actions": ["Email the vendor to request the PO number"],
  "responseSubject": "Purchase order reference required for invoice {{invoiceNumber}}",
  "responseBody": "Dear {{vendorName}},\\n\\nWe have received invoice {{invoiceNumber}}, but no purchase order reference was quoted.\\n\\nCould you confirm the PO number so we can process it for payment?\\n\\nKind regards,\\nAccounts Payable"
}
\`\`\`

Next step: apply it, then ask me for a back-test if you would like to see how it behaves.`;

function sse(text: string) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 400) {
    chunks.push(
      `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 400) } }] })}\n\n`,
    );
  }
  chunks.push('data: [DONE]\n\n');
  return chunks.join('');
}

test('configuration card renders under the prose reply', async ({ page }) => {
  await page.route('**/api/agent-builder/chat', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sse(REPLY),
    }),
  );

  await page.goto('/settings#agent-builder-2');
  await page.getByRole('button', { name: /new agent|create agent|add agent/i }).first().click();

  const input = page.getByPlaceholder(/Describe what your agent should do/i);
  await input.waitFor({ timeout: 15000 });
  await input.fill('Email vendors when an invoice has no PO number');
  await input.press('Enter');

  await expect(page.getByText('Chase vendor for missing PO number')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Send emails', { exact: true })).toBeVisible();
  await expect(page.getByText('Auto apply', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Apply configuration/i })).toBeVisible();
  // The prose reply must survive alongside the card, without the raw json fence
  await expect(page.getByText(/stops chasing by hand/i)).toBeVisible();
  await expect(page.getByText('```json')).toHaveCount(0);

  // Applying it should name the agent from the summary, file it under Xelix Capture
  // and carry the rule mode across to the agent
  await page.getByRole('button', { name: /Apply configuration/i }).click();
  await expect(page.getByText('Xelix Capture').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: /Chase vendor for missing PO number/i })).toBeVisible();
  await expect(page.getByRole('combobox').first()).toHaveValue('auto-apply');
});
