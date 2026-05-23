#!/usr/bin/env node
import { contextFromArgs } from "./context.js";
import { doctorCommand, initDoctorLayout } from "./doctor.js";
import { ingestCommand } from "./ingest.js";
import { readRegistry, registrySummary } from "./registry.js";
import { repairCommand } from "./repair.js";

const [command, subcommand, ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case "init": {
      const args = [subcommand, ...rest].filter((value): value is string => value !== undefined);
      const context = contextFromArgs(args);
      await initDoctorLayout(context);
      console.log(`home=${context.home}`);
      console.log("PersonalOS home layout ensured");
      break;
    }
    case "ingest":
      await ingestCommand([subcommand, ...rest].filter((value): value is string => value !== undefined));
      break;
    case "doctor":
      await doctorCommand([subcommand, ...rest].filter((value): value is string => value !== undefined));
      break;
    case "repair":
      await repairCommand([subcommand, ...rest].filter((value): value is string => value !== undefined));
      break;
    case "registry":
      await registryCommand(subcommand, rest);
      break;
    default:
      printUsage();
      process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function registryCommand(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case "status": {
      const context = contextFromArgs(args);
      const registry = await readRegistry(context);
      console.log(`home=${context.home}`);
      console.log(registrySummary(registry));
      break;
    }
    default:
      printUsage();
      process.exitCode = 1;
  }
}

function printUsage(): void {
  console.log(`PersonalOS CLI

Usage:
  personalos init [--home path]
  personalos ingest <file> [--home path] [--source manual_upload] [--note text] [--sensitivity normal|private|sensitive] [--tag tag]
  personalos doctor [--home path] [--deep]
  personalos repair [--home path]
  personalos registry status [--home path]

Home resolution:
  --home path, then PERSONALOS_HOME, then the user home default .personalos directory.
`);
}
