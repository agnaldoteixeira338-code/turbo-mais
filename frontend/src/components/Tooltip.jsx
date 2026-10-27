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
  Selic: 'A taxa básica de juros do Brasil, definida pelo Banco Central a cada 45 dias. Quando ela sobe, a renda fixa rende mais.',
  'IR regressivo':
    'O imposto de renda da renda fixa cai quanto mais tempo o dinheiro fica aplicado: 22,5% até 6 meses, 20% até 1 ano, 17,5% até 2 anos e 15% depois disso. Cada aporte conta o seu próprio prazo.',
  CDB: 'Empréstimo que você faz a um banco. Paga um percentual do CDI (100%, 110%...), tem IR regressivo e é garantido pelo FGC até R$ 250 mil.',
  'LCI/LCA':
    'Letras de crédito imobiliário e do agronegócio. Costumam pagar um % menor do CDI, mas são ISENTAS de imposto de renda para pessoa física. Também têm garantia do FGC.',
  'Tesouro Selic':
    'Título público que rende a Selic. É o investimento mais seguro do país. Tem IR regressivo e taxa de custódia da B3 de 0,20% ao ano sobre o que passar de R$ 10 mil.',
  Poupança:
    'Isenta de IR, mas rende pouco: com a Selic acima de 8,5% ao ano, paga 0,5% ao mês + TR (cerca de 6% a 8% ao ano). Por isso costuma perder para CDB e Tesouro quando os juros estão altos.',
  TR: 'Taxa Referencial, calculada pelo Banco Central. Entra no rendimento da poupança e costuma ser bem pequena.',
  'Perfil de risco': 'Conservador = oscila pouco; moderado = oscila de forma moderada; arrojado = pode subir ou cair muito.',
};
