import { deriveIntentFromUserTurn } from '@/agent/intent/deriveIntent';
import { runSandboxAgent } from '@/agent/runSandboxAgent';
import { playgroundOutcome, type PlaygroundRequest } from './playgroundRequestSchema';

export async function runPlaygroundSession(body: PlaygroundRequest) {
  const intent = deriveIntentFromUserTurn(body.userTurn);
  const measuredAuthorizedTools =
    intent.requestedTools.length > 0 ? intent.requestedTools : ['read_document'];

  const result = await runSandboxAgent({
    userTurn: body.userTurn,
    injectionLine: body.injectionLine,
    guardMode: body.guardMode,
    promptProfile: 'NAIVE',
    measuredAuthorizedTools,
  });

  const outcome = playgroundOutcome({
    hijacked: result.hijacked,
    guardMode: body.guardMode,
    blockedTools: result.blockedTools,
  });

  return {
    outcome,
    hijacked: result.hijacked,
    guardMode: body.guardMode,
    warrantTools: result.warrantTools,
    calledTools: result.calledTools,
    blockedTools: result.blockedTools,
    signals: result.signals,
    finalAnswer: result.finalAnswer,
    guardDecisions: result.guardDecisions.map((decision) => ({
      tool: decision.tool,
      allowed: decision.allowed,
      reason: decision.reason,
      code: decision.allowed ? null : decision.code,
    })),
    transcript: result.transcript,
    latencyMs: result.latencyMs,
    usage: result.usage,
  };
}
