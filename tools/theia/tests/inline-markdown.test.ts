// Theia (UX-006, UX-007, UX-009, UX-011) — inlineMarkdownToHtml tests.
//
// Covers inline markers (` `code` `, `**bold**`, `[text](url)`)
// and block-level markers (fenced code blocks, GFM tables, lists,
// ATX headers, horizontal rules, paragraphs). Everything else is
// HTML-escaped. Unbalanced markers are treated as literal text.
//
// UX-011 wraps prose in `<p class="theia-md-p">…</p>` so the
// backlog body has visible paragraph spacing. Every test below
// pins this contract: a text input becomes one `<p>`; a list,
// table, code block, header, or hr is emitted standalone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { inlineMarkdownToHtml } from "../src/views/spec.ts";

// Helper: wrap a string in the canonical single-paragraph
// rendering so tests stay readable.
const p = (s: string): string => `<p class="theia-md-p">${s}</p>`;

test("UX-006: plain text is HTML-escaped and wrapped in <p>", () => {
  assert.equal(inlineMarkdownToHtml("plain text"), p("plain text"));
  assert.equal(inlineMarkdownToHtml("a < b & c > d"), p("a &lt; b &amp; c &gt; d"));
  assert.equal(inlineMarkdownToHtml("quotes \"x\" 'y'"), p("quotes &quot;x&quot; &#39;y&#39;"));
});

test("UX-006: backticks become <code>…</code>", () => {
  assert.equal(inlineMarkdownToHtml("use `foo` here"), p("use <code>foo</code> here"));
  assert.equal(inlineMarkdownToHtml("`a` and `b`"), p("<code>a</code> and <code>b</code>"));
});

test("UX-006: backtick content is HTML-escaped", () => {
  assert.equal(inlineMarkdownToHtml("`<script>`"), p("<code>&lt;script&gt;</code>"));
});

test("UX-006: **bold** becomes <strong>…</strong>", () => {
  assert.equal(inlineMarkdownToHtml("this is **bold** text"), p("this is <strong>bold</strong> text"));
  assert.equal(inlineMarkdownToHtml("**a** and **b**"), p("<strong>a</strong> and <strong>b</strong>"));
});

test("UX-006: bold content is HTML-escaped", () => {
  assert.equal(inlineMarkdownToHtml("**<x>**"), p("<strong>&lt;x&gt;</strong>"));
});

test("UX-006: code inside bold renders as code (nested correctly)", () => {
  assert.equal(
    inlineMarkdownToHtml("**bold `with code` here**"),
    p("<strong>bold <code>with code</code> here</strong>"),
  );
});

test("UX-006: asterisks inside backticks are literal (not bold)", () => {
  // `**not bold**` → the ** inside backticks is treated as literal
  // text inside <code>, not as a bold marker.
  assert.equal(
    inlineMarkdownToHtml("`**not bold**`"),
    p("<code>**not bold**</code>"),
  );
});

test("UX-006: unbalanced markers are treated as literal text", () => {
  assert.equal(inlineMarkdownToHtml("`unclosed"), p("`unclosed"));
  assert.equal(inlineMarkdownToHtml("**unclosed"), p("**unclosed"));
  assert.equal(inlineMarkdownToHtml("orphan`"), p("orphan`"));
  assert.equal(inlineMarkdownToHtml("orphan**"), p("orphan**"));
});

test("UX-006: empty string returns empty string", () => {
  assert.equal(inlineMarkdownToHtml(""), "");
});

test("UX-006: backticks and bold can mix freely", () => {
  assert.equal(
    inlineMarkdownToHtml("**bold** with `code` and **more** `more code`"),
    p("<strong>bold</strong> with <code>code</code> and <strong>more</strong> <code>more code</code>"),
  );
});

// ----------------------------------------------------------------------------
// UX-007 — links [text](url) + safe-URL guard
// ----------------------------------------------------------------------------

test("UX-007: [text](url) becomes an <a> with the URL as href", () => {
  assert.equal(
    inlineMarkdownToHtml("[Spec 012](../../012-theia/spec.md)"),
    p(`<a href="../../012-theia/spec.md">Spec 012</a>`),
  );
  assert.equal(
    inlineMarkdownToHtml("see [the constitution](https://example.com/constitution)"),
    p(`see <a href="https://example.com/constitution">the constitution</a>`),
  );
});

test("UX-007: bold and code inside link text render correctly", () => {
  assert.equal(
    inlineMarkdownToHtml("[**bold** link](url)"),
    p(`<a href="url"><strong>bold</strong> link</a>`),
  );
  assert.equal(
    inlineMarkdownToHtml("[`code` link](url)"),
    p(`<a href="url"><code>code</code> link</a>`),
  );
});

