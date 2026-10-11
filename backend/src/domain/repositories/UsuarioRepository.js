/* eslint-disable no-unused-vars */
const { naoImplementado } = require('./contrato');

/** @interface */
class UsuarioRepository {
  /** @param {{email:string, celular:string, senhaHash:string}} dados @returns {Promise<Usuario>} lança ConflictError se e-mail existir */
  async criar(dados) { naoImplementado('UsuarioRepository', 'criar'); }
  /** @returns {Promise<Usuario|null>} */
  async buscarPorEmail(email) { naoImplementado('UsuarioRepository', 'buscarPorEmail'); }
  /** @returns {Promise<Usuario|null>} */
  async buscarPorId(id) { naoImplementado('UsuarioRepository', 'buscarPorId'); }
  async atualizarSenha(id, senhaHash) { naoImplementado('UsuarioRepository', 'atualizarSenha'); }
  async atualizarDoisFatores(id, ativo) { naoImplementado('UsuarioRepository', 'atualizarDoisFatores'); }
}

module.exports = { UsuarioRepository };
