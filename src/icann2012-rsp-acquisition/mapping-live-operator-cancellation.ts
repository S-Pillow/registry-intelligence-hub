/** Thrown when the operator stops mapping-live (Ctrl-C or injected abort in tests). */
export class MappingLiveOperatorCancellation extends Error {
  constructor(message = "operator interrupt (Ctrl-C) — mapping-live halted") {
    super(message);
    this.name = "MappingLiveOperatorCancellation";
  }
}

export function isMappingLiveOperatorCancellation(err: unknown): err is MappingLiveOperatorCancellation {
  return err instanceof MappingLiveOperatorCancellation;
}
