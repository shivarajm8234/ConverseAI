import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Car, 
  Clock, 
  User, 
  CheckCircle2, 
  Search,
  Monitor
} from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { format, isSameDay, parseISO } from 'date-fns'

// Import react-day-picker styles (Basic styles for starting point)
import 'react-day-picker/dist/style.css'
import { apiUrl } from '@/lib/api'

export function Slots() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  
  const { data: slots } = useQuery({
    queryKey: ['filled-slots'],
    queryFn: async () => {
      try {
        const res = await fetch(apiUrl('/slots'))
        if (!res.ok) throw new Error('Network error')
        const data = await res.json()
        return data || []
      } catch (e) {
        console.error('Failed to fetch slots data:', e)
        return []
      }
    }
  })

  // Filter slots based on selected date
  const filteredSlots = slots?.filter((slot: any) => {
    if (!selectedDate) return true 
    try {
      const slotDate = parseISO(slot.date)
      return isSameDay(slotDate, selectedDate)
    } catch {
      return false
    }
  }) || []

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-white">Filled Slots</h1>
        <p className="text-slate-400">View and manage scheduled office visits and test drives booked by the voice agent.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Calendar Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl shadow-xl backdrop-blur-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CalendarIcon size={16} className="text-purple-500" /> Select Date
            </h3>
            
            <div className="calendar-container overflow-hidden">
              <style>{`
                .rdp {
                  --rdp-cell-size: 40px;
                  --rdp-accent-color: #8600ff;
                  --rdp-background-color: #1e293b;
                  margin: 0;
                }
                .rdp-day_selected {
                  background-color: var(--rdp-accent-color) !important;
                  color: white !important;
                  border-radius: 12px;
                }
                .rdp-day:hover:not(.rdp-day_selected) {
                  background-color: #1e293b;
                  border-radius: 12px;
                }
                .rdp-head_cell {
                  color: #475569;
                  font-weight: 700;
                  font-size: 0.75rem;
                }
                .rdp-nav_button {
                  color: #94a3b8;
                }
                .rdp-nav_button:hover {
                  background-color: #1e293b;
                }
                .rdp-caption_label {
                  color: #f8fafc;
                  font-weight: 700;
                }
              `}</style>
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                showOutsideDays
                className="mx-auto"
              />
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800">
               <button 
                onClick={() => setSelectedDate(undefined)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors font-medium border border-white/5"
               >
                 Show All Bookings
               </button>
            </div>
          </div>
        </div>

        {/* Slots Table Content */}
        <div className="lg:col-span-3 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-purple-600/10 rounded-2xl border border-purple-600/20">
                   <MapPin className="text-purple-500" size={24} />
                 </div>
                 <div>
                   <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Office Visits</p>
                   <p className="text-3xl font-mono font-bold text-white uppercase">{filteredSlots.filter((s:any) => s.type === 'Office Visit').length}</p>
                 </div>
              </div>
              <div className="text-xs text-purple-400 font-medium bg-purple-400/10 px-2 py-1 rounded shadow-[0_0_5px_rgba(134,0,255,0.3)]">On {selectedDate ? format(selectedDate, 'MMM d') : 'All Time'}</div>
            </div>
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-purple-600/10 rounded-2xl border border-purple-600/20">
                   <Car className="text-purple-500" size={24} />
                 </div>
                 <div>
                   <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Test Drives</p>
                   <p className="text-3xl font-mono font-bold text-white uppercase">{filteredSlots.filter((s:any) => s.type === 'Test Drive').length}</p>
                 </div>
              </div>
              <div className="text-xs text-purple-400 font-medium bg-purple-400/10 px-2 py-1 rounded">On {selectedDate ? format(selectedDate, 'MMM d') : 'All Time'}</div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96 group">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search bookings for this date..." 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="text-white">{filteredSlots.length}</span> bookings for <span className="text-purple-400">{selectedDate ? format(selectedDate, 'PPP') : 'All Time'}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-800">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Booking Type</th>
                    <th className="px-6 py-4">When</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredSlots.length > 0 ? (
                    filteredSlots.map((slot: any) => (
                      <tr key={slot.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4 font-semibold text-white">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-slate-800 rounded">
                               <User size={16} className="text-slate-500" />
                             </div>
                             <p className="text-sm">{slot.customerName || 'Anonymous'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm">
                             {slot.type === 'Test Drive' ? (
                               <Car size={16} className="text-purple-500" />
                             ) : (
                               <MapPin size={16} className="text-purple-500" />
                             )}
                             <span className="font-semibold text-slate-200">{slot.type || 'Undefined'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-slate-300">
                              <CalendarIcon size={14} className="text-slate-500" /> {slot.date}
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Clock size={14} className="text-slate-500" /> {slot.time || 'N/A'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-600/10 text-purple-500 border border-purple-500/10 flex items-center gap-1 w-fit shadow-[0_0_5px_rgba(134,0,255,0.2)]">
                            <CheckCircle2 size={12} /> {slot.status || 'Confirmed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-bold uppercase tracking-widest text-slate-600 group-hover:text-purple-500 transition-colors">
                           Details
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-40 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30 group">
                           <div className="p-6 bg-slate-900 border-2 border-dashed border-slate-800 rounded-full group-hover:border-blue-500/50 group-hover:bg-blue-500/5 transition-all">
                             <Monitor size={64} className="text-slate-700" />
                           </div>
                           <div className="space-y-1">
                             <p className="text-xl font-bold text-slate-400">No bookings for this date</p>
                             <p className="text-sm text-slate-600 max-w-xs mx-auto">Try selecting a different date on the calendar or click "Show All Bookings".</p>
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
      </div>
    </div>
  )
}
