import { Icone } from './Icone';

export function EmptyState({ icone = 'info', titulo, descricao, acao }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-4 rounded-3xl bg-roxo-50 p-4 text-roxo-600 dark:bg-roxo-500/15 dark:text-roxo-300">
        <Icone nome={icone} className="h-8 w-8" />
      </span>
      <h3 className="text-lg font-bold">{titulo}</h3>
      {descricao && <p className="mt-1 max-w-sm texto-suave">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}
