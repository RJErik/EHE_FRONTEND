import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './feature/Theme-provider.jsx'
import AuthCheck from './feature/AuthCheck.jsx'

createRoot(document.getElementById('root')).render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthCheck>
            <App />
        </AuthCheck>
    </ThemeProvider>
)
