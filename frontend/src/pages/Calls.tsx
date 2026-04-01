import { useQuery } from '@tanstack/react-query'
import { 
  PhoneCall, 
  Mic, 
  Clock, 
  Globe, 
  MessageSquare,
  Play,
  Download,
  Search,
  Filter
} from 'lucide-react'
import axios from 'axios'
import { cn } from '@/lib/utils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export function Calls() {
  const { data: calls } = useQuery({
    queryKey: ['call-logs'],
    queryFn: async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/calls`)
        return res.data || []
      } catch (e) {
        console.error('Failed to fetch call logs:', e)
        return []
      }
    }
  })

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-white">Call History</h1>
        <p className="text-slate-400">Review recordings, transcripts, and performance insights from every automated call.</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96 group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by customer name or phone..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
             <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors border border-white/5">
               <Filter size={16} /> Filters
             </button>
             <button className="flex items-center gap-2 px-3 py-2 bg-purple-600/10 text-purple-400 rounded-xl text-sm font-semibold transition-colors border border-purple-500/20">
               <Download size={16} /> Export CSV
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-800">
                <th className="px-6 py-4">Call Details</th>
                <th className="px-6 py-4">Language</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Outcome</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {calls && calls.length > 0 ? (
                calls.map((call: any) => (
                  <tr key={call.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold border border-purple-500/10 shadow-[0_0_10px_rgba(134,0,255,0.2)]">
                          <PhoneCall size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{call.customerName || 'Customer Interaction'}</p>
                          <p className="text-xs text-slate-500 font-medium">{call.timestamp || 'Just now'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-slate-500" /> {call.language || 'English'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-500" /> {call.duration || '0:00'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit",
                        call.outcome === 'Success' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        "bg-red-500/10 text-red-500 border-red-500/20"
                      )}>
                        <div className={cn("w-1 h-1 rounded-full", call.outcome === 'Success' ? "bg-emerald-500" : "bg-red-500")} />
                        {call.outcome || 'No Outcome'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 transition-colors text-slate-500 hover:text-purple-500 hover:bg-purple-500/10 rounded-lg">
                          <Play size={18} />
                        </button>
                        <button className="p-2 transition-colors text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg">
                          <MessageSquare size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-50">
                       <Mic size={48} className="text-slate-600 mb-2" />
                       <div className="space-y-1">
                         <p className="text-lg font-semibold text-slate-400">No calls recorded yet</p>
                         <p className="text-sm text-slate-600">The historical data will appear here once the agent starts receiving calls.</p>
                       </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