test("UX-007: link href is HTML-escaped", () => {
  assert.equal(
    inlineMarkdownToHtml("[text](https://example.com/?a=1&b=2)"),
    p(`<a href="https://example.com/?a=1&amp;b=2">text</a>`),
  );
});

test("UX-007: dangerous URL schemes are rejected (no href rendered, text kept)", () => {
  assert.equal(inlineMarkdownToHtml("[click](javascript:alert(1))"), p("click"));
  assert.equal(inlineMarkdownToHtml("[click](JavaScript:alert(1))"), p("click"));
  assert.equal(inlineMarkdownToHtml("[click](data:text/html,<script>)"), p("click"));
  assert.equal(inlineMarkdownToHtml("[click](vbscript:msgbox)"), p("click"));
  assert.equal(inlineMarkdownToHtml("[click](file:///etc/passwd)"), p("click"));
});

test("UX-007: unbalanced brackets are treated as literal", () => {
  assert.equal(inlineMarkdownToHtml("[unclosed"), p("[unclosed"));
  assert.equal(inlineMarkdownToHtml("text ]("), p("text ]("));
  assert.equal(inlineMarkdownToHtml("[text](unclosed"), p("[text](unclosed"));
});

test("UX-007: empty link text or href keeps the brackets literal", () => {
  assert.equal(inlineMarkdownToHtml("[](url)"), p("[](url)"));
  assert.equal(inlineMarkdownToHtml("[text]()"), p("[text]()"));
});

// ----------------------------------------------------------------------------
// UX-009 — block-level markers (fenced code, tables, lists)
// ----------------------------------------------------------------------------

test("UX-009: fenced code block becomes <pre><code class='theia-code-block'>", () => {
  const input = "```\nnot ok 213 - AC-6: parseCodeInventory\nAssertionError: false == true\n```";
  const expected = `<pre class="theia-code-block"><code>not ok 213 - AC-6: parseCodeInventory\nAssertionError: false == true</code></pre>`;
  assert.equal(inlineMarkdownToHtml(input), expected);
});

test("UX-009: fenced code block with language hint drops the language", () => {
  const input = "```ts\nconst x: number = 1;\n```";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /^<pre class="theia-code-block"><code>const x: number = 1;<\/code><\/pre>$/);
});

test("UX-009: fenced code block content is HTML-escaped but NOT inline-processed", () => {
  const input = "```\nuse `foo` for **bold**\n```";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /<pre class="theia-code-block"><code>use `foo` for \*\*bold\*\*<\/code><\/pre>/);
  assert.doesNotMatch(result, /<strong>/);
  assert.doesNotMatch(result, /<code>foo<\/code>/);
});

test("UX-009: text before and after a fenced block is wrapped in <p>s", () => {
  const input = "before\n```\nx = 1\n```\nafter";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /^<p class="theia-md-p">before<\/p>\n<pre class="theia-code-block"><code>x = 1<\/code><\/pre>\n<p class="theia-md-p">after<\/p>$/);
});

test("UX-009: GFM pipe-table becomes <table class='theia-md-table'>", () => {
  const input = "| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /<table class="theia-md-table">/);
  assert.match(result, /<thead>/);
  assert.match(result, /<th class="theia-md-th-left">a<\/th>/);
  assert.match(result, /<th class="theia-md-th-left">b<\/th>/);
  assert.match(result, /<td class="theia-md-td-left">1<\/td>/);
  assert.match(result, /<td class="theia-md-td-left">2<\/td>/);
  assert.match(result, /<td class="theia-md-td-left">3<\/td>/);
  assert.match(result, /<td class="theia-md-td-left">4<\/td>/);
});

test("UX-009: pipe-table alignment (right / center) renders as a CSS class", () => {
  const input = "| left | right | center |\n| :--- | ---: | :---: |\n| a | b | c |";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /<th class="theia-md-th-left">left<\/th>/);
  assert.match(result, /<th class="theia-md-th-right">right<\/th>/);
  assert.match(result, /<th class="theia-md-th-center">center<\/th>/);
  assert.match(result, /<td class="theia-md-td-left">a<\/td>/);
  assert.match(result, /<td class="theia-md-td-right">b<\/td>/);
  assert.match(result, /<td class="theia-md-td-center">c<\/td>/);
});

test("UX-009: pipe-table cells run through the inline passes", () => {
  const input = "| col |\n| --- |\n| **bold** and `code` |";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /<td class="theia-md-td-left"><strong>bold<\/strong> and <code>code<\/code><\/td>/);
});

