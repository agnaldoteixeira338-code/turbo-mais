/**
 * Motor de matching "texto livre → ativos compatíveis".
 *
 * Serviço de domínio PURO: sem I/O, sem dependências, 100% determinístico.
 * Recebe o catálogo e o dicionário por parâmetro, o que o torna trivial de
 * testar e de trocar no futuro (ex.: por embeddings — ver README, "O que eu
 * faria diferente").
 *
 * Pipeline:
 *   1. normaliza (minúsculas, sem acento, sem pontuação)
 *   2. extrai conceitos casando termos do dicionário por PALAVRA/FRASE inteira
 *      (evita "ia" casar com "familia")
 *   3. pontua cada ativo por compatibilidade (tipo, setor, tag, perfil, país)
 *   4. ranqueia (score desc, ticker asc para desempate estável) e corta no top N
 *   5. gera justificativa legível: "Por que combina com você"
 */

const PESOS = Object.freeze({
  tipo: 3,
  setor: 3,
  tag: 2,
  perfil: 2,
  pais: 2,
  perfilEvitado: -4,
});

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

class MotorDeSugestoes {
  /** @param {{conceitos: Array<object>}} dicionario */
  constructor(dicionario) {
    if (!dicionario || !Array.isArray(dicionario.conceitos)) {
      throw new Error('Dicionário de sinônimos inválido');
    }
    // Pré-normaliza os termos uma única vez (o dicionário é estático)
    this.conceitos = dicionario.conceitos.map((c) => ({
      ...c,
      termosNormalizados: [...new Set(c.termos.map(normalizar))].filter(Boolean),
      setoresNormalizados: (c.setores ?? []).map(normalizar),
    }));
  }

  static normalizar(texto) {
    return normalizar(texto);
  }

  /** @returns {Array<{conceito: object, termo: string}>} */
  extrairConceitos(texto) {
    const alvo = ` ${normalizar(texto)} `;
    const encontrados = [];
    for (const conceito of this.conceitos) {
      const termo = conceito.termosNormalizados.find((t) => alvo.includes(` ${t} `));
      if (termo) encontrados.push({ conceito, termo });
    }
    return encontrados;
  }

  /**
   * @param {string} texto descrição livre do usuário (já sanitizada)
   * @param {import('../entities/AtivoEducativo').AtivoEducativo[]} ativos
   * @param {{limite?: number}} [opcoes]
   */
  sugerir(texto, ativos, { limite = 10 } = {}) {
    const extraidos = this.extrairConceitos(texto);
    const palavrasChave = extraidos.map(({ conceito }) => conceito.rotulo);
    if (extraidos.length === 0) return { palavrasChave, sugestoes: [] };

    const pontuados = ativos
      .map((ativo) => this.#pontuar(ativo, extraidos))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.ativo.ticker.localeCompare(b.ativo.ticker))
      .slice(0, limite);

    const sugestoes = pontuados.map((r, i) => ({
      ticker: r.ativo.ticker,
      nome: r.ativo.nome,
      tipo: r.ativo.tipo,
      score: r.score,
      posicao: i + 1,
      justificativa: this.#justificar(r.motivos),
    }));

    return { palavrasChave, sugestoes };
  }

  #pontuar(ativo, extraidos) {
    let score = 0;
    const motivos = [];
    const setorAtivo = normalizar(ativo.setor);
    const tagsAtivo = new Set(ativo.tags ?? []);

    for (const { conceito, termo } of extraidos) {
      let pontosConceito = 0;

      if (conceito.tipos?.includes(ativo.tipo)) pontosConceito += PESOS.tipo;
      if (conceito.setoresNormalizados.includes(setorAtivo)) pontosConceito += PESOS.setor;
      const tagsEmComum = (conceito.tags ?? []).filter((t) => tagsAtivo.has(t));
      pontosConceito += tagsEmComum.length * PESOS.tag;
      if (conceito.perfilRisco && conceito.perfilRisco === ativo.perfilRisco) pontosConceito += PESOS.perfil;
      if (conceito.paises?.includes(ativo.pais)) pontosConceito += PESOS.pais;

      if (pontosConceito > 0) {
        motivos.push(`você mencionou "${termo}" e isso combina com ${conceito.rotulo.toLowerCase()}`);
      }
      if (conceito.evitarPerfis?.includes(ativo.perfilRisco)) {
        pontosConceito += PESOS.perfilEvitado;
      }
      score += pontosConceito;
    }

    if (score > 0) motivos.push(`perfil de risco ${ativo.perfilRisco}`);
    return { ativo, score, motivos };
  }

  #justificar(motivos) {
    const unicos = [...new Set(motivos)];
    const texto = unicos.join('; ');
    return `Combina com você porque ${texto}.`;
  }
}

module.exports = { MotorDeSugestoes, normalizar, PESOS };
