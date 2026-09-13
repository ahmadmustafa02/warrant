#!/usr/bin/env node
import { runCli } from '@/cli/main';

runCli(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
