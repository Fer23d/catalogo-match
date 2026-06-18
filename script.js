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

const FAVORITES_STORAGE_KEY = "catalogo-match-favorites-v1";
const MAX_SUGGESTIONS = 8;

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
  suggestions: document.querySelector("#autocomplete-suggestions"),
  showResults: document.querySelector("#show-results"),
  showFavorites: document.querySelector("#show-favorites"),
  favoriteCount: document.querySelector("#favorite-count"),
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

function entryKey(entry) {
  return [
    entry.fabricante,
    normalizeCode(entry.codigoFinal),
    normalizeCode(entry.produto),
    normalizeCode(entry.dimensao),
    normalizeCode(entry.acabamento)
  ].join("|");
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
          entry.key = entryKey(entry);
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
const ENTRY_BY_KEY = new Map(
  Object.values(SEARCH_INDEX)
    .flat()
    .map((entry) => [entry.key, entry])
);

let currentGroupedResults = {};
let activeView = "results";
let favorites = loadFavorites();

function loadFavorites() {
  try {
    if (typeof localStorage === "undefined") return [];
    const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((key) => ENTRY_BY_KEY.has(key)) : [];
  } catch (error) {
    return [];
  }
}

function saveFavorites() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

function isFavorite(key) {
  return favorites.includes(key);
}

function updateFavoriteCount() {
  elements.favoriteCount.textContent = formatNumber(favorites.length);
}

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

function suggestionLabel(entry) {
  return unique([
    entry.produto,
    entry.dimensao,
    entry.acabamento
  ]).join(" ");
}

function autocompleteSuggestions(value) {
  const queryText = normalizar(value);
  if (queryText.length < 2) return [];
  const grouped = searchCatalogs({
    text: value,
    dimension: "",
    finish: "",
    combined: value
  }, {
    manufacturers: selectedManufacturers(),
    limitPerManufacturer: 4
  });

  const seen = new Set();
  return Object.values(grouped)
    .flat()
    .sort((left, right) => right.score - left.score)
    .map((entry) => ({
      label: suggestionLabel(entry),
      fabricante: entry.fabricante,
      codigoFinal: entry.codigoFinal,
      score: entry.score
    }))
    .filter((item) => {
      const key = normalizar(`${item.label} ${item.fabricante}`);
      if (!item.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SUGGESTIONS);
}

function hideSuggestions() {
  elements.suggestions.hidden = true;
  elements.suggestions.innerHTML = "";
}

function renderSuggestions() {
  const suggestions = autocompleteSuggestions(elements.description.value);
  if (!suggestions.length) {
    hideSuggestions();
    return;
  }

  elements.suggestions.hidden = false;
  elements.suggestions.innerHTML = suggestions.map((suggestion) => `
    <button
      class="autocomplete-option"
      type="button"
      role="option"
      data-query="${escapeHtml(suggestion.label)}"
    >
      <strong>${escapeHtml(suggestion.label)}</strong>
      <span>${escapeHtml(suggestion.fabricante)}${suggestion.codigoFinal ? ` · ${escapeHtml(suggestion.codigoFinal)}` : ""} · ${suggestion.score}%</span>
    </button>
  `).join("");
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function confidenceClass(score) {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function abrirCatalogo(produto) {
  const url = produto.pdfUrl;
  const pagina = produto.paginaPdf || produto.pagina;
  if (!url) return;
  const termoOuReferencia = [
    produto.codigoFinal,
    produto.referencia,
    produto.dimensao,
    produto.linha,
    produto.acabamento,
    produto.produto
  ].filter(Boolean).join(" | ");
  const viewerUrl = new URL("catalog-viewer.html", window.location.href);
  viewerUrl.searchParams.set("pdf", url);
  if (pagina) viewerUrl.searchParams.set("page", pagina);
  if (produto.pagina) viewerUrl.searchParams.set("pageLabel", produto.pagina);
  if (termoOuReferencia) viewerUrl.searchParams.set("term", termoOuReferencia);
  if (produto.codigoFinal) viewerUrl.searchParams.set("code", produto.codigoFinal);
  if (produto.referencia) viewerUrl.searchParams.set("reference", produto.referencia);
  if (produto.dimensao) viewerUrl.searchParams.set("dimension", produto.dimensao);
  if (produto.linha) viewerUrl.searchParams.set("line", produto.linha);
  if (produto.acabamento) viewerUrl.searchParams.set("finish", produto.acabamento);
  if (produto.fabricante) viewerUrl.searchParams.set("manufacturer", produto.fabricante);
  if (produto.produto) viewerUrl.searchParams.set("product", produto.produto);
  window.open(viewerUrl.toString(), "_blank", "noopener");
}

function openCatalogFromButton(button) {
  const produto = {
    fabricante: button.dataset.fabricante || "",
    produto: button.dataset.produto || "",
    codigoFinal: button.dataset.codigo || "",
    referencia: button.dataset.referencia || "",
    dimensao: button.dataset.dimensao || "",
    linha: button.dataset.linha || "",
    acabamento: button.dataset.acabamento || "",
    pagina: button.dataset.pagina || "",
    paginaPdf: button.dataset.paginaPdf || "",
    pdfUrl: button.dataset.pdfUrl || ""
  };
  abrirCatalogo(produto);
  if (produto.codigoFinal) {
    elements.feedback.textContent =
      `Viewer do catálogo aberto em nova aba. O sistema vai tentar destacar ` +
      `o código ${produto.codigoFinal} na página renderizada.`;
  }
}

function rerenderActiveView() {
  updateFavoriteCount();
  if (activeView === "favorites") {
    renderFavorites();
    return;
  }
  if (Object.keys(currentGroupedResults).length) renderGroupedResults(currentGroupedResults);
}

function toggleFavorite(key) {
  if (!ENTRY_BY_KEY.has(key)) return;
  if (isFavorite(key)) {
    favorites = favorites.filter((favoriteKey) => favoriteKey !== key);
    elements.feedback.textContent = "Produto removido dos favoritos.";
  } else {
    favorites = [key, ...favorites];
    elements.feedback.textContent = "Produto adicionado aos favoritos.";
  }
  saveFavorites();
  rerenderActiveView();
}

async function copyCode(code) {
  if (!code) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = code;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      document.execCommand("copy");
      temporary.remove();
    }
    elements.feedback.textContent = "Código copiado!";
  } catch (error) {
    elements.feedback.textContent = `Não foi possível copiar automaticamente. Código: ${code}`;
  }
}

function renderResultCard(result) {
  const canOpenCatalog = Boolean(result.pdfUrl);
  const favorite = isFavorite(result.key);
  const code = result.codigoFinal || "";
  return `
    <article class="manual-result-card" data-entry-key="${escapeHtml(result.key)}">
      <div class="result-card-heading">
        <div>
          <strong>${escapeHtml(result.produto || "Produto sem título")}</strong>
          <span>${escapeHtml(result.fabricante)} · Página ${escapeHtml(result.pagina || "—")}</span>
        </div>
        <div class="card-top-actions">
          <button
            class="favorite-button ${favorite ? "active" : ""}"
            type="button"
            data-entry-key="${escapeHtml(result.key)}"
            aria-label="${favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
            title="${favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
          >${favorite ? "★" : "☆"}</button>
          <span class="confidence ${confidenceClass(result.score)}">${result.score}%</span>
        </div>
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
      <div class="result-actions">
        ${code
          ? `<button
              class="copy-code-button"
              type="button"
              data-code="${escapeHtml(code)}"
            >Copiar código</button>`
          : ""}
        ${canOpenCatalog
          ? `<button
            class="catalog-open-button"
            type="button"
            data-fabricante="${escapeHtml(result.fabricante)}"
            data-produto="${escapeHtml(result.produto)}"
            data-codigo="${escapeHtml(result.codigoFinal)}"
            data-referencia="${escapeHtml(result.referencia)}"
            data-dimensao="${escapeHtml(result.dimensao)}"
            data-linha="${escapeHtml(result.linha)}"
            data-acabamento="${escapeHtml(result.acabamento)}"
            data-pagina="${escapeHtml(result.pagina)}"
            data-pagina-pdf="${escapeHtml(result.paginaPdf)}"
            data-pdf-url="${escapeHtml(result.pdfUrl)}"
          >Abrir no catálogo</button>`
          : ""}
      </div>
    </article>
  `;
}

function groupEntriesByManufacturer(entries) {
  const grouped = Object.fromEntries(MANUFACTURERS.map((fabricante) => [fabricante, []]));
  entries.forEach((entry) => {
    if (!grouped[entry.fabricante]) grouped[entry.fabricante] = [];
    grouped[entry.fabricante].push(entry);
  });
  return grouped;
}

function favoriteResult(entry) {
  return {
    ...entry,
    score: 100,
    breakdown: {
      produto: 40,
      dimensao: 25,
      linha: 20,
      acabamento: 15,
      codigo: 0
    }
  };
}

function renderGroupedResults(grouped, options = {}) {
  const total = Object.values(grouped).flat().length;
  if (options.mode === "favorites") {
    elements.feedback.textContent = total
      ? `${total} favoritos salvos, separados por fabricante.`
      : "Nenhum favorito salvo ainda. Use a estrela em um resultado para salvar produtos aqui.";
  } else {
    elements.feedback.textContent = total
      ? `${total} resultados encontrados, separados por fabricante e ordenados por relevância.`
      : "Nenhum resultado encontrado. Tente informar outro termo, dimensão, linha ou código parcial.";
  }

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

function renderFavorites() {
  const favoriteEntries = favorites
    .map((key) => ENTRY_BY_KEY.get(key))
    .filter(Boolean)
    .map(favoriteResult);
  renderGroupedResults(groupEntriesByManufacturer(favoriteEntries), { mode: "favorites" });
}

function setActiveView(view) {
  activeView = view;
  elements.showResults.classList.toggle("active", view === "results");
  elements.showFavorites.classList.toggle("active", view === "favorites");
  if (view === "favorites") {
    renderFavorites();
    return;
  }
  if (Object.keys(currentGroupedResults).length) {
    renderGroupedResults(currentGroupedResults);
    return;
  }
  elements.feedback.textContent = "Informe uma busca para consultar todos os catálogos.";
  elements.results.innerHTML = "";
}

function selectedManufacturers() {
  return [...document.querySelectorAll('input[name="manual-manufacturer"]:checked')]
    .map((input) => input.value);
}

function runManualSearch() {
  const query = buildQuery();
  if (!normalizar(query.combined)) {
    currentGroupedResults = {};
    activeView = "results";
    elements.showResults.classList.add("active");
    elements.showFavorites.classList.remove("active");
    elements.feedback.textContent = "Informe uma busca para consultar todos os catálogos.";
    elements.results.innerHTML = "";
    return;
  }
  const grouped = searchCatalogs(query, {
    manufacturers: selectedManufacturers(),
    limitPerManufacturer: 10
  });
  currentGroupedResults = grouped;
  setActiveView("results");
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
  currentGroupedResults = {};
  setActiveView("results");
  elements.results.innerHTML = "";
  elements.feedback.textContent = "Informe uma busca para consultar todos os catálogos.";
  hideSuggestions();
  elements.description.focus();
});

elements.description.addEventListener("input", renderSuggestions);
elements.description.addEventListener("focus", renderSuggestions);
elements.description.addEventListener("blur", () => {
  window.setTimeout(hideSuggestions, 140);
});

elements.suggestions.addEventListener("mousedown", (event) => {
  const option = event.target.closest(".autocomplete-option");
  if (!option) return;
  elements.description.value = option.dataset.query;
  hideSuggestions();
  runManualSearch();
});

elements.showResults.addEventListener("click", () => setActiveView("results"));
elements.showFavorites.addEventListener("click", () => setActiveView("favorites"));

document.querySelectorAll('input[name="manual-manufacturer"]').forEach((input) => {
  input.addEventListener("change", () => {
    renderSuggestions();
    if (normalizar(buildQuery().combined)) runManualSearch();
  });
});

elements.examples.forEach((button) => {
  button.addEventListener("click", () => {
    elements.description.value = button.dataset.query;
    elements.dimension.value = "";
    elements.finish.value = "";
    hideSuggestions();
    runManualSearch();
  });
});

elements.results.addEventListener("click", async (event) => {
  const button = event.target.closest(".catalog-open-button");
  if (button) {
    openCatalogFromButton(button);
    return;
  }

  const copyButton = event.target.closest(".copy-code-button");
  if (copyButton) {
    await copyCode(copyButton.dataset.code || "");
    return;
  }

  const favoriteButton = event.target.closest(".favorite-button");
  if (favoriteButton) toggleFavorite(favoriteButton.dataset.entryKey || "");
});

initializeSummary();
updateFavoriteCount();
