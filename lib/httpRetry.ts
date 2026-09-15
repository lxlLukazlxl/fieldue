// Tenta uma requisição e, se a rede falhar de cara (ex.: o servidor
// "dormindo" no plano free do Render, que leva uns 30-50s pra acordar),
// espera um pouco e tenta de novo — em vez de perder na hora o que o
// técnico acabou de preencher (fotos, relatório, assinatura...).
//
// Só entra em ação quando o fetch() lança uma exceção (falha de rede/
// conexão recusada). Se o servidor responder — mesmo com um erro (4xx/5xx)
// — não há nova tentativa aqui: quem chamou trata a resposta normalmente.
type OpcoesRetentativa = {
  esperasMs?: number[];
  aoTentarNovamente?: (tentativa: number, restantes: number) => void;
};

export async function fetchComRetentativa(
  url: string,
  options: RequestInit,
  opcoes?: OpcoesRetentativa,
): Promise<Response> {
  const esperasMs = opcoes?.esperasMs ?? [5000, 10000, 20000];
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa <= esperasMs.length; tentativa++) {
    try {
      return await fetch(url, options);
    } catch (e) {
      ultimoErro = e;
      if (tentativa < esperasMs.length) {
        opcoes?.aoTentarNovamente?.(tentativa + 1, esperasMs.length - tentativa);
        await new Promise((resolve) => setTimeout(resolve, esperasMs[tentativa]));
      }
    }
  }
  throw ultimoErro;
}
