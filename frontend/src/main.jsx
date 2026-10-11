import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import './styles/globals.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { FavoritosProvider } from './context/FavoritosContext';
import { NotificacoesProvider } from './context/NotificacoesContext';

// Ordem dos providers = ordem de dependência (Auth → Socket → Favoritos/Notificações)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <FavoritosProvider>
              <NotificacoesProvider>
                <App />
              </NotificacoesProvider>
            </FavoritosProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
