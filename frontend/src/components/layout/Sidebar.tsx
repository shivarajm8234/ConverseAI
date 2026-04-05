import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Phone, 
  Calendar, 
  Sparkles,
  ChevronLeft, 
  ChevronRight,
  Mic2,
  Network
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/' },
  { icon: Users, label: 'CRM Details', path: '/crm' },
  { icon: Phone, label: 'Call History', path: '/calls' },
  { icon: Calendar, label: 'Filled Slots', path: '/slots' },
  { icon: Sparkles, label: 'Automation center', path: '/automation' },
  { icon: Network, label: 'Knowledge Graph', path: '/knowledge' },
]

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside 
      className={cn(
        "flex flex-col bg-slate-950 border-r border-slate-800 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(134,0,255,0.4)]">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">ConverseAI</span>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(134,0,255,0.4)]">
            <Mic2 className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all group",
              isActive 
                ? "bg-purple-600/10 text-purple-400" 
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5",
              isCollapsed && "mx-auto"
            )} />
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
            {!isCollapsed && (
               <div className="ml-auto w-1 h-1 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white transition-colors"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </aside>
  )
}
