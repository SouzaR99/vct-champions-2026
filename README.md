# VCT Champions 2026 — Dashboard Live

Dashboard estático para GitHub Pages com sincronização automática.

## Atualização
- GitHub Actions executa `update-vct.mjs` a cada 5 minutos (`*/5 * * * *`).
- O navegador consulta `data.json` a cada 5 minutos, ao voltar para a aba e ao recuperar foco.
- Durante partidas ao vivo, o dashboard marca o estado LIVE e atualiza placares/estatísticas quando a fonte fornecer novos dados.
- O navegador usa o snapshot embutido como fallback se `data.json` estiver temporariamente indisponível.

## Publicação
1. Renomeie `VCT_Champions_2026_Dashboard.html` para `index.html`.
2. Suba todos os arquivos para um repositório GitHub.
3. Ative Settings → Pages → Deploy from branch → `main` → `/root`.
4. Em Actions, permita workflows e execute manualmente uma vez para testar.

## Observação
O agendamento do GitHub Actions é periódico e pode sofrer atraso de alguns minutos. Portanto, “5 minutos” é a frequência configurada, não uma garantia de latência exata. A API/fonte de dados também determina o quão rápido novas estatísticas ficam disponíveis.
