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
