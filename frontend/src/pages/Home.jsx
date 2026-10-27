import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Icone } from '../components/Icone';
import { useAuth } from '../hooks/useAuth';
import Dashboard from './Dashboard';

const ATALHOS = [
  { para: '/buscar', emoji: '🔍', titulo: 'Buscar Investimento', descricao: 'Cripto, CDBs, bancos, ações BR e globais' },
  { para: '/ideia', emoji: '💡', titulo: 'Ideia', descricao: 'Conte o que busca e receba sugestões' },
  { para: '/simulador', emoji: '🧮', titulo: 'Simulador', descricao: 'Quanto seu dinheiro rende em cada aplicação' },
  { para: '/carteira', emoji: '💼', titulo: 'Minha Carteira', descricao: 'Seu painel de acompanhamento' },
];

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Home() {
  const { usuario } = useAuth();
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-4xl bg-roxo-600 p-6 text-white sm:p-8">
        <Logo tamanho="md" comSlogan className="[&_p]:text-roxo-100 [&_span]:text-white" />
        <p className="mt-6 text-lg">
          {saudacao()}, <strong className="break-all">{usuario?.email}</strong> 👋
        </p>
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-roxo-400/40 blur-3xl" aria-hidden="true" />
      </section>

      <nav aria-label="Atalhos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ATALHOS.map((a) => (
          <Link key={a.para} to={a.para} className="card group flex flex-col gap-3 transition hover:-translate-y-0.5 hover:ring-2 hover:ring-roxo-500/40">
            <span className="text-4xl" aria-hidden="true">
              {a.emoji}
            </span>
            <span className="text-lg font-bold">{a.titulo}</span>
            <span className="text-sm texto-suave">{a.descricao}</span>
            <Icone nome="seta" className="mt-auto h-5 w-5 text-roxo-600 transition group-hover:translate-x-1 dark:text-roxo-300" />
          </Link>
        ))}
      </nav>

      <Dashboard />
    </div>
  );
}
