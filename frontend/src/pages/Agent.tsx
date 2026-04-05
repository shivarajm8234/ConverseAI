import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bot, Database, Network, Server, Activity, ExternalLink } from 'lucide-react';
import { healthUrl } from '@/lib/api';

export function Agent() {
  const { data: health, isFetching } = useQuery({
    queryKey: ['backend-health'],
    queryFn: async () => {
      const res = await fetch(healthUrl());
      if (!res.ok) throw new Error('unreachable');
      return res.json() as Promise<{ status: string; timestamp: string }>;
    },
    retry: 1,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Bot className="text-purple-500" size={32} />
          Voice agent
        </h1>
        <p className="text-slate-400">
          Telephony runs on your Asterisk server (AGI). This dashboard is hosted on Firebase; CRM and the
          knowledge graph are backed by Supabase PostgreSQL via the API.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Backend status</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
              health?.status === 'ok'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
            }`}
          >
            <Activity size={16} className={isFetching ? 'animate-pulse' : ''} />
            {health?.status === 'ok' ? 'API reachable' : 'API not reachable — check server & CORS'}
          </span>
          {health?.timestamp && (
            <span className="text-xs text-slate-500 font-mono">last: {health.timestamp}</span>
          )}
        </div>
        <p className="text-xs text-slate-600">
          Set <code className="text-slate-400">VITE_API_BASE_URL</code> to your deployed API (e.g.{' '}
          <code className="text-slate-400">https://your-api.example.com/api</code>).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StackCard
          icon={<Database className="text-cyan-400" size={22} />}
          title="Supabase (database)"
          body="PostgreSQL holds customers, calls, document chunks, and graph tables (GraphNode, GraphEdge). Prisma in the backend reads and writes this data."
        />
        <StackCard
          icon={<Server className="text-purple-400" size={22} />}
          title="Firebase (this app)"
          body="Firebase Hosting serves the built Vite app; Analytics measures usage. It does not replace Supabase for relational or graph data."
        />
        <StackCard
          icon={<Bot className="text-amber-400" size={22} />}
          title="Voice agent process"
          body="The AGI script on the voice server uses Groq/Sarvam/etc. Configure secrets in backend .env on that host."
        />
        <Link
          to="/knowledge"
          className="group rounded-2xl border border-purple-500/30 bg-purple-600/5 p-5 transition-colors hover:bg-purple-600/10 hover:border-purple-500/50"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Network className="text-purple-400" size={22} />
              <div>
                <h3 className="font-semibold text-white">Knowledge graph</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Entities and relations from <span className="text-slate-300">GET /api/graph</span> (Supabase).
                </p>
              </div>
            </div>
            <ExternalLink className="text-slate-500 group-hover:text-purple-400 shrink-0" size={18} />
          </div>
        </Link>
      </div>
    </div>
  );
}

function StackCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}
