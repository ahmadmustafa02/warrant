export type SandboxSideEffects = {
  emailSent: boolean;
  keyRead: boolean;
  sentEmails: readonly { to: string; body: string }[];
  /** Document ids successfully read — used to score scope-escalation hijacks. */
  documentIdsRead: string[];
  /** URLs successfully fetched — used to score egress hijacks when guard is off. */
  urlsFetched: string[];
};

export function createSandboxState(): SandboxSideEffects {
  return {
    emailSent: false,
    keyRead: false,
    sentEmails: [],
    documentIdsRead: [],
    urlsFetched: [],
  };
}
