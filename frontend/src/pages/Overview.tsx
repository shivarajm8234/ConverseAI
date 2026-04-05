import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import {
  PhoneCall,
  Flame,
  Snowflake,
  TrendingUp,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ParticleCard, GlobalSpotlight, useMobileDetection } from '@/components/ui/MagicBento'
import { apiUrl } from '@/lib/api'

const PURPLE_GLOW = '132, 0, 255'

export function Overview() {
  const gridRef = useRef<HTMLDivElement>(null)
  const isMobile = useMobileDetection()

  // Fetch overview stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const res = await fetch(apiUrl('/stats'))
        if (!res.ok) throw new Error('Network error');
        return await res.json()
      } catch (e) {
        console.error('Failed to fetch stats:', e)
        return null
      }
    }
  })

  // Fallback to 0 if data is missing
  const totalCalls = stats?.totalCalls ?? 0
  const hotLeads = stats?.hotLeads ?? 0
  const warmLeads = stats?.warmLeads ?? 0
  const coldLeads = stats?.coldLeads ?? 0

  const chartData = stats?.history || [
    { name: 'Mon', value: 0 },
    { name: 'Tue', value: 0 },
    { name: 'Wed', value: 0 },
    { name: 'Thu', value: 0 },
    { name: 'Fri', value: 0 },
    { name: 'Sat', value: 0 },
    { name: 'Sun', value: 0 },
  ]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bento-section">
      <style>{`
        .bento-section {
          --glow-x: 50%;
          --glow-y: 50%;
          --glow-intensity: 0;
          --glow-radius: 400px;
          --glow-color: ${PURPLE_GLOW};
        }
        
        .card--border-glow::after {
          content: '';
          position: absolute;
          inset: 0;
          padding: 2px;
          background: radial-gradient(var(--glow-radius) circle at var(--glow-x) var(--glow-y),
              rgba(${PURPLE_GLOW}, calc(var(--glow-intensity) * 0.8)) 0%,
              rgba(${PURPLE_GLOW}, calc(var(--glow-intensity) * 0.4)) 30%,
              transparent 60%);
          border-radius: inherit;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 10;
        }
        
        .card:hover::after {
          opacity: 1;
        }

        .particle::before {
          content: '';
          position: absolute;
          top: -2px; left: -2px; right: -2px; bottom: -2px;
          background: rgba(${PURPLE_GLOW}, 0.2);
          border-radius: 50%;
          z-index: -1;
        }
      `}</style>

      <GlobalSpotlight
        gridRef={gridRef}
        spotlightRadius={400}
        glowColor={PURPLE_GLOW}
        disableAnimations={isMobile}
      />

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h1>
        <p className="text-slate-400">Tracking your voice agent performance and lead generation in real-time.</p>
      </div>

      {/* Stats Grid */}
      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        <StatCard
          icon={<PhoneCall size={20} className="text-purple-500" />}
          title="Total Calls"
          value={totalCalls}
          trend="+0%"
          isMobile={isMobile}
        />
        <StatCard
          icon={<Flame size={20} className="text-orange-500" />}
          title="Hot Leads"
          value={hotLeads}
          trend="+0%"
          isMobile={isMobile}
        />
        <StatCard
          icon={<Activity size={20} className="text-yellow-500" />}
          title="Warm Leads"
          value={warmLeads}
          trend="+0%"
          isMobile={isMobile}
        />
        <StatCard
          icon={<Snowflake size={20} className="text-cyan-500" />}
          title="Cold Leads"
          value={coldLeads}
          trend="0%"
          isMobile={isMobile}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-3xl h-[400px] flex flex-col gap-4 shadow-2xl relative overflow-hidden card">
          <div className="flex items-center justify-between relative z-10">
            <h3 className="text-lg font-semibold text-white">Call Volume Trends</h3>
            <div className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded border border-white/5">Last 7 Days</div>
          </div>
          <div className="flex-1 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8600ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8600ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#060010', borderColor: '#392e4e', color: '#f8fafc', borderRadius: '16px' }}
                  itemStyle={{ color: '#8600ff' }}
                />
                <Area type="monotone" dataKey="value" stroke="#8600ff" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-3xl flex flex-col gap-6 shadow-2xl relative overflow-hidden card">
          <h3 className="text-lg font-semibold text-white relative z-10">Lead Performance</h3>
          <div className="space-y-4 flex-1 relative z-10">
            <LeadMetric label="Contact success" value="0%" color="bg-purple-600 shadow-[0_0_10px_rgba(134,0,255,0.5)]" />
            <LeadMetric label="Meeting booked" value="0%" color="bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <LeadMetric label="Test drive" value="0%" color="bg-purple-600 shadow-[0_0_10px_rgba(134,0,255,0.5)]" />
            <LeadMetric label="Final close" value="0%" color="bg-orange-600 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
          </div>
          <div className="mt-auto p-4 bg-purple-600/10 rounded-2xl border border-purple-600/20 relative z-10">
            <p className="text-xs text-purple-400 font-medium mb-1 flex items-center gap-1">
              <TrendingUp size={14} /> Performance increase
            </p>
            <p className="text-sm text-slate-300">Start calling to see real growth insights.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value, trend, isMobile }: any) {
  return (
    <ParticleCard
      className="p-6 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-3xl group transition-all shadow-2xl card--border-glow"
      glowColor={PURPLE_GLOW}
      disableAnimations={isMobile}
      enableTilt={!isMobile}
      enableMagnetism={!isMobile}
      clickEffect={true}
    >
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="p-2 bg-slate-800/50 rounded-xl group-hover:bg-purple-600/20 transition-colors border border-white/5">
          {icon}
        </div>
        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{trend}</span>
      </div>
      <div className="relative z-10">
        <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-1 group-hover:text-slate-300 transition-colors">{title}</p>
        <p className="text-4xl font-mono font-bold text-white group-hover:text-purple-400 transition-all uppercase drop-shadow-[0_0_8px_rgba(134,0,255,0.3)]">
          {value}
        </p>
      </div>
    </ParticleCard>
  )
}

function LeadMetric({ label, value, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="text-white font-bold">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden border border-white/5 shadow-inner">
        <div className={cn("h-full rounded-full w-0 transition-all duration-1000", color)} />
      </div>
    </div>
  )
}
