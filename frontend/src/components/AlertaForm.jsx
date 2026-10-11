import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { alertasService } from '../services/favoritos';

/** Formulário "🔔 Configurar alerta" da tela de detalhes. */
export function AlertaForm({ ticker, onCriado }) {
  const [gatilho, setGatilho] = useState('3');
  const [direcao, setDirecao] = useState('ambas');
  const [estado, setEstado] = useState({ enviando: false, erro: null, sucesso: false });

  async function enviar(e) {
    e.preventDefault();
    setEstado({ enviando: true, erro: null, sucesso: false });
    try {
      const alerta = await alertasService.criar({ ticker, gatilhoPercentual: Number(gatilho.replace(',', '.')), direcao });
      setEstado({ enviando: false, erro: null, sucesso: true });
      onCriado?.(alerta);
    } catch (err) {
      setEstado({ enviando: false, erro: err.message, sucesso: false });
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="text-sm texto-suave">Avisaremos quando {ticker} variar no dia além do percentual escolhido.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input rotulo="Variação (%)" inputMode="decimal" value={gatilho} onChange={(e) => setGatilho(e.target.value)} required pattern="^\d{1,3}([.,]\d{1,2})?$" />
        <div>
          <label htmlFor="direcao-alerta" className="rotulo">
            Direção
          </label>
          <select id="direcao-alerta" className="campo" value={direcao} onChange={(e) => setDirecao(e.target.value)}>
            <option value="ambas">📈📉 Alta ou queda</option>
            <option value="alta">📈 Só alta</option>
            <option value="baixa">📉 Só queda</option>
          </select>
        </div>
      </div>
      {estado.erro && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{estado.erro}</p>}
      {estado.sucesso && <p role="status" className="text-sm text-alta">Alerta criado! Você será notificado aqui e no navegador.</p>}
      <Button type="submit" variante="secundario" carregando={estado.enviando}>
        🔔 Criar alerta
      </Button>
    </form>
  );
}
