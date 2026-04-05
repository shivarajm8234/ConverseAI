import { useState, useRef, useEffect } from 'react'
import { 
  Sparkles, 
  Bot, 
  User, 
  Zap, 
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  SendHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  text: string
  sender: 'admin' | 'ai'
  timestamp: Date
  status?: 'processing' | 'done'
}

const QUICK_COMMANDS = [
  "Send 10% discount to all Hot Leads",
  "Update motorcycle arrival status",
  "Broadcast test drive slots for Sunday",
  "Follow up with cold leads via Telegram"
]

export function Automation() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello Admin! I'm your Automation Assistant. Tell me what needs to be done via Telegram.",
      sender: 'ai',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (text: string) => {
    if (!text.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'admin',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
    setInput('')
    setIsProcessing(true)

    // Simulate AI behavior
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `Command received: "${text}". I have initiated the automation sequence via Telegram. Status: [SUCCESS]`,
        sender: 'ai',
        timestamp: new Date(),
        status: 'done'
      }
      setMessages(prev => [...prev, aiResponse])
      setIsProcessing(false)
    }, 1500)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Sparkles className="text-purple-500" /> Automation center
        </h1>
        <p className="text-slate-400">Command your Voice Agent and Telegram automation using natural language.</p>
      </div>

      <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-3xl shadow-2xl relative overflow-hidden group">
        {/* Glow Decoration */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] -z-10" />

        {/* Chat Area */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-slate-800"
        >
          {messages.map((msg) => (
            <div 
              key={msg.id}
              className={cn(
                "flex items-start gap-4 animate-in fade-in zoom-in-95 duration-300",
                msg.sender === 'admin' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg",
                msg.sender === 'admin' ? "bg-purple-600 text-white" : "bg-slate-800 text-purple-400"
              )}>
                {msg.sender === 'admin' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div className={cn(
                "max-w-[70%] p-4 rounded-2xl relative group/msg transition-all",
                msg.sender === 'admin' 
                  ? "bg-purple-600/20 border border-purple-500/30 text-white rounded-tr-none shadow-[0_0_20px_rgba(134,0,255,0.1)]" 
                  : "bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-tl-none shadow-xl"
              )}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
                {msg.status === 'done' && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                    <ShieldCheck size={12} /> Execution Complete
                  </div>
                )}
                <span className="text-[10px] text-slate-500 mt-2 block opacity-0 group-hover/msg:opacity-100 transition-opacity">
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
            </div>
          ))}
          {isProcessing && (
             <div className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center border border-white/10">
                   <Zap size={18} className="text-purple-400 animate-spin" />
                </div>
                <div className="bg-slate-800/30 border border-slate-700/30 p-4 rounded-2xl text-xs text-slate-500 font-bold tracking-widest uppercase italic">
                   Agent is processing automation command...
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Action Area */}
        <div className="p-6 bg-slate-950/50 border-t border-slate-800/50">
          {/* Quick Targets */}
          <div className="flex flex-wrap gap-2 mb-4">
             {QUICK_COMMANDS.map((cmd) => (
               <button
                 key={cmd}
                 onClick={() => handleSend(cmd)}
                 className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-400 hover:border-purple-500/50 hover:text-purple-400 hover:bg-purple-500/5 transition-all shadow-sm"
               >
                 {cmd}
               </button>
             ))}
          </div>

          <div className="relative group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder="e.g. Update bike status and notify hot leads via Telegram..." 
              className="w-full h-14 bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-16 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600/50 transition-all shadow-inner"
            />
            <MessageSquare size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
            <button 
               onClick={() => handleSend(input)}
               disabled={!input.trim() || isProcessing}
               className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:grayscale disabled:hover:bg-purple-600 shadow-lg shadow-purple-600/30"
            >
              <SendHorizontal size={20} />
            </button>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2">
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AI Model: GPT-Ops-Engine
             </div>
             <div className="flex items-center gap-2">
                <ArrowRight size={10} /> Telegram Automation Active
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTimestamp(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
