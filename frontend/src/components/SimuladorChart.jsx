import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { moeda, numeroCompacto, prazoPorExtenso } from '../utils/formatar';
import { useTheme } from '../hooks/useTheme';
import { ESTILO_MODALIDADE } from '../utils/modalidades';

/** Evolução do valor LÍQUIDO (se resgatado naquele mês) de cada modalidade. */
export default function SimuladorChart({ modalidades, melhor }) {
  const { escuro } = useTheme();
  if (!modalidades?.length) return null;

  const meses = modalidades[0].serie.length;
  const dados = Array.from({ length: meses }, (_, i) => ({
    mes: i,
    investido: modalidades[0].serie[i].investido,
    ...Object.fromEntries(modalidades.map((m) => [m.id, m.serie[i].liquido])),
  }));
  const eixo = escuro ? '#a1a1aa' : '#71717a';
  const vencedora = modalidades.find((m) => m.id === melhor);
  const rotuloMes = (m) => (meses > 25 ? `${Math.round(m / 12)}a` : `${m}m`);

  return (
    <div
      className="h-72 w-full sm:h-80"
      role="img"
      aria-label={`Gráfico da evolução do valor líquido em ${prazoPorExtenso(meses - 1)}. ${vencedora ? `A que mais rende é ${vencedora.nome}, terminando em ${moeda(vencedora.valorLiquido)}.` : ''}`}
    >
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={escuro ? '#ffffff12' : '#00000010'} vertical={false} />
          <XAxis dataKey="mes" tickFormatter={rotuloMes} tick={{ fill: eixo, fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: eixo, fontSize: 12 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => numeroCompacto(v)} />
          <Tooltip
            formatter={(v, chave) => [moeda(v), chave === 'investido' ? 'Total investido' : modalidades.find((m) => m.id === chave)?.nome ?? chave]}
            labelFormatter={(m) => (m === 0 ? 'Início' : `Mês ${m} (${prazoPorExtenso(m)})`)}
            itemSorter={(item) => -item.value}
            contentStyle={{ borderRadius: 16, border: 'none', background: escuro ? '#18181b' : '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}
          />
          <Legend formatter={(chave) => (chave === 'investido' ? 'Total investido' : modalidades.find((m) => m.id === chave)?.nome ?? chave)} wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="investido" stroke={eixo} strokeWidth={1.5} strokeDasharray="1 4" dot={false} isAnimationActive={false} />
          {modalidades.map((m) => (
            <Line
              key={m.id}
              type="monotone"
              dataKey={m.id}
              stroke={ESTILO_MODALIDADE[m.id]?.cor}
              strokeDasharray={ESTILO_MODALIDADE[m.id]?.traco}
              strokeWidth={m.id === melhor ? 3.5 : 2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
