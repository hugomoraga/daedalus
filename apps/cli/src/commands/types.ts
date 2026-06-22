import type { ProposalDeps } from "@daedalus/proposal-generation";
import type { OpportunityDiscoveryDeps } from "@daedalus/opportunity-discovery";
import type { RevenueDeps } from "@daedalus/revenue-visibility";
import { loadTenantConfig } from "../../../../config/tenants/index.ts";

export type Deps = ProposalDeps & OpportunityDiscoveryDeps & RevenueDeps;

export interface CommandContext {
  tenantId: string;
  values: Record<string, string | undefined>;
  deps: Deps;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void> | void;

export function requireOpt(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required --${name}`);
  }
  return value;
}

export function tenantCurrency(tenantId: string): string {
  return loadTenantConfig(tenantId).currency;
}