test("UX-009: text before a pipe-table is wrapped in <p>", () => {
  const input = "header line\n| a | b |\n| --- | --- |\n| 1 | 2 |";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /^<p class="theia-md-p">header line<\/p>\n<table class="theia-md-table">/);
});

test("UX-009: bullet list becomes <ul><li>…</li></ul>", () => {
  const input = "- alpha\n- beta\n- gamma";
  const result = inlineMarkdownToHtml(input);
  assert.equal(result, "<ul><li>alpha</li><li>beta</li><li>gamma</li></ul>");
});

test("UX-009: numbered list becomes <ol><li>…</li></ol>", () => {
  const input = "1. one\n2. two\n3. three";
  const result = inlineMarkdownToHtml(input);
  assert.equal(result, "<ol><li>one</li><li>two</li><li>three</li></ol>");
});

test("UX-009: list items run through the inline passes", () => {
  const input = "- a **bold** item\n- another with `code`";
  const result = inlineMarkdownToHtml(input);
  assert.equal(result, "<ul><li>a <strong>bold</strong> item</li><li>another with <code>code</code></li></ul>");
});

test("UX-009: list and prose mix — each block wrapped in its own element", () => {
  const input = "intro line\n- item one\n- item two\n\noutro line";
  const result = inlineMarkdownToHtml(input);
  // The intro is its own <p>, the list stands alone, and the
  // outro is its own <p>. The blank line between list and outro
  // becomes a paragraph break.
  assert.match(result, /^<p class="theia-md-p">intro line<\/p>\n<ul><li>item one<\/li><li>item two<\/li><\/ul>\n<p class="theia-md-p">outro line<\/p>$/);
});

test("UX-009: a single trailing dash is not a list", () => {
  assert.equal(inlineMarkdownToHtml("a - b"), p("a - b"));
  assert.equal(inlineMarkdownToHtml("text - with a dash"), p("text - with a dash"));
});

