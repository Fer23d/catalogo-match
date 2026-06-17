/* global CATALOGO_PRODUTOS, CATALOGO_DAISA_PRODUTOS, CATALOGO_ELECON_PRODUTOS, CATALOGO_ARCELOR_PRODUTOS, CATALOGO_BURNDY_PRODUTOS, CATALOGO_INTELLI_PRODUTOS, CATALOGO_SUBESTACOES_PRODUTOS */

const CATALOGS = {
  CISER: typeof CATALOGO_PRODUTOS !== "undefined" ? CATALOGO_PRODUTOS : [],
  ELECON: typeof CATALOGO_ELECON_PRODUTOS !== "undefined" ? CATALOGO_ELECON_PRODUTOS : [],
  DAISA: typeof CATALOGO_DAISA_PRODUTOS !== "undefined" ? CATALOGO_DAISA_PRODUTOS : [],
  ARCELOR: typeof CATALOGO_ARCELOR_PRODUTOS !== "undefined" ? CATALOGO_ARCELOR_PRODUTOS : [],
  BURNDY: typeof CATALOGO_BURNDY_PRODUTOS !== "undefined" ? CATALOGO_BURNDY_PRODUTOS : [],
  INTELLI: typeof CATALOGO_INTELLI_PRODUTOS !== "undefined" ? CATALOGO_INTELLI_PRODUTOS : [],
  SUBESTACOES: typeof CATALOGO_SUBESTACOES_PRODUTOS !== "undefined" ? CATALOGO_SUBESTACOES_PRODUTOS : []
};

const PDF_URL_BY_MANUFACTURER = {
  CISER: "catalogo-geral-ciser-2026.pdf",
  ELECON: "catalogo-elecon.pdf",
  DAISA: "catalogo-DAISA.pdf",
  ARCELOR: "catalogo-arcelor.pdf",
  BURNDY: "catalogo-burndy.pdf",
  INTELLI: "catalogo-intelli.pdf",
  SUBESTACOES: "catalogo-subestacoes.pdf"
};

const MANUFACTURERS = Object.keys(CATALOGS);
const STOP_WORDS = new Set([
  "a", "o", "os", "as", "de", "do", "da", "dos", "das", "e", "em", "para",
  "por", "com", "sem", "the", "of", "for", "and", "produto", "codigo",
  "linha", "catalogo", "modelo", "tipo"
]);

const TOKEN_ALIASES = {
  ac: "aco",
  aço: "aco",
  steel: "aco",
  stainless: "inox",
  ss: "inox",
  inoxidavel: "inox",
  aluminium: "aluminio",
  aluminum: "aluminio",
  al: "aluminio",
  zinc: "zincado",
  zincado: "zincado",
  galvanizado: "zincado",
  galvanizacao: "zincado",
  eletrolitico: "eletrolitica",
  branca: "branco",
  white: "branco",
  black: "preto",
  yellow: "amarelo",
  paraf: "parafuso",
  parafuso: "parafuso",
  screw: "parafuso",
  bolt: "parafuso",
  bolts: "parafuso",
  sext: "sextavado",
  sextav: "sextavado",
  hex: "sextavado",
  hexagonal: "sextavado",
  flange: "flangeado",
  flang: "flangeado",
  arr: "arruela",
  washer: "arruela",
  nut: "porca",
  porcas: "porca",
  rosc: "rosca",
  thread: "rosca",
  threaded: "rosca",
  cab: "cabeca",
  cabeça: "cabeca",
  condulet: "condulete",
  condulete: "condulete",
  conduit: "eletroduto",
  eletrod: "eletroduto",
  perfilado: "perfil",
  profile: "perfil",
  channel: "perfil",
  angle: "cantoneira",
  terminal: "terminal",
  lug: "terminal",
  conector: "conector",
  connector: "conector"
};

const FINISH_WORDS = new Set([
  "zincado", "branco", "preto", "amarelo", "bicromatizado", "galvanizado",
  "eletrolitica", "inox", "304", "316", "aluminio", "cobre", "estanhado",
  "polido", "pvc", "zamak", "fogo", "pre", "natural", "pintado"
]);

