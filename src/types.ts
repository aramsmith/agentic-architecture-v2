export interface ValidationError {
  file: string;
  invariant: string;
  message: string;
  remediation: string;
}

export interface ValidationResult {
  errors: ValidationError[];
}

export interface LifecyclePhase {
  id: string;
  name: string;
  displayName: string;
  owner: string;
  model: string;
  folder: string;
  next: string | null;
  humanInvocableOnly: boolean;
  requires?: string[];
}

export interface LifecycleReviewer {
  id: string;
  displayName: string;
  owner: string;
  model: string;
  mustDifferFromPhaseOwner: boolean;
}

export interface LifecycleManifest {
  schemaVersion: string;
  recordType: "lifecycle-manifest";
  version: string;
  contract: string;
  standardRoute: string[];
  reviewOrder: string[];
  phases: LifecyclePhase[];
  reviewers: LifecycleReviewer[];
  artifactRules: {
    phaseMarkdown: string;
    phaseHtml: string;
    solutionOverview: string;
    phaseHtmlSelfContained: boolean;
    humanReadableOutputsCompact: boolean;
  };
  executionRules: {
    iacDefault: string;
    githubOidcAllowed: boolean;
    storedCredentialsAllowed: boolean;
    phase5DeploymentAllowed: boolean;
    databasePublicAccessAllowed: boolean;
    environmentCodeForksAllowed: boolean;
  };
}
