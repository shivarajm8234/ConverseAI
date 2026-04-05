import { useQuery } from '@tanstack/react-query'
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  UserPlus,
  Mail,
  Phone,
  Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiUrl } from '@/lib/api'

export function CRM() {
  const { data: customers } = useQuery({
    queryKey: ['crm-customers'],
    queryFn: async () => {
      try {
        const res = await fetch(apiUrl('/crm'))
        if (!res.ok) throw new Error('Network error')
        const data = await res.json()
        return data || []
      } catch (e) {
        console.error('Failed to fetch CRM data:', e)
        return []
      }
    }
  })

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Customer CRM</h1>
          <p className="text-slate-400">Manage your leads and customer profiles in one central place.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all active:scale-95 shadow-lg shadow-purple-600/20">
          <UserPlus size={18} /> Add Customer
        </button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96 group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by name, email or phone..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
             <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors border border-white/5">
               <Filter size={16} /> Filters
             </button>
             <div className="text-xs text-slate-500 ml-2 font-medium">
               Found: <span className="text-white">{customers?.length || 0}</span> customers
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-800">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Latest AI Summary</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {customers && customers.length > 0 ? (
                customers.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-purple-400 font-bold border border-white/5">
                          {customer.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{customer.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 font-medium">Added on {customer.createdAt || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <Mail size={12} className="text-slate-500" /> {customer.email || 'No email'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <Phone size={12} className="text-slate-500" /> {customer.phone || 'No phone'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.requirements ? (
                        <p className="text-xs text-slate-400 line-clamp-2 max-w-[200px]" title={customer.requirements}>
                          {customer.requirements}
                        </p>
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">No AI summary yet</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold border",
                        customer.status === 'Hot' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                        customer.status === 'WARM' || customer.status === 'Warm' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                        "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
                      )}>
                        {customer.status || 'NEW'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-500 hover:text-white transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-50">
                       <Tag size={48} className="text-slate-600 mb-2" />
                       <div className="space-y-1">
                         <p className="text-lg font-semibold text-slate-400">No customers found</p>
                         <p className="text-sm text-slate-600">Start by importing your data or adding your first lead manually.</p>
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
