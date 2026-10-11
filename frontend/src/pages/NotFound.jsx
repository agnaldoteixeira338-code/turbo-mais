import { Logo } from '../components/Logo';
import { Button } from '../components/Button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo tamanho="md" />
      <p className="mt-10 bg-gradient-to-br from-roxo-500 to-roxo-800 bg-clip-text text-8xl font-black text-transparent sm:text-9xl">404</p>
      <h1 className="mt-4 text-2xl font-bold">Esse ativo saiu da bolsa… ou nunca existiu 📉</h1>
      <p className="mt-2 max-w-md texto-suave">A página que você procura não foi encontrada. Que tal voltar e acelerar suas decisões por outro caminho?</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button para="/">Ir para o início</Button>
        <Button para="/buscar" variante="secundario">
          Buscar investimentos
        </Button>
      </div>
    </main>
  );
}
