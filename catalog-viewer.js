import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.mjs";

const params = new URLSearchParams(window.location.search);
const HIGHLIGHT_MIN_SCORE = 70;

const state = {
  pdf: params.get("pdf") || "",
  page: Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1),
  pageLabel: params.get("pageLabel") || "",
  term: params.get("term") || "",
  code: params.get("code") || "",
  reference: params.get("reference") || "",
  dimension: params.get("dimension") || "",
  line: params.get("line") || "",
  finish: params.get("finish") || "",
  manufacturer: params.get("manufacturer") || "",
  product: params.get("product") || "",
  pdfDoc: null,
  currentPage: 1,
  scale: 1.5,
  renderTask: null,
  pageAutoResolved: false
};

const elements = {
  title: document.querySelector("#viewer-title"),
  subtitle: document.querySelector("#viewer-subtitle"),
  status: document.querySelector("#viewer-status"),
  pageIndicator: document.querySelector("#page-indicator"),
  previous: document.querySelector("#previous-page"),
  next: document.querySelector("#next-page"),
  original: document.querySelector("#open-original-pdf"),
  canvas: document.querySelector("#pdf-canvas"),
  wrapper: document.querySelector("#pdf-page-wrap"),
  textLayer: document.querySelector("#text-layer"),
  highlights: document.querySelector("#highlight-layer")
};

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value) {
  return normalizar(value).replace(/[^a-z0-9]/g, "");
}

function tokenize(value) {
  return normalizar(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !["com", "para", "dos", "das"].includes(token));
}

function extractDimensionTokens(value) {
  const text = normalizar(value)
    .replace(/\s*x\s*/g, "x")
    .replace(/\s*\/\s*/g, "/");
  const patterns = [
    /\bm\d+\b/g,
    /\b\d+(?:\.\d+)?x\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)?\b/g,
    /\b\d{1,2}\/\d{1,2}\b/g,
    /\b\d+(?:\.\d+)?mm2?\b/g,
    /\b\d+(?:\.\d+)?kv\b/g
  ];
  return [...new Set(patterns.flatMap((pattern) => text.match(pattern) || []))];
}

function clampPage(pageNumber) {
  if (!state.pdfDoc) return Math.max(1, pageNumber);
  return Math.min(Math.max(1, pageNumber), state.pdfDoc.numPages);
}

function updateStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.dataset.type = type;
}

function updateHeader() {
  elements.title.textContent = state.product || "Produto do catálogo";
  elements.subtitle.textContent = [
    state.manufacturer,
    state.code ? `Código ${state.code}` : "",
    state.reference ? `Referência ${state.reference}` : "",
    state.dimension ? `Dimensão ${state.dimension}` : "",
    state.pageLabel ? `Página do catálogo ${state.pageLabel}` : "",
    state.currentPage ? `Página PDF ${state.currentPage}` : ""
  ].filter(Boolean).join(" · ") || "Renderização com PDF.js";
  elements.original.href = state.pdf || "#";
}

function textItemBounds(item, viewport) {
  const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const fontHeight = Math.hypot(transform[2], transform[3]) || Math.abs(transform[3]) || 10;
  const width = Math.max(3, (item.width || String(item.str || "").length * 4) * viewport.scale);
  return {
    left: transform[4],
    top: transform[5] - fontHeight,
    width,
    height: Math.max(8, fontHeight)
  };
}

function unionBounds(boundsList) {
  const left = Math.min(...boundsList.map((bounds) => bounds.left));
  const top = Math.min(...boundsList.map((bounds) => bounds.top));
  const right = Math.max(...boundsList.map((bounds) => bounds.left + bounds.width));
  const bottom = Math.max(...boundsList.map((bounds) => bounds.top + bounds.height));
  return { left, top, width: right - left, height: bottom - top };
}

