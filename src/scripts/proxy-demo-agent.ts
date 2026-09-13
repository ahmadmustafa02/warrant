import 'dotenv/config';
import { runProxyDemoAgent } from '@/agent/proxyDemo/runProxyDemoAgent';

async function main(): Promise<void> {
  const result = await runProxyDemoAgent({});
  console.log(JSON.stringify(result, null, 2));
  if (result.hijacked) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
