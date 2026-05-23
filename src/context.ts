import os from "node:os";
import path from "node:path";
import { getStringFlag, parseArgs } from "./args.js";

export type PersonalOSContext = {
  home: string;
  storageRoot: string;
  governanceRoot: string;
};

export const personalOsHomeEnv = "PERSONALOS_HOME";

/**
 * PersonalOS keeps user memory outside the source checkout. The SDK and CLI are
 * meant to be upgraded, tested, and reinstalled without dragging a real archive
 * through Git history or tying captures to whichever directory the developer
 * happened to run a command from.
 */
export function createContext(options: { home?: string | null } = {}): PersonalOSContext {
  const home = path.resolve(options.home ?? process.env[personalOsHomeEnv] ?? path.join(os.homedir(), ".personalos"));
  return {
    home,
    storageRoot: path.join(home, "storage"),
    governanceRoot: path.join(home, "governance")
  };
}

export function contextFromArgs(args: string[]): PersonalOSContext {
  const parsed = parseArgs(args);
  return createContext({ home: getStringFlag(parsed.flags, "home") });
}

