import { describe, expect, it } from 'vitest';
import { DuplicateToolError, ToolRegistry, type ToolDefinition } from './registry';

const readDocument: ToolDefinition = {
  name: 'read_document',
  riskTier: 'READ_ONLY',
  description: 'Reads a document by id.',
};

const sendEmail: ToolDefinition = {
  name: 'send_email',
  riskTier: 'SENSITIVE',
  description: 'Sends an email on the user behalf.',
};

const deleteAccount: ToolDefinition = {
  name: 'delete_account',
  riskTier: 'DESTRUCTIVE',
  description: 'Permanently deletes an account.',
};

describe('ToolRegistry', () => {
  it('registers definitions passed to the constructor', () => {
    const registry = new ToolRegistry([readDocument, sendEmail]);
    expect(registry.has('read_document')).toBe(true);
    expect(registry.get('send_email')?.riskTier).toBe('SENSITIVE');
    expect(registry.list()).toHaveLength(2);
  });

  it('returns undefined for an unregistered name', () => {
    expect(new ToolRegistry().get('nope')).toBeUndefined();
  });

  it('rejects redeclaration instead of overwriting', () => {
    const registry = new ToolRegistry([sendEmail]);
    // Silent replacement would let a later registration downgrade a risk tier.
    expect(() => registry.register({ ...sendEmail, riskTier: 'READ_ONLY' })).toThrow(
      DuplicateToolError,
    );
    expect(registry.get('send_email')?.riskTier).toBe('SENSITIVE');
  });

  it('freezes stored definitions', () => {
    const registry = new ToolRegistry([sendEmail]);
    const stored = registry.get('send_email');
    expect(() => {
      (stored as { riskTier: string }).riskTier = 'READ_ONLY';
    }).toThrow(TypeError);
  });

  it('leaves read-only tools unrestricted', () => {
    const registry = new ToolRegistry([readDocument]);
    expect(registry.requiresWarrant('read_document')).toBe(false);
  });

  it('requires a warrant for consequential tools', () => {
    const registry = new ToolRegistry([sendEmail, deleteAccount]);
    expect(registry.requiresWarrant('send_email')).toBe(true);
    expect(registry.requiresWarrant('delete_account')).toBe(true);
  });

  it('fails closed for tools it has never heard of', () => {
    // A capability injected at runtime must not bypass the guard by being absent.
    expect(new ToolRegistry().requiresWarrant('exfiltrate_everything')).toBe(true);
  });
});
