import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout, MensagemErro } from '../components/AuthLayout';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';

/** Login em duas etapas quando o usuário tem 2FA: senha → código do e-mail. */
export default function Login() {
  const { entrar, entrarComoVisitante, validar2FA } = useAuth();
  const navegar = useNavigate();
  const destino = useLocation().state?.de ?? '/';
  const [form, setForm] = useState({ email: '', senha: '' });
  const [desafio, setDesafio] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [entrandoVisitante, setEntrandoVisitante] = useState(false);

  async function entrarVisitante() {
    setErro('');
    setEntrandoVisitante(true);
    try {
      await entrarComoVisitante();
      navegar(destino, { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEntrandoVisitante(false);
    }
  }

  async function enviarCredenciais(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const r = await entrar(form);
      if (r.requer2FA) setDesafio(r.desafioToken);
      else navegar(destino, { replace: true });
    } catch (err) {
      setErro(err.code === 'CONTA_BLOQUEADA' ? `${err.message} Tente novamente em ${Math.ceil((err.retryAfter ?? 900) / 60)} min.` : err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await validar2FA({ desafioToken: desafio, codigo });
      navegar(destino, { replace: true });
    } catch (err) {
      if (err.code === 'DESAFIO_INVALIDO') setDesafio(null);
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (desafio) {
    return (
      <AuthLayout titulo="Verificação em duas etapas" subtitulo="Enviamos um código de 6 dígitos para o seu e-mail.">
        <form onSubmit={enviarCodigo} className="space-y-5">
          <Input
            rotulo="Código de verificação"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]"
            autoFocus
            required
          />
          <MensagemErro>{erro}</MensagemErro>
          <Button type="submit" tamanho="lg" className="w-full" carregando={enviando} disabled={codigo.length !== 6}>
            Verificar
          </Button>
          <button type="button" onClick={() => setDesafio(null)} className="w-full text-sm font-semibold text-roxo-700 dark:text-roxo-300">
            Voltar
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Entrar" subtitulo="Que bom te ver de novo!">
      <form onSubmit={enviarCredenciais} className="space-y-5" noValidate>
        <Input rotulo="E-mail" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <div>
          <Input rotulo="Senha" type="password" autoComplete="current-password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required />
          <Link to="/esqueci-senha" className="mt-2 inline-block text-sm font-semibold text-roxo-700 hover:underline dark:text-roxo-300">
            Esqueceu a senha?
          </Link>
        </div>
        <MensagemErro>{erro}</MensagemErro>
        <Button type="submit" tamanho="lg" className="w-full" carregando={enviando} disabled={!form.email || !form.senha || entrandoVisitante}>
          Entrar
        </Button>
        <div className="flex items-center gap-3 text-sm texto-suave" aria-hidden="true">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
          ou
          <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
        </div>
        <div>
          <Button variante="secundario" tamanho="lg" className="w-full" onClick={entrarVisitante} carregando={entrandoVisitante} disabled={enviando}>
            Entrar como visitante
          </Button>
          <p className="mt-2 text-center text-xs texto-suave">Conheça o app numa conta de demonstração, sem cadastro.</p>
        </div>
        <p className="text-center text-sm texto-suave">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-roxo-700 hover:underline dark:text-roxo-300">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
