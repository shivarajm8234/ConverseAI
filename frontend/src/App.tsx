import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Overview } from './pages/Overview'
import { CRM } from './pages/CRM'
import { Calls } from './pages/Calls'
import { Slots } from './pages/Slots'
import { Automation } from './pages/Automation'
import { Knowledge } from './pages/Knowledge'
import { Agent } from './pages/Agent'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/slots" element={<Slots />} />
            <Route path="/automation" element={<Automation />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/agent" element={<Agent />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
