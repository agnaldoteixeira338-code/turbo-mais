import { Card } from './Card';
import { Icone } from './Icone';

// Classes por extenso: o Tailwind só gera as classes que aparecem escritas no código
const CORES = {
  alta: { texto: 'text-alta', ponto: 'bg-alta' },
  baixa: { texto: 'text-baixa', ponto: 'bg-baixa' },
};

function Lista({ titulo, itens, sentido }) {
  const cor = CORES[sentido];
  return (
    <section aria-label={titulo} className="rounded-2xl bg-zinc-50 p-4 dark:bg-white/5">
      <h3 className={`flex items-center gap-2 font-bold ${cor.texto}`}>
        <Icone nome={sentido} className="h-5 w-5" /> {titulo}
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {itens.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cor.ponto}`} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * O que costuma fazer o preço subir e cair (ADR-015). Na renda fixa não há
 * "preço que cai": a pergunta vira o que faz render mais ou menos (e os riscos).
 */
export function FatoresPreco({ fatores, rendaFixa = false }) {
  if (!fatores?.alta?.length && !fatores?.baixa?.length) return null;
  return (
    <Card titulo={rendaFixa ? 'O que faz render mais ou menos' : 'O que costuma fazer o preço subir ou cair'}>
      <div className="grid gap-4 md:grid-cols-2">
        <Lista titulo={rendaFixa ? 'Rende mais quando' : 'Costuma subir com'} itens={fatores.alta} sentido="alta" />
        <Lista titulo={rendaFixa ? 'Rende menos ou tem risco quando' : 'Costuma cair com'} itens={fatores.baixa} sentido="baixa" />
      </div>
      <p className="mt-4 text-xs texto-suave">
        Fatores conhecidos que costumam influenciar este ativo, explicados de forma simples. Ajudam a entender o que você está olhando, mas não garantem o que
        vai acontecer.
      </p>
    </Card>
  );
}
