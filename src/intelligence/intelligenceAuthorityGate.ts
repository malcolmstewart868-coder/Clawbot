export type AuthorityGateResults = {
  finalAction: string;
  execute: boolean;
  authorityGranted: boolean;
  gateReason: string;
};

export function applyAuthorityGate(args: {
  candidateAction: string;
  supervisor: {
    authorityGranted: boolean;
    observeOnly: boolean;
    advisoryOnly: boolean;
    supervisorNote: string;
    mode: string;
  };
}): AuthorityGateResults {
  if (args.supervisor.observeOnly) {
    return {
      finalAction: "OBSERVE",
      execute: false,
      authorityGranted: false,
      gateReason: "OBSERVE_ONLY_GATE",
    };
  }

  if (args.supervisor.advisoryOnly) {
    return {
      finalAction: args.candidateAction,
      execute: false,
      authorityGranted: false,
      gateReason: "ADVISORY_ONLY_GATE",
    };
  }

  if (!args.supervisor.authorityGranted) {
    return {
      finalAction: args.candidateAction,
      execute: false,
      authorityGranted: false,
      gateReason: "AUTHORITY_DENIED",
    };
  }

  return {
    finalAction: args.candidateAction,
    execute: true,
    authorityGranted: true,
    gateReason: "AUTHORITY_GRANTED",
  };
}