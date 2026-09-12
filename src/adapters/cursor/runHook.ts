import { issueWarrant } from '@/core/authorization/warrant';
import { taint } from '@/core/provenance/tainted';
import { evaluateToolCall, type GuardMode } from '@/agent/guard/applyGuard';
import { createCursorRegistry } from './cursorRegistry';
import { deriveCursorIntentFromPrompt } from './deriveCursorIntent';
import {
  beforeMcpExecutionSchema,
  beforeShellExecutionSchema,
  beforeSubmitPromptSchema,
  type HookEventName,
  postToolUseSchema,
  preToolUseSchema,
  sessionIdFromPayload,
} from './hookEvents';
import { loadCursorPolicy, pathMatchesProtectedPrefix } from './policy';
import {
  extractNetworkTarget,
  shellCommandLooksLikeNetworkEgress,
} from './shellEgress';
import { appendLedgerEvent, latestWarrant } from './sessionStore';

export type HookPermission = 'allow' | 'ask' | 'deny';

export type HookResult = {
  readonly permission: HookPermission;
  readonly user_message?: string;
  readonly agent_message?: string;
};

function guardModeFromPolicy(mode: 'SHADOW' | 'ENFORCE'): GuardMode {
  return mode === 'ENFORCE' ? 'ENFORCE' : 'DETECT_ONLY';
}

function shadowLog(
  sessionId: string,
  hook: string,
  code: string,
  reason: string,
  detail: Record<string, unknown>,
): void {
  appendLedgerEvent(sessionId, {
    type: 'shadow',
    at: new Date().toISOString(),
    hook,
    code,
    reason,
    detail,
  });
}

function evaluateDenied(
  policyMode: 'SHADOW' | 'ENFORCE',
  sessionId: string,
  hook: string,
  code: string,
  reason: string,
  detail: Record<string, unknown>,
): HookResult {
  if (policyMode === 'SHADOW') {
    shadowLog(sessionId, hook, code, reason, detail);
    return { permission: 'allow' };
  }
  return {
    permission: 'deny',
    user_message: `Warrant blocked this action: ${reason}`,
    agent_message: `Warrant denied the action (${code}). ${reason}`,
  };
}

export function runCursorHook(
  event: HookEventName,
  input: unknown,
  projectRoot: string,
): HookResult {
  const policy = loadCursorPolicy(projectRoot);
  const registry = createCursorRegistry();
  const mode = guardModeFromPolicy(policy.mode);

  if (event === 'beforeSubmitPrompt') {
    const payload = beforeSubmitPromptSchema.parse(input);
    const sessionId = sessionIdFromPayload(payload);
    const prompt = payload.prompt ?? payload.user_message ?? '';
    const intent = deriveCursorIntentFromPrompt(prompt);
    const warrant = issueWarrant(taint(intent, 'USER'), registry);
    appendLedgerEvent(sessionId, {
      type: 'warrant',
      at: new Date().toISOString(),
      warrant,
    });
    return { permission: 'allow' };
  }

  if (event === 'postToolUse') {
    const payload = postToolUseSchema.parse(input);
    const sessionId = sessionIdFromPayload(payload);
    const tool = payload.tool ?? payload.tool_name ?? '';
    const readPath = payload.file_path ?? payload.path;
    if (/read/i.test(tool) && typeof readPath === 'string' && readPath.length > 0) {
      appendLedgerEvent(sessionId, {
        type: 'read',
        at: new Date().toISOString(),
        path: readPath,
      });
    }
    return { permission: 'allow' };
  }

  if (event === 'beforeShellExecution') {
    const payload = beforeShellExecutionSchema.parse(input);
    const sessionId = sessionIdFromPayload(payload);
    const warrant = latestWarrant(sessionId) ?? latestWarrant('default');
    const command = payload.command;
    if (!shellCommandLooksLikeNetworkEgress(command)) {
      return { permission: 'allow' };
    }
    if (warrant === undefined) {
      return evaluateDenied(
        policy.mode,
        sessionId,
        event,
        'NO_WARRANT',
        'no warrant was frozen for this session before the shell command ran',
        { command },
      );
    }
    const target = extractNetworkTarget(command);
    const decision = evaluateToolCall({
      mode,
      warrant,
      registry,
      toolName: 'shell_network',
      rawArguments: JSON.stringify({ target }),
    });
    if (decision !== null && !decision.allowed) {
      return evaluateDenied(
        policy.mode,
        sessionId,
        event,
        decision.code,
        decision.reason,
        { command, target },
      );
    }
    return { permission: 'allow' };
  }

  if (event === 'preToolUse') {
    const payload = preToolUseSchema.parse(input);
    const sessionId = sessionIdFromPayload(payload);
    const tool = payload.tool ?? payload.tool_name ?? '';
    const filePath = payload.file_path ?? payload.path;
    if (!/write|edit|apply/i.test(tool) || typeof filePath !== 'string') {
      return { permission: 'allow' };
    }
    return evaluateProtectedWrite(filePath, projectRoot, sessionId);
  }

  if (event === 'beforeMCPExecution') {
    const payload = beforeMcpExecutionSchema.parse(input);
    const sessionId = sessionIdFromPayload(payload);
    const warrant = latestWarrant(sessionId) ?? latestWarrant('default');
    const tool = payload.tool ?? payload.tool_name ?? 'unknown';
    if (warrant === undefined) {
      return evaluateDenied(
        policy.mode,
        sessionId,
        event,
        'NO_WARRANT',
        'no warrant was frozen for this session before the MCP call ran',
        { tool },
      );
    }
    const decision = evaluateToolCall({
      mode,
      warrant,
      registry,
      toolName: 'mcp_invoke',
      rawArguments: JSON.stringify({ tool, server: payload.server ?? 'unknown' }),
    });
    if (decision !== null && !decision.allowed) {
      return evaluateDenied(
        policy.mode,
        sessionId,
        event,
        decision.code,
        decision.reason,
        { tool },
      );
    }
    return { permission: 'allow' };
  }

  return { permission: 'allow' };
}

export function evaluateProtectedWrite(
  filePath: string,
  projectRoot: string,
  sessionId: string,
): HookResult {
  const policy = loadCursorPolicy(projectRoot);
  if (!pathMatchesProtectedPrefix(filePath, policy.protectedPathPrefixes)) {
    return { permission: 'allow' };
  }
  const warrant = latestWarrant(sessionId);
  const registry = createCursorRegistry();
  const mode = guardModeFromPolicy(policy.mode);
  if (warrant === undefined) {
    return evaluateDenied(
      policy.mode,
      sessionId,
      'preToolUse',
      'NO_WARRANT',
      'no warrant was frozen before editing a protected path',
      { path: filePath },
    );
  }
  const decision = evaluateToolCall({
    mode,
    warrant,
    registry,
    toolName: 'write_protected_path',
    rawArguments: JSON.stringify({ path: filePath }),
  });
  if (decision !== null && !decision.allowed) {
    return evaluateDenied(
      policy.mode,
      sessionId,
      'preToolUse',
      decision.code,
      decision.reason,
      { path: filePath },
    );
  }
  return { permission: 'allow' };
}
