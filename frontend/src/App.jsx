import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout, RotaProtegida, RotaPublica } from './components/Layout';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { AvisoServidorAcordando } from './components/AvisoServidorAcordando';
import Home from './pages/Home';
import Login from './pages/Login';

// Telas carregadas sob demanda: o bundle inicial fica pequeno (login + home)
const Cadastro = lazy(() => import('./pages/Cadastro'));
const EsqueciSenha = lazy(() => import('./pages/EsqueciSenha'));
const ResetarSenha = lazy(() => import('./pages/ResetarSenha'));
const BuscarInvestimento = lazy(() => import('./pages/BuscarInvestimento'));
const DetalhesAtivo = lazy(() => import('./pages/DetalhesAtivo'));
const Favoritos = lazy(() => import('./pages/Favoritos'));
const MinhaCarteira = lazy(() => import('./pages/MinhaCarteira'));
const Ideia = lazy(() => import('./pages/Ideia'));
const Simulador = lazy(() => import('./pages/Simulador'));
const Notificacoes = lazy(() => import('./pages/Notificacoes'));
const Configurar2FA = lazy(() => import('./pages/Configurar2FA'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <>
      <AvisoServidorAcordando />
      <Suspense fallback={<div className="mx-auto max-w-3xl p-8"><LoadingSkeleton variante="bloco" /></div>}>
        <Routes>
          <Route path="/login" element={<RotaPublica><Login /></RotaPublica>} />
          <Route path="/cadastro" element={<RotaPublica><Cadastro /></RotaPublica>} />
          <Route path="/esqueci-senha" element={<RotaPublica><EsqueciSenha /></RotaPublica>} />
          <Route path="/resetar-senha" element={<ResetarSenha />} />

          <Route element={<RotaProtegida><Layout /></RotaProtegida>}>
            <Route index element={<Home />} />
            <Route path="buscar" element={<BuscarInvestimento />} />
            <Route path="ativos/:ticker" element={<DetalhesAtivo />} />
            <Route path="favoritos" element={<Favoritos />} />
            <Route path="carteira" element={<MinhaCarteira />} />
            <Route path="ideia" element={<Ideia />} />
          <Route path="simulador" element={<Simulador />} />
            <Route path="notificacoes" element={<Notificacoes />} />
            <Route path="seguranca" element={<Configurar2FA />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
