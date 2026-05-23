import AdminPage from './pages/AdminPage'
import DirectoryPage from './pages/DirectoryPage'

const normalizePathname = (pathname) => {
  if (!pathname || pathname === '/') {
    return '/'
  }

  return pathname.replace(/\/+$/, '')
}

function App() {
  const pathname =
    typeof window === 'undefined' ? '/' : normalizePathname(window.location.pathname)

  if (pathname === '/admin') {
    return <AdminPage />
  }

  return <DirectoryPage />
}

export default App
