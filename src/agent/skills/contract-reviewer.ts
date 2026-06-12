export interface ContractIssue {
  severity: "critical" | "warning" | "info";
  clause: string;
  issue: string;
  suggestion: string;
}

export interface ContractReview {
  summary: string;
  overallRisk: "low" | "medium" | "high";
  issues: ContractIssue[];
  missingClauses: string[];
  recommendedChanges: string[];
}
