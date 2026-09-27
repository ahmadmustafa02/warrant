import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { prepareUserCommand } from '@/lib/spawnCommand';
import type { GuardMode } from '@/agent/guard/applyGuard';
import type { DiscoveredTool } from '@/adapters/proxy/canonical';
import type { ProxyDecision } from '@/adapters/proxy/guardExchange';
import { ProxySession } from '@/adapters/proxy/proxySession';
import {
  isJsonRpcRequest,
  isToolsCall,
  judgeMcpToolCall,
  mcpDenialResult,
  toolsFromListResult,
} from './guardMcpCall';
import { encodeMcpFrame, McpFrameDecoder, type McpFrame } from './mcpFraming';

export interface McpProxyEvent {
  readonly decisions: readonly ProxyDecision[];
  readonly blockedTools: readonly string[];
  readonly wouldBlockTools: readonly string[];
}

export interface McpStdioProxyOptions {
  readonly mode: GuardMode;
  readonly userTurn: string;
  readonly command: readonly string[];
  readonly onEvent?: (event: McpProxyEvent) => void;
  readonly stdin?: NodeJS.ReadableStream;
  readonly stdout?: NodeJS.WritableStream;
  readonly stderr?: NodeJS.WritableStream;
}

/**
 * Sits on stdio between an MCP client and a real MCP server.
 *
 * The client's framing is preserved on the way back so a Content-Length client
 * does not suddenly receive NDJSON.
 */
export function startMcpStdioProxy(
  options: McpStdioProxyOptions,
): Promise<{ child: ChildProcessWithoutNullStreams; done: Promise<number> }> {
  const command = options.command[0];
  if (command === undefined || command === '') {
    return Promise.reject(
      new Error('warrant guard --mcp requires a server command after --'),
    );
  }

  const prepared = prepareUserCommand(options.command);
  const child = spawn(prepared.file, [...prepared.args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: prepared.shell,
    windowsVerbatimArguments: prepared.windowsVerbatimArguments,
  });

  const session = new ProxySession();
  let advertised: readonly DiscoveredTool[] = [];
  const clientDecoder = new McpFrameDecoder();
  const serverDecoder = new McpFrameDecoder();
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  child.stderr.on('data', (chunk: Buffer) => {
    stderr.write(chunk);
  });

  stdin.on('data', (chunk: Buffer) => {
    let frames: readonly McpFrame[];
    try {
      frames = clientDecoder.push(chunk);
    } catch {
      child.stdin.write(chunk);
      return;
    }
    for (const frame of frames) {
      if (options.mode !== 'OFF' && isToolsCall(frame.json)) {
        const judgement = judgeMcpToolCall({
          mode: options.mode,
          userTurn: options.userTurn,
          request: frame.json,
          advertised,
          session,
        });
        if (judgement.decision !== undefined) {
          const blocked = judgement.deny ? [toolNameOf(judgement.decision)] : [];
          const wouldBlock =
            !judgement.deny && isDenial(judgement.decision)
              ? [toolNameOf(judgement.decision)]
              : [];
          options.onEvent?.({
            decisions: [judgement.decision],
            blockedTools: blocked,
            wouldBlockTools: wouldBlock,
          });
        }
        if (judgement.deny && isJsonRpcRequest(frame.json)) {
          stdout.write(
            encodeMcpFrame(
              mcpDenialResult(frame.json.id, judgement.reason),
              frame.framing,
            ),
          );
          continue;
        }
      }
      child.stdin.write(encodeMcpFrame(frame.json, frame.framing));
    }
  });

  child.stdout.on('data', (chunk: Buffer) => {
    let frames: readonly McpFrame[];
    try {
      frames = serverDecoder.push(chunk);
    } catch {
      stdout.write(chunk);
      return;
    }
    for (const frame of frames) {
      const listed = toolsFromListResult(frame.json);
      if (listed.length > 0) {
        advertised = listed;
        session.observeTools(listed);
      }
      stdout.write(encodeMcpFrame(frame.json, frame.framing));
    }
  });

  const done = new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });

  return Promise.resolve({ child, done });
}

function toolNameOf(decision: ProxyDecision): string {
  return decision.kind === 'GUARD' ? decision.decision.tool : decision.toolName;
}

function isDenial(decision: ProxyDecision): boolean {
  return decision.kind !== 'GUARD' || !decision.decision.allowed;
}
