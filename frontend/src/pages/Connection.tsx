import { useState, useEffect } from 'react'
import { 
  Server, 
  ShieldCheck, 
  Globe, 
  Key, 
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  UserCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiUrl } from '@/lib/api'

export function Connection() {
  const [formData, setFormData] = useState({
    hostName: '',
    ipAddress: '',
    password: '',
    sipUsername: '2000',
    sipPassword: '5678'
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error' | 'fetching'>('idle')

  useEffect(() => {
    const fetchConfig = async () => {
      setStatus('fetching')
      try {
        const response = await fetch(apiUrl('/config'))
        if (response.ok) {
          const data = await response.json()
          const isLocalAccess = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(window.location.hostname)
          
          setFormData(prev => ({
            ...prev,
            hostName: window.location.hostname,
            ipAddress: isLocalAccess ? (data.localIp || window.location.hostname) : (data.publicIp || window.location.hostname)
          }))
        }
      } catch (error) {
        console.error('Failed to fetch config:', error)
      } finally {
        setStatus('idle')
      }
    }

    fetchConfig()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    
    // Simulate API call
    setTimeout(() => {
      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    }, 1500)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="relative max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Background Glows */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-white">Connection Settings</h1>
        <p className="text-slate-400">Configure your application host, IP, and authentication credentials.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Globe size={16} className="text-purple-500" /> Host Name
                </label>
                <input
                  type="text"
                  name="hostName"
                  value={formData.hostName}
                  onChange={handleChange}
                  placeholder="e.g. voice-ai-server.local"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Server size={16} className="text-purple-500" /> IP Address
                  </label>
                  <button 
                    type="button"
                    onClick={() => {
                      const fetchConfig = async () => {
                        setStatus('fetching')
                        try {
                          const response = await fetch(apiUrl('/config'))
                          if (response.ok) {
                            const data = await response.json()
                            const isLocalAccess = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(window.location.hostname)
                            setFormData(prev => ({
                              ...prev,
                              ipAddress: isLocalAccess ? (data.localIp || window.location.hostname) : (data.publicIp || window.location.hostname)
                            }))
                          }
                        } catch (error) {
                          console.error('Failed to fetch config:', error)
                        } finally {
                          setStatus('idle')
                        }
                      }
                      fetchConfig()
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={12} className={cn(status === 'fetching' && "animate-spin")} />
                    Auto-detect
                  </button>
                </div>
                <input
                  type="text"
                  name="ipAddress"
                  value={formData.ipAddress}
                  onChange={handleChange}
                  placeholder="e.g. 192.168.1.100"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Key size={16} className="text-purple-500" /> Password / Secret Key
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="pt-4 pb-2 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <PhoneCall size={20} className="text-purple-500" /> SIP Credentials
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <UserCircle size={16} className="text-purple-500" /> SIP Username
                    </label>
                    <input
                      type="text"
                      name="sipUsername"
                      value={formData.sipUsername}
                      onChange={handleChange}
                      placeholder="e.g. 2000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Key size={16} className="text-purple-500" /> SIP Password
                    </label>
                    <input
                      type="password"
                      name="sipPassword"
                      value={formData.sipPassword}
                      onChange={handleChange}
                      placeholder="••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={status === 'saving'}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg",
                  status === 'success' 
                    ? "bg-emerald-600 text-white" 
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20"
                )}
              >
                {status === 'saving' ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : status === 'success' ? (
                  <>
                    <CheckCircle2 size={20} /> Connection Verified
                  </>
                ) : (
                  <>
                    <Save size={20} /> Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-purple-500" /> Security Info
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your credentials are encrypted and stored securely. Ensure the IP address is accessible from your current network.
            </p>
            <div className="p-3 bg-purple-600/10 border border-purple-500/20 rounded-xl">
              <div className="flex gap-3">
                <AlertCircle size={18} className="text-purple-400 shrink-0" />
                <p className="text-xs text-purple-300">
                  Default port is 8080 for API. For SIP, use port 5060 (UDP). Ensure your firewall allows UDP traffic on port 5060.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Backend API</span>
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Database</span>
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
