import { describe, expect, it } from 'vitest';
import {
  auditToolRegistry,
  DuplicateToolError,
  ToolDefinitionError,
  ToolRegistry,
  type ToolDefinition,
} from './registry';

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

  it('freezes authority parameters against later mutation', () => {
    const mutable = ['to'];
    const registry = new ToolRegistry([{ ...sendEmail, authorityParameters: mutable }]);
    mutable.push('body');

    const stored = registry.get('send_email')?.authorityParameters;
    expect(stored).toEqual(['to']);
    expect(() => (stored as string[]).push('body')).toThrow(TypeError);
  });

  it('rejects authority parameters on a read-only tool without egress', () => {
    expect(
      () => new ToolRegistry([{ ...readDocument, authorityParameters: ['id'] }]),
    ).toThrow(ToolDefinitionError);
  });

  it('allows authority parameters on an egress read-only tool', () => {
    const registry = new ToolRegistry([
      {
        ...readDocument,
        name: 'fetch_url',
        egress: true,
        authorityParameters: ['url'],
      },
    ]);
    expect(registry.get('fetch_url')?.egress).toBe(true);
    expect(registry.requiresWarrant('fetch_url')).toBe(true);
  });

  it('rejects invalid parameter constraints at registration time', () => {
    expect(
      () =>
        new ToolRegistry([
          {
            ...sendEmail,
            parameterConstraints: {
              body: { kind: 'stringPattern', pattern: '[' },
            },
          },
        ]),
    ).toThrow(ToolDefinitionError);
  });

  it('requires egress tools to declare authority parameters', () => {
    expect(
      () => new ToolRegistry([{ ...readDocument, name: 'fetch_url', egress: true }]),
    ).toThrow(ToolDefinitionError);
  });

  it('fails closed for tools it has never heard of', () => {
    // A capability injected at runtime must not bypass the guard by being absent.
    expect(new ToolRegistry().requiresWarrant('exfiltrate_everything')).toBe(true);
  });

  it('flags read-only tools whose parameters look like egress destinations', () => {
    const findings = auditToolRegistry(
      new ToolRegistry([
        {
          name: 'load_page',
          riskTier: 'READ_ONLY',
          description: 'Loads a page.',
          observedParameters: ['url'],
        },
      ]),
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]).toContain('load_page');
  });
});
