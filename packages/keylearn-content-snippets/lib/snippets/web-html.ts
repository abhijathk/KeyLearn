import { type Snippet } from "../types.ts";

/**
 * HTML, written so it works before any CSS or JavaScript arrives.
 *
 * The corpus is weighted towards semantics and forms, because that is where
 * the difference between markup that works and markup that merely looks right
 * actually shows up — and because a div with a click handler is still the most
 * common accessibility defect on the web.
 */
export const webHtml: readonly Snippet[] = [
  {
    id: "html-document",
    title: "The head of a document",
    level: 2,
    tags: ["structure"],
    code: `<!-- The viewport meta is what stops a phone rendering the page at
     desktop width and zooming out. lang is what tells a screen reader
     which voice to use. -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Orders — KeyLearn</title>`,
  },
  {
    id: "html-landmarks",
    title: "The landmark elements",
    level: 2,
    tags: ["structure", "accessibility"],
    code: `<!-- These are what a screen reader's landmark list is built from. A page
     of divs offers no way to skip to the content. -->
<header>…</header>
<nav aria-label="Primary">…</nav>
<main>…</main>
<footer>…</footer>`,
  },
  {
    id: "html-headings",
    title: "Headings in order",
    level: 2,
    tags: ["structure", "accessibility"],
    code: `<!-- One h1 per page, and no skipping a level for the sake of the size
     it happens to render at. Use CSS for the size. -->
<h1>Orders</h1>
<h2>This month</h2>
<h3>Australia</h3>`,
  },
  {
    id: "html-article-section",
    title: "article, section, and when neither is right",
    level: 3,
    tags: ["structure"],
    code: `<!-- An article stands alone; a section is a labelled part of something.
     A section with no heading should almost always have been a div. -->
<article>
  <h2>Order KB-1042</h2>
  <p>Two keyboards, shipped on 2 August.</p>
</article>`,
  },
  {
    id: "html-list",
    title: "A list, marked up as one",
    level: 1,
    tags: ["structure"],
    code: `<!-- A screen reader announces "list, 3 items", which a stack of divs
     does not. Navigation is a list of links; so is a set of tabs. -->
<ul>
  <li><a href="/orders">Orders</a></li>
  <li><a href="/products">Products</a></li>
  <li><a href="/settings">Settings</a></li>
</ul>`,
  },
  {
    id: "html-link-vs-button",
    title: "A link goes somewhere; a button does something",
    level: 2,
    tags: ["accessibility"],
    code: `<!-- The distinction is not cosmetic: a link can be opened in a new tab
     and is announced as a link, a button is activated by Space as well as
     Enter. Style them however you like; choose them by behaviour. -->
<a href="/orders/1042">View order</a>
<button type="button">Add to cart</button>`,
  },
  {
    id: "html-button-type",
    title: "Always give a button a type",
    level: 3,
    tags: ["forms"],
    code: `<!-- Inside a form the default is submit, so a button meant to open a
     dialog will instead submit the form. This is the single most common
     form bug there is. -->
<button type="button" aria-expanded="false">Filters</button>`,
  },
  {
    id: "html-label",
    title: "Every input needs a label",
    level: 2,
    tags: ["forms", "accessibility"],
    code: `<!-- The for attribute matches the id, which also makes the label a
     click target for the field. A placeholder is not a label: it vanishes
     the moment anyone types. -->
<label for="email">Email address</label>
<input id="email" name="email" type="email" autocomplete="email" required />`,
  },
  {
    id: "html-input-types",
    title: "The input type changes the keyboard",
    level: 3,
    tags: ["forms"],
    code: `<!-- On a phone these produce three different keyboards. inputmode is
     for when the type must stay text but the keys should not. -->
<input type="email" inputmode="email" />
<input type="tel" inputmode="tel" />
<input type="text" inputmode="numeric" pattern="[0-9]*" />`,
  },
  {
    id: "html-autocomplete",
    title: "Let the browser fill it in",
    level: 3,
    tags: ["forms"],
    code: `<!-- The token names are a fixed list in the spec, and getting them
     right is what makes a checkout form fill itself in one tap. -->
<input name="given-name" autocomplete="given-name" />
<input name="postal-code" autocomplete="postal-code" />
<input name="cc-number" autocomplete="cc-number" inputmode="numeric" />`,
  },
  {
    id: "html-fieldset",
    title: "Group related controls",
    level: 3,
    tags: ["forms", "accessibility"],
    code: `<!-- The legend is announced with each radio, so "Premium" becomes
     "Plan, Premium" rather than a word with no context. -->
<fieldset>
  <legend>Plan</legend>
  <label><input type="radio" name="plan" value="basic" /> Basic</label>
  <label><input type="radio" name="plan" value="premium" /> Premium</label>
</fieldset>`,
  },
  {
    id: "html-validation",
    title: "Validation the browser already does",
    level: 3,
    tags: ["forms"],
    code: `<!-- Free, works with JavaScript disabled, and announced properly. Do
     it in the markup first and add script only for what this cannot say. -->
<input
  type="text"
  name="sku"
  required
  minlength="5"
  maxlength="16"
  pattern="[A-Z]{2}-\\d{2}"
/>`,
  },
  {
    id: "html-error-message",
    title: "Attach an error to its field",
    level: 4,
    tags: ["forms", "accessibility"],
    code: `<!-- aria-describedby links the message to the input, and aria-invalid
     is what makes a screen reader announce the field as being in error. -->
<input id="sku" name="sku" aria-invalid="true" aria-describedby="sku-error" />
<p id="sku-error" role="alert">SKU must look like AB-12.</p>`,
  },
  {
    id: "html-select",
    title: "A select, with its options grouped",
    level: 2,
    tags: ["forms"],
    code: `<!-- A native select is keyboard accessible, works on a phone, and is
     announced correctly — which a custom dropdown rarely manages. -->
<label for="country">Country</label>
<select id="country" name="country">
  <optgroup label="Oceania">
    <option value="AU">Australia</option>
    <option value="NZ">New Zealand</option>
  </optgroup>
</select>`,
  },
  {
    id: "html-table",
    title: "A data table",
    level: 3,
    tags: ["structure", "accessibility"],
    code: `<!-- scope tells a screen reader which cells a header describes, which
     is what lets someone navigate a table by column. -->
<table>
  <caption>
    Revenue by country
  </caption>
  <thead>
    <tr>
      <th scope="col">Country</th>
      <th scope="col">Revenue</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Australia</th>
      <td>51,250</td>
    </tr>
  </tbody>
</table>`,
  },
  {
    id: "html-img-alt",
    title: "Alt text, including when it should be empty",
    level: 2,
    tags: ["accessibility"],
    code: `<!-- Describe what the image conveys, not what it depicts. A decorative
     image takes alt="" so it is skipped; omitting alt makes the screen
     reader read the filename instead. -->
<img src="/chart.png" alt="Revenue rose from 40k to 51k over the quarter." />
<img src="/flourish.svg" alt="" />`,
  },
  {
    id: "html-img-performance",
    title: "An image that does not shift the page",
    level: 4,
    tags: ["media"],
    code: `<!-- width and height let the browser reserve the space before the file
     arrives. loading="lazy" for anything below the fold, and never for the
     image at the top. -->
<img
  src="/cover.jpg"
  width="1200"
  height="675"
  loading="lazy"
  decoding="async"
  alt=""
/>`,
  },
  {
    id: "html-picture",
    title: "A different image for a different screen",
    level: 4,
    tags: ["media"],
    code: `<!-- The browser picks the first source it can use, so the modern format
     goes first and the img at the end is the fallback. -->
<picture>
  <source srcset="/cover.avif" type="image/avif" />
  <source srcset="/cover.webp" type="image/webp" />
  <img src="/cover.jpg" alt="" />
</picture>`,
  },
  {
    id: "html-details",
    title: "A disclosure widget with no JavaScript",
    level: 2,
    tags: ["interactive"],
    code: `<!-- Keyboard accessible, announced correctly, and works before any
     script loads. Most accordions did not need to be built. -->
<details>
  <summary>Shipping options</summary>
  <p>Standard delivery arrives in three to five business days.</p>
</details>`,
  },
  {
    id: "html-dialog",
    title: "A native modal dialog",
    level: 4,
    tags: ["interactive"],
    code: `<!-- showModal() traps focus, adds the backdrop and closes on Escape —
     the three things hand-built modals nearly always get wrong. -->
<dialog id="confirm">
  <form method="dialog">
    <p>Delete this order?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Delete</button>
  </form>
</dialog>`,
  },
  {
    id: "html-live-region",
    title: "Announce something that changed",
    level: 5,
    tags: ["accessibility"],
    code: `<!-- polite waits for a pause; assertive interrupts. The element must be
     in the DOM before the text is put into it, or nothing is announced. -->
<p aria-live="polite" id="status"></p>`,
  },
  {
    id: "html-skip-link",
    title: "A skip link",
    level: 3,
    tags: ["accessibility"],
    code: `<!-- The first focusable thing on the page, usually hidden until it has
     focus. Without it, every keyboard user tabs through the whole nav on
     every page. -->
<a class="skip-link" href="#main">Skip to content</a>`,
  },
  {
    id: "html-time",
    title: "A machine-readable date",
    level: 3,
    tags: ["structure"],
    code: `<!-- The datetime attribute is the unambiguous form; the text inside is
     for people, and may be relative. -->
<time datetime="2026-08-02">2 August</time>`,
  },
  {
    id: "html-external-link",
    title: "Open a link elsewhere, safely",
    level: 3,
    tags: ["structure"],
    code: `<!-- noopener stops the new page reaching back through window.opener.
     Modern browsers imply it with _blank, but old ones do not. -->
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  Documentation
</a>`,
  },
  {
    id: "html-script-loading",
    title: "Load a script without blocking the parser",
    level: 4,
    tags: ["media"],
    code: `<!-- defer keeps the order and runs after parsing; async runs whenever
     it arrives. A module is deferred already. -->
<script type="module" src="/app.js"></script>
<script defer src="/analytics.js"></script>`,
  },
  {
    id: "html-form-post",
    title: "A form that works with no JavaScript at all",
    level: 3,
    tags: ["forms"],
    code: `<!-- The baseline everything else should enhance. If the script fails
     to load, this still submits. -->
<form method="post" action="/orders">
  <label for="sku">SKU</label>
  <input id="sku" name="sku" required />
  <button type="submit">Create order</button>
</form>`,
  },
];
