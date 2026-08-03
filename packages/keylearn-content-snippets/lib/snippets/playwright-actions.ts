import { type Snippet } from "../types.ts";

/**
 * Doing things to the page.
 *
 * Every action here waits for the element to be ready on its own, which is why
 * none of them are preceded by a sleep. That is the habit worth building: a
 * test that waits for a fixed number of milliseconds is either slow or flaky,
 * and usually both.
 */
export const actions: readonly Snippet[] = [
  {
    id: "pw-act-fill",
    title: "Type into a field, replacing what is there",
    level: 1,
    tags: ["action", "form"],
    code: `// fill clears first and sets the value in one go, so it does not matter
// what the field already held.
await page.getByLabel('Full name').fill('Ada Lovelace');`,
  },
  {
    id: "pw-act-clear",
    title: "Empty a field",
    level: 1,
    tags: ["action", "form"],
    code: `// Clearer than fill('') and it fires the events a real deletion would.
await page.getByLabel('Search').clear();`,
  },
  {
    id: "pw-act-type-slow",
    title: "Type key by key, when the page reacts to each keystroke",
    level: 2,
    tags: ["action", "keyboard"],
    code: `// fill sets the value in one event, which an autocomplete listening for
// keystrokes will never see. This is the exception, not the default.
await page
  .getByRole('combobox', { name: 'City' })
  .pressSequentially('Melb', { delay: 100 });`,
  },
  {
    id: "pw-act-check",
    title: "Tick and untick a checkbox",
    level: 1,
    tags: ["action", "form"],
    code: `// check and uncheck assert the resulting state, so an unresponsive
// checkbox fails here rather than three assertions later.
await page.getByLabel('Remember me').check();
await page.getByLabel('Send me offers').uncheck();`,
  },
  {
    id: "pw-act-radio",
    title: "Choose a radio button",
    level: 1,
    tags: ["action", "form"],
    code: `// check rather than click: it verifies the radio ended up selected.
await page.getByRole('radio', { name: 'Express delivery' }).check();`,
  },
  {
    id: "pw-act-select",
    title: "Choose from a native select",
    level: 1,
    tags: ["action", "form"],
    code: `// The bare string matches the option's value attribute, not its label.
await page.getByLabel('Country').selectOption('AU');`,
  },
  {
    id: "pw-act-select-multi",
    title: "Choose several options at once",
    level: 2,
    tags: ["action", "form"],
    code: `// Replaces the whole selection rather than adding to it.
await page.getByLabel('Languages').selectOption(['en', 'fr', 'de']);`,
  },
  {
    id: "pw-act-select-label",
    title: "Choose an option by its visible label",
    level: 2,
    tags: ["action", "form"],
    code: `// Use this when the value attribute is an opaque id: the test then reads
// the way the page does.
await page.getByLabel('Size').selectOption({ label: 'Medium' });`,
  },
  {
    id: "pw-act-dblclick",
    title: "Double click",
    level: 1,
    tags: ["action", "mouse"],
    code: `// One call, not two clicks: two separate clicks may fall outside the
// interval the browser counts as a double click.
await page.getByRole('cell', { name: 'Rename me' }).dblclick();`,
  },
  {
    id: "pw-act-rightclick",
    title: "Open a context menu",
    level: 2,
    tags: ["action", "mouse"],
    code: `// Assert the menu appeared before acting on it, or the next click races
// the menu's own animation.
await page.getByTestId('file-row').click({ button: 'right' });
await expect(page.getByRole('menu')).toBeVisible();`,
  },
  {
    id: "pw-act-modifier-click",
    title: "Click while holding a modifier",
    level: 2,
    tags: ["action", "mouse"],
    code: `// Playwright presses and releases the modifier for you, so nothing is
// left held down for the rest of the test.
await page
  .getByRole('listitem', { name: 'report.pdf' })
  .click({ modifiers: ['Shift'] });`,
  },
  {
    id: "pw-act-hover",
    title: "Hover to reveal something",
    level: 1,
    tags: ["action", "mouse"],
    code: `// Hover-only interfaces are unreachable by keyboard and touch; a test
// that needs this is often pointing at a real accessibility problem.
await page.getByRole('button', { name: 'More' }).hover();
await expect(page.getByRole('tooltip')).toHaveText('More actions');`,
  },
  {
    id: "pw-act-press",
    title: "Press a key and a chord",
    level: 1,
    tags: ["action", "keyboard"],
    code: `// Pressing on the locator focuses it first; page.keyboard sends the key
// wherever focus already is.
await page.getByLabel('Search').press('Enter');
await page.keyboard.press('Control+Shift+P');`,
  },
  {
    id: "pw-act-upload",
    title: "Upload a file",
    level: 2,
    tags: ["action", "file"],
    code: `// Sets the input directly, so no operating-system file dialog is opened
// and nothing has to be clicked in it.
await page
  .getByLabel('Attach a receipt')
  .setInputFiles('tests/fixtures/receipt.pdf');`,
  },
  {
    id: "pw-act-upload-many",
    title: "Upload several files, then remove them",
    level: 3,
    tags: ["action", "file"],
    code: `// An empty array clears the selection, which is how you test the remove
// path without hunting for a delete button.
const input = page.getByLabel('Photos');
await input.setInputFiles(['a.png', 'b.png', 'c.png']);
await expect(page.getByRole('listitem')).toHaveCount(3);
await input.setInputFiles([]);`,
  },
  {
    id: "pw-act-download",
    title: "Wait for a download and save it",
    level: 3,
    tags: ["action", "file"],
    code: `// Start waiting before the click. Await the click first and the download
// may have finished before anything was listening for it.
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Export CSV' }).click();
const download = await downloadPromise;
await download.saveAs('tmp/' + download.suggestedFilename());`,
  },
  {
    id: "pw-act-dragdrop",
    title: "Drag one element onto another",
    level: 3,
    tags: ["action", "mouse"],
    code: `// dragTo handles the whole sequence. Hand-rolled mouse moves are where
// drag tests usually turn flaky.
await page.getByTestId('task-42').dragTo(page.getByTestId('column-done'));`,
  },
  {
    id: "pw-act-dialog",
    title: "Accept a browser dialog",
    level: 3,
    tags: ["action", "dialog"],
    code: `// Register the handler first: an unhandled dialog is dismissed
// automatically, so the click would appear to do nothing.
page.once('dialog', (dialog) => dialog.accept());
await page.getByRole('button', { name: 'Delete account' }).click();`,
  },
  {
    id: "pw-act-newtab",
    title: "Follow a link that opens a new tab",
    level: 3,
    tags: ["action", "context"],
    code: `// The new page arrives on the context, not on the page that opened it.
const pagePromise = context.waitForEvent('page');
await page.getByRole('link', { name: 'Open report' }).click();
const report = await pagePromise;
await expect(report).toHaveTitle(/Quarterly report/);`,
  },
  {
    id: "pw-act-focus-blur",
    title: "Move focus deliberately",
    level: 2,
    tags: ["action", "keyboard"],
    code: `// Validation that runs on blur will not fire while the field still has
// focus, which is why the field looks valid and the form will not submit.
await page.getByLabel('Amount').focus();
await page.keyboard.type('149.99');
await page.getByLabel('Amount').blur();`,
  },
];
