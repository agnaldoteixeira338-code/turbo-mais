import { api, ApiError, definirAccessToken, obterAccessToken, registrarAoExpirarSessao } from '../src/services/api';

function resposta(status, corpo, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => headers[h.toLowerCase()] ?? null },
    json: async () => corpo,
  };
}
const sucesso = (data, meta = null) => ({ success: true, data, error: null, meta });

describe('services/api', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    definirAccessToken(null);
  });

  it('desembrulha o envelope { success, data, meta } e envia Authorization', async () => {
    definirAccessToken('tok');
    global.fetch.mockResolvedValue(resposta(200, sucesso([1, 2], { total: 2 })));
    await expect(api('/favoritos')).resolves.toEqual({ data: [1, 2], meta: { total: 2 } });
    const [url, opcoes] = global.fetch.mock.calls[0];
    expect(url).toBe('http://api.teste/api/v1/favoritos');
    expect(opcoes.headers.Authorization).toBe('Bearer tok');
    expect(opcoes.credentials).toBe('include');
  });

  it('converte erro da API em ApiError com code e Retry-After', async () => {
    global.fetch.mockResolvedValue(resposta(429, { success: false, error: { code: 'CONTA_BLOQUEADA', message: 'Bloqueada' } }, { 'retry-after': '600' }));
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 429, code: 'CONTA_BLOQUEADA', retryAfter: 600 });
  });

  it('falha de rede vira SEM_CONEXAO', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/x')).rejects.toBeInstanceOf(ApiError);
    await expect(api('/x')).rejects.toMatchObject({ code: 'SEM_CONEXAO' });
  });

  it('401 → renova a sessão UMA vez (single-flight) e repete as requisições', async () => {
    definirAccessToken('velho');
    document.cookie = 'csrf_token=csrf123; path=/';
    let refreshes = 0;
    global.fetch.mockImplementation(async (url, opcoes) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes += 1;
        expect(opcoes.headers['X-CSRF-Token']).toBe('csrf123');
        await new Promise((r) => setTimeout(r, 5));
        return resposta(200, sucesso({ accessToken: 'novo', usuario: {} }));
      }
      return opcoes.headers.Authorization === 'Bearer novo' ? resposta(200, sucesso('ok')) : resposta(401, { success: false, error: { code: 'TOKEN_INVALIDO' } });
    });

    const resultados = await Promise.all([api('/a'), api('/b'), api('/c')]);
    expect(resultados.map((r) => r.data)).toEqual(['ok', 'ok', 'ok']);
    expect(refreshes).toBe(1);
    expect(obterAccessToken()).toBe('novo');
  });

  it('se a renovação falhar, limpa o token e avisa que a sessão expirou', async () => {
    definirAccessToken('velho');
    const aoExpirar = jest.fn();
    registrarAoExpirarSessao(aoExpirar);
    global.fetch.mockResolvedValue(resposta(401, { success: false, error: {} }));
    await expect(api('/a')).rejects.toMatchObject({ code: 'SESSAO_EXPIRADA' });
    expect(aoExpirar).toHaveBeenCalled();
    expect(obterAccessToken()).toBeNull();
  });

  it('POST idempotente mantém a MESMA Idempotency-Key no retry após refresh', async () => {
    definirAccessToken('velho');
    const chaves = [];
    global.fetch.mockImplementation(async (url, opcoes) => {
      if (url.endsWith('/auth/refresh')) return resposta(200, sucesso({ accessToken: 'novo' }));
      chaves.push(opcoes.headers['Idempotency-Key']);
      return opcoes.headers.Authorization === 'Bearer novo' ? resposta(201, sucesso({ id: 1 })) : resposta(401, { success: false, error: {} });
    });
    await api('/alertas', { method: 'POST', body: { a: 1 }, idempotente: true });
    expect(chaves).toHaveLength(2);
    expect(chaves[0]).toBe(chaves[1]);
  });

  it('204 devolve data nula', async () => {
    global.fetch.mockResolvedValue(resposta(204, null));
    await expect(api('/favoritos/X', { method: 'DELETE' })).resolves.toEqual({ data: null, meta: null });
  });
});
