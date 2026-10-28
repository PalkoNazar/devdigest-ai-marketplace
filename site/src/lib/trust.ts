// What a plugin can execute or connect to, derived from its files. Not a security review.
import type { HookInfo, McpInfo, MonitorInfo } from './catalog.ts';

export type TrustLevel = 'content-only' | 'local-commands' | 'network';

export const TRUST_LABELS: Record<TrustLevel, string> = {
  'content-only': 'Content only',
  'local-commands': 'Runs local commands',
  network: 'Connects to network',
};

export type Trust = {
  level: TrustLevel;
  asksForSecrets: boolean;
  hooks: HookInfo[];
  mcpServers: McpInfo[];
  monitors: MonitorInfo[];
  bin: string[];
  userConfig: { key: string; title: string; required: boolean; sensitive: boolean }[];
  toolAccess: { name: string; tools: string[] }[];
  networkHosts: string[];
  minClaudeCodeVersion?: string;
  dependencies: string[];
  sources: string[];
};

export function trustOf(input: Partial<Omit<Trust, 'level' | 'asksForSecrets' | 'networkHosts'>>): Trust {
  const hooks = input.hooks ?? [];
  const mcpServers = input.mcpServers ?? [];
  const monitors = input.monitors ?? [];
  const bin = input.bin ?? [];
  const userConfig = input.userConfig ?? [];
  const remote = mcpServers.filter((s) => s.transport !== 'stdio' && (s.transport !== 'bundle' || s.url));
  const runsLocal = hooks.length > 0 || monitors.length > 0 || bin.length > 0 || mcpServers.some((s) => s.transport === 'stdio' || s.transport === 'bundle');
  const level: TrustLevel = remote.length > 0 ? 'network' : runsLocal ? 'local-commands' : 'content-only';
  return {
    level,
    asksForSecrets: userConfig.some((c) => c.sensitive),
    hooks,
    mcpServers,
    monitors,
    bin,
    userConfig,
    toolAccess: input.toolAccess ?? [],
    networkHosts: [...new Set(remote.map((s) => s.host).filter((h): h is string => Boolean(h)))].sort(),
    minClaudeCodeVersion: input.minClaudeCodeVersion,
    dependencies: input.dependencies ?? [],
    sources: input.sources ?? [],
  };
}
