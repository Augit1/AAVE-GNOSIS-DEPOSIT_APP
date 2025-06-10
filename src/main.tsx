import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Providers } from './providers'
import './index.css'

function AppWithProviders() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  )

  React.useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <Providers theme={theme}>
      <App theme={theme} setTheme={setTheme} />
    </Providers>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithProviders />
  </React.StrictMode>,
) 