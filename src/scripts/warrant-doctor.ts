import { createSandboxRegistry } from '@/agent/sandbox/tools';
import { auditToolRegistry } from '@/core/tools/registry';

function main(): void {
  const registry = createSandboxRegistry();
  const findings = auditToolRegistry(registry);

  if (findings.length === 0) {
    console.log('warrant doctor: no registry findings');
    return;
  }

  console.log('warrant doctor: registry findings');
  for (const line of findings) {
    console.log(`- ${line}`);
  }
  process.exitCode = 1;
}

main();
