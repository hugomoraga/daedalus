// Theia (UX-006) — inlineMarkdownToHtml tests.
//
// Covers the small subset of markdown the helper recognises: backticks
// for inline code and `**bold**` for emphasis. Everything else is
// HTML-escaped. Unbalanced markers are treated as literal text.

import { test } from "node:test";
import assert from "node:assert/strict";
import { inlineMarkdownToHtml } from "../src/views/spec.ts";

test("UX-006: plain text is HTML-escaped", () => {
  assert.equal(inlineMarkdownToHtml("plain text"), "plain text");
  assert.equal(inlineMarkdownToHtml("a < b & c > d"), "a &lt; b &amp; c &gt; d");
  assert.equal(inlineMarkdownToHtml("quotes \"x\" 'y'"), "quotes &quot;x&quot; &#39;y&#39;");
});

test("UX-006: backticks become <code>…</code>", () => {
  assert.equal(inlineMarkdownToHtml("use `foo` here"), "use <code>foo</code> here");
  assert.equal(inlineMarkdownToHtml("`a` and `b`"), "<code>a</code> and <code>b</code>");
});

test("UX-006: backtick content is HTML-escaped", () => {
  assert.equal(inlineMarkdownToHtml("`<script>`"), "<code>&lt;script&gt;</code>");
});

test("UX-006: **bold** becomes <strong>…</strong>", () => {
  assert.equal(inlineMarkdownToHtml("this is **bold** text"), "this is <strong>bold</strong> text");
  assert.equal(inlineMarkdownToHtml("**a** and **b**"), "<strong>a</strong> and <strong>b</strong>");
});

test("UX-006: bold content is HTML-escaped", () => {
  assert.equal(inlineMarkdownToHtml("**<x>**"), "<strong>&lt;x&gt;</strong>");
});

test("UX-006: code inside bold renders as code (nested correctly)", () => {
  assert.equal(
    inlineMarkdownToHtml("**bold `with code` here**"),
    "<strong>bold <code>with code</code> here</strong>",
  );
});

test("UX-006: asterisks inside backticks are literal (not bold)", () => {
  // `**not bold**` → the ** inside backticks is treated as literal
  // text inside <code>, not as a bold marker.
  assert.equal(
    inlineMarkdownToHtml("`**not bold**`"),
    "<code>**not bold**</code>",
  );
});

test("UX-006: unbalanced markers are treated as literal text", () => {
  assert.equal(inlineMarkdownToHtml("`unclosed"), "`unclosed");
  assert.equal(inlineMarkdownToHtml("**unclosed"), "**unclosed");
  assert.equal(inlineMarkdownToHtml("orphan`"), "orphan`");
  assert.equal(inlineMarkdownToHtml("orphan**"), "orphan**");
});

test("UX-006: empty string returns empty string", () => {
  assert.equal(inlineMarkdownToHtml(""), "");
});

test("UX-006: backticks and bold can mix freely", () => {
  assert.equal(
    inlineMarkdownToHtml("**bold** with `code` and **more** `more code`"),
    "<strong>bold</strong> with <code>code</code> and <strong>more</strong> <code>more code</code>",
  );
});

// ----------------------------------------------------------------------------
// UX-007 — links [text](url) + safe-URL guard
// ----------------------------------------------------------------------------

test("UX-007: [text](url) becomes an <a> with the URL as href", () => {
  assert.equal(
    inlineMarkdownToHtml("[Spec 012](../../012-theia/spec.md)"),
    `<a href="../../012-theia/spec.md">Spec 012</a>`,
  );
  assert.equal(
    inlineMarkdownToHtml("see [the constitution](https://example.com/constitution)"),
    `see <a href="https://example.com/constitution">the constitution</a>`,
  );
});

test("UX-007: bold and code inside link text render correctly", () => {
  assert.equal(
    inlineMarkdownToHtml("[**bold** link](url)"),
    `<a href="url"><strong>bold</strong> link</a>`,
  );
  assert.equal(
    inlineMarkdownToHtml("[`code` link](url)"),
    `<a href="url"><code>code</code> link</a>`,
  );
});

test("UX-007: link href is HTML-escaped", () => {
  assert.equal(
    inlineMarkdownToHtml("[text](https://example.com/?a=1&b=2)"),
    `<a href="https://example.com/?a=1&amp;b=2">text</a>`,
  );
});

