import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Network, 
  GitBranch, 
  Database,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Send,
  MapPin,
  Bike,
  Cpu,
  ShieldCheck,
  LayoutGrid
} from 'lucide-react';
import { ParticleCard, GlobalSpotlight, useMobileDetection } from '@/components/ui/MagicBento';
import { apiUrl } from '@/lib/api';

const PURPLE_GLOW = '132, 0, 255';

export function Knowledge() {
  const gridRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobileDetection();
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const { data: graph, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['knowledge-graph'],
    queryFn: async () => {
      const res = await fetch(apiUrl('/graph'));
      const ct = res.headers.get('content-type') ?? '';
      if (!res.ok) {
        const t = await res.text();
        throw new Error(
          res.status === 404
            ? 'API not found. For Firebase Hosting, rebuild with VITE_API_BASE_URL pointing at your backend.'
            : t.slice(0, 240) || `HTTP ${res.status}`,
        );
      }
      if (!ct.includes('application/json')) {
        throw new Error(
          'Response was not JSON (often means the dashboard host returned index.html). Set VITE_API_BASE_URL to your live API URL and rebuild.',
        );
      }
      const body = await res.json();
      return {
        nodes: Array.isArray(body.nodes) ? body.nodes : [],
        edges: Array.isArray(body.edges) ? body.edges : [],
      };
    },
  });

  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(apiUrl('/graph'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to add entity');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-graph'] });
      setNewLabel('');
      setNewContent('');
      setIsAdding(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(apiUrl(`/graph/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete entity');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-graph'] });
    }
  });

  const nodes = (graph?.nodes ?? []).filter((n: any) => activeCategory === 'ALL' || n.type === activeCategory);
  const edges = graph?.edges ?? [];

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
          <p className="text-slate-400">
            AI-extracted entities and relationships. Add manual entries or manage existing knowledge.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all active:scale-95 shadow-lg shadow-purple-600/20"
          >
              <Plus size={18} />
              Add Knowledge
          </button>
          <button 
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-xl text-slate-300 transition-all active:scale-95"
          >
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-4 border-b border-white/5">
          {[
              { id: 'ALL', label: 'All Knowledge', icon: LayoutGrid, color: 'text-slate-400' },
              { id: 'BRANCH', label: 'Branches', icon: MapPin, color: 'text-rose-400' },
              { id: 'MODEL', label: 'Ather Models', icon: Bike, color: 'text-purple-400' },
              { id: 'TECH', label: 'Technology', icon: Cpu, color: 'text-cyan-400' },
              { id: 'POLICY', label: 'Warranty/Policy', icon: ShieldCheck, color: 'text-emerald-400' },
          ].map((cat) => (
              <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${
                      activeCategory === cat.id 
                      ? 'bg-purple-600/20 border-purple-500/50 text-white shadow-lg shadow-purple-600/10' 
                      : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
              >
                  <cat.icon size={16} className={activeCategory === cat.id ? 'text-purple-400' : cat.color} />
                  <span className="text-sm font-medium">{cat.label}</span>
              </button>
          ))}
      </div>

      {isAdding && (
        <div className="p-6 bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 rounded-3xl animate-in zoom-in-95 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase font-bold tracking-wider ml-1">Entity Name / Title</label>
              <input 
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Ather 450X Price"
                className="w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-white outline-none focus:border-purple-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase font-bold tracking-wider ml-1">Knowledge Content</label>
              <textarea 
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Details about this entity..."
                className="w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-white outline-none focus:border-purple-500/50 transition-all h-14"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button 
              disabled={!newLabel || !newContent || addMutation.isPending}
              onClick={() => addMutation.mutate({ label: newLabel, content: newContent })}
              className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20"
            >
              {addMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
              Save to Graph
            </button>
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">Could not load the knowledge graph</p>
          <p className="mt-1 text-amber-100/90">{error instanceof Error ? error.message : String(error)}</p>
        </div>
      )}

      <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nodes.length > 0 ? (
                    nodes.map((node: any) => (
                        <EntityCard key={node.id} node={node} isMobile={isMobile} onDelete={() => deleteMutation.mutate(node.id)} isDeleting={deleteMutation.isPending} />
                    ))
                ) : (
                    <div className="col-span-full p-20 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl text-center">
                        <Database className="mx-auto text-slate-700 mb-4" size={64} />
                        <p className="text-slate-400 text-xl font-medium">No knowledge entities found</p>
                        <p className="text-slate-600 text-sm mt-2">Start adding knowledge above or via the Telegram bot</p>
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-6">
            <div className="p-8 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-3xl h-[600px] shadow-2xl relative overflow-hidden flex flex-col">
                <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                    <GitBranch size={20} className="text-purple-400" />
                    Relationship Map
                </h3>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {edges.length > 0 ? (
                        edges.map((edge: any) => (
                            <div key={edge.id} className="p-4 bg-slate-800/30 rounded-2xl border border-white/5 flex items-center justify-between group transition-all hover:bg-slate-800/50">
                                <span className="text-xs font-mono text-purple-400 font-bold">{edge.sourceNodeId.slice(0, 15)}</span>
                                <div className="flex-1 px-4 flex flex-col items-center">
                                    <div className="h-px w-full bg-slate-700 relative">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-slate-900 text-[9px] text-slate-500 uppercase tracking-widest font-bold whitespace-nowrap">
                                            {edge.relation}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-cyan-400 font-bold">{edge.targetNodeId.slice(0, 15)}</span>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-slate-500">
                             <GitBranch size={48} className="mb-4" />
                             <p>Waiting for relations...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function EntityCard({ node, isMobile, onDelete, isDeleting }: any) {
    return (
        <ParticleCard 
            className="p-6 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-3xl group transition-all hover:bg-slate-900/60 relative"
            glowColor={PURPLE_GLOW}
            disableAnimations={isMobile}
            enableTilt={!isMobile}
            clickEffect={true}
        >
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(134,0,255,0.8)]" />
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{node.type}</span>
                    </div>
                    <h4 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors tracking-tight uppercase">
                        {node.label}
                    </h4>
                </div>
                <div className="flex gap-1">
                    <button className="p-2 text-slate-600 hover:text-white transition-colors">
                        <Search size={18} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        disabled={isDeleting}
                        className="p-2 text-slate-600 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                {node.metadata?.content ? (
                    <p className="text-xs text-slate-400 leading-relaxed italic line-clamp-3">
                        "{node.metadata.content}"
                    </p>
                ) : null}
                <div className="space-y-1">
                    {node.metadata && Object.entries(node.metadata).filter(([k]) => k !== 'content').map(([key, val]: any) => (
                        <div key={key} className="flex justify-between text-[10px]">
                            <span className="text-slate-600 capitalize font-bold">{key}</span>
                            <span className="text-slate-400 font-mono truncate max-w-[120px]">{typeof val === 'string' ? val : JSON.stringify(val)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </ParticleCard>
    );
}
