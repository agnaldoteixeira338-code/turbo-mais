const { Router } = require('express');
const dtos = require('../../../application/dtos');

/**
 * Rate limit por rota:
 *   cadastro, login, 2fa/validar  → auth (10 / 15 min / IP)
 *   esqueci-senha, resetar-senha  → sensivel (5 / h / IP)
 *   2fa/ativar, me                → usuario (120 / min / usuário)
 *   refresh, logout               → global + CSRF
 */
function authRoutes({ controller, mw }) {
  const r = Router();
  const v = mw.validateInput;

  r.post('/cadastro', mw.rl.auth, v({ body: dtos.auth.cadastro }), controller.cadastrar);
  r.post('/login', mw.rl.auth, v({ body: dtos.auth.login }), controller.login);
  r.post('/refresh', mw.csrf, controller.refresh);
  r.post('/logout', mw.csrf, controller.logout);
  r.post('/esqueci-senha', mw.rl.sensivel, v({ body: dtos.auth.esqueciSenha }), controller.esqueciSenha);
  r.post('/resetar-senha', mw.rl.sensivel, v({ body: dtos.auth.resetarSenha }), controller.resetarSenha);
  r.post('/2fa/ativar', mw.auth, mw.rl.usuario, v({ body: dtos.auth.ativar2FA }), controller.ativar2FA);
  r.post('/2fa/validar', mw.rl.auth, v({ body: dtos.auth.validar2FA }), controller.validar2FA);
  r.get('/me', mw.auth, mw.rl.usuario, controller.eu);

  return r;
}

module.exports = { authRoutes };
