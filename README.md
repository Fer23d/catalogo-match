# Catalogo Match

Ferramenta web local para busca manual inteligente em catalogos tecnicos
industriais. O objetivo e funcionar como um "Google interno" de produtos,
consultando multiplos fabricantes ao mesmo tempo e separando os resultados por
catalogo.

## Como usar

1. Abra `index.html` em um navegador moderno ou acesse o GitHub Pages.
2. Digite o produto, descricao tecnica, dimensao, rosca, acabamento, linha ou
   codigo parcial.
3. Use as sugestoes automaticas para completar a busca, se desejar.
4. Opcionalmente filtre os fabricantes.
5. Clique em **Buscar**.
6. Revise os resultados agrupados por fabricante e ordenados por score.
7. Use **Copiar codigo**, **Abrir no catalogo** ou a estrela de favoritos.

Exemplos de busca:

```text
parafuso sextavado inox 304
arruela lisa 1/4 zincado branco
condulete 3/4 aluminio
M8 flangeado 8.8
bolt hex stainless
```

## Catalogos suportados

```text
CISER
ELECON
DAISA
ARCELOR
BURNDY
INTELLI
SUBESTACOES
```

Cada fabricante e pesquisado de forma independente. O sistema nunca mistura
linha, referencia ou codigo entre catalogos diferentes.

## Busca inteligente

A busca combina tres estrategias:

- full text search: encontra termos presentes no nome, descricao, detalhe,
  categoria, linha, referencia e codigo;
- fuzzy search: tolera abreviacoes, pequenas diferencas de escrita e erros de
  digitacao;
- match semantico simplificado: normaliza sinonimos tecnicos como `bolt`,
  `screw`, `hex`, `stainless`, `washer`, `conduit`, `thread` e termos
  equivalentes em portugues.

Normalizacao aplicada:

- remove acentos;
- converte para minusculas;
- remove caracteres especiais;
- reduz espacos duplicados;
- padroniza virgula decimal.

## Ranking

Cada resultado recebe uma pontuacao de confianca:

- produto similar: ate 40 pontos;
- dimensao correta: ate 25 pontos;
- linha ou familia correta: ate 20 pontos;
- acabamento ou material correto: ate 15 pontos;
- codigo parcial ou exato: ate 10 pontos.

Os resultados sao sempre ordenados do maior score para o menor dentro de cada
fabricante.

## Dados exibidos

Cada card de resultado mostra:

- fabricante;
- produto;
- linha;
- dimensao;
- acabamento;
- referencia;
- codigo final;
- pagina do catalogo;
- score de confianca;
- composicao do score;
- botao para copiar o codigo final;
- estrela para salvar/remover favorito;
- botao para abrir o PDF do fabricante diretamente na pagina do produto.

## Recursos profissionais

- autocomplete inteligente com sugestoes vindas dos catalogos carregados;
- busca fuzzy para erros de digitacao, abreviacoes e termos incompletos;
- filtros visuais por fabricante;
- score colorido: alta, media e baixa confianca;
- favoritos persistentes em `localStorage`;
- copia rapida do codigo final com um clique.

## Abertura e destaque no catalogo

Cada resultado possui o PDF correto do seu fabricante. O botao **Abrir no
catalogo** abre o `catalog-viewer.html`, um viewer interno baseado em PDF.js.
Esse viewer:

- carrega o PDF correspondente ao fabricante;
- renderiza a pagina do produto em canvas;
- extrai a camada de texto posicional com PDF.js;
- se a pagina logica do catalogo nao for a mesma pagina fisica do arquivo PDF,
  procura automaticamente a pagina correta pela camada de texto;
- calcula score por codigo, referencia, descricao e dimensao;
- desenha retangulo amarelo semi-transparente exatamente sobre os textos
  encontrados usando as coordenadas do PDF;
- rola a tela automaticamente ate o destaque.

Se o texto nao for encontrado na camada extraida pelo PDF.js, o viewer mostra um
aviso e mantem o botao para abrir o PDF original.

## Arquivos principais

- `index.html`: interface de busca manual;
- `catalog-viewer.html`: viewer PDF.js com destaque de produto;
- `catalog-viewer.js`: carregamento do PDF, navegacao de pagina e overlay
  amarelo de destaque;
- `vendor/pdfjs/`: PDF.js local, sem depender de CDN;
- `style.css`: layout responsivo;
- `script.js`: normalizacao, fuzzy search, ranking e renderizacao;
- `catalogo-data.js`: base Ciser extraida;
- `catalogo-daisa-data.js`: base DAISA extraida;
- `catalogo-elecon-data.js`: base Elecon extraida;
- `catalogo-arcelor-data.js`: base ArcelorMittal extraida;
- `catalogo-burndy-data.js`: base BURNDY extraida;
- `catalogo-intelli-data.js`: base Intelli extraida;
- `catalogo-subestacoes-data.js`: ficha local do catalogo de Subestacoes;
- `catalogo-*.pdf`: PDFs originais para consulta.

## Bases atuais

- Ciser: 441 fichas e 6.402 TAGs unicas;
- DAISA: 52 familias e 977 variantes;
- Elecon: 766 referencias extraidas;
- ArcelorMittal: 4 familias e 215 combinacoes tecnicas;
- BURNDY: 877 referencias extraidas;
- Intelli: 1.012 referencias extraidas;
- Subestacoes: PDF adicionado com ficha local de catalogo.

Todos os dados sao processados localmente no navegador. Nenhum arquivo e
enviado para servidor.
