// Proposal Generation — value objects. No pricing engine, no tax (Spec 002 non-goals).
// Amounts are whole currency units (integers). Currency comes from the tenant config.

export type PricingLineItem = {
  label: string;
  amount: number;
};

export type ExpectedValue = {
  amount: number;
  currency: string;
};

// expectedValue = sum of line items, in the tenant currency. Nothing more.
export function sumLineItems(items: PricingLineItem[], currency: string): ExpectedValue {
  const amount = items.reduce((acc, item) => acc + item.amount, 0);
  return { amount, currency };
}
