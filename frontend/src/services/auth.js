import { api, definirAccessToken, possivelSessaoAtiva, renovarSessao } from './api';

function guardarSessao(dados) {
  if (dados?.accessToken) definirAccessToken(dados.accessToken);
  return dados;
}

export const authService = {
  cadastrar: ({ email, celular, senha }) => api('/auth/cadastro', { method: 'POST', body: { email, celular, senha } }).then((r) => r.data),

  /** @returns {Promise<{requer2FA: true, desafioToken: string} | {usuario: object, accessToken: string}>} */
  login: ({ email, senha }) => api('/auth/login', { method: 'POST', body: { email, senha } }).then((r) => guardarSessao(r.data)),

  /** Conta de demonstração, sem senha (botão "Entrar como visitante"). */
  entrarComoVisitante: () => api('/auth/visitante', { method: 'POST' }).then((r) => guardarSessao(r.data)),

  validar2FA: ({ desafioToken, codigo }) => api('/auth/2fa/validar', { method: 'POST', body: { desafioToken, codigo } }).then((r) => guardarSessao(r.data)),

  ativar2FA: (codigo) => api('/auth/2fa/ativar', { method: 'POST', body: codigo ? { codigo } : {} }).then((r) => r.data),

  esqueciSenha: (email) => api('/auth/esqueci-senha', { method: 'POST', body: { email } }).then((r) => r.data),

  resetarSenha: ({ token, novaSenha }) => api('/auth/resetar-senha', { method: 'POST', body: { token, novaSenha } }).then((r) => r.data),

  async logout() {
    try {
      await api('/auth/logout', { method: 'POST', csrf: true });
    } finally {
      definirAccessToken(null);
    }
  },

  /** Ao abrir o app: tenta recuperar a sessão a partir do cookie de refresh. */
  async restaurarSessao() {
    if (!possivelSessaoAtiva()) return null; // visitante novo: nada a renovar
    try {
      const dados = await renovarSessao();
      return dados.usuario;
    } catch {
      return null;
    }
  },

  me: () => api('/auth/me').then((r) => r.data.usuario),
};
