# AprovaIA

Aplicação web para organizar o estudo a partir de provas, com login Google via Firebase Authentication e modo padrão de IA local gratuita com Ollama. Gemini e OpenAI são provedores opcionais e não são chamados no modo local.

## Requisitos

- Node.js 22.13 ou superior (ou Node.js 24+).
- Um projeto Firebase com Authentication e o provedor Google habilitado.
- [Ollama para Windows](https://ollama.com/download) para executar o modelo localmente. Este projeto usa `gemma4:e2b`; o modelo precisa ser baixado uma vez e ocupa cerca de 4,6 GB em disco, além de memória enquanto é executado.
- Opcional: chave Gemini ou [API OpenAI](https://platform.openai.com/api-keys) apenas se decidir ativar serviços em nuvem. Essas APIs podem ter limites, requisitos de créditos ou cobrança separados.
- Credenciais do Firebase Admin para que o servidor possa validar sessões. Use uma conta de serviço ou Application Default Credentials (ADC).

O modo local padrão não envia provas à Gemini ou à OpenAI e não gera cobranças de API. O modelo utiliza os recursos do próprio computador. Se habilitar Gemini em nuvem, respeite os termos de idade do provedor.

## Configuração local

1. Instale as dependências:

   ```powershell
   npm.cmd install
   ```

2. Copie `.env.example` para `.env`. O padrão usa Ollama local; se necessário, ajuste:
   - `AI_PROVIDER=ollama`: mantém todo o processamento de IA no computador; este é o modo padrão.
   - `OLLAMA_BASE_URL` e `OLLAMA_MODEL`: endereço local e modelo baixado no Ollama. Padrão: `http://127.0.0.1:11434` e `gemma4:e2b`.
   - `ENABLE_GEMINI_FALLBACK=false`: não envia a prova para a nuvem por padrão. Para permitir essa contingência, defina explicitamente como `true` e configure `GEMINI_API_KEY`.
   - `OPENAI_API_KEY` e `OPENAI_MODEL`: chave privada para OpenAI, se decidir usar esse provedor.
   - `ENABLE_PAID_OPENAI_FALLBACK=false`: mantém a OpenAI desativada para evitar uso pago acidental. Só habilite após configurar faturamento e desejar explicitamente esse uso.
   - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID` e `FIREBASE_APP_ID`: configuração do app Web em Firebase Console → Project settings → Your apps.
   - `FIREBASE_MESSAGING_SENDER_ID`: valor correspondente do app Web, se disponível.
   - `GOOGLE_APPLICATION_CREDENTIALS`: opcional; caminho absoluto para um JSON de conta de serviço do Firebase Admin. Mantenha esse arquivo fora desta pasta e nunca o envie ao Git. Se preferir ADC, deixe a variável sem valor e autentique o usuário local com `gcloud auth application-default login --project=SEU_PROJECT_ID`.

3. Mantenha o aplicativo Ollama aberto no Windows e baixe o modelo uma vez:

   ```powershell
   ollama pull gemma4:e2b
   ```

   Se não usar o aplicativo da bandeja, inicie `ollama serve` em uma janela separada do PowerShell e deixe-a aberta.

4. No Firebase Console, abra Authentication → Sign-in method e habilite Google. Em Authentication → Settings → Authorized domains, adicione `localhost`.

5. Inicie o servidor:

   ```powershell
   npm.cmd start
   ```

6. Abra `http://localhost:3000`.

Se as credenciais ainda não estiverem prontas, “Explorar demonstração” permite navegar pela interface. A demonstração não processa arquivos nem chama a IA.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` publica somente `index.html`, `app.js` e `runtime-config.js`; o servidor Node.js, o Ollama e arquivos `.env` não são publicados. O repositório `Yghor-Soares/aprovaia.github.io` precisa ser público para usar GitHub Pages no plano Free. O endereço do site de projeto será `https://yghor-soares.github.io/aprovaia.github.io/`. O código-fonte do repositório também ficará público; não envie segredos, chaves privadas ou provas.

O Pages não executa o servidor nem hospeda o Ollama. Para habilitar login e geração de apostilas, mantenha o backend e o Ollama rodando neste computador, instale o `cloudflared` e crie um túnel HTTPS temporário:

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

Copie o endereço `https://....trycloudflare.com` exibido pelo túnel e salve-o como variável de repositório `APROVAIA_API_BASE_URL` em **Settings → Secrets and variables → Actions → Variables**. Depois execute o workflow `Deploy AprovaIA to GitHub Pages` em **Actions → Run workflow**. O endereço do túnel rápido muda quando o túnel reinicia; atualize a variável e publique novamente. Não exponha a porta do computador no roteador: o túnel encaminha a conexão ao `127.0.0.1`.

Mantenha `CORS_ALLOWED_ORIGINS=https://yghor-soares.github.io` na configuração privada do backend. No Firebase Authentication, autorize `yghor-soares.github.io` em **Authentication → Settings → Authorized domains** e confira as origens JavaScript autorizadas no provedor Google. O valor de `APROVAIA_API_BASE_URL` é público; `.env`, chaves de provedores e credenciais Firebase Admin não devem ser adicionados ao GitHub.

## Leituras por vestibular

A biblioteca separa listas oficiais de obras obrigatórias dos materiais de apoio gerais, com filtros por vestibular. Inclui as listas da FUVEST/USP 2027 e da Unicamp 2027 e 2028, além do PDF oficial de obras do PAS/UnB 1 para 2026–2028. As listas podem mudar a cada edição: confira sempre o edital vigente. Os links de apoio não são listas oficiais de obras obrigatórias.

## O que a IA faz

- `POST /api/analyze`: verifica a sessão Firebase, envia um PDF ou texto ao provedor de IA disponível e retorna os tópicos em JSON.
- `POST /api/study-guide`: cria explicações por tópico, pontos-chave, dicas de prova e questões originais com respostas comentadas.
- `POST /api/ask`: responde dúvidas do estudante sobre o tópico atual.
- `POST /api/adult-consent`: registra, no Firebase Auth, a confirmação de idade exigida para usar as rotas de IA.

O modo padrão gera análises, apostilas e respostas localmente pelo Ollama, sem chamadas às APIs Gemini/OpenAI. PDFs com texto selecionável são extraídos no computador; PDFs digitalizados sem texto precisam ter as questões coladas no campo de texto. É possível incluir todos os tópicos detectados e adicionar manualmente quantos outros desejar; sugestões de tópicos por área são exibidas para complementar a lista. Para evitar solicitações grandes ao modelo, o servidor gera a apostila sequencialmente em lotes de até dois tópicos. Apostilas extensas podem levar vários minutos. O primeiro carregamento do modelo pode levar até alguns minutos; depois ele permanece carregado temporariamente. Gemini só é usado como contingência se `ENABLE_GEMINI_FALLBACK=true`; OpenAI só é chamada se `ENABLE_PAID_OPENAI_FALLBACK=true`. O botão de análise tem limite de três minutos para acomodar o primeiro carregamento.

O servidor não persiste o arquivo da prova. PDFs de até 20 MB são mantidos em memória; no modo local, o texto é extraído pelo PDF.js e enviado somente ao Ollama em `127.0.0.1`. Textos colados têm limite de 60 mil caracteres. Ativar um provedor em nuvem envia o conteúdo a esse serviço e pode gerar custos. As respostas da IA são material de apoio e devem ser conferidas com referências confiáveis.

Cada endpoint de IA exige um ID token Firebase válido e há um limite de 12 solicitações por usuário a cada 15 minutos. As chaves de provedores em nuvem e a conta de serviço ficam no servidor; a configuração Firebase Web não é uma credencial secreta.

O login Google usa persistência local do Firebase; a sessão continua após atualizar a página ou reabrir o navegador. A confirmação de idade também é mantida neste navegador e apagada ao sair da conta.
