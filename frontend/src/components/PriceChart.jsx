import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dataCurta, moeda } from '../utils/formatar';
import { useTheme } from '../hooks/useTheme';

/** Gráfico histórico (Recharts). Verde se o período fechou em alta, vermelho se em queda. */
export default function PriceChart({ pontos, moedaCodigo = 'BRL' }) {
  const { escuro } = useTheme();
  if (!pontos?.length) return null;
  const subiu = pontos.at(-1).preco >= pontos[0].preco;
  const cor = subiu ? '#0e9f6e' : '#e02424';
  const eixo = escuro ? '#a1a1aa' : '#71717a';

  return (
    <div className="h-64 w-full" role="img" aria-label={`Gráfico de preço: de ${moeda(pontos[0].preco, moedaCodigo)} para ${moeda(pontos.at(-1).preco, moedaCodigo)} no período`}>
      <ResponsiveContainer>
        <AreaChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="preenchimento" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={escuro ? '#ffffff12' : '#00000010'} vertical={false} />
          <XAxis dataKey="data" tickFormatter={dataCurta} tick={{ fill: eixo, fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: eixo, fontSize: 12 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => v.toLocaleString('pt-BR')} />
          <Tooltip
            formatter={(v) => [moeda(v, moedaCodigo), 'Preço']}
            labelFormatter={dataCurta}
            contentStyle={{ borderRadius: 16, border: 'none', background: escuro ? '#18181b' : '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}
          />
          <Area type="monotone" dataKey="preco" stroke={cor} strokeWidth={2.5} fill="url(#preenchimento)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
