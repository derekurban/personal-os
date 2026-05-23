export type ParsedArgs = {
  positional: string[];
  flags: Map<string, Array<string | boolean>>;
};

export function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, Array<string | boolean>>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [rawName, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      addFlag(flags, rawName, inlineValue);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      addFlag(flags, rawName, next);
      index += 1;
      continue;
    }

    addFlag(flags, rawName, true);
  }

  return { positional, flags };
}

export function getStringFlag(flags: Map<string, Array<string | boolean>>, name: string): string | null {
  const value = flags.get(name)?.at(-1);
  return typeof value === "string" ? value : null;
}

export function getStringFlags(flags: Map<string, Array<string | boolean>>, name: string): string[] {
  return (flags.get(name) ?? []).filter((value): value is string => typeof value === "string");
}

export function getBooleanFlag(flags: Map<string, Array<string | boolean>>, name: string): boolean {
  return flags.get(name)?.includes(true) ?? false;
}

function addFlag(flags: Map<string, Array<string | boolean>>, name: string, value: string | boolean): void {
  const values = flags.get(name) ?? [];
  values.push(value);
  flags.set(name, values);
}
