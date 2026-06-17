# Catalogo Match

Ferramenta web local para busca manual inteligente em catalogos tecnicos
industriais. O objetivo e funcionar como um "Google interno" de produtos,
consultando multiplos fabricantes ao mesmo tempo e separando os resultados por
catalogo.

## Como usar

1. Abra `index.html` em um navegador moderno ou acesse o GitHub Pages.
2. Digite o produto, descricao tecnica, dimensao, rosca, acabamento, linha ou
   codigo parcial.
3. Opcionalmente filtre os fabricantes.
4. Clique em **Buscar**.
5. Revise os resultados agrupados por fabricante e ordenados por score.
6. Use **Abrir no catalogo** para abrir o PDF oficial na pagina do item.

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
- composicao do score.
- botao para abrir o PDF do fabricante diretamente na pagina do produto.

## Abertura do catalogo

Cada resultado possui o PDF correto do seu fabricante. O botao **Abrir no
catalogo** abre uma nova aba usando o formato:

```text
catalogo-do-fabricante.pdf#page=NUMERO_DA_PAGINA
```

Quando existe codigo final, o link tambem envia `search=CODIGO` para tentar
destacar/localizar o produto no leitor de PDF. Se o navegador nao respeitar
`#page=` ou `search=`, o sistema orienta o usuario a usar a busca interna do
PDF com o codigo final exibido no card.

## Arquivos principais

- `index.html`: interface de busca manual;
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
