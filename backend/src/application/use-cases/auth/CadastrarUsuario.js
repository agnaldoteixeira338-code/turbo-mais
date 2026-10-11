const { Email } = require('../../../domain/value-objects/Email');
const { Celular } = require('../../../domain/value-objects/Celular');
const { Senha } = require('../../../domain/value-objects/Senha');
const { ConflictError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

/**
 * Cadastro: e-mail, celular e senha — sem nome, sem CPF.
 *
 * Trade-off consciente: responder 409 "e-mail já cadastrado" permite
 * enumeração de contas. Mitigamos com rate limit agressivo na rota em vez de
 * sacrificar a UX (a alternativa — sempre "verifique seu e-mail" — exige fluxo
 * de confirmação por e-mail, previsto no roadmap). Ver THREAT-MODEL.md.
 */
class CadastrarUsuario {
  constructor({ usuarioRepository, passwordHasher, auditLog }) {
    this.usuarioRepository = usuarioRepository;
    this.passwordHasher = passwordHasher;
    this.auditLog = auditLog;
  }

  async execute({ email, celular, senha }, ctx = {}) {
    const emailVO = Email.criar(email);
    const celularVO = Celular.criar(celular);
    const senhaVO = Senha.criar(senha);

    const existente = await this.usuarioRepository.buscarPorEmail(emailVO.valor);
    if (existente) throw new ConflictError('E-mail já cadastrado', 'EMAIL_JA_CADASTRADO');

    const senhaHash = await this.passwordHasher.hash(senhaVO.valor);
    // O repositório também converte unique_violation em ConflictError,
    // cobrindo a corrida entre o SELECT acima e este INSERT.
    const usuario = await this.usuarioRepository.criar({
      email: emailVO.valor,
      celular: celularVO.valor,
      senhaHash,
    });

    await auditar(this.auditLog, ACOES_AUDITORIA.USUARIO_CADASTRADO, ctx, { usuarioId: usuario.id });
    return usuario;
  }
}

module.exports = { CadastrarUsuario };
