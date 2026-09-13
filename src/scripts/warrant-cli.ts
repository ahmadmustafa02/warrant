// The published bin shebang is added by tsup's banner; adding one here too would
// land a second shebang on line 2 of the bundle, which Node rejects.
import { runCli } from '@/cli/main';

runCli(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
