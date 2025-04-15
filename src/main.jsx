import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './components/Theme-provider.jsx'
import AuthCheck from './components/AuthCheck.jsx'

createRoot(document.getElementById('root')).render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthCheck>
            <App />
        </AuthCheck>
    </ThemeProvider>
)
