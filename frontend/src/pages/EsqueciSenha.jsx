import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout, MensagemErro } from '../components/AuthLayout';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { authService } from '../services/auth';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const r = await authService.esqueciSenha(email);
      setMensagem(r.mensagem);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo="Esqueceu a senha?" subtitulo="Digite seu e-mail e enviaremos um link para criar uma nova senha.">
      {mensagem ? (
        <div className="space-y-6">
          <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            {mensagem}
          </p>
          <p className="text-sm texto-suave">O link expira em 15 minutos. Confira também a caixa de spam.</p>
          <Button para="/login" variante="secundario" className="w-full">
            Voltar para o login
          </Button>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-5">
          <Input rotulo="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <MensagemErro>{erro}</MensagemErro>
          <Button type="submit" tamanho="lg" className="w-full" carregando={enviando} disabled={!email}>
            Enviar link
          </Button>
          <Link to="/login" className="block text-center text-sm font-semibold text-roxo-700 dark:text-roxo-300">
            Voltar para o login
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
