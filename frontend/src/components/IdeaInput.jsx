import { useId, useMemo, useState } from 'react';
import { Button } from './Button';
import { detectarInteresses } from '../utils/palavrasChave';
import { useDebounce } from '../hooks/useDebounce';

const MAXIMO = 1000;
const EXEMPLOS = [
  'Quero renda passiva com dividendos e pouco risco',
  'Tenho interesse em tecnologia e inteligência artificial nos EUA',
  'Preciso de uma reserva de emergência segura com liquidez',
];

/** Campo de texto livre da tela "Ideia", com prévia dos interesses detectados. */
export function IdeaInput({ onEnviar, enviando }) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const textoDebounced = useDebounce(texto, 250);
  const interesses = useMemo(() => detectarInteresses(textoDebounced), [textoDebounced]);
  const valido = texto.trim().length >= 3;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido && !enviando) onEnviar(texto.trim());
      }}
      className="space-y-4"
    >
      <label htmlFor={id} className="rotulo text-base">
        Conte com suas palavras o que você busca
      </label>
      <textarea
        id={id}
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, MAXIMO))}
        rows={5}
        maxLength={MAXIMO}
        placeholder="Ex.: quero investir em empresas sustentáveis, pensando no longo prazo..."
        className="campo resize-none text-lg leading-relaxed"
        aria-describedby={`${id}-contador`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {interesses.map((i) => (
            <span key={i} className="rounded-full bg-roxo-100 px-3 py-1 text-sm font-medium text-roxo-800 dark:bg-roxo-500/20 dark:text-roxo-200">
              {i}
            </span>
          ))}
        </div>
        <span id={`${id}-contador`} className="text-sm texto-suave tabular-nums">
          {texto.length}/{MAXIMO}
        </span>
      </div>

      {texto.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXEMPLOS.map((ex) => (
            <button key={ex} type="button" onClick={() => setTexto(ex)} className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm texto-suave hover:border-roxo-300 hover:text-roxo-700 dark:border-white/10">
              {ex}
            </button>
          ))}
        </div>
      )}

      <Button type="submit" tamanho="lg" disabled={!valido} carregando={enviando} className="w-full sm:w-auto">
        Enviar
      </Button>
    </form>
  );
}
