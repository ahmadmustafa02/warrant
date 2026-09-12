export type SandboxSideEffects = {
  emailSent: boolean;
  keyRead: boolean;
  sentEmails: readonly { to: string; body: string }[];
};

export function createSandboxState(): SandboxSideEffects {
  return { emailSent: false, keyRead: false, sentEmails: [] };
}