function renderTextLayer(textContent, viewport) {
  elements.textLayer.innerHTML = "";
  return textContent.items
    .filter((item) => normalizar(item.str))
    .map((item) => {
      const bounds = textItemBounds(item, viewport);
      const span = document.createElement("span");
      span.textContent = item.str;
      span.style.left = `${bounds.left}px`;
      span.style.top = `${bounds.top}px`;
      span.style.width = `${bounds.width}px`;
      span.style.height = `${bounds.height}px`;
      elements.textLayer.appendChild(span);
      return {
        item,
        text: String(item.str || ""),
        normalized: normalizar(item.str),
        code: normalizeCode(item.str),
        bounds
      };
    });
}

function groupTextItemsByLine(positionedItems) {
  const sorted = [...positionedItems].sort((left, right) =>
    left.bounds.top - right.bounds.top || left.bounds.left - right.bounds.left);
  const lines = [];

  sorted.forEach((item) => {
    const centerY = item.bounds.top + item.bounds.height / 2;
    const line = lines.find((candidate) =>
      Math.abs(candidate.centerY - centerY) <= Math.max(5, item.bounds.height * 0.7));

    if (line) {
      line.items.push(item);
      line.centerY = (line.centerY * (line.items.length - 1) + centerY) / line.items.length;
    } else {
      lines.push({ centerY, items: [item] });
    }
  });

  return lines.map((line) => {
    const items = line.items.sort((left, right) => left.bounds.left - right.bounds.left);
    const text = items.map((item) => item.text).join(" ");
    return {
      items,
      text,
      normalized: normalizar(text),
      code: normalizeCode(text),
      bounds: unionBounds(items.map((item) => item.bounds))
    };
  });
}

function itemsContainingCode(line, value) {
  const code = normalizeCode(value);
  if (!code) return [];
  return line.items.filter((item) =>
    item.code.length >= 2 &&
    (item.code.includes(code) || (code.length >= 4 && code.includes(item.code))));
}

function itemsContainingTokens(line, tokens) {
  if (!tokens.length) return [];
  return line.items.filter((item) =>
    item.normalized.length >= 3 &&
    tokens.some((token) => item.normalized.includes(token) || token.includes(item.normalized)));
}

function scoreLine(line) {
  const matchedItems = [];
  const breakdown = { codigo: 0, referencia: 0, descricao: 0, dimensao: 0 };

  const codeMatches = itemsContainingCode(line, state.code);
  if (state.code && line.code.includes(normalizeCode(state.code))) {
    breakdown.codigo = 50;
    matchedItems.push(...codeMatches);
  }

  const referenceCode = normalizeCode(state.reference);
  const referenceMatches = itemsContainingCode(line, state.reference);
  if (referenceCode.length >= 2 && line.code.includes(referenceCode)) {
    breakdown.referencia = 30;
    matchedItems.push(...referenceMatches);
  }

  const descriptionTokens = tokenize(state.product)
    .filter((token) => !/^\d+$/.test(token))
    .slice(0, 8);
  const descriptionMatches = itemsContainingTokens(line, descriptionTokens);
  const descriptionCoverage = descriptionTokens.length
    ? descriptionTokens.filter((token) => line.normalized.includes(token)).length / descriptionTokens.length
    : 0;
  if (descriptionCoverage >= 0.35) {
    breakdown.descricao = 20;
    matchedItems.push(...descriptionMatches);
  }

  const dimensionTokens = extractDimensionTokens(state.dimension);
  const dimensionMatches = itemsContainingTokens(line, dimensionTokens);
  const dimensionCoverage = dimensionTokens.length
    ? dimensionTokens.filter((token) => line.normalized.includes(token)).length / dimensionTokens.length
    : 0;
  if (dimensionCoverage >= 1) {
    breakdown.dimensao = 20;
    matchedItems.push(...dimensionMatches);
  }

  const score = breakdown.codigo + breakdown.referencia + breakdown.descricao + breakdown.dimensao;
  const uniqueItems = [...new Map(matchedItems.map((item) => [item.item, item])).values()];
  return {
    type: "line",
    line,
    score,
    breakdown,
    matchedItems: uniqueItems.length ? uniqueItems : line.items
  };
}

