# Skills Browser

![Skills Browser](https://img.shields.io/badge/plataforma-Windows-181818)
![Python](https://img.shields.io/badge/Python-3.8+-3776AB)
![Node.js](https://img.shields.io/badge/Node.js-npx-F7DF1E)

**Skills Browser** é uma reconstrução local do aplicativo desktop original para descobrir, pesquisar e gerenciar skills para agentes de IA disponíveis no catálogo público do [skills.sh](https://www.skills.sh/).

A versão reconstruída recupera a interface embutida no executável original e a disponibiliza em um navegador local. A aplicação não envia dados privados para um serviço próprio: ela consulta o catálogo público e executa comandos locais do `npx skills` no seu computador.

## Índice

- [Recursos](#recursos)
- [Origem da reconstrução](#origem-da-reconstrução)
- [Como funciona](#como-funciona)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Execução](#execução)
- [Uso](#uso)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Endpoints locais](#endpoints-locais)
- [Dados e armazenamento](#dados-e-armazenamento)
- [Segurança](#segurança)
- [Testes](#testes)
- [Solução de problemas](#solução-de-problemas)
- [Limitações](#limitações)
- [Licença](#licença)

## Recursos

- Ranking das skills mais usadas em todo o período.
- Visualização de skills em alta nas últimas 24 horas.
- Visualização de skills com atividade recente.
- Busca por nome, tema ou repositório.
- Paginação e carregamento incremental do catálogo.
- Atividade das últimas oito semanas em gráficos de linha.
- Contadores de instalações totais e skills disponíveis.
- Lista das skills instaladas no escopo global.
- Instalação global de uma skill com `npx skills add`.
- Remoção global de uma skill com `npx skills remove`.
- Painel lateral com comando, saída do processo e estado da operação.
- Atualização manual dos dados.
- Interface responsiva com tema escuro.
- Abertura automática do navegador em `127.0.0.1`.
- Atalho de teclado `/` para focar a busca.
- Atalho `Esc` para fechar painéis ou limpar a pesquisa.

## Origem da reconstrução

O aplicativo original era um executável Windows de 64 bits, publicado como aplicação `.NET 8` com WebView2. O arquivo único continha a DLL principal, recursos da interface e dependências empacotadas.

Durante a análise da DLL original foram identificados:

- Assembly .NET 8 para Windows.
- Framework desktop `Microsoft.WindowsDesktop.App`.
- WebView2 para WinForms.
- Três recursos web incorporados:
  - `web/index.html`
  - `web/app.js`
  - `web/styles.css`

Os arquivos recuperados de interface foram extraídos para esta pasta e o servidor local foi reconstruído para substituir a camada de backend do aplicativo original.

## Como funciona

```text
Navegador local
      │
      ▼
server.py em 127.0.0.1:8765
      │
      ├── Arquivos estáticos ── index.html / app.js / styles.css
      ├── API local ─────────── /api/meta, /api/leaderboard, /api/search
      │                           /api/installed, /api/install, /api/remove
      │
      ├── skills.sh público
      │
      └── npx skills ─────────── instala ou remove skills globais
```

O navegador solicita dados ao servidor local. Quando os endpoints públicos conhecidos não estão disponíveis ou deixam de existir, o servidor tenta ler os dados de ranking incorporados na página atual do `skills.sh`. Isso evita interromper completamente a interface quando a API pública muda.

## Pré-requisitos

### Obrigatórios

- Windows 10 ou Windows 11.
- Python 3.8 ou superior.
- Node.js com o comando `npx` disponível.
- Conexão com a Internet para consultar o catálogo e instalar skills.

### Verificação no PowerShell

```powershell
python --version
node --version
npx --version
```

O comando `npx` deve estar disponível no `PATH` do sistema.

## Instalação

Não é necessária a instalação de pacotes Python externos para executar o servidor: ele usa apenas a biblioteca padrão do Python.

1. Abra o diretório da reconstrução.
2. Confirme que `index.html`, `app.js`, `styles.css` e `server.py` estão na mesma pasta.
3. Execute o arquivo `launch.bat`.

Você também pode iniciar pela linha de comando:

```bat
cd /d "C:\Users\Administrator\Desktop\skills-browser\app"
python server.py
```

## Execução

### Método recomendado

Duplo clique em:

```text
launch.bat
```

O script entra no diretório correto e inicia o servidor. A janela permanecerá aberta com o endereço local da aplicação.

### Execução manual

```bat
python server.py
```

Abra manualmente:

```text
http://127.0.0.1:8765/
```

Para encerrar, pressione `Ctrl+C` na janela do servidor ou feche o processo.

## Uso

### Explorar o ranking

Os usuários podem alternar entre:

- **Mais baixadas**: ranking geral de todos os tempos.
- **Em alta**: variação registrada nas últimas 24 horas.
- **Bombando agora**: atividade recente do catálogo.

O botão **Atualizar dados** recarrega estatísticas, skills instaladas e o ranking atual.

### Buscar

Digite pelo menos dois caracteres no campo de busca. Resultados podem ser encontrados por nome da skill, tema ou repositório.

### Instalar uma skill

O aplicativo usa a sintaxe atual do CLI: o repositório é informado como pacote e a skill específica é passada por `--skill`.

```text
npx skills add <repositório-ou-url> --skill <nome-da-skill> -g -y
```

1. Clique em **Instalar** em uma linha do catálogo.
2. Confira o comando mostrado no painel lateral.
3. Acompanhe a saída do `npx`.
4. Aguarde a indicação de conclusão.
5. Use **Concluir** para fechar o painel.

### Visualizar skills instaladas

Clique no contador **Instaladas** na barra superior. O painel mostra as skills encontradas em:

```text
%USERPROFILE%\.agents\skills
```

A aplicação tenta ler o campo `source` em `SKILL.md` quando ele está disponível.

### Remover uma skill

1. Abra o painel **Skills instaladas**.
2. Clique em **Remover** ao lado da skill desejada.
3. Confira a saída do processo no painel lateral.

## Estrutura do projeto

```text
app/
├── index.html       Interface HTML recuperada
├── styles.css       Tema visual, layout responsivo e animações
├── app.js           Estado, busca, ranking e interação da interface
├── server.py        Servidor HTTP local e integração com skills.sh/npx
├── launch.bat       Inicialização no Windows
├── test_server.py   Teste unitário básico
├── README.md        Documentação do projeto
└── __pycache__/     Cache gerado automaticamente pelo Python
```

### `index.html`

Contém a estrutura da página: cabeçalho, estatísticas, abas de ranking, campo de busca, tabela de skills, rodapé e painéis laterais.

### `styles.css`

Contém o tema escuro, grid de fundo, animações de carregamento, estados vazios, painéis, notificações e regras responsivas.

### `app.js`

Gerencia:

- Estado da aba e da busca.
- Paginação do ranking.
- Renderização das linhas.
- Gráficos simples de tendência.
- Cache temporário de descrições.
- Painéis laterais.
- Streaming da saída dos comandos.
- Atualização da lista instalada.
- Navegação por teclado.
- Mensagens temporárias para o usuário.

### `server.py`

Fornece arquivos estáticos, consulta o catálogo público, executa o `npx skills` e lista skills instaladas.

## Endpoints locais

| Método | Rota | Função |
|---|---|---|
| `GET` | `/` | Página principal |
| `GET` | `/api/meta` | Estatísticas do catálogo |
| `GET` | `/api/leaderboard` | Ranking por visualização e página |
| `GET` | `/api/search?q=termo&limit=100` | Busca no catálogo |
| `GET` | `/api/installed` | Skills do diretório global |
| `POST` | `/api/descriptions` | Descrições de um lote de skills |
| `POST` | `/api/install` | Instala uma skill globalmente |
| `POST` | `/api/remove` | Remove uma skill globalmente |

Os endpoints são destinados ao uso local pelo navegador e não possuem autenticação. Por isso, o servidor deve continuar limitado ao endereço `127.0.0.1`.

## Dados e armazenamento

A aplicação não possui banco de dados próprio.

Dados consultados do catálogo:

- Nome e identificador da skill.
- Repositório de origem.
- Quantidade de instalações.
- Instalações das últimas oito semanas.
- Status oficial.
- URL pública.

Dados locais consultados:

```text
%USERPROFILE%\.agents\skills
```

Para cada diretório encontrado em `.agents\skills`, o servidor usa o nome da pasta como nome da skill. Quando existe, o valor `source` do início do `SKILL.md` é mostrado como origem.

## Segurança

### Revisão de skills

Skills podem executar instruções e ferramentas com as permissões do agente que as utiliza. Revise a documentação e o código antes de instalar ou executar uma skill desconhecida.

### Confirmação do comando

Antes de executar uma instalação ou remoção, confira o comando exibido no painel. O programa transmite apenas o identificador selecionado pelo usuário ao servidor local.

### Escopo global

Os comandos usam `-g`, portanto a alteração pode afetar todos os agentes configurados no computador atual.

### Rede local

O servidor usa somente `127.0.0.1`, impedindo que seja acessado por outros computadores na rede local. Não exponha a porta `8765` em túnel ou firewall sem revisar essa decisão.

### Conteúdo remoto

Tanto o servidor quanto a interface devem considerar o conteúdo recebido do catálogo como não confiável. A interface usa escapamento ao gerar HTML dinâmico, mas scripts externos não são executados diretamente.

## Testes

Execute o teste unitário básico:

```bat
cd /d "C:\Users\Administrator\Desktop\skills-browser\app"
python -m unittest -v test_server.py
```

Também é possível verificar a sintaxe:

```bat
python -m py_compile server.py test_server.py
```

Smoke test manual do ranking:

```powershell
Invoke-RestMethod "http://127.0.0.1:8765/api/leaderboard?view=all-time&page=0"
```

## Solução de problemas

### `python` não é reconhecido

Instale Python no Windows e marque a opção para adicionar o executável ao `PATH`. Confirme em um terminal novo:

```powershell
python --version
```

### `npx` não é reconhecido

Instale Node.js e reinicie o terminal. Teste:

```powershell
npx --version
```

### A porta 8765 está ocupada

Outro processo pode estar utilizando a porta. Feche-o ou altere a porta em `server.py`:

```python
server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
```

Também altere a URL aberta pelo navegador no método `main()`.

### Ranking não carrega

Verifique:

- Conexão com a Internet.
- Disponibilidade de `https://www.skills.sh/`.
- Ausência de proxy ou firewall bloqueando o acesso.
- Código HTTP exibido no navegador ou no painel.

### A instalação não inicia

Confirme que `npx` está no `PATH` e que o diretório global pertence ao usuário atual. Execute o comando mostrado no painel manualmente para diagnosticar a saída completa.

### Nenhuma skill aparece como instalada

Confirme que a pasta existe:

```powershell
Test-Path "$HOME\.agents\skills"
Get-ChildItem "$HOME\.agents\skills"
```

## Limitações

- Esta é uma reconstrução a partir do executável; não representa necessariamente o código-fonte oficial completo.
- A API pública do `skills.sh` pode mudar sem aviso.
- A busca, a descrição e o ranking dependem da disponibilidade dos serviços públicos.
- A detecção de agentes instalados não está implementada no servidor reconstruído.
- A pasta global é a única fonte consultada para skills instaladas.
- Não há empacotamento atual em `.exe` ou instalador Windows nesta reconstrução.
- Não há banco local para cache persistente do catálogo.

## Skills com nomes iguais

O catálogo pode listar várias skills com o mesmo nome em repositórios diferentes. A aplicação agora gera um identificador estável usando `repositório/nome-da-skill`, por exemplo:

```text
vercel-labs/agent-browser/agent-browser
browserbase/skills/browser
```

Isso impede que o botão **Instalar** de uma linha instale a skill errada. O servidor envia sempre o repositório correto junto com `--skill`.

## Arquitetura original reconstruída

Com base na análise do binário:

- Plataforma: Windows 64 bits.
- Runtime: `.NET 8`.
- Interface: recursos HTML, CSS e JavaScript hospedados em WebView2.
- Backend: serviço HTTP embutido no processo .NET.
- Execução de comandos: processos locais do `npx skills`.
- Skills instaladas: pasta global do usuário.

## Licença

Este projeto foi reconstruído a partir de um aplicativo fornecido pelo usuário. Defina uma licença antes de publicar o código-fonte em um repositório público, especialmente se houver assets ou partes visuais de terceiros.
