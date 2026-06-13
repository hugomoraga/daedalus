# Bounded Context: Tenancy & Identity

**Purpose:** Who the organization is operating *as* and *for*. Enforces isolation.

## Domains
- **Tenant** *(aggregate root)* — the top-level isolation boundary. Every entity in the system belongs to exactly one tenant. Invariant: no cross-tenant references.
- **Customer** *(aggregate root)* — an external party the organization serves. Belongs to one Tenant.

See the authoritative definitions in the [Domain Model](../../docs/domain-model.md). Conceptual only in Phase 0.
