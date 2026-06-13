# Daedalus Identity

**Status:** Foundational · Phase 0 · **Canon**
**Version:** 0.1.0
**Last updated:** 2026-06-13

> **Purpose of this document.** This is the identity boundary of the project. It exists to answer one question precisely — *what is Daedalus, and what is merely the first thing Daedalus operates?* — so the two never blur. If a future decision is unclear about whether something belongs to the platform or to a tenant, this document is where it gets resolved.

---

## 1. What Daedalus Is

Daedalus is an **architecture for autonomous organizations governed by policies, workflows, and agents.**

It is a **platform**: a generic, tenant-agnostic Core plus a catalog of reusable modules. It is designed to model, operate, and evolve *any* independent organization as a software system — *Organization as Code*.

## 2. What Daedalus Is Not

- **Not a company.** Daedalus does not *do* a business; it *operates* organizations that do.
- **Not "Hugo OS."** The founder's independent activity is the first tenant, not the system. The Core must remain usable by a different founder, studio, or collective with no founder-specific assumptions baked in.
- **Not a SaaS bundle.** It is not a CRM + accounting app + tax tool stitched together. It is one governed system where those concerns are modules over a shared event and policy substrate.
- **Not a growth engine.** It optimizes for freedom, focus, traceability, and sustainability — not scale.

---

## 3. The Thesis

> *Daedalus exists to help builders, architects, and technical founders create and operate independent organizations without being trapped by administrative friction.*

The independent builder's scarcest resource is **attention on the work only they can do**. Administrative friction — finding clients, accounting, taxes, coordination, the long tail of small tasks — consumes exactly that attention. Daedalus absorbs the friction into governed software so the founder gets the attention back.

---

## 4. What We Optimize For (and What We Don't)

| We maximize | We explicitly do **not** maximize |
|---|---|
| **Freedom** — the founder chooses the work | Growth / revenue for its own sake |
| **Creative focus** — judgment, architecture, problem-solving | Headcount or scale |
| **Traceability** — every action auditable | Feature count or surface area |
| **Economic sustainability** — viable and solvent | Utilization / "keeping busy" |

A change that increases revenue but costs the founder their focus is a **regression**, not progress. This table is a decision rule, not a slogan: when two designs compete, prefer the one that returns more attention to the founder.

---

## 5. The Three-Layer Identity

This is the architectural decision that keeps the platform from collapsing into a single-tenant tool.

```
┌──────────────────────────────────────────────────────────┐
│  CORE  (generic, tenant-agnostic)                          │
│  Constitution · domains · events · policy/workflow/agent   │
│  engines. Knows nothing about any specific tenant.         │
└──────────────────────────────────────────────────────────┘
                  ▲ selects & configures
┌──────────────────────────────────────────────────────────┐
│  MODULES  (reusable capabilities)                          │
│  Opportunity Discovery · Proposal Generation · Revenue     │
│  Visibility · Tax & Compliance Guard · Administrative      │
│  Shield. Born from real pain, designed for any tenant.     │
└──────────────────────────────────────────────────────────┘
                  ▲ instantiated by
┌──────────────────────────────────────────────────────────┐
│  TENANTS  (specific organizations)                         │
│  Tenant 0 = the founder's activity. Each tenant selects    │
│  modules and supplies its own profile, data, and context.  │
└──────────────────────────────────────────────────────────┘
```

### Core — generic
The Constitution, the domain model, the event vocabulary, and the policy/workflow/agent engines. The Core knows **nothing** about any specific tenant. It could operate a different founder tomorrow with no change. (Constitution, Principle 10; protected from amendment under Article VI.)

### Modules — reusable
Capabilities that solve a class of pain. A module may be **born** from Tenant 0's specific pain, but it is **designed** so any tenant with that pain can adopt it unchanged. A module that only works for Tenant 0 is a defect.

### Tenants — specific
A concrete organization Daedalus operates. A tenant supplies a **profile** (which modules it uses, its parameters, its context) and its own isolated data. **Tenant 0** is the founder's independent activity — see the [Tenant 0 Profile](../tenants/tenant-0-founder-profile.md).

---

## 6. The Litmus Test for "Where Does This Belong?"

When adding anything, ask in order:

1. **Is it true for every organization?** → Core.
2. **Is it a reusable solution to a class of pain?** → Module.
3. **Is it true only for this specific organization?** → Tenant Profile.

If something founder-specific is pushing to live in the Core or Constitution, that is the signal to **stop**: either generalize it into a module, or push it down into the Tenant 0 profile. Founder specifics never climb upward.

---

## 7. The Human Goal and the Systemic Goal

- **Human goal:** free the founder to spend time on **judgment, creativity, architecture, and problem-solving**.
- **Systemic goal:** have **workflows, policies, and agents absorb coordination, administration, and repetitive execution** — with humans present only at decision points that require accountability.

Every module is justified by how much friction it removes from the human, not by how much it does.

---

*Canon. Subordinate to the [Constitution](../memory/constitution.md). Pairs with the [Manifesto](./manifesto.md) (why) and the [Tenant 0 Profile](../tenants/tenant-0-founder-profile.md) (the first concrete case).*
