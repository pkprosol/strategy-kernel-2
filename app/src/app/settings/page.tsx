'use client';

import { useSession } from 'next-auth/react';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';

function SettingsContent() {
  const { data: session } = useSession();

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-zinc-100 mb-6">Settings</h2>

      <div className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h3 className="font-semibold text-zinc-200 mb-2">Account</h3>
          <p className="text-sm text-zinc-500">
            Email: {session?.user?.email}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h3 className="font-semibold text-zinc-200 mb-2">MCP Server</h3>
          <p className="text-sm text-zinc-500 mb-2">
            Add the Strategy Kernel MCP server to your Claude Desktop config:
          </p>
          <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-400 overflow-x-auto">
{`{
  "mcpServers": {
    "strategy-kernel": {
      "command": "node",
      "args": ["/path/to/strategy-kernel/mcp-server/build/index.js"],
      "env": {
        "DB_PATH": "/path/to/strategy-kernel/app/strategy-kernel.db",
        "STRATEGY_KERNEL_USER_EMAIL": "${session?.user?.email || 'your@email.com'}"
      }
    }
  }
}`}
          </pre>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h3 className="font-semibold text-zinc-200 mb-2">Data</h3>
          <p className="text-sm text-zinc-500">
            Database: SQLite (local, private, portable)
          </p>
          <p className="text-sm text-zinc-500">
            Location: strategy-kernel/app/strategy-kernel.db
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Providers>
      <Shell>
        <SettingsContent />
      </Shell>
    </Providers>
  );
}
