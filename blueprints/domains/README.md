# domains/

Bounded contexts and their aggregates. Conceptual in Phase 0 — see the [Domain Model](../../docs/domain-model.md) for the authoritative definitions.

Each bounded context is a folder. New contexts (People, Finance, Procurement) are added as **siblings** — this is *Modular Evolution* (Principle 7) made literal in the file tree. The core does not reshape to accommodate a new module.

## Initial contexts

| Folder | Bounded context | Domains |
|---|---|---|
| `tenancy-identity/` | Tenancy & Identity | Tenant, Customer |
| `commercial/` | Commercial | Lead, Proposal |
| `delivery-billing/` | Delivery & Billing | Project, Invoice, Payment |

Governance (Policy, Workflow, Agent, Audit Log) is **cross-cutting** and lives in [`governance/`](../../governance/), [`policies/`](../policies/), [`workflows/`](../workflows/), and [`agents/`](../agents/) — not here — because it governs these contexts rather than being one of them.

*Folders are scaffolding. No aggregates are implemented in Phase 0.*
