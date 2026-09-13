import 'dotenv/config';
import { runProxyDemoAgent } from '@/agent/proxyDemo/runProxyDemoAgent';

/**
 * Optional subprocess for `warrant red-team -- -- node …/warrant-eval-child.js`:
 * reads WARRANT_EVAL_* env vars and talks to the model through OPENAI_BASE_URL.
 */
async function main(): Promise<void> {
  const userTurn = process.env.WARRANT_EVAL_USER_TURN?.trim();
  const injectionLine = process.env.WARRANT_EVAL_INJECTION?.trim();
  if (injectionLine === undefined || injectionLine === '') {
    throw new Error('WARRANT_EVAL_INJECTION is required');
  }

  const result = await runProxyDemoAgent({
    userTurn: userTurn === '' ? undefined : userTurn,
    injectionLine,
  });

  // Last line JSON for the parent CLI parser.
  console.log(JSON.stringify(result));
  process.exitCode = result.hijacked ? 2 : 0;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
