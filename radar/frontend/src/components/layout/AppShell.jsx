import { useLocation } from 'react-router-dom'
import Topbar from './Topbar'

export default function AppShell({ children }) {
  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      <Topbar />
      <main className="flex-1 overflow-y-auto lg:overflow-hidden relative">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  )
}

function PageTransition({ children }) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-enter h-full overflow-y-auto lg:overflow-hidden">
      {children}
    </div>
  )
}
