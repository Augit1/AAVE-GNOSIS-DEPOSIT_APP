import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Providers } from './providers'

function AppWithProviders() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );
  return (
    <Providers theme={theme}>
      <App theme={theme} setTheme={setTheme} />
    </Providers>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithProviders />
  </React.StrictMode>,
) 