const elements = {
  summary: document.querySelector("#database-summary"),
  products: document.querySelector("#stat-products"),
  variants: document.querySelector("#stat-variants"),
  categories: document.querySelector("#stat-categories"),
  form: document.querySelector("#manual-form"),
  description: document.querySelector("#manual-description"),
  dimension: document.querySelector("#manual-dimension"),
  finish: document.querySelector("#manual-finish"),
  clear: document.querySelector("#clear-search"),
  feedback: document.querySelector("#manual-feedback"),
  results: document.querySelector("#manual-results"),
  examples: document.querySelectorAll(".example-searches [data-query]")
};

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°ª]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value) {
  return normalizar(value).replace(/[^a-z0-9]/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function tokenize(value) {
  return normalizar(value)
    .split(/\s+/)
    .map((token) => TOKEN_ALIASES[token] || token)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function tokenMatches(queryToken, candidateToken) {
  if (queryToken === candidateToken) return true;
  if (
    queryToken.length >= 3 &&
    candidateToken.length >= 3 &&
    (queryToken.startsWith(candidateToken) || candidateToken.startsWith(queryToken))
  ) {
    return true;
  }
  const maxDistance = Math.min(queryToken.length, candidateToken.length) >= 7 ? 2 : 1;
  return levenshtein(queryToken, candidateToken) <= maxDistance;
}

function extractDimensionTokens(value) {
  const text = normalizar(value)
    .replace(/\s*x\s*/g, "x")
    .replace(/\s*\/\s*/g, "/");
  const patterns = [
    /\bm\d+\b/g,
    /\b\d+(?:\.\d+)?x\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)?\b/g,
    /(?<![\d.])\d{1,2}\/\d{1,2}\b/g,
    /\b\d+(?:\.\d+)?\s*mm2?\b/g,
    /\b\d+(?:\.\d+)?\s*kv\b/g,
    /\b\d+(?:\.\d+)?\s*(?:pol|polegada|polegadas)\b/g
  ];
  return unique(patterns.flatMap((pattern) => text.match(pattern) || []))
    .map((token) => token.replace(/\s+/g, ""));
}

function extractCodeFragments(value) {
  const raw = String(value ?? "").toLowerCase();
  const originalFragments = raw.match(/[a-z0-9][a-z0-9./-]{2,}/gi) || [];
  const tokenFragments = tokenize(value).filter((token) =>
    token.length >= 3 && (/\d/.test(token) || /^[a-z]{2,10}$/.test(token)));
  return unique([...originalFragments, ...tokenFragments])
    .map(normalizeCode)
    .filter((fragment) => fragment.length >= 2 && !STOP_WORDS.has(fragment));
}

function scoreTokenCoverage(queryTokens, candidateTokens) {
  if (!queryTokens.length) return 0;
  let matched = 0;
  queryTokens.forEach((queryToken) => {
    if (candidateTokens.some((candidateToken) => tokenMatches(queryToken, candidateToken))) {
      matched += 1;
    }
  });
  return matched / queryTokens.length;
}

function variantCode(variant) {
  return variant.tag || variant.codigo || variant.codigoFinal || variant.codigoBase || "";
}

function extractPdfPage(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : "";
}

function normalizeCatalogProduct(product, variant, fabricante) {
  const linha = product.linha || variant.familia || "";
  const dimensao = [variant.dimensao, variant.comprimento]
    .filter(Boolean)
    .join(" x ");
  const acabamento = variant.acabamento || variant.sistema || "";
  const referencia = variant.referencia || variant.familia || "";
  const codigoFinal = variantCode(variant);
  const pagina = variant.paginaCatalogo || product.paginaCatalogo || "";
  const searchableText = [
    fabricante,
    product.nome,
    product.categoria,
    product.rosca,
    product.material,
    linha,
    dimensao,
    acabamento,
    referencia,
    codigoFinal,
    variant.detalhe,
    variant.embalagem,
    variant.acabamentoCodigo
  ].join(" ");

  return {
    fabricante,
    produto: String(product.nome || ""),
    categoria: String(product.categoria || ""),
    linha: String(linha || ""),
    dimensao: String(dimensao || ""),
    acabamento: String(acabamento || ""),
    referencia: String(referencia || ""),
    codigoFinal: String(codigoFinal || ""),
    pagina: String(pagina || ""),
    paginaPdf: extractPdfPage(pagina),
    pdfUrl: PDF_URL_BY_MANUFACTURER[fabricante] || "",
    detalhe: String(variant.detalhe || ""),
    texto: searchableText,
    textoNormalizado: normalizar(searchableText),
    primaryTokens: tokenize([
      fabricante,
      product.nome,
      product.categoria,
      product.rosca,
      product.material,
      linha,
      dimensao,
      acabamento,
      referencia,
      codigoFinal
    ].join(" ")),
    tokens: tokenize(searchableText),
    dimensoes: extractDimensionTokens(searchableText),
    codigoNormalizado: normalizeCode(codigoFinal),
    linhaNormalizada: normalizeCode(linha),
    referenciaNormalizada: normalizeCode(referencia)
  };
}

function buildSearchIndex() {
  return Object.fromEntries(
    MANUFACTURERS.map((fabricante) => {
      const entries = [];
      const seen = new Set();
      CATALOGS[fabricante].forEach((product) => {
        (product.variantes || []).forEach((variant) => {
          const entry = normalizeCatalogProduct(product, variant, fabricante);
          const key = [
            entry.fabricante,
            entry.codigoNormalizado,
            normalizar(entry.produto),
            normalizar(entry.dimensao),
            normalizar(entry.acabamento)
          ].join("|");
          if ((entry.codigoFinal || entry.produto) && !seen.has(key)) {
            seen.add(key);
            entries.push(entry);
          }
        });
      });
      return [fabricante, entries];
    })
  );
}

const SEARCH_INDEX = buildSearchIndex();

function buildQuery() {
  return {
    text: elements.description.value,
    dimension: elements.dimension.value,
    finish: elements.finish.value,
    combined: [
      elements.description.value,
      elements.dimension.value,
      elements.finish.value
    ].join(" ")
  };
}

function scoreEntry(query, entry) {
  const queryTokens = tokenize(query.combined);
  const dimensionTokens = extractDimensionTokens(`${query.text} ${query.dimension}`);
  const finishTokens = tokenize(`${query.text} ${query.finish}`)
    .filter((token) => FINISH_WORDS.has(token));
  const dimensionFragments = new Set(dimensionTokens.map(normalizeCode));
  const codeFragments = extractCodeFragments(query.combined)
    .filter((fragment) => !dimensionFragments.has(fragment));

  const productTokens = queryTokens.filter((token) =>
    !dimensionTokens.includes(token) &&
    !finishTokens.includes(token) &&
    !/^\d+(?:\.\d+)?$/.test(token)
  );
  const primaryCoverage = scoreTokenCoverage(productTokens, entry.primaryTokens);
  const contextCoverage = scoreTokenCoverage(productTokens, entry.tokens);
  let product = Math.max(
    Math.round(40 * primaryCoverage),
    Math.round(25 * contextCoverage)
  );

  const exactCode = codeFragments.some((fragment) =>
    fragment.length >= 3 && fragment === entry.codigoNormalizado);
  const partialCode = codeFragments.some((fragment) =>
    fragment.length >= 3 &&
    (entry.codigoNormalizado.includes(fragment) ||
      entry.referenciaNormalizada.includes(fragment)));
  if (exactCode) product = Math.max(product, 40);

  const candidateDimensions = new Set([
    ...entry.dimensoes,
    ...extractDimensionTokens(`${entry.dimensao} ${entry.detalhe}`)
  ].map(normalizar));
  const dimensionCoverage = dimensionTokens.length
    ? dimensionTokens.filter((token) => candidateDimensions.has(normalizar(token))).length /
      dimensionTokens.length
    : 0;
  const dimensao = Math.round(25 * dimensionCoverage);

  const linha = codeFragments.some((fragment) =>
    fragment.length >= 3 &&
    (entry.linhaNormalizada === fragment ||
      entry.linhaNormalizada.includes(fragment) ||
      entry.referenciaNormalizada === fragment))
    ? 20
    : 0;

  const acabamento = finishTokens.length
    ? Math.round(15 * scoreTokenCoverage(
        finishTokens,
        tokenize(`${entry.acabamento} ${entry.detalhe} ${entry.produto} ${entry.categoria}`)
      ))
    : 0;

  const codigo = exactCode || partialCode ? 10 : 0;
  const rawScore = product + dimensao + linha + acabamento + codigo;
  const score = Math.min(100, rawScore);

  return {
    score,
    breakdown: {
      produto: product,
      dimensao,
      linha,
      acabamento,
      codigo
    }
  };
}

function searchCatalogs(query, options = {}) {
  const limitPerManufacturer = options.limitPerManufacturer || 10;
  const selected = new Set(options.manufacturers?.length
    ? options.manufacturers
    : MANUFACTURERS);
  const orderedManufacturers = MANUFACTURERS.filter((fabricante) => selected.has(fabricante));
  const grouped = Object.fromEntries(orderedManufacturers.map((fabricante) => [fabricante, []]));

  orderedManufacturers.forEach((fabricante) => {
    grouped[fabricante] = SEARCH_INDEX[fabricante]
      .map((entry) => ({ ...entry, ...scoreEntry(query, entry) }))
      .filter((entry) => entry.score >= 10)
      .sort((left, right) =>
        right.score - left.score ||
        right.breakdown.codigo - left.breakdown.codigo ||
        left.codigoFinal.localeCompare(right.codigoFinal))
      .slice(0, limitPerManufacturer);
  });

  return grouped;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function confidenceClass(score) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function abrirCatalogo(produto) {
  const url = produto.pdfUrl;
  const pagina = produto.paginaPdf || produto.pagina;
  const codigo = produto.codigoFinal ? encodeURIComponent(produto.codigoFinal) : "";
  if (!url) return;
  const params = [
    pagina ? `page=${pagina}` : "",
    codigo ? `search=${codigo}` : ""
  ].filter(Boolean).join("&");
  window.open(params ? `${url}#${params}` : url, "_blank", "noopener");
}

function openCatalogFromButton(button) {
  const produto = {
    fabricante: button.dataset.fabricante || "",
    produto: button.dataset.produto || "",
    codigoFinal: button.dataset.codigo || "",
    pagina: button.dataset.pagina || "",
    paginaPdf: button.dataset.paginaPdf || "",
    pdfUrl: button.dataset.pdfUrl || ""
  };
  abrirCatalogo(produto);
  if (produto.codigoFinal) {
    elements.feedback.textContent =
      `Catálogo aberto em nova aba. Se o PDF não navegar direto até a página, ` +
      `use a busca do PDF para localizar o código: ${produto.codigoFinal}.`;
  }
}

function renderResultCard(result) {
  const canOpenCatalog = Boolean(result.pdfUrl);
  return `
    <article class="manual-result-card">
      <div class="result-card-heading">
        <div>
          <strong>${escapeHtml(result.produto || "Produto sem título")}</strong>
          <span>${escapeHtml(result.fabricante)} · Página ${escapeHtml(result.pagina || "—")}</span>
        </div>
        <span class="confidence ${confidenceClass(result.score)}">${result.score} pontos</span>
      </div>
      <dl>
        <div><dt>Fabricante</dt><dd>${escapeHtml(result.fabricante)}</dd></div>
        <div><dt>Linha</dt><dd>${escapeHtml(result.linha || "—")}</dd></div>
        <div><dt>Dimensão</dt><dd>${escapeHtml(result.dimensao || "—")}</dd></div>
        <div><dt>Referência</dt><dd>${escapeHtml(result.referencia || "—")}</dd></div>
        <div><dt>Acabamento</dt><dd>${escapeHtml(result.acabamento || "—")}</dd></div>
        <div><dt>Código final</dt><dd>${escapeHtml(result.codigoFinal || "—")}</dd></div>
      </dl>
      <p class="score-breakdown">
        produto ${result.breakdown.produto} · dimensão ${result.breakdown.dimensao} ·
        linha ${result.breakdown.linha} · acabamento ${result.breakdown.acabamento} ·
        código ${result.breakdown.codigo}
      </p>
      ${canOpenCatalog
        ? `<button
            class="catalog-open-button"
            type="button"
            data-fabricante="${escapeHtml(result.fabricante)}"
            data-produto="${escapeHtml(result.produto)}"
            data-codigo="${escapeHtml(result.codigoFinal)}"
            data-pagina="${escapeHtml(result.pagina)}"
            data-pagina-pdf="${escapeHtml(result.paginaPdf)}"
            data-pdf-url="${escapeHtml(result.pdfUrl)}"
          >Abrir no catálogo</button>`
        : ""}
    </article>
  `;
}

function renderGroupedResults(grouped) {
  const total = Object.values(grouped).flat().length;
  elements.feedback.textContent = total
    ? `${total} resultados encontrados, separados por fabricante e ordenados por relevância.`
    : "Nenhum resultado encontrado. Tente informar outro termo, dimensão, linha ou código parcial.";

  elements.results.innerHTML = Object.keys(grouped).map((fabricante) => {
    const results = grouped[fabricante] || [];
    return `
      <section class="manufacturer-group" data-manufacturer="${fabricante}">
        <header>
          <h3>${escapeHtml(fabricante)}</h3>
          <span>${results.length ? `${results.length} resultados` : "nenhum resultado"}</span>
        </header>
        ${results.length
          ? `<div class="manual-result-grid">${results.map(renderResultCard).join("")}</div>`
          : '<p class="empty-manufacturer">Nenhum resultado neste fabricante.</p>'}
      </section>
    `;
  }).join("");
}

function selectedManufacturers() {
  return [...document.querySelectorAll('input[name="manual-manufacturer"]:checked')]
    .map((input) => input.value);
}

function runManualSearch() {
  const query = buildQuery();
  if (!normalizar(query.combined)) {
    elements.feedback.textContent = "Informe uma busca para consultar todos os catálogos.";
    elements.results.innerHTML = "";
    return;
  }
  const grouped = searchCatalogs(query, {
    manufacturers: selectedManufacturers(),
    limitPerManufacturer: 10
  });
  renderGroupedResults(grouped);
}

function initializeSummary() {
  const allProducts = Object.values(CATALOGS).flat();
  const allEntries = Object.values(SEARCH_INDEX).flat();
  const categories = new Set(allProducts.map((product) => product.categoria).filter(Boolean));
  elements.products.textContent = formatNumber(allProducts.length);
  elements.variants.textContent = formatNumber(allEntries.length);
  elements.categories.textContent = formatNumber(categories.size);
  elements.summary.textContent =
    `${formatNumber(allEntries.length)} códigos em ${MANUFACTURERS.length} catálogos`;
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runManualSearch();
});

elements.clear.addEventListener("click", () => {
  elements.description.value = "";
  elements.dimension.value = "";
  elements.finish.value = "";
  elements.results.innerHTML = "";
  elements.feedback.textContent = "Informe uma busca para consultar todos os catálogos.";
  elements.description.focus();
});

document.querySelectorAll('input[name="manual-manufacturer"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (normalizar(buildQuery().combined)) runManualSearch();
  });
});

elements.examples.forEach((button) => {
  button.addEventListener("click", () => {
    elements.description.value = button.dataset.query;
    elements.dimension.value = "";
    elements.finish.value = "";
    runManualSearch();
  });
});

elements.results.addEventListener("click", (event) => {
  const button = event.target.closest(".catalog-open-button");
  if (button) openCatalogFromButton(button);
});

initializeSummary();