test("UX-007: dangerous URL schemes are rejected (no href rendered, text kept)", () => {
  assert.equal(inlineMarkdownToHtml("[click](javascript:alert(1))"), "click");
  assert.equal(inlineMarkdownToHtml("[click](JavaScript:alert(1))"), "click");
  assert.equal(inlineMarkdownToHtml("[click](data:text/html,<script>)"), "click");
  assert.equal(inlineMarkdownToHtml("[click](vbscript:msgbox)"), "click");
  assert.equal(inlineMarkdownToHtml("[click](file:///etc/passwd)"), "click");
});

test("UX-007: unbalanced brackets are treated as literal", () => {
  assert.equal(inlineMarkdownToHtml("[unclosed"), "[unclosed");
  assert.equal(inlineMarkdownToHtml("text ]("), "text ](");
  assert.equal(inlineMarkdownToHtml("[text](unclosed"), "[text](unclosed");
});

test("UX-007: empty link text or href keeps the brackets literal", () => {
  assert.equal(inlineMarkdownToHtml("[](url)"), "[](url)");
  assert.equal(inlineMarkdownToHtml("[text]()"), "[text]()");
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
  // The language hint is dropped — the token linter would reject
  // per-language class names, and the renderer doesn't need it.
  const input = "```ts\nconst x: number = 1;\n```";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /^<pre class="theia-code-block"><code>const x: number = 1;<\/code><\/pre>$/);
});

test("UX-009: fenced code block content is HTML-escaped but NOT inline-processed", () => {
  // The point of a code block: `code` and **bold** inside are
  // literal characters, not markers.
  const input = "```\nuse `foo` for **bold**\n```";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /<pre class="theia-code-block"><code>use `foo` for \*\*bold\*\*<\/code><\/pre>/);
  assert.doesNotMatch(result, /<strong>/);
  assert.doesNotMatch(result, /<code>foo<\/code>/);
});

test("UX-009: text before and after a fenced block survives", () => {
  const input = "before\n```\nx = 1\n```\nafter";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /^before\n<pre class="theia-code-block"><code>x = 1<\/code><\/pre>\nafter$/);
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

test("UX-009: text before a pipe-table survives", () => {
  const input = "header line\n| a | b |\n| --- | --- |\n| 1 | 2 |";
  const result = inlineMarkdownToHtml(input);
  assert.match(result, /^header line\n<table class="theia-md-table">/);
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

test("UX-009: list and prose mix — only the list block becomes <ul>", () => {
  const input = "intro line\n- item one\n- item two\n\noutro line";
  const result = inlineMarkdownToHtml(input);
  // The list replaces its lines (each followed by \n) with a
  // single block; the blank line that separated list from outro
  // collapses to one \n in the output (markdown's rule).
  assert.match(result, /^intro line\n<ul><li>item one<\/li><li>item two<\/li><\/ul>\noutro line$/);
});

test("UX-009: a single trailing dash is not a list", () => {
  // One item, no second — the regex needs at least one item but a
  // single-item list IS a list. Standalone text like "a - b" with
  // a hyphen in the middle is not a list (the line doesn't start
  // with "- " or "* "). This test pins that.
  assert.equal(inlineMarkdownToHtml("a - b"), "a - b");
  assert.equal(inlineMarkdownToHtml("text - with a dash"), "text - with a dash");
});

test("UX-009: all block markers combined (the BUG-001 body shape)", () => {
  // Mirrors the structure of a real backlog body that has code
  // blocks, lists, tables, and inline markers all in one piece of
  // prose. The whole point of UX-009.
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
  // Bold + intro survives
  assert.match(result, /<strong>Resolution\.<\/strong> Fixed in PR #88:/);
  // Code block renders as <pre>, not as inline <code>
  assert.match(result, /<pre class="theia-code-block"><code>not ok 213/);
  // List renders as <ul>
  assert.match(result, /<ul><li><code>origin\/087-bug-001<\/code><\/li><li><code>origin\/087-post-086-hygiene<\/code><\/li><\/ul>/);
  // Table renders as <table>
  assert.match(result, /<table class="theia-md-table">/);
  assert.match(result, /<td class="theia-md-td-left">a<\/td>/);
});