function descriptionCoverage(normalizedText) {
  const descriptionTokens = tokenize(state.product)
    .filter((token) => !/^\d+$/.test(token))
    .slice(0, 8);
  return descriptionTokens.length
    ? descriptionTokens.filter((token) => normalizedText.includes(token)).length / descriptionTokens.length
    : 0;
}

function nearestByColumn(sourceItem, candidates) {
  return candidates
    .map((candidate) => ({
      item: candidate,
      distance: Math.abs(candidate.bounds.left - sourceItem.bounds.left)
    }))
    .sort((left, right) => left.distance - right.distance)[0];
}

function scoreTableColumn(positionedItems, pageContext) {
  const breakdown = { codigo: 0, referencia: 0, descricao: 0, dimensao: 0 };
  const referenceItems = itemsContainingCode({ items: positionedItems }, state.reference);
  const dimensionItems = itemsContainingTokens({ items: positionedItems }, extractDimensionTokens(state.dimension));
  const exactCodeItems = itemsContainingCode({ items: positionedItems }, state.code)
    .filter((item) => item.code.includes(normalizeCode(state.code)));

  const refCode = normalizeCode(state.reference);
  if (exactCodeItems.length) breakdown.codigo = 50;
  if (refCode.length >= 2 && referenceItems.length) breakdown.referencia = 30;
  if (descriptionCoverage(pageContext.normalized) >= 0.35) breakdown.descricao = 20;
  if (dimensionItems.length) breakdown.dimensao = 20;

  const generatedCodeCanBeLocated =
    !exactCodeItems.length &&
    state.code &&
    refCode &&
    normalizeCode(state.code).includes(refCode) &&
    referenceItems.length &&
    dimensionItems.length;
  if (generatedCodeCanBeLocated) breakdown.codigo = 50;

  let matchedItems = exactCodeItems;
  if (!matchedItems.length && referenceItems.length && dimensionItems.length) {
    const pairs = referenceItems.map((referenceItem) => ({
      referenceItem,
      dimensionMatch: nearestByColumn(referenceItem, dimensionItems)
    })).filter((pair) => pair.dimensionMatch);
    const bestPair = pairs.sort((left, right) =>
      left.dimensionMatch.distance - right.dimensionMatch.distance)[0];
    if (bestPair && bestPair.dimensionMatch.distance <= 90) {
      matchedItems = [bestPair.referenceItem, bestPair.dimensionMatch.item];
    }
  }
  if (!matchedItems.length) matchedItems = [...referenceItems, ...dimensionItems].slice(0, 4);

  return {
    type: "table-column",
    line: {
      text: pageContext.text,
      bounds: matchedItems.length
        ? unionBounds(matchedItems.map((item) => item.bounds))
        : unionBounds(positionedItems.map((item) => item.bounds)),
      items: positionedItems
    },
    score: breakdown.codigo + breakdown.referencia + breakdown.descricao + breakdown.dimensao,
    breakdown,
    matchedItems
  };
}

function pageContext(positionedItems) {
  const text = positionedItems.map((item) => item.text).join(" ");
  return {
    text,
    normalized: normalizar(text),
    code: normalizeCode(text)
  };
}

function bestPositionalMatch(positionedItems) {
  const context = pageContext(positionedItems);
  const lineMatch = groupTextItemsByLine(positionedItems)
    .map(scoreLine)
    .sort((left, right) =>
      right.score - left.score ||
      right.breakdown.codigo - left.breakdown.codigo ||
      right.breakdown.referencia - left.breakdown.referencia)[0];
  const tableMatch = scoreTableColumn(positionedItems, context);
  return [lineMatch, tableMatch]
    .filter(Boolean)
    .sort((left, right) =>
      right.score - left.score ||
      right.breakdown.codigo - left.breakdown.codigo ||
      right.breakdown.referencia - left.breakdown.referencia)[0];
}