test("UX-009: all block markers combined (the BUG-001 body shape)", () => {
  const input = [
    "**Resolution.** Fixed in PR #88:",
    "",
    "```",
    "not ok 213 - AC-6: parseCodeInventory",
    "AssertionError: false == true",
    "```",
    "",
    "Branches deleted:",
    "",
    "- `origin/087-bug-001`",
    "- `origin/087-post-086-hygiene`",
    "",
    "Status:",
    "",
    "| branch | merged |",
    "| --- | --- |",
    "| a | yes |",
    "| b | no |",
  ].join("\n");
  const result = inlineMarkdownToHtml(input);
  // Bold + intro survives inside a <p>.
  assert.match(result, /<p class="theia-md-p"><strong>Resolution\.<\/strong> Fixed in PR #88:<\/p>/);
  // Code block renders as <pre>, not as inline <code>.
  assert.match(result, /<pre class="theia-code-block"><code>not ok 213/);
  // Each prose chunk between blocks is its own <p>.
  assert.match(result, /<p class="theia-md-p">Branches deleted:<\/p>/);
  assert.match(result, /<p class="theia-md-p">Status:<\/p>/);
  // List renders as <ul>.
  assert.match(result, /<ul><li><code>origin\/087-bug-001<\/code><\/li><li><code>origin\/087-post-086-hygiene<\/code><\/li><\/ul>/);
  // Table renders as <table>.
  assert.match(result, /<table class="theia-md-table">/);
  assert.match(result, /<td class="theia-md-td-left">a<\/td>/);
});

// ----------------------------------------------------------------------------
// UX-011 — ATX headers, horizontal rules, paragraphs
// ----------------------------------------------------------------------------

test("UX-011: ATX # h1 becomes <h1 class='theia-md-h1'>", () => {
  assert.equal(inlineMarkdownToHtml("# Heading 1"), '<h1 class="theia-md-h1">Heading 1</h1>');
});

test("UX-011: ATX ## h2 becomes <h2 class='theia-md-h2'>", () => {
  assert.equal(inlineMarkdownToHtml("## Heading 2"), '<h2 class="theia-md-h2">Heading 2</h2>');
});

test("UX-011: ATX ### h3 becomes <h3 class='theia-md-h3'>", () => {
  assert.equal(inlineMarkdownToHtml("### Heading 3"), '<h3 class="theia-md-h3">Heading 3</h3>');
});

test("UX-011: ATX headers up to ###### become the matching h-level", () => {
  assert.equal(inlineMarkdownToHtml("#### H4"), '<h4 class="theia-md-h4">H4</h4>');
  assert.equal(inlineMarkdownToHtml("##### H5"), '<h5 class="theia-md-h5">H5</h5>');
  assert.equal(inlineMarkdownToHtml("###### H6"), '<h6 class="theia-md-h6">H6</h6>');
});

test("UX-011: ATX headers run through the inline passes", () => {
  assert.equal(
    inlineMarkdownToHtml("### **bold** `code` header"),
    '<h3 class="theia-md-h3"><strong>bold</strong> <code>code</code> header</h3>',
  );
});

test("UX-011: header with trailing whitespace trims the whitespace", () => {
  assert.equal(inlineMarkdownToHtml("### Spaced   "), '<h3 class="theia-md-h3">Spaced</h3>');
});

test("UX-011: a # without space is literal (not a header)", () => {
  // The header syntax requires whitespace between the hashes
  // and the text; `#tag` (no space) is a hashtag, not a header.
  assert.equal(inlineMarkdownToHtml("#tag"), p("#tag"));
  assert.equal(inlineMarkdownToHtml("##version"), p("##version"));
});

test("UX-011: a header followed by prose is three blocks (h3 + 2 paragraphs)", () => {
  // Two blank lines around a single-line paragraph produce
  // three separate blocks: the heading, the paragraph, and
  // another paragraph (separated by the blank line).
  const result = inlineMarkdownToHtml("### Why\n\nThe section explains why.\n\nMore prose.");
  assert.equal(
    result,
    '<h3 class="theia-md-h3">Why</h3>\n<p class="theia-md-p">The section explains why.</p>\n<p class="theia-md-p">More prose.</p>',
  );
});

test("UX-011: a header followed by soft-wrapped prose is two blocks", () => {
  // No blank line between the prose lines means they belong
  // to the same paragraph (soft wrap).
  const result = inlineMarkdownToHtml("### Why\n\nThe section explains why.\nMore prose.");
  assert.equal(
    result,
    '<h3 class="theia-md-h3">Why</h3>\n<p class="theia-md-p">The section explains why. More prose.</p>',
  );
});

test("UX-011: --- on its own line becomes <hr>", () => {
  assert.equal(inlineMarkdownToHtml("---"), '<hr class="theia-md-hr">');
  assert.equal(inlineMarkdownToHtml("----"), '<hr class="theia-md-hr">');
  assert.equal(inlineMarkdownToHtml("----------"), '<hr class="theia-md-hr">');
});

test("UX-011: --- followed by text is literal (not a rule)", () => {
  // The HR regex requires only whitespace after the dashes;
  // `---foo` is inline text.
  assert.equal(inlineMarkdownToHtml("---foo"), p("---foo"));
  assert.equal(inlineMarkdownToHtml("--- 1+1"), p("--- 1+1"));
});

test("UX-011: --- between paragraphs is its own block", () => {
  const result = inlineMarkdownToHtml("Before.\n\n---\n\nAfter.");
  assert.equal(
    result,
    '<p class="theia-md-p">Before.</p>\n<hr class="theia-md-hr">\n<p class="theia-md-p">After.</p>',
  );
});

test("UX-011: consecutive non-blank lines join into one paragraph", () => {
  const result = inlineMarkdownToHtml("first line\nsecond line\nthird line");
  assert.equal(result, '<p class="theia-md-p">first line second line third line</p>');
});

test("UX-011: a blank line separates paragraphs", () => {
  const result = inlineMarkdownToHtml("paragraph one.\n\nparagraph two.");
  assert.equal(
    result,
    '<p class="theia-md-p">paragraph one.</p>\n<p class="theia-md-p">paragraph two.</p>',
  );
});

test("UX-011: the live UX-009 body shape — headers + lists + paragraphs + hr", () => {
  // Mirrors the actual UX-009 backlog body. Headers + numbered
  // list + a horizontal rule + paragraphs. The whole point of
  // UX-011 is that this renders as a real hierarchy.
  const input = [
    "### Why",
    "",
    "The body explains why.",
    "",
    "1. **First** item",
    "2. Second item",
    "",
    "---",
    "",
    "### Acceptance",
    "",
    "Tests pass.",
  ].join("\n");
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /<h3 class="theia-md-h3">Why<\/h3>/);
  assert.match(result, /<p class="theia-md-p">The body explains why\.<\/p>/);
  assert.match(result, /<ol><li><strong>First<\/strong> item<\/li><li>Second item<\/li><\/ol>/);
  assert.match(result, /<hr class="theia-md-hr">/);
  assert.match(result, /<h3 class="theia-md-h3">Acceptance<\/h3>/);
  assert.match(result, /<p class="theia-md-p">Tests pass\.<\/p>/);
});