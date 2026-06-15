# Catalogo Match

Aplicativo web local para importar uma planilha Excel, cruzar produtos com os
catalogos Ciser 2026, DAISA, Elecon, ArcelorMittal e BURNDY e preencher somente
a coluna `Observacoes` com o codigo final encontrado.

## Como usar

1. Abra `index.html` em um navegador moderno.
2. Em **Cruzamento Excel**, selecione o arquivo `.xlsx` ou `.xlsm`.
3. Escolha a aba e confirme o mapeamento das colunas.
4. Clique em **Cruzar produtos**.
5. Revise os resultados e exporte a planilha preenchida.

Tambem e possivel consultar manualmente por nome, dimensao, linha, familia ou
codigo final.

## Busca multi-catalogo

A busca manual percorre todos os fabricantes de forma independente e apresenta
uma secao para cada base:

```text
CISER
ELECON
DAISA
ARCELOR
BURNDY
```

Os resultados nunca compartilham linha, referencia ou codigo entre
fabricantes. Internamente, todas as bases sao normalizadas para:

```text
fabricante, linha, produto, dimensao, referencia,
acabamento, codigoFinal, pagina, confianca
```

O ranking manual usa ate 100 pontos:

- produto similar: 30;
- dimensao correta: 25;
- linha ou familia correta: 20;
- acabamento correto: 15;
- referencia ou codigo parcial: 10.

Por padrao, todos os catalogos sao pesquisados. Os checkboxes da tela permitem
limitar a consulta a fabricantes especificos.

## Busca Ciser

A busca prioriza:

1. linha do catalogo;
2. descricao do produto;
3. dimensao;
4. acabamento;
5. rosca ou material.

Para linhas com codigo composto, o aplicativo valida a combinacao real
`linha + referencia + acabamento` na base extraida. Ele nao cria codigos que
nao estejam cadastrados no catalogo.

## Busca DAISA

Os produtos DAISA sao pesquisados por familia, descricao e dimensao. Nas
familias roscadas, o sistema tambem considera o padrao informado:

- `BSP`: acrescenta o prefixo `B -`;
- `NPT`: acrescenta o prefixo `N -`;
- sem rosca: mantem o codigo publicado na tabela.

Exemplos reconhecidos:

```text
Uniao reta com rosca 3/4 BSP -> B - URR 034
Bucha de reducao 3/4 x 1/2 -> BRR 034 x 012
Derivacao final 3/4 -> DF 034
Curva 90 graus 1 polegada -> C90 100 DS
```

## Busca Elecon

Os codigos Elecon sao lidos diretamente das tabelas do catalogo. A busca
prioriza codigo exato, familia, nome do produto, dimensao e acabamento ou
sistema.

Exemplos reconhecidos:

```text
Eletroduto medio eletrolitico 3/4 -> EC-EDE 22
Curva horizontal 90 graus para eletrocalha -> EC-CAC 1
Perfilado perfurado 38 x 38 -> EC-PEP 38
Condulete fixo C 3/4 -> 56101/082
Bucha de reducao aluminio BSP 3/4 x 1/2 -> 56124001
Caixa de passagem 200 x 200 x 100 -> CP-2020
```

## Busca ArcelorMittal

Os perfis ArcelorMittal sao pesquisados pela familia e pelas dimensoes
publicadas nas tabelas. Como o catalogo nao apresenta um SKU comercial para
essas tabelas, o codigo final e a propria designacao tecnica oficial.

Exemplos reconhecidos:

```text
Cantoneira 40 x 40 x 3 mm -> L 40,00 x 40,00 x 3,00 mm - 1,85 kg/m
Perfil U 4 x 2 alma -> U 4" x 2ª alma - 9,30 kg/m
Perfil I 6 x 2 alma -> I 6" x 2ª alma - 22,00 kg/m
Perfil W 150 x 13 -> W 150 x 13
```

## Busca BURNDY

As referencias BURNDY sao lidas diretamente das tabelas do catalogo. A busca
prioriza codigo exato, familia, descricao do produto e bitola ou faixa de
condutor.

Exemplos reconhecidos:

```text
Parafuso fendido bimetalico KSU 35-50 mm2 -> KSU25
Terminal a compressao flexivel 50 mm2 -> YAL50-FLEX-SG1
Codigo exato YGHC26C2 -> YGHC26C2
```

## Preservacao do Excel

A exportacao nao cria outra planilha. O aplicativo mantem o arquivo original
em memoria e altera cirurgicamente somente os valores das celulas da coluna
`Observacoes`.

A coluna e localizada por busca flexivel em toda a aba, ignorando acentos,
espacos extras e a posicao da linha de cabecalho. Nenhum indice fixo e usado.

As demais partes do arquivo nao sao reconstruidas: abas, formulas, estilos,
larguras, alturas, mesclagens, imagens, filtros, paineis congelados,
visualizacoes e configuracoes de impressao permanecem no pacote original.
Quando nao ha correspondencia, a celula recebe somente `N/E`.

O arquivo exportado se chama `planilha_preenchida_ciser.xlsx`, preservando a
compatibilidade com o fluxo existente.

## Arquivos

- `index.html`: estrutura da interface;
- `style.css`: layout responsivo;
- `script.js`: importacao, busca, cruzamento e exportacao;
- `catalogo-data.js`: base Ciser extraida;
- `catalogo-daisa-data.js`: base DAISA extraida;
- `catalogo-elecon-data.js`: base Elecon extraida;
- `catalogo-arcelor-data.js`: base ArcelorMittal extraida;
- `catalogo-burndy-data.js`: base BURNDY extraida;
- `catalogo-geral-ciser-2026.pdf`: catalogo Ciser;
- `catalogo-DAISA.pdf`: catalogo DAISA;
- `catalogo-elecon.pdf`: catalogo Elecon;
- `catalogo-arcelor.pdf`: catalogo de perfis ArcelorMittal;
- `catalogo-burndy.pdf`: catalogo BURNDY;
- `../work/extract_catalog_detailed.mjs`: extrator Ciser;
- `../work/extract_daisa_catalog.mjs`: extrator DAISA;
- `../work/extract_elecon_catalog.mjs`: extrator Elecon;
- `../work/extract_arcelor_catalog.mjs`: extrator ArcelorMittal;
- `../work/extract_burndy_catalog.mjs`: extrator BURNDY;
- `../work/test_match.mjs`: testes automatizados.

## Bases atuais

- Ciser: 441 fichas e 6.402 TAGs unicas;
- DAISA: 52 familias e 977 variantes.
- Elecon: 766 referencias extraidas.
- ArcelorMittal: 4 familias e 215 combinacoes tecnicas.
- BURNDY: 877 referencias extraidas.

Todos os dados da planilha sao processados localmente no navegador. Nenhum
arquivo e enviado para um servidor.
