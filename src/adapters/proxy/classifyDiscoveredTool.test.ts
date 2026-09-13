import { describe, expect, it } from 'vitest';
import {
  buildProxyRegistry,
  classifyDiscoveredTool,
  tokenizeToolName,
} from './classifyDiscoveredTool';

function tool(name: string, parameterNames: readonly string[] = []) {
  return { name, description: '', parameterNames };
}

describe('tokenizeToolName', () => {
  it('splits snake_case and camelCase alike', () => {
    expect(tokenizeToolName('send_email')).toEqual(['send', 'email']);
    expect(tokenizeToolName('sendEmail')).toEqual(['send', 'email']);
    expect(tokenizeToolName('mcp__github__create_issue')).toEqual([
      'mcp',
      'github',
      'create',
      'issue',
    ]);
  });
});

describe('classifyDiscoveredTool', () => {
  it('treats money and deletion verbs as destructive', () => {
    expect(classifyDiscoveredTool(tool('refund_charge')).riskTier).toBe('DESTRUCTIVE');
    expect(classifyDiscoveredTool(tool('delete_user')).riskTier).toBe('DESTRUCTIVE');
  });

  it('treats outbound side effects as sensitive and pins their destination', () => {
    const definition = classifyDiscoveredTool(tool('send_email', ['to', 'body']));

    expect(definition.riskTier).toBe('SENSITIVE');
    expect(definition.authorityParameters).toEqual(['to']);
  });

  it('leaves ordinary reads warrant-exempt', () => {
    const definition = classifyDiscoveredTool(tool('read_ticket', ['id']));

    expect(definition.riskTier).toBe('READ_ONLY');
    expect(definition.egress).toBeUndefined();
    expect(definition.authorityParameters).toBeUndefined();
  });

  it('marks a read that leaves the process as egress so it still needs a warrant', () => {
    const definition = classifyDiscoveredTool(tool('fetch_url', ['url']));

    expect(definition.riskTier).toBe('READ_ONLY');
    expect(definition.egress).toBe(true);
    expect(definition.authorityParameters).toEqual(['url']);
  });

  it('treats an unrecognized verb as local read-only work', () => {
    expect(classifyDiscoveredTool(tool('frobnicate_widget')).riskTier).toBe(
      'READ_ONLY',
    );
  });

  it('requires a warrant when an unknown tool advertises a destination parameter', () => {
    const definition = classifyDiscoveredTool(
      tool('frobnicate_widget', ['to', 'payload']),
    );

    expect(definition.riskTier).toBe('READ_ONLY');
    expect(definition.egress).toBe(true);
    expect(definition.authorityParameters).toEqual(['to']);
  });

  it('treats secret-bearing tool names as sensitive even when they look like reads', () => {
    expect(classifyDiscoveredTool(tool('get_api_key')).riskTier).toBe('SENSITIVE');
    expect(classifyDiscoveredTool(tool('get_api_key')).returnsSecrets).toBe(true);
  });

  it('treats vault reads as secret-bearing sensitive tools', () => {
    const definition = classifyDiscoveredTool(tool('read_vault_entry', ['key']));

    expect(definition.riskTier).toBe('SENSITIVE');
    expect(definition.returnsSecrets).toBe(true);
  });

  it('lets an explicit override win over the inferred tier', () => {
    const definition = classifyDiscoveredTool(tool('frobnicate_widget'), {
      riskTier: 'READ_ONLY',
    });

    expect(definition.riskTier).toBe('READ_ONLY');
  });
});

describe('buildProxyRegistry', () => {
  it('registers every observed tool and exempts only plain reads', () => {
    const registry = buildProxyRegistry([
      tool('read_ticket', ['id']),
      tool('send_email', ['to']),
      tool('fetch_url', ['url']),
      tool('frobnicate_widget', ['id']),
    ]);

    expect(registry.requiresWarrant('read_ticket')).toBe(false);
    expect(registry.requiresWarrant('frobnicate_widget')).toBe(false);
    expect(registry.requiresWarrant('send_email')).toBe(true);
    expect(registry.requiresWarrant('fetch_url')).toBe(true);
  });

  it('ignores a duplicate advertisement rather than throwing', () => {
    const registry = buildProxyRegistry([
      tool('send_email', ['to']),
      tool('send_email'),
    ]);

    expect(registry.list()).toHaveLength(1);
  });
});
