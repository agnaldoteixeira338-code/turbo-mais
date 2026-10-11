import { Link } from 'react-router-dom';
import { Icone } from './Icone';

/** Card do painel inicial com título, link "ver tudo" e conteúdo. */
export function DashboardCard({ titulo, icone, linkPara, linkTexto = 'Ver tudo', children }) {
  return (
    <section className="card flex flex-col animate-entrar">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          {icone && <Icone nome={icone} className="h-5 w-5 text-roxo-600 dark:text-roxo-300" />}
          {titulo}
        </h2>
        {linkPara && (
          <Link to={linkPara} className="inline-flex items-center gap-1 text-sm font-semibold text-roxo-700 hover:underline dark:text-roxo-300">
            {linkTexto} <Icone nome="seta" className="h-4 w-4" />
          </Link>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}
