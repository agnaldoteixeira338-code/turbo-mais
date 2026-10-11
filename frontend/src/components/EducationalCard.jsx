import { Icone } from './Icone';

/** Bloco educativo ("O que essa empresa faz", "Papel na sociedade"...). */
export function EducationalCard({ titulo, icone = 'info', children }) {
  return (
    <article className="rounded-3xl bg-roxo-50/70 p-5 dark:bg-roxo-500/10">
      <h3 className="mb-2 flex items-center gap-2 font-bold text-roxo-800 dark:text-roxo-200">
        <Icone nome={icone} className="h-5 w-5" />
        {titulo}
      </h3>
      <div className="leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </article>
  );
}