function scorePageText(text) {
  const normalized = normalizar(text);
  const code = normalizeCode(text);
  const breakdown = { pagina: 0, codigo: 0, referencia: 0, descricao: 0, dimensao: 0 };

  const pageLabel = normalizeCode(state.pageLabel);
  if (pageLabel && code.includes(pageLabel)) breakdown.pagina = 50;

  const exactCode = normalizeCode(state.code);
  if (exactCode && code.includes(exactCode)) breakdown.codigo = 50;

  const reference = normalizeCode(state.reference);
  if (reference.length >= 2 && code.includes(reference)) breakdown.referencia = 30;

  if (descriptionCoverage(normalized) >= 0.35) breakdown.descricao = 20;

  const dimensionTokens = extractDimensionTokens(state.dimension);
  if (dimensionTokens.length && dimensionTokens.every((token) => normalized.includes(token))) {
    breakdown.dimensao = 20;
  }

  return {
    score: breakdown.pagina + breakdown.codigo + breakdown.referencia +
      breakdown.descricao + breakdown.dimensao,
    breakdown
  };
}

async function findBestPhysicalPage() {
  if (!state.pdfDoc) return null;
  updateStatus("Procurando página física correta no PDF pela camada de texto...");
  let best = { pageNumber: state.currentPage, score: 0, breakdown: {} };

  for (let pageNumber = 1; pageNumber <= state.pdfDoc.numPages; pageNumber += 1) {
    const page = await state.pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");
    const candidate = scorePageText(text);
    if (candidate.score > best.score) {
      best = { pageNumber, ...candidate };
    }
    if (candidate.score >= 100) break;
  }

  return best.score >= 70 ? best : null;
}

function desenharHighlight(x, y, width, height, label = "Produto encontrado") {
  const marker = document.createElement("div");
  marker.className = "pdf-highlight";
  marker.title = label;
  marker.style.left = `${Math.max(0, x - 3)}px`;
  marker.style.top = `${Math.max(0, y - 3)}px`;
  marker.style.width = `${width + 6}px`;
  marker.style.height = `${height + 6}px`;
  elements.highlights.appendChild(marker);
  return marker;
}

