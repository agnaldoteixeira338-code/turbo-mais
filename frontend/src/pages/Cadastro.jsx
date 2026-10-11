import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, MensagemErro } from '../components/AuthLayout';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { authService } from '../services/auth';
import { useAuth } from '../hooks/useAuth';

/** Mesma política do backend (Senha VO) — validar no front é UX, não segurança. */
export const REGRAS_SENHA = [
  { teste: (s) => s.length >= 8, texto: 'Mínimo de 8 caracteres' },
  { teste: (s) => /[a-z]/.test(s) && /[A-Z]/.test(s), texto: 'Letras maiúsculas e minúsculas' },
  { teste: (s) => /\d/.test(s), texto: 'Um número' },
  { teste: (s) => /[^A-Za-z0-9]/.test(s), texto: 'Um caractere especial' },
];

export function mascararCelular(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function ChecklistSenha({ senha }) {
  return (
    <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
      {REGRAS_SENHA.map((r) => {
        const ok = r.teste(senha);
        return (
          <li key={r.texto} className={ok ? 'text-alta' : 'texto-suave'}>
            {ok ? '✓' : '○'} {r.texto}
          </li>
        );
      })}
    </ul>
  );
}

export default function Cadastro() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [form, setForm] = useState({ email: '', celular: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const senhaForte = useMemo(() => REGRAS_SENHA.every((r) => r.teste(form.senha)), [form.senha]);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await authService.cadastrar(form);
      await entrar({ email: form.email, senha: form.senha });
      navegar('/', { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo="Criar conta" subtitulo="Só três dados. Sem nome, sem CPF — o Turbo Mais não movimenta dinheiro.">
      <form onSubmit={enviar} className="space-y-5" noValidate>
        <Input rotulo="E-mail" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <Input
          rotulo="Celular"
          type="tel"
          autoComplete="tel-national"
          placeholder="(11) 98765-4321"
          value={form.celular}
          onChange={(e) => setForm({ ...form, celular: mascararCelular(e.target.value) })}
          required
        />
        <div>
          <Input rotulo="Senha" type="password" autoComplete="new-password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required />
          <ChecklistSenha senha={form.senha} />
        </div>
        <MensagemErro>{erro}</MensagemErro>
        <Button type="submit" tamanho="lg" className="w-full" carregando={enviando} disabled={!form.email || form.celular.length < 14 || !senhaForte}>
          Criar conta
        </Button>
        <p className="text-center text-sm texto-suave">
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-roxo-700 hover:underline dark:text-roxo-300">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
