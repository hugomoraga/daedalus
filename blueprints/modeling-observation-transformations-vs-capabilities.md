# Modeling Observation: Transformations vs Capabilities

**Status:** Observation (non-binding)
**Type:** Modeling lens (cross-cutting conceptual note)
**Date:** 2026-06-13

## Insight

When evaluating a candidate module, distinguish between:

* **Transformation:** what organizational state change occurs.
* **Capability:** the mechanism that produces that change.

Capabilities may vary significantly between tenants while attempting to achieve a similar transformation.

## Validation Test

A transformation is not automatically generic because it is expressed as a state transition.

For a transformation to be considered cross-tenant, it should survive the **"four tenant test"**:

* Commercial
* NGO
* Community
* Creative

If the meaning, invariants, or lifecycle of the transition changes substantially across tenant types, then the transformation is tenant-specific and should not be elevated as a generic concept.

## Architectural Boundary

This distinction is a **modeling lens, not an architectural primitive**.

* **Aggregates** remain the unit of consistency.
* **Modules** remain the unit of ownership and deployment.
* **Events and workflows** remain the mechanism through which transformations are expressed and coordinated.

This observation does **not** modify the Core, [ADR-001](../governance/decisions/ADR-001-defer-root-entity-selection.md), the roadmap, or existing module boundaries.
