import { useId, useState } from 'react';
import { Icone } from './Icone';

/**
 * Tooltip educativo acessível: abre com hover, foco (teclado) ou toque,
 * fecha com Esc. O texto é ligado ao gatilho por aria-describedby.
 */
export function Tooltip({ termo, children }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className="ml-1 inline-flex rounded-full text-zinc-400 hover:text-roxo-600 dark:hover:text-roxo-300"
        aria-label={`O que é ${termo}?`}
        aria-describedby={aberto ? id : undefined}
        aria-expanded={aberto}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onClick={() => setAberto((v) => !v)}
        onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
      >
        <Icone nome="info" className="h-4 w-4" />
      </button>
      {aberto && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-3 text-left text-sm font-normal leading-relaxed text-white shadow-xl dark:bg-zinc-800"
        >
          <strong className="block text-roxo-200">{termo}</strong>
          {children}
        </span>
      )}
    </span>
  );
}

/** Glossário usado nos tooltips — linguagem simples, sem jargão. */
export const GLOSSARIO = {
  'P/L': 'Preço dividido pelo lucro por ação. Indica quantos anos de lucro "pagariam" a ação. Muito baixo ou muito alto merece investigação.',
  'Dividend Yield': 'Quanto a empresa pagou em dividendos no último ano, em % do preço da ação. É a "renda" que a ação gerou.',
  'Market Cap': 'Valor de mercado: preço da ação × quantidade de ações. Mostra o tamanho da empresa na bolsa.',
  Variação: 'Quanto o preço mudou hoje em relação ao fechamento anterior.',
  CDI: 'Taxa que os bancos usam para emprestar entre si, muito próxima da Selic. É a referência da renda fixa.',
  'Perfil de risco': 'Conservador = oscila pouco; moderado = oscila de forma moderada; arrojado = pode subir ou cair muito.',
};
