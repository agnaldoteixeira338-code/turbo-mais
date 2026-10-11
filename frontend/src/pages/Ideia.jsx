import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { IdeaInput } from '../components/IdeaInput';
import { SuggestionCard } from '../components/SuggestionCard';
import { EmptyState } from '../components/EmptyState';
import { ideiaService } from '../services/ideia';
import { useFavoritos } from '../hooks/useFavoritos';
import { dataHora } from '../utils/formatar';

export default function Ideia() {
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const { ehFavorito, alternar } = useFavoritos();

  useEffect(() => {
    ideiaService
      .listar({ limit: 5 })
      .then(({ data }) => setHistorico(data))
      .catch(() => {});
  }, []);

  async function enviar(texto) {
    setErro('');
    setEnviando(true);
    try {
      const ideia = await ideiaService.enviar(texto);
      setResultado(ideia);
      setHistorico((h) => [ideia, ...h].slice(0, 5));
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">💡 Ideia</h1>
        <p className="mt-1 texto-suave">Descreva seus objetivos e mostramos ativos que combinam com você — e o porquê.</p>
      </header>

      <Card>
        <IdeaInput onEnviar={enviar} enviando={enviando} />
        {erro && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{erro}</p>}
      </Card>

      {resultado && (
        <section aria-labelledby="titulo-sugestoes" className="space-y-4">
          <h2 id="titulo-sugestoes" className="text-xl font-bold">
            {resultado.sugestoes.length ? `Top ${resultado.sugestoes.length} para você` : 'Hmm, não entendemos bem'}
          </h2>
          {resultado.sugestoes.length === 0 ? (
            <Card>
              <EmptyState icone="ideia" titulo="Nenhum interesse reconhecido" descricao="Tente mencionar temas como dividendos, tecnologia, segurança, cripto, exterior ou sustentabilidade." />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {resultado.sugestoes.map((s) => (
                <SuggestionCard key={s.ticker} sugestao={s} ehFavorito={ehFavorito(s.ticker)} onAlternarFavorito={(t) => alternar(t).catch(() => {})} />
              ))}
            </div>
          )}
          <p className="text-xs texto-suave">Sugestões educativas geradas por regras de compatibilidade. Não constituem recomendação de investimento.</p>
        </section>
      )}

      {historico.length > 0 && (
        <Card titulo="Suas ideias recentes">
          <ul className="divide-y divide-zinc-100 dark:divide-white/5">
            {historico.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setResultado(i)} className="w-full py-3 text-left hover:text-roxo-700 dark:hover:text-roxo-300">
                  <p className="line-clamp-1 font-medium">{i.texto}</p>
                  <p className="text-xs texto-suave">
                    {dataHora(i.criadoEm)} · {i.sugestoes.length} sugestões
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
