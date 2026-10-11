const fs = require('node:fs');
const path = require('node:path');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const { criarChamadaResiliente } = require('../resilience/circuitBreakers');
const { mascararEmail } = require('../../shared/utils');

const TEMPLATES = {
  'reset-senha': {
    arquivo: 'resetSenha.html',
    assunto: 'Turbo Mais — redefinição de senha',
    texto: (d) => `Para redefinir sua senha, acesse: ${d.link}\nO link expira em ${d.validadeMinutos} minutos. Se não foi você, ignore este e-mail.`,
  },
  '2fa': {
    arquivo: '2fa.html',
    assunto: 'Turbo Mais — seu código de verificação',
    texto: (d) => `Seu código de verificação é ${d.codigo}. Ele expira em ${d.validadeMinutos} minutos. Nunca compartilhe este código.`,
  },
};

// Carregados uma vez na inicialização (fail fast se o arquivo sumir)
const HTML = Object.fromEntries(
  Object.entries(TEMPLATES).map(([tipo, t]) => [tipo, fs.readFileSync(path.join(__dirname, 'templates', t.arquivo), 'utf8')]),
);

const escaparHtml = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function renderizar(tipo, dados) {
  const template = TEMPLATES[tipo];
  if (!template) throw new Error(`Template de e-mail desconhecido: ${tipo}`);
  const html = HTML[tipo].replace(/\{\{(\w+)\}\}/g, (_, chave) => escaparHtml(dados[chave] ?? ''));
  return { assunto: template.assunto, html, texto: template.texto(dados) };
}

/**
 * Envio com FALLBACK entre provedores: Resend (API HTTP) → Nodemailer (SMTP).
 * Cada provedor tem seu circuit breaker: se o Resend estiver fora, as próximas
 * chamadas vão direto para o SMTP sem pagar o timeout do Resend toda vez.
 * Se todos falharem, o erro sobe e o BullMQ faz retry/DLQ.
 */
class EmailService {
  constructor({ from, resendApiKey, smtp, logger, ambiente }) {
    this.from = from;
    this.logger = logger;
    this.provedores = [];

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const chamar = criarChamadaResiliente('email-resend', { logger, opcoesRetry: { retries: 1 } });
      this.provedores.push({
        nome: 'resend',
        enviar: (msg) =>
          chamar(async () => {
            const { error } = await resend.emails.send(msg);
            if (error) throw Object.assign(new Error(`resend: ${error.message}`), { retryable: true });
          }),
      });
    }

    if (smtp?.host) {
      const transporte = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
      });
      const chamar = criarChamadaResiliente('email-smtp', { logger, opcoesRetry: { retries: 1 } });
      this.provedores.push({
        nome: 'smtp',
        enviar: (msg) => chamar(() => transporte.sendMail({ ...msg, text: msg.text })),
      });
    }

    // Em desenvolvimento sem provedor configurado: escreve no log (com o link/código
    // visíveis só aqui, de propósito) para que o fluxo seja testável localmente.
    if (this.provedores.length === 0 && ambiente !== 'production') {
      this.provedores.push({
        nome: 'console',
        enviar: async (msg) => {
          // eslint-disable-next-line no-console
          console.log(`\n📧 [DEV] Para: ${msg.to}\nAssunto: ${msg.subject}\n${msg.text}\n`);
        },
      });
    }
  }

  async enviar({ tipo, para, dados }) {
    if (this.provedores.length === 0) throw new Error('Nenhum provedor de e-mail configurado');
    const { assunto, html, texto } = renderizar(tipo, dados);
    const mensagem = { from: this.from, to: para, subject: assunto, html, text: texto };

    let ultimoErro;
    for (const provedor of this.provedores) {
      try {
        await provedor.enviar(mensagem);
        this.logger?.info({ tipo, provedor: provedor.nome, destinatario: mascararEmail(para) }, 'e-mail entregue ao provedor');
        return { provedor: provedor.nome };
      } catch (err) {
        ultimoErro = err;
        this.logger?.warn({ tipo, provedor: provedor.nome, erro: err.message }, 'provedor de e-mail falhou; tentando o próximo');
      }
    }
    throw ultimoErro;
  }
}

module.exports = { EmailService, renderizar };
