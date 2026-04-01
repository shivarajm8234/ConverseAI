import { Search } from 'lucide-react'

export function TopBar() {
  return (
    <header className="h-16 bg-slate-950/50 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-10 w-full">
      <div className="flex-1 max-w-md">
        <div className="relative group">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
          <input
            type="text"
            placeholder="Search details, calls, or leads..."
            className="w-full h-10 bg-slate-900/50 border border-slate-800 rounded-full pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Profile and Notifications removed */}
      </div>
    </header>
  )
}
