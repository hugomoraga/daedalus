# Spec 004 — Unknown (fixture)

> Fixture for Theia parser tests. This spec intentionally has NO
> `**Status:**` line so the parser must fall back to `status = "Unknown"`
> with a populated `unknownReason`.

## 1. Summary

This fixture simulates a spec whose Status line is missing. The parser must surface `status = "Unknown"` and `unknownReason = "Status line missing or unparseable"`.
