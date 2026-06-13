# The Daedalus Constitution

**Status:** Ratified · Phase 0
**Version:** 1.1.0
**Last updated:** 2026-06-13
**Authority:** This is the supreme governing document of Daedalus. No specification, policy, workflow, agent, or tenant profile may contradict it.

> **Amendment note (v1.1.0):** the project was reoriented from "model *an* organization" to "an architecture that can operate *many* independent organizations." This added Principle 10 (*Generic Core, Specific Tenants*) and a Tenant Profile layer to the decision hierarchy. The first tenant operated by Daedalus is the founder's independent professional activity — **Tenant 0** — but the Constitution governs the generic Core and is tenant-agnostic. See [`docs/identity.md`](../docs/identity.md).

> This file follows the GitHub Spec Kit convention of locating the project constitution at `memory/constitution.md`. Spec Kit treats the constitution as the non-negotiable context injected into every specification and planning step. We adopt that convention deliberately: the constitution is *memory* the system must never forget.

---

## Preamble

Daedalus is an **architecture for autonomous organizations governed by policies, workflows, and agents** — not a single company. It can operate many independent organizations, each as an isolated tenant. An organization that runs on code, policy, and autonomous execution needs a constitution for the same reason a state does: to bind power, to make authority legible, and to guarantee that the system serves human ends.

This document governs the **generic Core** and is **tenant-agnostic**. It defines what is immutable, who decides what, and where the boundaries of automation lie — for any organization Daedalus operates. Tenant-specific behavior, data, and pain live in **tenant profiles** (see [`tenants/`](../tenants/)), never here. The first tenant is the founder's independent professional activity, **Tenant 0**; it is a validation case, not the definition of the system.

---

## Article I — Immutable Principles

These **ten** principles are **constitutional**. Every specification, policy, workflow, agent, and tenant profile must conform to them. They may only change through the amendment process in Article VI.

1. **Organization as Code** — Every organizational capability must be representable as code, configuration, policy, or workflow.
2. **Policy before Agent** — Policies define behavior. Agents execute within policy boundaries. An agent never defines organizational behavior.
3. **Everything is an Event** — Organizational state changes are represented by explicit, immutable events.
4. **Auditability by Default** — Every significant action must be traceable to an actor, a cause, and an authorizing policy.
5. **Human Governance** — Humans retain final authority over irreversible and strategic decisions.
6. **Tenant Isolation** — Organizations, customers, and workspaces remain isolated by design.
7. **Modular Evolution** — The organization evolves through modules without requiring redesign of the core.
8. **Spec-Driven Development** — Every capability begins as a specification; implementation follows it.
9. **Simplicity First** — Model only what the next stage of evolution requires. Do not design for hypothetical complexity.
10. **Generic Core, Specific Tenants** — The Core and this Constitution are tenant-agnostic. Tenant-specific behavior, data, and pain live in tenant profiles and reusable modules, never in the Core. Daedalus is a platform that can operate many organizations; no single tenant — including Tenant 0 — may shape the Core to itself. A module born from one tenant's pain must be designed to serve any tenant with that pain.

**Infrastructure as Code** is a binding operational requirement: all infrastructure must be reproducible and versioned. It is listed separately because it governs *how* the system is deployed rather than *how the organization behaves*.

---

## Article II — Governance Model

### II.1 Structure
Governance operates at three levels:

| Level | Scope | Who holds it |
|---|---|---|
| **Constitutional** | The principles in Article I and this document | Human stewards, by amendment only |
| **Policy** | Rules that bind organizational behavior within the constitution | Human policy owners |
| **Operational** | Execution of work within policy | Workflows and agents, supervised by humans |

### II.2 Principle of Subsidiarity
Decisions are made at the lowest level competent to make them. Operational execution does not escalate to humans unless a policy requires it or reversibility is at stake. Conversely, no operational layer may make a decision reserved for a higher level.

### II.3 Default Deny
Where authority is unclear, the system **denies and escalates**. Ambiguity resolves toward human judgment, never toward autonomous action.

---

