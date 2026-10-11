import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Variacao } from '../components/Indicadores';
import { Button } from '../components/Button';
import { useNotificacoes } from '../hooks/useNotificacoes';
import { dataHora, moeda } from '../utils/formatar';

export default function Notificacoes() {
  const { notificacoes, naoLidas, marcarComoLida, permissao, pedirPermissao } = useNotificacoes();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">🔔 Notificações</h1>
          <p className="mt-1 texto-suave">{naoLidas ? `${naoLidas} não lida(s)` : 'Tudo em dia'}</p>
        </div>
        {permissao === 'default' && (
          <Button variante="secundario" tamanho="sm" onClick={pedirPermissao}>
            Ativar no navegador
          </Button>
        )}
      </header>

      <Card>
        {notificacoes.length === 0 ? (
          <EmptyState icone="sino" titulo="Nenhuma notificação ainda" descricao="Crie um alerta na página de um ativo e avisaremos quando ele se mexer." acao={<Button para="/buscar">Buscar ativos</Button>} />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-white/5">
            {notificacoes.map((n) => (
              <li key={n.id} className={`flex flex-wrap items-center gap-3 py-4 ${n.lida ? 'opacity-70' : ''}`}>
                <span className="text-2xl" aria-hidden="true">
                  {n.direcao === 'alta' ? '📈' : '📉'}
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/ativos/${encodeURIComponent(n.ticker)}`} className="font-bold hover:underline">
                    {n.ticker}
                  </Link>{' '}
                  <span className="texto-suave">{n.direcao === 'alta' ? 'subiu' : 'caiu'}</span> <Variacao valor={n.variacao} />
                  <p className="text-xs texto-suave">
                    {dataHora(n.criadoEm)}
                    {n.preco != null && ` · ${moeda(n.preco)}`}
                  </p>
                </div>
                {n.lida ? (
                  <span className="text-xs texto-suave">Lida</span>
                ) : (
                  <Button variante="fantasma" tamanho="sm" onClick={() => marcarComoLida(n.id)}>
                    Marcar como lida
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
