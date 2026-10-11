import { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Icone } from '../components/Icone';
import { MensagemErro } from '../components/AuthLayout';
import { authService } from '../services/auth';
import { useAuth } from '../hooks/useAuth';
import { useNotificacoes } from '../hooks/useNotificacoes';

/** Tela "Segurança": ativa a verificação em duas etapas e as notificações do navegador. */
export default function Configurar2FA() {
  const { usuario, atualizarUsuario } = useAuth();
  const { permissao, pedirPermissao } = useNotificacoes();
  const [etapa, setEtapa] = useState('inicio');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function executar(fn) {
    setErro('');
    setEnviando(true);
    try {
      await fn();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const enviarCodigo = () => executar(async () => {
    await authService.ativar2FA();
    setEtapa('codigo');
  });

  const confirmar = (e) => {
    e.preventDefault();
    executar(async () => {
      await authService.ativar2FA(codigo);
      await atualizarUsuario();
      setEtapa('ativado');
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="titulo-pagina">Segurança</h1>

      <Card titulo="Verificação em duas etapas">
        {usuario?.twoFactorAtivo || etapa === 'ativado' ? (
          <p className="flex items-center gap-2 text-alta">
            <Icone nome="check" /> Ativada. Pediremos um código enviado para {usuario?.email} a cada login.
          </p>
        ) : etapa === 'codigo' ? (
          <form onSubmit={confirmar} className="max-w-sm space-y-4">
            <p className="texto-suave">Enviamos um código para {usuario?.email}. Ele vale por 10 minutos.</p>
            <Input
              rotulo="Código de 6 dígitos"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
            <MensagemErro>{erro}</MensagemErro>
            <div className="flex gap-3">
              <Button type="submit" carregando={enviando} disabled={codigo.length !== 6}>
                Confirmar
              </Button>
              <Button variante="fantasma" onClick={enviarCodigo} disabled={enviando}>
                Reenviar código
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="texto-suave">
              Além da senha, pediremos um código enviado ao seu e-mail. Mesmo que alguém descubra sua senha, não conseguirá entrar.
            </p>
            <MensagemErro>{erro}</MensagemErro>
            <Button onClick={enviarCodigo} carregando={enviando}>
              Ativar verificação em duas etapas
            </Button>
          </div>
        )}
      </Card>

      <Card titulo="Notificações no navegador">
        {permissao === 'granted' ? (
          <p className="flex items-center gap-2 text-alta">
            <Icone nome="check" /> Ativadas. Você será avisado mesmo com o Turbo Mais em outra aba.
          </p>
        ) : permissao === 'denied' ? (
          <p className="texto-suave">Bloqueadas no navegador. Para ativar, libere as notificações nas configurações do site.</p>
        ) : (
          <div className="space-y-4">
            <p className="texto-suave">Receba um aviso quando um alerta de preço disparar, mesmo com o Turbo Mais em segundo plano.</p>
            <Button variante="secundario" onClick={pedirPermissao}>
              🔔 Permitir notificações
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