## Article III — Decision Hierarchy

When artifacts conflict, this order of precedence is absolute and resolves the conflict:

```
1. Constitution            (this document — supreme, tenant-agnostic)
2. Core Policy             (binding rules within the constitution, tenant-agnostic)
3. Tenant Profile          (tenant-scoped policy + configuration, within Core Policy)
4. Workflow                (declarative process within policy)
5. Agent execution         (action within workflow + policy)
6. Configuration / data    (inputs to the above)
```

A lower artifact may never override a higher one. A workflow that contradicts a policy is invalid. An agent action unsupported by policy is illegitimate and must be rejected and logged. If two artifacts at the same level conflict, the system halts that path and escalates to a human.

**On Tenant Profiles:** a tenant profile (e.g. [Tenant 0](../tenants/tenant-0-founder-profile.md)) configures and specializes behavior *within* Core Policy — it selects modules, sets tenant-specific parameters, and records tenant-specific context. It may **never** override the Constitution or Core Policy, and nothing in it may leak upward into the Core. If a tenant profile needs something the Core forbids, that is a signal to amend Core Policy generically (so all tenants benefit) — never to special-case one tenant.

---

## Article IV — Agent Limitations

Agents are **bounded executors**. The following limits are constitutional and may not be waived by any policy.

An agent **MAY**:
- Execute tasks explicitly authorized by an active policy.
- Read data it is granted access to within its tenant scope.
- Emit events recording its actions.
- Propose actions or decisions to humans for approval.

An agent **MUST NOT**:
- Define, modify, or reinterpret policy.
- Take an irreversible action without an authorizing policy and, where required, human approval.
- Act outside its assigned tenant scope.
- Take any action it cannot record as a traceable event.
- Escalate its own privileges or grant privileges to another agent.
- Make strategic decisions reserved for humans (see Article V).

Every agent action must carry, at minimum: the **authorizing policy**, the **triggering event or instruction**, the **agent identity**, and the **tenant scope**. An action that cannot produce this lineage must not execute.

---

## Article V — Human Responsibilities

Humans are **accountable**, not merely involved. Accountability cannot be delegated to an agent.

Humans retain exclusive authority over:
- **Amending the constitution** and ratifying policies.
- **Irreversible decisions** — anything that cannot be safely undone (financial commitment, contractual obligation, data destruction, external commitments).
- **Strategic decisions** — direction, priorities, and trade-offs that require judgment beyond defined policy.
- **Exception handling** — resolving cases that policy does not cover.
- **Final approval** at any gate a policy marks as human-governed.

Humans are responsible for keeping policy current. **A policy gap is a human responsibility, not an agent's license to improvise.** When policy is silent, the system escalates; humans decide and, if appropriate, encode the decision as new policy.

---

## Article VI — Amendment Process

This constitution is deliberately hard to change, and changes are deliberately traceable.

1. **Proposal** — Any steward may propose an amendment as a written specification, with rationale and impact analysis.
2. **Review** — The proposal is reviewed against existing principles for conflicts and downstream effects.
3. **Ratification** — Human stewards ratify by explicit, recorded approval. Silence is never consent.
4. **Versioning** — Every amendment increments this document's version and is recorded as a governance event (`ConstitutionAmended`).
5. **Propagation** — Affected specifications must be reconciled with the amended constitution before the next implementation cycle.

No amendment may remove Article V (Human Responsibilities), Article IV's prohibition on agent self-modification of policy, or Principle 10's guarantee that the Core stays generic (no tenant — including Tenant 0 — may be written into the Core). These are the load-bearing guarantees that keep the system accountable to humans and prevent the platform from collapsing into a single-tenant tool.

---

## Article VII — Interpretation

When applying this constitution to a concrete case:
- Prefer the interpretation that **preserves auditability and human accountability**.
- Prefer **denial and escalation** over permissive action under uncertainty.
- Prefer the **simplest reading** consistent with the principles (Simplicity First applies to governance too).

---

*Ratified as the foundational governing document of Daedalus. All artifacts in this repository are subordinate to it.*