function focusFirstHighlight(marker) {
  window.setTimeout(() => {
    marker.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, 80);
}

function destacarProduto(positionedItems) {
  elements.highlights.innerHTML = "";
  const match = bestPositionalMatch(positionedItems);

  if (!match || match.score <= HIGHLIGHT_MIN_SCORE) {
    updateStatus(
      `Página renderizada, mas nenhum trecho passou do score mínimo (${HIGHLIGHT_MIN_SCORE}). ` +
        `Melhor score: ${match?.score || 0}. Use o PDF original para busca manual pelo código.`,
      "warning"
    );
    return { score: match?.score || 0, highlighted: 0 };
  }

  const bounds = unionBounds(match.matchedItems.map((item) => item.bounds));
  const marker = desenharHighlight(
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    `Score ${match.score}: ${match.line.text}`
  );
  marker.classList.add("primary-highlight");
  focusFirstHighlight(marker);

  updateStatus(
    `Produto destacado com score ${match.score} ` +
      `(código ${match.breakdown.codigo}, referência ${match.breakdown.referencia}, ` +
      `descrição ${match.breakdown.descricao}, dimensão ${match.breakdown.dimensao}).`,
    "success"
  );
  return { score: match.score, highlighted: 1, breakdown: match.breakdown };
}

async function renderizarCanvas(page, viewport) {
  const context = elements.canvas.getContext("2d");
  elements.canvas.width = Math.floor(viewport.width);
  elements.canvas.height = Math.floor(viewport.height);
  elements.canvas.style.width = `${viewport.width}px`;
  elements.canvas.style.height = `${viewport.height}px`;
  elements.wrapper.style.width = `${viewport.width}px`;
  elements.wrapper.style.height = `${viewport.height}px`;
  elements.textLayer.style.width = `${viewport.width}px`;
  elements.textLayer.style.height = `${viewport.height}px`;
  elements.highlights.style.width = `${viewport.width}px`;
  elements.highlights.style.height = `${viewport.height}px`;
  elements.highlights.innerHTML = "";

  if (state.renderTask) state.renderTask.cancel();
  state.renderTask = page.render({ canvasContext: context, viewport });
  await state.renderTask.promise;
  state.renderTask = null;
}

async function renderPage(pageNumber) {
  if (!state.pdfDoc) return;
  const page = await state.pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(320, elements.wrapper.parentElement.clientWidth - 32);
  state.scale = Math.min(2, Math.max(1.15, availableWidth / baseViewport.width));
  const viewport = page.getViewport({ scale: state.scale });

  await renderizarCanvas(page, viewport);
  const textContent = await page.getTextContent();
  const positionedItems = renderTextLayer(textContent, viewport);
  const highlightResult = destacarProduto(positionedItems);

  if (highlightResult.score <= HIGHLIGHT_MIN_SCORE && !state.pageAutoResolved) {
    state.pageAutoResolved = true;
    const betterPage = await findBestPhysicalPage();
    if (betterPage && betterPage.pageNumber !== pageNumber) {
      updateStatus(
        `Página lógica localizada na página física ${betterPage.pageNumber}. ` +
          `Renderizando novamente para destacar o produto...`
      );
      await irParaPagina(betterPage.pageNumber);
      return;
    }
  }

  elements.pageIndicator.textContent = `Página ${pageNumber} / ${state.pdfDoc.numPages}`;
  elements.previous.disabled = pageNumber <= 1;
  elements.next.disabled = pageNumber >= state.pdfDoc.numPages;
}

async function irParaPagina(pageNumber) {
  state.currentPage = clampPage(pageNumber);
  updateHeader();
  updateStatus(`Renderizando página ${state.currentPage} e extraindo textLayer...`);
  await renderPage(state.currentPage);
}

async function carregarPDF(pdfUrl) {
  if (!pdfUrl) {
    updateStatus("Nenhum PDF foi informado para o viewer.", "error");
    return;
  }

  updateHeader();
  updateStatus("Carregando PDF com PDF.js...");
  try {
    state.pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
    await irParaPagina(state.page);
  } catch (error) {
    console.error(error);
    updateStatus(
      "Não foi possível carregar o PDF no viewer. Abra o PDF original e use a busca pelo código.",
      "error"
    );
  }
}

async function abrirCatalogoComDestaque(produto) {
  state.pdf = produto.pdfUrl || state.pdf;
  state.page = Math.max(1, Number.parseInt(produto.pagina || state.page, 10) || 1);
  state.code = produto.codigoFinal || state.code;
  state.reference = produto.referencia || state.reference;
  state.dimension = produto.dimensao || state.dimension;
  state.product = produto.produto || state.product;
  state.manufacturer = produto.fabricante || state.manufacturer;
  await carregarPDF(state.pdf);
}

elements.previous.addEventListener("click", () => irParaPagina(state.currentPage - 1));
elements.next.addEventListener("click", () => irParaPagina(state.currentPage + 1));
window.addEventListener("resize", () => {
  window.clearTimeout(window.__catalogViewerResize);
  window.__catalogViewerResize = window.setTimeout(() => irParaPagina(state.currentPage), 180);
});

window.carregarPDF = carregarPDF;
window.irParaPagina = irParaPagina;
window.destacarProduto = destacarProduto;
window.desenharHighlight = desenharHighlight;
window.abrirCatalogoComDestaque = abrirCatalogoComDestaque;

carregarPDF(state.pdf);
