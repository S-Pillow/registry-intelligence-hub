export type HumanApprovalInput = {
  stewardApprovalId: string | undefined;
  productApprovalId: string | undefined;
};

export type HumanApprovalResult = {
  ok: boolean;
  errors: string[];
  stewardApprovalId: string | null;
  productApprovalId: string | null;
};

export function evaluateHumanApprovals(input: HumanApprovalInput): HumanApprovalResult {
  const errors: string[] = [];
  const steward = input.stewardApprovalId?.trim() || null;
  const product = input.productApprovalId?.trim() || null;

  if (!steward) {
    errors.push("Missing --steward-approval <ticket-or-signoff-id> — data steward must attest this is the intended publication");
  }
  if (!product) {
    errors.push("Missing --product-approval <ticket-or-signoff-id> — product owner must attest Reveal Day intent");
  }

  return {
    ok: errors.length === 0,
    errors,
    stewardApprovalId: steward,
    productApprovalId: product,
  };
}
