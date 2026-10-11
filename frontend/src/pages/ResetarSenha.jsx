import { useEffect, useMemo, useState } from 'react';
import { AuthLayout, MensagemErro } from '../components/AuthLayout';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { authService } from '../services/auth';
import { ChecklistSenha, REGRAS_SENHA } from './Cadastro';

/**
 * O token chega no FRAGMENTO da URL (#token=...): nunca é enviado ao servidor
 * em logs de acesso nem vaza no Referer. Lemos e LIMPAMOS a URL em seguida.
 */
function lerTokenDoFragmento() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get('token');
}

export default function ResetarSenha() {
  const [token] = useState(lerTokenDoFragmento);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [concluido, setConcluido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const forte = useMemo(() => REGRAS_SENHA.every((r) => r.teste(senha)), [senha]);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await authService.resetarSenha({ token, novaSenha: senha });
      setConcluido(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout titulo="Link inválido" subtitulo="Este link de redefinição está incompleto ou já foi usado.">
        <Button para="/esqueci-senha" className="w-full">
          Pedir um novo link
        </Button>
      </AuthLayout>
    );
  }

  if (concluido) {
    return (
      <AuthLayout titulo="Senha redefinida! 🎉" subtitulo="Por segurança, encerramos suas sessões em outros dispositivos.">
        <Button para="/login" className="w-full">
          Entrar com a nova senha
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Criar nova senha">
      <form onSubmit={enviar} className="space-y-5">
        <div>
          <Input rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          <ChecklistSenha senha={senha} />
        </div>
        <Input
          rotulo="Confirme a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          erro={confirmacao && confirmacao !== senha ? 'As senhas não conferem' : ''}
          required
        />
        <MensagemErro>{erro}</MensagemErro>
        <Button type="submit" tamanho="lg" className="w-full" carregando={enviando} disabled={!forte || senha !== confirmacao}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
}
