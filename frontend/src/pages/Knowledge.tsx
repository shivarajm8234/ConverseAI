import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Network, 
  GitBranch, 
  Database,
  Search,
  RefreshCw
} from 'lucide-react';
import { ParticleCard, GlobalSpotlight, useMobileDetection } from '@/components/ui/MagicBento';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const PURPLE_GLOW = '132, 0, 255';

export function Knowledge() {
  const gridRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobileDetection();

  const { data: graph, isLoading, refetch } = useQuery({
    queryKey: ['knowledge-graph'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/graph`);
      if (!res.ok) throw new Error('Network error');
      return await res.json();
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bento-section">
      <style>{`
        .bento-section {
          --glow-radius: 400px;
          --glow-color: ${PURPLE_GLOW};
        }
        .node-pulse {
            animation: pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
        }
        @keyframes pulse-ring {
            0% { transform: scale(.33); }
            80%, 100% { opacity: 0; }
        }
      `}</style>
      
      <GlobalSpotlight 
        gridRef={gridRef} 
        spotlightRadius={400} 
        glowColor={PURPLE_GLOW} 
        disableAnimations={isMobile}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Network className="text-purple-500" />
            Knowledge Graph
          </h1>
          <p className="text-slate-400">AI-extracted entities and relationships from your Telegram updates.</p>
        </div>
        <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-400 transition-all active:scale-95"
        >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            Refresh Graph
        </button>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entity List */}
        <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {graph?.nodes?.length > 0 ? (
                    graph.nodes.map((node: any) => (
                        <EntityCard key={node.id} node={node} isMobile={isMobile} />
                    ))
                ) : (
                    <div className="col-span-full p-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl text-center">
                        <Database className="mx-auto text-slate-700 mb-4" size={48} />
                        <p className="text-slate-500 text-lg">No entities found in the graph yet.</p>
                        <p className="text-slate-600 text-sm mt-2">Update your knowledge via the Telegram bot to see them here.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Relationships / Activity */}
        <div className="space-y-6">
            <div className="p-6 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-3xl h-full shadow-2xl relative overflow-hidden">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <GitBranch size={20} className="text-purple-400" />
                    Recent Relations
                </h3>
                <div className="space-y-4">
                    {graph?.edges?.length > 0 ? (
                        graph.edges.map((edge: any) => (
                            <div key={edge.id} className="p-4 bg-slate-800/30 rounded-2xl border border-white/5 flex items-center justify-between">
                                <span className="text-xs font-mono text-purple-400">{edge.sourceNodeId}</span>
                                <div className="flex-1 px-4 flex flex-col items-center">
                                    <div className="h-px w-full bg-slate-700 relative">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-[#0a0a0a] text-[10px] text-slate-500 uppercase tracking-tighter">
                                            {edge.relation}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-cyan-400">{edge.targetNodeId}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-slate-600 text-sm text-center py-8 italic">Waiting for relationship data...</p>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function EntityCard({ node, isMobile }: any) {
    return (
        <ParticleCard 
            className="p-5 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl group transition-all hover:bg-slate-900/60"
            glowColor={PURPLE_GLOW}
            disableAnimations={isMobile}
            enableTilt={!isMobile}
            clickEffect={true}
        >
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(134,0,255,0.8)]" />
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{node.type}</span>
                    </div>
                    <h4 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight">
                        {node.label}
                    </h4>
                </div>
                <button className="p-2 text-slate-600 hover:text-slate-400 transition-colors">
                    <Search size={16} />
                </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                {node.metadata && Object.entries(node.metadata).map(([key, val]: any) => (
                    <div key={key} className="flex justify-between text-[11px]">
                        <span className="text-slate-500 capitalize">{key}</span>
                        <span className="text-slate-300 font-mono">{typeof val === 'string' ? val : JSON.stringify(val)}</span>
                    </div>
                ))}
            </div>
        </ParticleCard>
    );
}
