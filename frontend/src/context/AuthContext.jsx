import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth';
import { registrarAoExpirarSessao } from '../services/api';

export const AuthContext = createContext(null);

/**
 * Estado de autenticação. Ao abrir o app, tenta restaurar a sessão pelo
 * cookie httpOnly de refresh — o usuário não precisa logar a cada F5, e o
 * access token continua só em memória.
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    registrarAoExpirarSessao(() => setUsuario(null));
    let ativo = true;
    authService.restaurarSessao().then((u) => {
      if (!ativo) return;
      setUsuario(u);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const entrar = useCallback(async (credenciais) => {
    const resultado = await authService.login(credenciais);
    if (!resultado.requer2FA) setUsuario(resultado.usuario);
    return resultado;
  }, []);

  const validar2FA = useCallback(async (dados) => {
    const resultado = await authService.validar2FA(dados);
    setUsuario(resultado.usuario);
    return resultado;
  }, []);

  const sair = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUsuario(null);
    }
  }, []);

  const atualizarUsuario = useCallback(async () => setUsuario(await authService.me()), []);

  const valor = useMemo(
    () => ({ usuario, carregando, autenticado: Boolean(usuario), entrar, validar2FA, sair, atualizarUsuario }),
    [usuario, carregando, entrar, validar2FA, sair, atualizarUsuario],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
