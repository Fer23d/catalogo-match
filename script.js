/* global XLSX, JSZip, CATALOGO_PRODUTOS, CATALOGO_DAISA_PRODUTOS, CATALOGO_ELECON_PRODUTOS, CATALOGO_ARCELOR_PRODUTOS, CATALOGO_BURNDY_PRODUTOS */

const FIELD_DEFINITIONS = [
  {
    key: "codigoFabricante",
    label: "Código fabricante / linha",
    aliases: ["codigo fabricante", "cod fabricante", "codigo", "linha", "referencia"]
  },
  {
    key: "descricao",
    label: "Descrição",
    aliases: ["descricao", "produto", "nome", "item", "material"],
    required: true
  },
  {
    key: "especificacao",
    label: "Especificação",
    aliases: ["especificacao", "especificações", "detalhes", "caracteristica"]
  },
  {
    key: "material",
    label: "Material",
    aliases: ["material", "materia prima", "composicao"]
  },
  {
    key: "dimensao",
    label: "Dimensão",
    aliases: ["dimensao", "bitola", "diametro", "diâmetro"]
  },
  {
    key: "unidade",
    label: "Unidade",
    aliases: ["unidade", "un", "und", "unit"]
  },
  {
    key: "tamanho",
    label: "Tamanho / comprimento",
    aliases: ["tamanho", "comprimento", "medida", "length"]
  },
  {
    key: "acabamento",
    label: "Acabamento",
    aliases: ["acabamento", "finish", "tratamento", "revestimento"]
  },
  {
    key: "rosca",
    label: "Rosca",
    aliases: ["rosca", "thread", "passo"]
  },
  {
    key: "observacoes",
    label: "Observações (destino)",
    aliases: ["observacoes", "observação", "observacao", "obs"],
    required: true,
    destination: true
  }
];

const TOKEN_ALIASES = {
  paraf: "parafuso",
  parafuso: "parafuso",
  bolt: "parafuso",
  bolts: "parafuso",
  sext: "sextavado",
  sextav: "sextavado",
  sextagonal: "sextavado",
  hex: "sextavado",
  atarr: "atarraxante",
  autoatarraxante: "atarraxante",
  autoperfurante: "broca",
  cab: "cabeca",
  cabeça: "cabeca",
  c: "com",
  s: "sem",
  int: "interno",
  ext: "externo",
  zinc: "zincado",
  bicr: "bicromatizado",
  pol: "polegada",
  met: "metrica",
  aço: "aco",
  steel: "aco",
  stainless: "inox",
  ss: "inox",
  angle: "cantoneira",
  channel: "perfil",
  washer: "arruela",
  nut: "porca",
  screw: "parafuso"
};

const FINISH_ALIASES = {
  "00": ["polido", "sem revestimento", "plain"],
  "01": [
    "zincado branco",
    "zincagem branca",
    "zinc plated",
    "galvanizado branco",
    "galvanizacao eletrolitica",
    "galvanização eletrolítica"
  ],
  "02": ["bicromatizado", "zincado amarelo", "cincado amarelo", "yellow zinc"],
  "03": ["zincado preto", "cincado preto", "black zinc"],
  "51": ["organo metalico", "organometalico", "zinc flake"],
  "96": ["nanotec", "nanotec 45k"]
};

const PRODUCT_WORDS = [
  "arruela", "parafuso", "porca", "barra", "chumbador", "rebite",
  "bucha", "pino", "gancho", "grampo", "prisioneiro", "anel"
];

const PRODUCT_MODIFIERS = [
  "lisa", "pressao", "sextavado", "sextavada", "frances", "rosqueada",
  "roscada", "rosca", "inteira", "atarraxante", "broca", "cabeca",
  "flangeada", "dentada"
];

const state = {
  workbook: null,
  originalBuffer: null,
  file: null,
  headers: [],
  rows: [],
  headerRowIndex: 0,
  mapping: {},
  results: [],
  filteredResults: [],
  page: 1,
  pageSize: 35
};

const elements = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".tab-panel"),
  steps: document.querySelectorAll(".step"),
  stages: document.querySelectorAll(".stage"),
  fileInput: document.querySelector("#excel-file"),
  dropZone: document.querySelector("#drop-zone"),
  fileSummary: document.querySelector("#file-summary"),
  fileName: document.querySelector("#file-name"),
  fileDetails: document.querySelector("#file-details"),
  sheetSelect: document.querySelector("#sheet-select"),
  continueMapping: document.querySelector("#continue-mapping"),
  mappingGrid: document.querySelector("#mapping-grid"),
  previewTable: document.querySelector("#preview-table"),
  rowCount: document.querySelector("#row-count"),
  runCrossing: document.querySelector("#run-crossing"),
  resultsBody: document.querySelector("#results-body"),
  pagination: document.querySelector("#pagination"),
  resultFilter: document.querySelector("#result-filter"),
  statusFilter: document.querySelector("#status-filter"),
  manualForm: document.querySelector("#manual-form"),
  manualResults: document.querySelector("#manual-results"),
  manualFeedback: document.querySelector("#manual-feedback")
};

const CATALOG_LINE_SET = new Set(
  CATALOGO_PRODUTOS.map((product) =>
    String(product.linha).toLowerCase().replace(/[^a-z0-9]/g, ""))
);
const DAISA_PRODUCTS =
  typeof CATALOGO_DAISA_PRODUTOS !== "undefined"
    ? CATALOGO_DAISA_PRODUTOS
    : [];
const ELECON_PRODUCTS =
  typeof CATALOGO_ELECON_PRODUTOS !== "undefined"
    ? CATALOGO_ELECON_PRODUTOS
    : [];
const ARCELOR_PRODUCTS =
  typeof CATALOGO_ARCELOR_PRODUTOS !== "undefined"
    ? CATALOGO_ARCELOR_PRODUTOS
    : [];
const BURNDY_PRODUCTS =
  typeof CATALOGO_BURNDY_PRODUTOS !== "undefined"
    ? CATALOGO_BURNDY_PRODUTOS
    : [];

const catalogos = {
  CISER: CATALOGO_PRODUTOS,
  ELECON: ELECON_PRODUCTS,
  DAISA: DAISA_PRODUCTS,
  ARCELOR: ARCELOR_PRODUCTS,
  BURNDY: BURNDY_PRODUCTS
};
const MANUFACTURER_ORDER = Object.keys(catalogos);

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9./]+/g, " ")
    .trim();
}

function normalizarTexto(texto) {
  return normalizeText(texto).replace(/\s+/g, " ");
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length > 1)
    .map((token) => TOKEN_ALIASES[token] || token);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    queryToken.length >= 4 &&
    candidateToken.length >= 4 &&
    (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken))
  ) {
    return true;
  }
  const maxDistance = Math.min(queryToken.length, candidateToken.length) >= 7 ? 2 : 1;
  return levenshtein(queryToken, candidateToken) <= maxDistance;
}

function tokenCoverage(query, candidateTokens) {
  const queryTokens = tokenize(query).filter((token) => !/^\d+(?:\.\d+)?$/.test(token));
  if (!queryTokens.length) return 0;

  let matched = 0;
  queryTokens.forEach((queryToken) => {
    if (candidateTokens.some((candidateToken) => tokenMatches(queryToken, candidateToken))) {
      matched += 1;
    }
  });

  return matched / queryTokens.length;
}

function extrairLinhaCatalogo(dimensao, descricao, codigoFabricante = "") {
  const combined = normalizarTexto(`${dimensao} ${descricao}`);
  const explicitLine =
    combined.match(/\blinha\s*[:#-]?\s*(\d{2,5}[a-z]?)\b/)?.[1] || "";
  if (explicitLine) return explicitLine;

  const code = normalizarTexto(codigoFabricante).replace(/[^a-z0-9]/g, "");
  return CATALOG_LINE_SET.has(code) ? code : "";
}

function extractRequestedLine(query) {
  return extrairLinhaCatalogo(
    `${query.dimensao} ${query.tamanho}`,
    `${query.descricao} ${query.especificacao}`,
    query.codigoFabricante
  );
}

function extrairDimensoes(texto) {
  const normalized = normalizarTexto(texto)
    .replace(/\blinha\s*[:#-]?\s*\d+[a-z]?\b/g, " ");
  const fractions = [...new Set(normalized.match(/\d+(?:\.\d+)?\/\d+/g) || [])];
  const milimetros = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*mm\b/g)]
    .map((match) => Number(match[1]));
  const metricas = [...normalized.matchAll(/(?:^|\s)m\s*(\d+(?:\.\d+)?)\b/g)]
    .map((match) => Number(match[1]));
  const pares = [...normalized.matchAll(
    /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*mm)?\b/g
  )].map((match) => ({
    bitola: Number(match[1]),
    comprimento: Number(match[2])
  }));
  const fractionParts = new Set(
    fractions.flatMap((fraction) => fraction.split("/"))
  );
  const numbers = (normalized.match(/\d+(?:\.\d+)?/g) || [])
    .filter((number) => !fractionParts.has(number))
    .map(Number)
    .filter((number) => number <= 500);
  const lista = [
    ...fractions,
    ...milimetros.map((number) => `${number}mm`),
    ...metricas.map((number) => `M${number}`),
    ...pares.map((pair) => `${pair.bitola}x${pair.comprimento}`)
  ];
  return {
    fractions,
    milimetros: [...new Set(milimetros)],
    metricas: [...new Set(metricas)],
    pares,
    numbers,
    lista: [...new Set(lista)]
  };
}

function extractDimensionFeatures(value) {
  const dimensions = extrairDimensoes(value);
  return {
    fractions: dimensions.fractions,
    numbers: [...new Set([
      ...dimensions.milimetros,
      ...dimensions.metricas,
      ...dimensions.pares.flatMap((pair) => [pair.bitola, pair.comprimento]),
      ...dimensions.numbers
    ])]
  };
}

function dimensionMatchQuality(query, variant) {
  const requested = extrairDimensoes(query);
  if (!requested.fractions.length && !requested.numbers.length) return 0;

  const nominal = extrairDimensoes(variant.dimensao);
  const length = extrairDimensoes(variant.comprimento);
  const fractionMatch = requested.fractions.some((fraction) =>
    nominal.fractions.includes(fraction));

  if (variant.comprimento) {
    const pairs = requested.pares.length
      ? requested.pares
      : requested.numbers.length >= 2
        ? [{ bitola: requested.numbers[0], comprimento: requested.numbers[1] }]
        : [];
    const nominalNumbers = [...nominal.numbers, ...nominal.milimetros, ...nominal.metricas];
    const lengthNumbers = [...length.numbers, ...length.milimetros];
    const exactPair = pairs.some((pair) =>
      nominalNumbers.some((number) => Math.abs(number - pair.bitola) <= 0.05) &&
      lengthNumbers.some((number) => Math.abs(number - pair.comprimento) <= 0.05));
    if (exactPair) return 100;

    const exactLength = requested.numbers.some((requestedNumber) =>
      lengthNumbers.some((number) => Math.abs(number - requestedNumber) <= 0.05));
    return fractionMatch && exactLength ? 95 : 0;
  }

  if (fractionMatch) return 100;

  const requestedMetric = [
    ...requested.milimetros,
    ...requested.metricas,
    ...requested.numbers
  ];
  const nominalMetric = [
    ...nominal.milimetros,
    ...nominal.metricas,
    ...nominal.numbers
  ];
  let bestDifference = Infinity;
  requestedMetric.forEach((requestedNumber) => {
    nominalMetric.forEach((candidateNumber) => {
      bestDifference = Math.min(bestDifference, Math.abs(candidateNumber - requestedNumber));
    });
  });
  if (bestDifference <= 0.05) return 90;

  const nominalAliases = {
    "1/4": [6, 7],
    "5/16": [8, 9],
    "3/8": [9.5, 10, 10.5]
  };
  const nominalAliasMatch = nominal.fractions.some((fraction) =>
    (nominalAliases[fraction] || []).some((alias) =>
      requestedMetric.some((number) => Math.abs(number - alias) <= 0.05)));
  if (nominalAliasMatch) return 85;

  if (bestDifference <= 1.05) return 70;
  return 0;
}

function dimensionMatchesVariant(query, variant) {
  return dimensionMatchQuality(query, variant) > 0;
}

function dimensionScore(query, variant) {
  return dimensionMatchesVariant(query, variant) ? 20 : 0;
}

function detectFinishCode(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  const directCode = normalized.match(/(?:^|\s)(00|01|02|03|51|96)(?:$|\s)/);
  if (directCode) return directCode[1];

  const orderedFinishes = ["02", "03", "51", "96", "00", "01"];
  const specific = orderedFinishes.find((code) =>
    FINISH_ALIASES[code].some((alias) => normalized.includes(normalizeText(alias))));
  if (specific) return specific;
  return /\b(zincad[oa]s?|galvanizad[oa]s?|galvanizacao)\b/.test(normalized)
    ? "01"
    : "";
}

function identificarAcabamento(descricao) {
  const codigo = detectFinishCode(descricao);
  const nomes = {
    "00": "Polido",
    "01": "Zincado Branco",
    "02": "Bicromatizado",
    "03": "Zincado Preto",
    "51": "Organo Metálico",
    "96": "Nanotec"
  };
  return { nome: nomes[codigo] || "", codigo };
}

function finishScore(query, variant) {
  if (!normalizeText(query)) return 0;
  const code = detectFinishCode(query);
  return code && code === variant.acabamentoCodigo ? 15 : 0;
}

function productTypeScore(query, entry) {
  const queryTokens = tokenize(query);
  const type = PRODUCT_WORDS.find((word) => queryTokens.includes(word));
  const modifiers = PRODUCT_MODIFIERS.filter((word) => queryTokens.includes(word));
  if (!type) {
    const matchedModifiers = modifiers.filter((word) => entry.candidateTokens.includes(word)).length;
    return modifiers.length >= 2 && matchedModifiers === modifiers.length ? 20 : 0;
  }
  if (!entry.candidateTokens.includes(type)) return 0;
  if (!modifiers.length) return 20;
  const matched = modifiers.filter((word) => entry.candidateTokens.includes(word)).length;
  return Math.round(20 + 5 * (matched / modifiers.length));
}

function materialOrThreadScore(query, product) {
  const normalized = normalizeText(query);
  if (!normalized) return 0;
  const candidate = normalizeText(`${product.material} ${product.rosca} ${product.nome}`);
  const knownThreads = ["unc", "unf", "bsw", "ma", "mb", "metrica", "soberba"];
  const requested = knownThreads.find((thread) => normalized.includes(thread));
  if (requested && candidate.includes(requested)) return 10;

  const materials = ["aco carbono", "aco inox", "inox 304", "inox 316", "latao"];
  const material = materials.find((item) => normalized.includes(item));
  return material && candidate.includes(material) ? 10 : 0;
}

function lineScore(requestedLine, product, variant) {
  void variant;
  if (!requestedLine) return 0;
  const line = normalizeText(product.linha).replace(/[^a-z0-9]/g, "");
  if (requestedLine === line) return 30;
  return 0;
}

const catalogVariantMap = new Map();
CATALOGO_PRODUTOS.forEach((product) => {
  product.variantes.forEach((variant) => {
    const expectedTag = `${product.linha}${variant.referencia}${variant.acabamentoCodigo}`
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    const actualTag = String(variant.tag).replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (!variant.referencia || !variant.acabamentoCodigo || actualTag !== expectedTag) return;
    if (catalogVariantMap.has(actualTag)) return;
    catalogVariantMap.set(actualTag, {
      marca: "CISER",
      product,
      variant,
      candidateTokens: tokenize(
        `${product.nome} ${product.rosca} ${product.material} ${product.categoria}`
      )
    });
  });
});
const catalogVariants = Array.from(catalogVariantMap.values());

const daisaCatalogVariants = DAISA_PRODUCTS.flatMap((product) =>
  (product.variantes || []).map((sourceVariant) => {
    const variant = {
      ...sourceVariant,
      tag: sourceVariant.codigo,
      referencia: sourceVariant.familia,
      comprimento: "",
      acabamentoCodigo: "",
      acabamento: sourceVariant.sistema
        ? `Sistema ${sourceVariant.sistema}`
        : "Código DAISA",
      embalagem: ""
    };
    return {
      marca: "DAISA",
      product: {
        ...product,
        linha: sourceVariant.familia,
        rosca: sourceVariant.sistema || "",
        material: ""
      },
      variant,
      candidateTokens: tokenize(
        `${product.nome} ${sourceVariant.familia} ${product.categoria} DAISA`
      )
    };
  })
);

const eleconCatalogVariants = ELECON_PRODUCTS.flatMap((product) =>
  (product.variantes || []).map((sourceVariant) => {
    const variant = {
      ...sourceVariant,
      tag: sourceVariant.codigo,
      referencia: sourceVariant.familia,
      comprimento: "",
      acabamentoCodigo: "",
      acabamento: sourceVariant.sistema || "Código Elecon",
      embalagem: ""
    };
    return {
      marca: "ELECON",
      product: {
        ...product,
        linha: sourceVariant.familia,
        rosca: sourceVariant.sistema || "",
        material: sourceVariant.sistema || ""
      },
      variant,
      candidateTokens: tokenize(
        `${product.nome} ${sourceVariant.familia} ${sourceVariant.detalhe} ` +
        `${sourceVariant.sistema} ${product.categoria} ELECON`
      )
    };
  })
);

function adaptExternalCatalog(products, marca) {
  return products.flatMap((product) =>
    (product.variantes || []).map((sourceVariant) => {
      const variant = {
        ...sourceVariant,
        tag: sourceVariant.codigo,
        referencia: sourceVariant.familia,
        comprimento: "",
        acabamentoCodigo: "",
        acabamento: sourceVariant.sistema || `Código ${marca}`,
        embalagem: ""
      };
      return {
        marca,
        product: {
          ...product,
          linha: sourceVariant.familia,
          rosca: sourceVariant.sistema || "",
          material: sourceVariant.sistema || ""
        },
        variant,
        candidateTokens: tokenize(
          `${product.nome} ${sourceVariant.familia} ${sourceVariant.dimensao} ` +
          `${sourceVariant.detalhe} ${sourceVariant.sistema} ${product.categoria} ${marca}`
        )
      };
    })
  );
}

const arcelorCatalogVariants = adaptExternalCatalog(
  ARCELOR_PRODUCTS,
  "ARCELORMITTAL"
);
const burndyCatalogVariants = adaptExternalCatalog(BURNDY_PRODUCTS, "BURNDY");

const DAISA_SIZE_RULES = [
  { code: "110", patterns: [/\b1\s+1\/4\b/, /\b32\s*mm\b/] },
  { code: "112", patterns: [/\b1\s+1\/2\b/, /\b40\s*mm\b/] },
  { code: "212", patterns: [/\b2\s+1\/2\b/, /\b65\s*mm\b/] },
  { code: "010", patterns: [/\b3\/8\b/, /\b10\s*mm\b/] },
  { code: "012", patterns: [/\b1\/2\b/, /\b15\s*mm\b/] },
  { code: "034", patterns: [/\b3\/4\b/, /\b20\s*mm\b/] },
  { code: "100", patterns: [/(?<!\/)\b1\b(?!\s*\/)(?:\s*(?:pol|polegada|"))?/, /\b25\s*mm\b/] },
  { code: "200", patterns: [/(?<!\/)\b2\b(?!\s*\/)(?:\s*(?:pol|polegadas|"))?/, /\b50\s*mm\b/] },
  { code: "300", patterns: [/(?<!\/)\b3\b(?!\s*\/)(?:\s*(?:pol|polegadas|"))?/, /\b80\s*mm\b/] },
  { code: "400", patterns: [/(?<!\/)\b4\b(?!\s*\/)(?:\s*(?:pol|polegadas|"))?/, /\b100\s*mm\b/] },
  { code: "500", patterns: [/(?<!\/)\b5\b(?!\s*\/)(?:\s*(?:pol|polegadas|"))?/, /\b125\s*mm\b/] },
  { code: "600", patterns: [/(?<!\/)\b6\b(?!\s*\/)(?:\s*(?:pol|polegadas|"))?/, /\b150\s*mm\b/] }
];

function detectDaisaSizeCodes(value) {
  const normalized = normalizeText(value);
  const found = [];
  DAISA_SIZE_RULES.forEach((rule) => {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      found.push(rule.code);
    }
  });
  if (found.includes("110") || found.includes("112")) {
    const index = found.indexOf("100");
    if (index >= 0) found.splice(index, 1);
  }
  if (found.includes("212")) {
    const index = found.indexOf("200");
    if (index >= 0) found.splice(index, 1);
  }
  return [...new Set(found)];
}

function normalizeCatalogCode(value) {
  return normalizarTexto(value).replace(/[^a-z0-9]/g, "");
}

function daisaProductScore(query, entry) {
  const normalized = normalizeText(query);
  if (
    normalized.includes("elecon") ||
    normalized.includes("arcelor") ||
    normalized.includes("burndy")
  ) {
    return 0;
  }
  const queryTokens = tokenize(query);
  const family = normalizeText(entry.variant.familia);
  let score = 0;
  if (
    queryTokens.includes(family) ||
    new RegExp(`\\b${family}\\b`, "i").test(normalized)
  ) {
    score += 55;
  }

  const ignored = new Set([
    "com", "sem", "para", "rosca", "tamanho", "codigo", "sistema",
    "produto", "daisa", "de", "do", "da", "e"
  ]);
  const productTokens = [...new Set(tokenize(entry.product.nome))]
    .filter((token) => token.length > 2 && !ignored.has(token));
  const matched = productTokens.filter((token) =>
    queryTokens.some((queryToken) => tokenMatches(queryToken, token))).length;
  if (productTokens.length) {
    score += Math.round(45 * (matched / Math.min(productTokens.length, 4)));
  }
  const candidateText = normalizeText(
    `${entry.product.nome} ${entry.product.categoria}`
  );
  if (normalized.includes("com rosca")) {
    score += candidateText.includes("com rosca") ? 30 : -35;
  } else if (normalized.includes("sem rosca")) {
    score += candidateText.includes("sem rosca") ? 30 : -35;
  }
  return Math.min(100, score);
}

function detectDaisaSystem(value) {
  const normalized = normalizeText(value);
  if (/schedule\s*40|\bschedule\b/.test(normalized)) return "S";
  if (/\bdin\b/.test(normalized)) return "D";
  if (/pvc\s*(?:classe\s*)?a/.test(normalized)) return "PA";
  if (/pvc\s*(?:classe\s*)?b/.test(normalized)) return "PB";
  if (/\bcomum\b/.test(normalized)) return "C";
  if (/\bnpt\b/.test(normalized)) return "NPT";
  if (/\bbsp\b/.test(normalized)) return "BSP";
  return "";
}

function resolveDaisaCode(entry, system) {
  const threadedPrefixFamilies = new Set([
    "URR", "DIIR", "DIIRT", "DNR", "DNRT", "DGR", "DGRT",
    "DNGRT", "RMR", "RMRT", "RTTR"
  ]);
  if (
    (system === "BSP" || system === "NPT") &&
    threadedPrefixFamilies.has(entry.variant.familia)
  ) {
    return `${system === "BSP" ? "B" : "N"} - ${entry.variant.codigoBase}`;
  }
  return entry.variant.codigo;
}

function searchDaisaCatalog(query, limit = 1, options = {}) {
  const strict = options.strict !== false;
  const descriptionQuery =
    `${query.descricao} ${query.especificacao} ${query.codigoFabricante}`;
  const dimensionQuery = [query.dimensao, query.tamanho].filter(Boolean).join(" ") ||
    descriptionQuery;
  const exactCode = normalizeCatalogCode(query.codigoFabricante);
  const exactEntry = exactCode && daisaCatalogVariants.find((entry) =>
    normalizeCatalogCode(entry.variant.codigo) === exactCode);
  const diagnostic = {
    item: query.item || query.codigoFabricante || "",
    descricaoOriginal: String(query.descricao || ""),
    dimensaoOriginal: [query.dimensao, query.tamanho].filter(Boolean).join(" "),
    linhaExtraida: "",
    dimensoesExtraidas: [],
    acabamentoExtraido: "",
    codigoAcabamento: "",
    produtosCandidatos: [],
    produtoEscolhido: "",
    referenciaEncontrada: "",
    codigoFinal: "",
    motivoFalha: "",
    catalogo: "DAISA"
  };

  if (exactEntry) {
    diagnostic.linhaExtraida = exactEntry.variant.familia;
    diagnostic.dimensoesExtraidas = [exactEntry.variant.dimensao];
    diagnostic.produtoEscolhido = exactEntry.product.nome;
    diagnostic.referenciaEncontrada = exactEntry.variant.familia;
    diagnostic.codigoFinal = exactEntry.variant.codigo;
    return {
      matches: [{ ...exactEntry, score: 100, breakdown: { codigo: 100 } }],
      diagnostic
    };
  }

  const sizeCodes = detectDaisaSizeCodes(dimensionQuery);
  diagnostic.dimensoesExtraidas = sizeCodes;
  const system = detectDaisaSystem(
    `${query.descricao} ${query.especificacao} ${query.rosca}`
  );
  diagnostic.acabamentoExtraido = system;

  let candidates = daisaCatalogVariants
    .map((entry) => ({
      ...entry,
      productScore: daisaProductScore(descriptionQuery, entry)
    }))
    .filter((entry) => entry.productScore >= (strict ? 25 : 10));
  diagnostic.produtosCandidatos = [
    ...new Set(candidates.map((entry) => entry.product.nome))
  ].slice(0, 20);

  if (strict && !candidates.length) {
    diagnostic.motivoFalha = "Produto DAISA não identificado";
    return { matches: [], diagnostic };
  }
  if (strict && !sizeCodes.length) {
    diagnostic.motivoFalha = "Dimensão DAISA não identificada";
    return { matches: [], diagnostic };
  }

  if (sizeCodes.length) {
    candidates = candidates.filter((entry) => {
      const variantSizes = String(entry.variant.dimensaoCodificada).match(/\d{3}/g) || [];
      return sizeCodes.every((code) => variantSizes.includes(code));
    });
  }
  if (strict && !candidates.length) {
    diagnostic.motivoFalha = "Dimensão não encontrada na tabela DAISA";
    return { matches: [], diagnostic };
  }

  if (system) {
    const bySystem = candidates.filter((entry) =>
      normalizeText(entry.variant.sistema).includes(normalizeText(system)));
    if (bySystem.length) candidates = bySystem;
  }

  const matches = candidates
    .map((entry) => {
      const sizeScore = sizeCodes.length ? 35 : 0;
      const systemScore = system &&
        normalizeText(entry.variant.sistema).includes(normalizeText(system))
        ? 10
        : 0;
      const resolvedCode = resolveDaisaCode(entry, system);
      return {
        ...entry,
        variant: {
          ...entry.variant,
          tag: resolvedCode,
          codigo: resolvedCode
        },
        score: Math.min(100, entry.productScore + sizeScore + systemScore),
        breakdown: {
          produto: entry.productScore,
          dimensao: sizeScore,
          sistema: systemScore
        }
      };
    })
    .sort((a, b) => b.score - a.score || a.variant.codigo.localeCompare(b.variant.codigo))
    .slice(0, limit);

  const chosen = matches[0];
  if (chosen) {
    diagnostic.linhaExtraida = chosen.variant.familia;
    diagnostic.produtoEscolhido = chosen.product.nome;
    diagnostic.referenciaEncontrada = chosen.variant.familia;
    diagnostic.codigoFinal = chosen.variant.codigo;
  } else {
    diagnostic.motivoFalha = "Código DAISA não encontrado";
  }
  return { matches, diagnostic };
}

function detectEleconDimensions(value) {
  const normalized = normalizeText(value)
    .replace(/(\d)\.(\d\/\d)/g, "$1 $2")
    .replace(/\b(\d+)p\b/g, "$1");
  const signatures = [];
  const fractions = normalized.match(/\b(?:\d+\s+)?\d+\/\d+\b/g) || [];
  const rectangular = normalized.match(
    /\b\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?\b/g
  ) || [];
  const nominalSource = rectangular.reduce(
    (text, dimension) => text.replace(dimension, " "),
    normalized
  );
  const nominalCodes = detectDaisaSizeCodes(nominalSource);
  fractions.forEach((valueFound) =>
    signatures.push(`f:${valueFound.replace(/\s+/g, " ")}`));
  rectangular.forEach((valueFound) =>
    signatures.push(`x:${valueFound.replace(/\s+/g, "")}`));
  return {
    nominalCodes,
    signatures: [...new Set(signatures)]
  };
}

function eleconDimensionMatches(requested, entry) {
  const available = detectEleconDimensions(
    `${entry.variant.dimensao} ${entry.variant.detalhe}`
  );
  if (requested.nominalCodes.length) {
    const nominalMatch = requested.nominalCodes.every((code) =>
      available.nominalCodes.includes(code));
    if (nominalMatch) return true;
  }
  return requested.signatures.some((signature) =>
    available.signatures.includes(signature));
}

function detectEleconFinish(value) {
  const normalized = normalizeText(value);
  const finishes = [
    ["pre zincado", "pre zinc"],
    ["galvanizado a fogo", "galvanizad a fogo"],
    ["galvanizado eletrolitico", "eletrolit"],
    ["aluminio", "alumin"],
    ["inox", "inox"],
    ["pvc", "pvc"],
    ["zamak", "zamak"],
    ["bsp", "bsp"],
    ["npt", "npt"]
  ];
  return finishes
    .filter(([, pattern]) => normalized.includes(pattern))
    .map(([finish]) => finish);
}

function eleconProductScore(query, entry) {
  const normalized = normalizeText(query);
  if (
    normalized.includes("daisa") ||
    normalized.includes("ciser") ||
    normalized.includes("arcelor") ||
    normalized.includes("burndy")
  ) {
    return 0;
  }
  const family = normalizeText(entry.variant.familia);
  const queryTokens = tokenize(query);
  const ignored = new Set([
    "com", "sem", "para", "produto", "codigo", "marca", "elecon",
    "de", "do", "da", "e", "mm", "pol", "polegada", "polegadas"
  ]);
  const meaningful = [...new Set(queryTokens)]
    .filter((token) => token.length > 1 && !ignored.has(token) && !/^\d/.test(token));
  const matched = meaningful.filter((token) =>
    entry.candidateTokens.some((candidate) => tokenMatches(token, candidate))).length;
  let score = meaningful.length
    ? Math.round(65 * (matched / Math.min(meaningful.length, 6)))
    : 0;
  if (
    queryTokens.includes(family) ||
    normalizeCatalogCode(query).includes(normalizeCatalogCode(entry.variant.familia))
  ) {
    score += 45;
  }
  if (normalized.includes("elecon")) score += 15;
  const productName = normalizeText(entry.product.nome);
  if (productName.length > 5 && normalized.includes(productName)) score += 25;
  return Math.min(100, score);
}

function searchEleconCatalog(query, limit = 1, options = {}) {
  const strict = options.strict !== false;
  const descriptionQuery =
    `${query.descricao} ${query.especificacao} ${query.codigoFabricante}`;
  const dimensionQuery =
    [query.dimensao, query.tamanho].filter(Boolean).join(" ") || descriptionQuery;
  const requestedDimensions = detectEleconDimensions(dimensionQuery);
  const requestedFinishes = detectEleconFinish(
    `${query.descricao} ${query.especificacao} ${query.acabamento} ${query.rosca}`
  );
  const exactCode = normalizeCatalogCode(query.codigoFabricante);
  const exactEntry = exactCode && eleconCatalogVariants.find((entry) =>
    normalizeCatalogCode(entry.variant.codigo) === exactCode);
  const diagnostic = {
    item: query.item || query.codigoFabricante || "",
    descricaoOriginal: String(query.descricao || ""),
    dimensaoOriginal: [query.dimensao, query.tamanho].filter(Boolean).join(" "),
    linhaExtraida: "",
    dimensoesExtraidas: [
      ...requestedDimensions.nominalCodes,
      ...requestedDimensions.signatures
    ],
    acabamentoExtraido: requestedFinishes.join(" / "),
    codigoAcabamento: "",
    produtosCandidatos: [],
    produtoEscolhido: "",
    referenciaEncontrada: "",
    codigoFinal: "",
    motivoFalha: "",
    catalogo: "ELECON"
  };

  if (exactEntry) {
    diagnostic.linhaExtraida = exactEntry.variant.familia;
    diagnostic.produtoEscolhido = exactEntry.product.nome;
    diagnostic.referenciaEncontrada = exactEntry.variant.familia;
    diagnostic.codigoFinal = exactEntry.variant.codigo;
    return {
      matches: [{ ...exactEntry, score: 100, breakdown: { codigo: 100 } }],
      diagnostic
    };
  }

  let candidates = eleconCatalogVariants
    .map((entry) => ({
      ...entry,
      productScore: eleconProductScore(descriptionQuery, entry)
    }))
    .filter((entry) => entry.productScore >= (strict ? 28 : 10));
  diagnostic.produtosCandidatos = [
    ...new Set(candidates.map((entry) => entry.product.nome))
  ].slice(0, 20);

  if (strict && !candidates.length) {
    diagnostic.motivoFalha = "Produto Elecon não identificado";
    return { matches: [], diagnostic };
  }

  const hasRequestedDimension =
    requestedDimensions.nominalCodes.length || requestedDimensions.signatures.length;
  if (hasRequestedDimension) {
    const dimensionMatches = candidates.filter((entry) =>
      eleconDimensionMatches(requestedDimensions, entry));
    if (dimensionMatches.length) {
      candidates = dimensionMatches;
    } else {
      const dimensionless = candidates.filter((entry) => !entry.variant.dimensao);
      if (dimensionless.length) candidates = dimensionless;
      else if (strict) {
        diagnostic.motivoFalha = "Dimensão não encontrada na tabela Elecon";
        return { matches: [], diagnostic };
      }
    }
  }

  if (requestedFinishes.length) {
    const finishMatches = candidates.filter((entry) => {
      const candidate = normalizeText(
        `${entry.variant.sistema} ${entry.variant.detalhe}`
      );
      return requestedFinishes.every((finish) =>
        candidate.includes(normalizeText(finish)));
    });
    if (finishMatches.length) candidates = finishMatches;
  }

  const matches = candidates
    .map((entry) => {
      const dimensionScore = hasRequestedDimension &&
        eleconDimensionMatches(requestedDimensions, entry)
        ? 25
        : 0;
      const finishText = normalizeText(
        `${entry.variant.sistema} ${entry.variant.detalhe}`
      );
      const finishScore = requestedFinishes.length &&
        requestedFinishes.every((finish) =>
          finishText.includes(normalizeText(finish)))
        ? 10
        : 0;
      return {
        ...entry,
        score: Math.min(100, entry.productScore + dimensionScore + finishScore),
        breakdown: {
          produto: entry.productScore,
          dimensao: dimensionScore,
          acabamento: finishScore
        }
      };
    })
    .sort((a, b) =>
      b.score - a.score ||
      b.productScore - a.productScore ||
      a.variant.codigo.localeCompare(b.variant.codigo))
    .slice(0, limit);

  const chosen = matches[0];
  if (chosen) {
    diagnostic.linhaExtraida = chosen.variant.familia;
    diagnostic.produtoEscolhido = chosen.product.nome;
    diagnostic.referenciaEncontrada = chosen.variant.familia;
    diagnostic.codigoFinal = chosen.variant.codigo;
  } else {
    diagnostic.motivoFalha = "Código Elecon não encontrado";
  }
  return { matches, diagnostic };
}

function extractNumericTokens(value) {
  const normalized = normalizeText(value)
    .replace(/\bmm2\b/g, " mm ")
    .replace(/\bcm2\b/g, " cm ")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2");
  return [
    ...new Set(
      (normalized.match(/\d+(?:\.\d+)?(?:\/\d+)?/g) || [])
        .map((token) => token.replace(/^0+(?=\d)/, ""))
    )
  ];
}

function detectArcelorFamily(value) {
  const normalized = normalizeText(value);
  if (/\bcantoneira\b|\bperfil\s+l\b|\bangle\b/.test(normalized)) return "L";
  if (/\bperfil\s+w\b|\bviga\s+w\b|\bwide\s+flange\b/.test(normalized)) return "W";
  if (/\bperfil\s+u\b|\bcanal\s+u\b/.test(normalized)) return "U";
  if (/\bperfil\s+i\b|\bviga\s+i\b/.test(normalized)) return "I";
  return "";
}

function arcelorDimensionMatches(requestedNumbers, entry) {
  if (!requestedNumbers.length) return false;
  const variant = entry.variant;
  const requested = requestedNumbers.map(Number);
  const close = (left, right) => Math.abs(Number(left) - Number(right)) <= 0.02;

  if (variant.familia === "L") {
    if (requested.length >= 3) {
      return (
        close(requested[0], variant.larguraAba) &&
        close(requested[1], variant.larguraAba) &&
        close(requested[2], variant.espessura)
      );
    }
    return requested.length >= 2 &&
      close(requested[0], variant.larguraAba) &&
      close(requested[1], variant.espessura);
  }
  if (variant.familia === "U" || variant.familia === "I") {
    return requested.length >= 2 &&
      close(requested[0], variant.polegadas) &&
      close(requested[1], variant.alma);
  }
  if (variant.familia === "W") {
    return requested.length >= 2 &&
      close(requested[0], variant.bitolaAltura) &&
      close(requested[1], variant.massaLinear);
  }
  return false;
}

function searchArcelorCatalog(query, limit = 1, options = {}) {
  const strict = options.strict !== false;
  const descriptionQuery =
    `${query.descricao} ${query.especificacao} ${query.codigoFabricante}`;
  const dimensionQuery =
    [query.dimensao, query.tamanho].filter(Boolean).join(" ") || descriptionQuery;
  const family = detectArcelorFamily(descriptionQuery);
  const requestedNumbers = extractNumericTokens(dimensionQuery);
  const exactCode = normalizeCatalogCode(query.codigoFabricante);
  const exactEntry = exactCode && arcelorCatalogVariants.find((entry) =>
    normalizeCatalogCode(entry.variant.codigo) === exactCode);
  const diagnostic = {
    item: query.item || query.codigoFabricante || "",
    descricaoOriginal: String(query.descricao || ""),
    dimensaoOriginal: [query.dimensao, query.tamanho].filter(Boolean).join(" "),
    linhaExtraida: family,
    dimensoesExtraidas: requestedNumbers,
    acabamentoExtraido: "",
    codigoAcabamento: "",
    produtosCandidatos: [],
    produtoEscolhido: "",
    referenciaEncontrada: "",
    codigoFinal: "",
    motivoFalha: "",
    catalogo: "ARCELORMITTAL"
  };

  if (exactEntry) {
    diagnostic.linhaExtraida = exactEntry.variant.familia;
    diagnostic.produtoEscolhido = exactEntry.product.nome;
    diagnostic.referenciaEncontrada = exactEntry.variant.familia;
    diagnostic.codigoFinal = exactEntry.variant.codigo;
    return {
      matches: [{ ...exactEntry, score: 100, breakdown: { codigo: 100 } }],
      diagnostic
    };
  }

  if (strict && !family) {
    diagnostic.motivoFalha = "Família de perfil ArcelorMittal não identificada";
    return { matches: [], diagnostic };
  }
  if (strict && requestedNumbers.length < 2) {
    diagnostic.motivoFalha = "Dimensão do perfil ArcelorMittal não identificada";
    return { matches: [], diagnostic };
  }

  let candidates = arcelorCatalogVariants.filter((entry) =>
    !family || entry.variant.familia === family);
  diagnostic.produtosCandidatos = [
    ...new Set(candidates.map((entry) => entry.product.nome))
  ];
  if (requestedNumbers.length >= 2) {
    const dimensionMatches = candidates.filter((entry) =>
      arcelorDimensionMatches(requestedNumbers, entry));
    if (dimensionMatches.length) {
      candidates = dimensionMatches;
    } else if (strict) {
      diagnostic.motivoFalha =
        "Dimensão não encontrada na tabela ArcelorMittal";
      return { matches: [], diagnostic };
    }
  }

  const normalizedDescription = normalizeText(descriptionQuery);
  const matches = candidates
    .map((entry) => {
      const familyScore = family && entry.variant.familia === family ? 55 : 20;
      const dimensionScore = arcelorDimensionMatches(requestedNumbers, entry)
        ? 35
        : 0;
      const brandScore = normalizedDescription.includes("arcelor") ? 10 : 0;
      return {
        ...entry,
        score: Math.min(100, familyScore + dimensionScore + brandScore),
        breakdown: {
          familia: familyScore,
          dimensao: dimensionScore,
          marca: brandScore
        }
      };
    })
    .sort((a, b) =>
      b.score - a.score ||
      a.variant.codigo.localeCompare(b.variant.codigo))
    .slice(0, limit);

  const chosen = matches[0];
  if (chosen) {
    diagnostic.produtoEscolhido = chosen.product.nome;
    diagnostic.referenciaEncontrada = chosen.variant.familia;
    diagnostic.codigoFinal = chosen.variant.codigo;
  } else {
    diagnostic.motivoFalha = "Perfil ArcelorMittal não encontrado";
  }
  return { matches, diagnostic };
}

function burndyProductScore(query, entry) {
  const normalized = normalizeText(query);
  if (
    normalized.includes("ciser") ||
    normalized.includes("daisa") ||
    normalized.includes("elecon") ||
    normalized.includes("arcelor")
  ) {
    return 0;
  }
  const family = normalizeText(entry.variant.familia);
  let score = Math.round(65 * tokenCoverage(query, entry.candidateTokens));
  if (new RegExp(`\\b${family}\\b`, "i").test(normalized)) {
    score += 45;
  }
  if (normalized.includes("burndy")) score += 15;
  const candidateText = normalizeText(
    `${entry.product.nome} ${entry.variant.codigo} ${entry.variant.detalhe}`
  );
  if (normalized.includes("bimetal")) {
    score += candidateText.includes("bimetal") ? 30 : -60;
  }
  if (normalized.includes("flexivel") || normalized.includes(" flex ")) {
    score += candidateText.includes("flex") ? 35 : -55;
  }
  ["sg1", "sg2"].forEach((series) => {
    if (normalized.includes(series)) {
      score += candidateText.includes(series) ? 30 : -60;
    }
  });
  return Math.max(0, Math.min(150, score));
}

function extractBurndyRanges(value) {
  const normalized = normalizeText(value);
  return [
    ...new Set(
      (normalized.match(/\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?/g) || [])
        .map((range) => range.replace(/\s+/g, ""))
    )
  ];
}

function burndyDimensionMatches(requestedNumbers, entry, requestedValue = "") {
  if (!requestedNumbers.length) return false;
  const candidateText = `${entry.variant.dimensao} ${entry.variant.detalhe}`;
  const requestedRanges = extractBurndyRanges(requestedValue);
  const availableRanges = extractBurndyRanges(candidateText);
  if (requestedRanges.length) {
    return requestedRanges.every((range) => availableRanges.includes(range));
  }
  const available = extractNumericTokens(candidateText);
  return requestedNumbers.every((number) => available.includes(number));
}

function searchBurndyCatalog(query, limit = 1, options = {}) {
  const strict = options.strict !== false;
  const descriptionQuery =
    `${query.descricao} ${query.especificacao} ${query.codigoFabricante}`;
  const dimensionQuery =
    [query.dimensao, query.tamanho].filter(Boolean).join(" ");
  const requestedNumbers = extractNumericTokens(dimensionQuery);
  const exactCode = normalizeCatalogCode(query.codigoFabricante);
  const exactEntry = exactCode && burndyCatalogVariants.find((entry) =>
    normalizeCatalogCode(entry.variant.codigo) === exactCode);
  const diagnostic = {
    item: query.item || query.codigoFabricante || "",
    descricaoOriginal: String(query.descricao || ""),
    dimensaoOriginal: dimensionQuery,
    linhaExtraida: "",
    dimensoesExtraidas: requestedNumbers,
    acabamentoExtraido: "",
    codigoAcabamento: "",
    produtosCandidatos: [],
    produtoEscolhido: "",
    referenciaEncontrada: "",
    codigoFinal: "",
    motivoFalha: "",
    catalogo: "BURNDY"
  };

  if (exactEntry) {
    diagnostic.linhaExtraida = exactEntry.variant.familia;
    diagnostic.produtoEscolhido = exactEntry.product.nome;
    diagnostic.referenciaEncontrada = exactEntry.variant.familia;
    diagnostic.codigoFinal = exactEntry.variant.codigo;
    return {
      matches: [{ ...exactEntry, score: 100, breakdown: { codigo: 100 } }],
      diagnostic
    };
  }

  let candidates = burndyCatalogVariants
    .map((entry) => ({
      ...entry,
      productScore: burndyProductScore(descriptionQuery, entry)
    }))
    .filter((entry) => entry.productScore >= (strict ? 30 : 12));
  diagnostic.produtosCandidatos = [
    ...new Set(candidates.map((entry) => entry.product.nome))
  ].slice(0, 20);

  if (strict && !candidates.length) {
    diagnostic.motivoFalha = "Produto BURNDY não identificado";
    return { matches: [], diagnostic };
  }
  if (requestedNumbers.length) {
    const dimensionMatches = candidates.filter((entry) =>
      burndyDimensionMatches(requestedNumbers, entry, dimensionQuery));
    if (dimensionMatches.length) {
      candidates = dimensionMatches;
    } else if (strict) {
      diagnostic.motivoFalha = "Bitola ou dimensão não encontrada na tabela BURNDY";
      return { matches: [], diagnostic };
    }
  }

  const matches = candidates
    .map((entry) => {
      const dimensionScore = burndyDimensionMatches(
        requestedNumbers,
        entry,
        dimensionQuery
      )
        ? 30
        : 0;
      return {
        ...entry,
        score: Math.min(100, entry.productScore + dimensionScore),
        breakdown: {
          produto: entry.productScore,
          dimensao: dimensionScore
        }
      };
    })
    .sort((a, b) =>
      b.score - a.score ||
      b.productScore - a.productScore ||
      a.variant.codigo.localeCompare(b.variant.codigo))
    .slice(0, limit);

  const chosen = matches[0];
  if (chosen) {
    diagnostic.linhaExtraida = chosen.variant.familia;
    diagnostic.produtoEscolhido = chosen.product.nome;
    diagnostic.referenciaEncontrada = chosen.variant.familia;
    diagnostic.codigoFinal = chosen.variant.codigo;
  } else {
    diagnostic.motivoFalha = "Código BURNDY não encontrado";
  }
  return { matches, diagnostic };
}

function getCatalogRegistry() {
  return {
    CISER: {
      entries: catalogVariants,
      search: (query, limit) => searchCatalog(query, limit, {
        strict: false,
        debug: false,
        catalogo: catalogos.CISER
      })
    },
    ELECON: {
      entries: eleconCatalogVariants,
      search: (query, limit) => searchEleconCatalog(query, limit, {
        strict: false,
        debug: false
      })
    },
    DAISA: {
      entries: daisaCatalogVariants,
      search: (query, limit) => searchDaisaCatalog(query, limit, {
        strict: false,
        debug: false
      })
    },
    ARCELOR: {
      entries: arcelorCatalogVariants,
      search: (query, limit) => searchArcelorCatalog(query, limit, {
        strict: false,
        debug: false
      })
    },
    BURNDY: {
      entries: burndyCatalogVariants,
      search: (query, limit) => searchBurndyCatalog(query, limit, {
        strict: false,
        debug: false
      })
    }
  };
}

function extractCodeFragments(value) {
  return [
    ...new Set(
      tokenize(value)
        .filter((token) =>
          token.length >= 3 &&
          (/\d/.test(token) || /^[a-z]{2,8}$/.test(token)))
        .map(normalizeCatalogCode)
        .filter(Boolean)
    )
  ];
}

function manualDimensionMatches(fabricante, query, entry) {
  const dimensionQuery =
    [query.dimensao, query.tamanho].filter(Boolean).join(" ") ||
    `${query.descricao} ${query.especificacao}`;
  if (!extractNumericTokens(dimensionQuery).length &&
      !extrairDimensoes(dimensionQuery).fractions.length) {
    return false;
  }
  if (fabricante === "CISER") {
    return dimensionMatchQuality(dimensionQuery, entry.variant) > 0;
  }
  if (fabricante === "DAISA") {
    const requested = detectDaisaSizeCodes(dimensionQuery);
    const available = String(entry.variant.dimensaoCodificada).match(/\d{3}/g) || [];
    return requested.length > 0 &&
      requested.every((code) => available.includes(code));
  }
  if (fabricante === "ELECON") {
    return eleconDimensionMatches(detectEleconDimensions(dimensionQuery), entry);
  }
  if (fabricante === "ARCELOR") {
    return arcelorDimensionMatches(extractNumericTokens(dimensionQuery), entry);
  }
  if (fabricante === "BURNDY") {
    return burndyDimensionMatches(
      extractNumericTokens(dimensionQuery),
      entry,
      dimensionQuery
    );
  }
  return false;
}

function manualFinishQuery(query) {
  const explicit = String(query.acabamento || "").trim();
  if (explicit) return explicit;
  const description = normalizeText(`${query.descricao} ${query.especificacao}`);
  const knownFinishes = [
    "zincado", "galvanizado", "bicromatizado", "inox", "aluminio",
    "pre zincado", "estanhado", "cobre", "pvc", "zamak", "bsp", "npt"
  ];
  return knownFinishes.filter((finish) =>
    description.includes(normalizeText(finish))).join(" ");
}

function scoreManualCatalogResult(fabricante, query, entry) {
  const descriptionQuery =
    `${query.descricao} ${query.especificacao}`.trim();
  const candidateText =
    `${entry.product.nome} ${entry.product.categoria} ` +
    `${entry.product.material || ""} ${entry.product.rosca || ""} ` +
    `${entry.variant.detalhe || ""} ${entry.variant.sistema || ""}`;
  const candidateCode = normalizeCatalogCode(entry.variant.tag);
  const codeFragments = extractCodeFragments(
    `${query.codigoFabricante} ${query.descricao}`
  );
  const fullRequestedCode = normalizeCatalogCode(query.codigoFabricante);
  const exactCode =
    (fullRequestedCode.length >= 3 && fullRequestedCode === candidateCode) ||
    codeFragments.some((fragment) =>
      fragment.length >= 3 && fragment === candidateCode);
  if (exactCode) {
    return {
      score: 100,
      breakdown: {
        produto: 30,
        dimensao: 25,
        linha: 20,
        acabamento: 15,
        referencia: 10
      }
    };
  }

  const partialCode = codeFragments.some((fragment) =>
    fragment.length >= 3 && candidateCode.includes(fragment));
  const coverage = tokenCoverage(descriptionQuery, tokenize(candidateText));
  const productPoints = partialCode
    ? 30
    : Math.min(30, Math.round(30 * coverage));

  const dimensionPoints = manualDimensionMatches(fabricante, query, entry)
    ? 25
    : 0;

  const normalizedDescription = normalizeText(descriptionQuery);
  const family = normalizeText(entry.variant.familia);
  const requestedCiserLine = fabricante === "CISER"
    ? extractRequestedLine(query)
    : "";
  const lineMatches = fabricante === "CISER"
    ? Boolean(requestedCiserLine) &&
      normalizeCatalogCode(entry.product.linha) === normalizeCatalogCode(requestedCiserLine)
    : Boolean(family) &&
      new RegExp(`\\b${family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
        .test(normalizedDescription);
  const linePoints = lineMatches ? 20 : 0;

  const finishQuery = manualFinishQuery(query);
  const candidateFinish = normalizeText(
    `${entry.variant.acabamento} ${entry.variant.sistema} ${entry.variant.detalhe}`
  );
  const finishTokens = tokenize(finishQuery);
  const finishPoints = finishTokens.length &&
    finishTokens.every((token) =>
      tokenize(candidateFinish).some((candidate) => tokenMatches(token, candidate)))
    ? 15
    : 0;

  const reference = normalizeCatalogCode(entry.variant.referencia);
  const referencePoints = codeFragments.some((fragment) =>
    fragment.length >= 2 &&
    (reference.includes(fragment) || candidateCode.includes(fragment)))
    ? 10
    : 0;

  return {
    score:
      productPoints +
      dimensionPoints +
      linePoints +
      finishPoints +
      referencePoints,
    breakdown: {
      produto: productPoints,
      dimensao: dimensionPoints,
      linha: linePoints,
      acabamento: finishPoints,
      referencia: referencePoints
    }
  };
}

function normalizeManualCatalogResult(fabricante, entry, scored) {
  return {
    fabricante,
    linha: String(entry.product.linha || entry.variant.familia || ""),
    produto: String(entry.product.nome || ""),
    dimensao: [entry.variant.dimensao, entry.variant.comprimento]
      .filter(Boolean)
      .join(" × "),
    referencia: String(entry.variant.referencia || ""),
    acabamento: String(
      entry.variant.acabamento || entry.variant.sistema || ""
    ),
    codigoFinal: String(entry.variant.tag || entry.variant.codigo || ""),
    pagina: String(
      entry.variant.paginaCatalogo || entry.product.paginaCatalogo || ""
    ),
    confianca: scored.score
  };
}

function searchMultiCatalog(query, options = {}) {
  const limitPerManufacturer = options.limitPerManufacturer || 5;
  const selected = new Set(
    options.manufacturers?.length
      ? options.manufacturers
      : MANUFACTURER_ORDER
  );
  const registry = getCatalogRegistry();
  const grouped = Object.fromEntries(
    MANUFACTURER_ORDER.map((fabricante) => [fabricante, []])
  );

  MANUFACTURER_ORDER.forEach((fabricante) => {
    if (!selected.has(fabricante)) return;
    const config = registry[fabricante];
    const specialized = config.search(query, Math.max(20, limitPerManufacturer * 4));
    const pool = [...specialized.matches, ...config.entries];
    const seen = new Set();
    const ranked = [];

    pool.forEach((entry) => {
      const key =
        `${normalizeCatalogCode(entry.variant.tag)}|` +
        `${normalizeText(entry.product.nome)}`;
      if (!entry.variant.tag || seen.has(key)) return;
      seen.add(key);
      const scored = scoreManualCatalogResult(fabricante, query, entry);
      const descriptionTokens = tokenize(
        `${query.descricao} ${query.especificacao}`
      ).filter((token) =>
        !["ciser", "elecon", "daisa", "arcelor", "arcelormittal", "burndy"]
          .includes(token));
      const hasIdentityMatch =
        scored.breakdown.produto > 0 ||
        scored.breakdown.linha > 0 ||
        scored.breakdown.referencia > 0;
      if (
        scored.score < 15 ||
        (descriptionTokens.length > 0 && !hasIdentityMatch)
      ) {
        return;
      }
      ranked.push({
        normalized: normalizeManualCatalogResult(fabricante, entry, scored),
        breakdown: scored.breakdown
      });
    });

    grouped[fabricante] = ranked
      .sort((left, right) =>
        right.normalized.confianca - left.normalized.confianca ||
        left.normalized.codigoFinal.localeCompare(right.normalized.codigoFinal))
      .slice(0, limitPerManufacturer)
      .map(({ normalized }) => normalized);
  });

  return grouped;
}

function createCatalogEntries(catalogo) {
  if (catalogo === CATALOGO_PRODUTOS) return catalogVariants;
  const entries = [];
  const seen = new Set();
  catalogo.forEach((product) => {
    (product.variantes || []).forEach((variant) => {
      const tag = normalizarTexto(variant.tag).replace(/[^a-z0-9]/g, "");
      if (!tag || seen.has(tag)) return;
      seen.add(tag);
      entries.push({
        marca: "CISER",
        product,
        variant,
        candidateTokens: tokenize(
          `${product.nome} ${product.rosca} ${product.material} ${product.categoria}`
        )
      });
    });
  });
  return entries;
}

function buscarProdutoPorLinha(catalogo, linha) {
  const normalizedLine = normalizarTexto(linha).replace(/[^a-z0-9]/g, "");
  return catalogo.filter((product) =>
    normalizarTexto(product.linha).replace(/[^a-z0-9]/g, "") === normalizedLine);
}

function buscarReferenciaNaTabela(produtosCatalogo, dimensoesExtraidas) {
  const products = Array.isArray(produtosCatalogo)
    ? produtosCatalogo
    : [produtosCatalogo].filter(Boolean);
  const dimensionText = dimensoesExtraidas.lista.join(" ");
  const matches = [];

  products.forEach((product) => {
    product.variantes.forEach((variant) => {
      const qualidade = dimensionMatchQuality(dimensionText, variant);
      if (qualidade > 0) matches.push({ product, variant, qualidade });
    });
  });

  return matches.sort((a, b) => b.qualidade - a.qualidade);
}

function verificarAcabamentoDisponivel(
  produtosCatalogo,
  referencia,
  codigoAcabamento
) {
  const products = Array.isArray(produtosCatalogo)
    ? produtosCatalogo
    : [produtosCatalogo].filter(Boolean);
  for (const product of products) {
    const variant = product.variantes.find((item) =>
      item.referencia === referencia &&
      item.acabamentoCodigo === codigoAcabamento);
    if (variant) return { product, variant };
  }
  return null;
}

function montarCodigoFinal(linha, referencia, codigoAcabamento) {
  return `${linha}${referencia}${codigoAcabamento}`;
}

function scoreCandidate(query, entry) {
  const exactTag =
    normalizeText(query.codigoFabricante).replace(/\D/g, "") === entry.variant.tag.replace(/\D/g, "");
  if (exactTag && entry.variant.tag) {
    return { score: 100, breakdown: { linha: 30, tipo: 25, dimensao: 20, acabamento: 15, materialRosca: 10 } };
  }

  const descriptionQuery = `${query.descricao} ${query.especificacao}`;
  const dimensionQuery = `${query.dimensao} ${query.tamanho} ${query.descricao} ${query.especificacao}`;
  const finishQuery = `${query.acabamento} ${query.descricao} ${query.especificacao}`;
  const materialQuery = `${query.material} ${query.rosca} ${query.descricao} ${query.especificacao}`;
  const requestedLine = extractRequestedLine(query);
  const breakdown = {
    linha: lineScore(requestedLine, entry.product, entry.variant),
    tipo: productTypeScore(descriptionQuery, entry),
    dimensao: dimensionScore(dimensionQuery, entry.variant),
    acabamento: finishScore(finishQuery, entry.variant),
    materialRosca: materialOrThreadScore(materialQuery, entry.product)
  };

  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { score: Math.min(100, Math.round(score)), breakdown };
}

function buildSearchDiagnostic(query) {
  const descricaoOriginal = String(query.descricao || query.especificacao || "");
  const dimensaoOriginal = [query.dimensao, query.tamanho].filter(Boolean).join(" ");
  const linhaExtraida = extractRequestedLine(query);
  const dimensoesExtraidas = extrairDimensoes(
    dimensaoOriginal || descricaoOriginal
  );
  const acabamento = identificarAcabamento(
    `${query.acabamento} ${descricaoOriginal}`
  );
  return {
    item: query.item || query.codigoFabricante || "",
    descricaoOriginal,
    dimensaoOriginal,
    linhaExtraida,
    dimensoesExtraidas: dimensoesExtraidas.lista,
    acabamentoExtraido: acabamento.nome,
    codigoAcabamento: acabamento.codigo,
    produtosCandidatos: [],
    produtoEscolhido: "",
    referenciaEncontrada: "",
    codigoFinal: "",
    motivoFalha: ""
  };
}

function searchCatalog(query, limit = 1, options = {}) {
  const strict = options.strict !== false;
  const catalogo = options.catalogo || CATALOGO_PRODUTOS;
  const diagnostic = buildSearchDiagnostic(query);
  const queryTokens = tokenize(`${query.descricao} ${query.especificacao}`);
  const line = diagnostic.linhaExtraida;
  const dimensionQuery = [query.dimensao, query.tamanho].filter(Boolean).join(" ") ||
    `${query.descricao} ${query.especificacao}`;
  const finishCode = diagnostic.codigoAcabamento;
  const exactCode = normalizeText(query.codigoFabricante).replace(/[^a-z0-9]/g, "");
  let candidates = createCatalogEntries(catalogo);
  const exactEntry = candidates.find(({ variant }) =>
    normalizarTexto(variant.tag).replace(/[^a-z0-9]/g, "") === exactCode);
  if (exactEntry) {
    const match = { ...exactEntry, ...scoreCandidate(query, exactEntry) };
    diagnostic.produtosCandidatos = [exactEntry.product.nome];
    diagnostic.produtoEscolhido = exactEntry.product.nome;
    diagnostic.referenciaEncontrada = exactEntry.variant.referencia;
    diagnostic.codigoFinal = exactEntry.variant.tag;
    if (options.debug) console.log(diagnostic);
    return { matches: [match].slice(0, limit), diagnostic };
  }

  if (line) {
    const lineProducts = buscarProdutoPorLinha(catalogo, line);
    diagnostic.produtosCandidatos = [
      ...new Set(lineProducts.map((product) => product.nome))
    ];
    if (!lineProducts.length) {
      diagnostic.motivoFalha = `Linha ${line} não encontrada no catalogo-data`;
      if (options.debug) console.log(diagnostic);
      return { matches: [], diagnostic };
    }
    const productSet = new Set(lineProducts);
    candidates = candidates.filter(({ product }) => productSet.has(product));
  } else if (strict) {
    diagnostic.motivoFalha = "Linha do catálogo não encontrada na planilha";
    if (options.debug) console.log(diagnostic);
    return { matches: [], diagnostic };
  } else if (queryTokens.length) {
    const tokenFiltered = candidates.filter(({ candidateTokens }) =>
      queryTokens.some((queryToken) =>
        candidateTokens.some((candidateToken) => tokenMatches(queryToken, candidateToken))));
    if (tokenFiltered.length) candidates = tokenFiltered;
  }

  const descriptionQuery = `${query.descricao} ${query.especificacao}`;
  const requestedProductType = PRODUCT_WORDS.find((word) =>
    tokenize(descriptionQuery).includes(word));
  if (requestedProductType) {
    candidates = candidates.filter((entry) =>
      entry.candidateTokens.includes(requestedProductType));
    if (!candidates.length) {
      diagnostic.motivoFalha =
        `Produto ${requestedProductType} não encontrado na linha ${line}`;
      if (options.debug) console.log(diagnostic);
      return { matches: [], diagnostic };
    }
  }

  diagnostic.produtosCandidatos = [
    ...new Set(candidates.map(({ product }) => product.nome))
  ];

  if (strict && !diagnostic.dimensoesExtraidas.length) {
    diagnostic.motivoFalha = "Dimensão não identificada nos dados da planilha";
    if (options.debug) console.log(diagnostic);
    return { matches: [], diagnostic };
  }

  candidates = candidates
    .map((entry) => ({
      ...entry,
      dimensionQuality: dimensionMatchQuality(dimensionQuery, entry.variant)
    }))
    .filter((entry) => !strict || entry.dimensionQuality > 0);
  if (strict && !candidates.length) {
    diagnostic.motivoFalha =
      `Dimensão ${diagnostic.dimensoesExtraidas.join(", ")} não encontrada na linha ${line}`;
    if (options.debug) console.log(diagnostic);
    return { matches: [], diagnostic };
  }

  if (strict && !finishCode) {
    diagnostic.motivoFalha = "Acabamento não identificado";
    if (options.debug) console.log(diagnostic);
    return { matches: [], diagnostic };
  }

  if (finishCode) {
    const withFinish = candidates.filter(({ variant }) =>
      variant.acabamentoCodigo === finishCode);
    if (strict && !withFinish.length) {
      const reference = candidates[0]?.variant.referencia || "";
      diagnostic.referenciaEncontrada = reference;
      diagnostic.motivoFalha = reference
        ? `Acabamento ${finishCode} não disponível para a referência ${reference}`
        : `Acabamento ${finishCode} não encontrado na linha ${line}`;
      if (options.debug) console.log(diagnostic);
      return { matches: [], diagnostic };
    }
    if (withFinish.length) candidates = withFinish;
  }

  const matches = candidates
    .map((entry) => {
      const scored = { ...entry, ...scoreCandidate(query, entry) };
      if (!strict) return scored;
      const structuralConfidence = entry.dimensionQuality >= 90 ? 95 : 85;
      return { ...scored, score: Math.max(scored.score, structuralConfidence) };
    })
    .sort((a, b) =>
      (b.dimensionQuality || 0) - (a.dimensionQuality || 0) ||
      b.score - a.score)
    .slice(0, limit);

  const chosen = matches[0];
  if (chosen) {
    const codigoFinal = montarCodigoFinal(
      chosen.product.linha,
      chosen.variant.referencia,
      chosen.variant.acabamentoCodigo
    );
    if (codigoFinal !== chosen.variant.tag) {
      diagnostic.motivoFalha = "Referência encontrada, mas a TAG da tabela é inconsistente";
      if (options.debug) console.log(diagnostic);
      return { matches: [], diagnostic };
    }
    diagnostic.produtoEscolhido = chosen.product.nome;
    diagnostic.referenciaEncontrada = chosen.variant.referencia;
    diagnostic.codigoFinal = codigoFinal;
  } else {
    diagnostic.motivoFalha = "Referência não encontrada";
  }
  if (options.debug) console.log(diagnostic);
  return { matches, diagnostic };
}

function searchAllCatalogs(query, limit = 1, options = {}) {
  const ciser = searchCatalog(query, limit, {
    ...options,
    debug: false,
    catalogo: CATALOGO_PRODUTOS
  });
  const hasExplicitCiserLine = Boolean(extractRequestedLine(query));
  const daisa = hasExplicitCiserLine
    ? {
        matches: [],
        diagnostic: {
          motivoFalha: "Busca DAISA ignorada porque há linha Ciser explícita"
        }
      }
    : searchDaisaCatalog(query, limit, options);
  const elecon = hasExplicitCiserLine
    ? {
        matches: [],
        diagnostic: {
          motivoFalha: "Busca Elecon ignorada porque há linha Ciser explícita"
        }
      }
    : searchEleconCatalog(query, limit, options);
  const arcelor = hasExplicitCiserLine
    ? {
        matches: [],
        diagnostic: {
          motivoFalha: "Busca ArcelorMittal ignorada porque há linha Ciser explícita"
        }
      }
    : searchArcelorCatalog(query, limit, options);
  const burndy = hasExplicitCiserLine
    ? {
        matches: [],
        diagnostic: {
          motivoFalha: "Busca BURNDY ignorada porque há linha Ciser explícita"
        }
      }
    : searchBurndyCatalog(query, limit, options);
  const matches = [
    ...ciser.matches,
    ...daisa.matches,
    ...elecon.matches,
    ...arcelor.matches,
    ...burndy.matches
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const chosen = matches[0];
  const diagnostic = hasExplicitCiserLine
    ? ciser.diagnostic
    : chosen?.marca === "DAISA"
    ? daisa.diagnostic
    : chosen?.marca === "ELECON"
      ? elecon.diagnostic
    : chosen?.marca === "ARCELORMITTAL"
      ? arcelor.diagnostic
    : chosen?.marca === "BURNDY"
      ? burndy.diagnostic
    : ciser.diagnostic.motivoFalha && !chosen
      ? {
          ...ciser.diagnostic,
          motivoFalha:
            `${ciser.diagnostic.motivoFalha}; ${daisa.diagnostic.motivoFalha}; ` +
            `${elecon.diagnostic.motivoFalha}; ${arcelor.diagnostic.motivoFalha}; ` +
            `${burndy.diagnostic.motivoFalha}`
        }
      : ciser.diagnostic;
  if (options.debug) console.log(diagnostic);
  return { matches, diagnostic };
}

function findMatches(query, limit = 1, options = {}) {
  return searchAllCatalogs(query, limit, options).matches;
}

function encontrarCodigoProduto(produtoPlanilha, catalogo = CATALOGO_PRODUTOS) {
  const { matches, diagnostic } = catalogo === CATALOGO_PRODUTOS
    ? searchAllCatalogs(produtoPlanilha, 1, { strict: true, debug: true })
    : searchCatalog(produtoPlanilha, 1, {
        strict: true,
        debug: true,
        catalogo
      });
  const match = matches[0];
  if (!match) {
    return {
      encontrado: false,
      codigoFinal: "N/E",
      motivo: diagnostic.motivoFalha,
      motivoFalha: diagnostic.motivoFalha,
      confianca: 0
    };
  }

  return {
    encontrado: true,
    necessitaRevisao: false,
    codigoFinal: match.variant.tag,
    marca: match.marca || "CISER",
    linhaCatalogo: match.product.linha,
    produtoCatalogo: match.product.nome,
    descricaoCatalogo: match.product.nome,
    referencia: match.variant.referencia,
    dimensaoEncontrada: [match.variant.dimensao, match.variant.comprimento]
      .filter(Boolean)
      .join(" × "),
    acabamento: match.variant.acabamento,
    acabamentoEncontrado: match.variant.acabamento,
    codigoAcabamento: match.variant.acabamentoCodigo,
    embalagem: match.variant.embalagem || "",
    paginaCatalogo: match.variant.paginaCatalogo || match.product.paginaCatalogo,
    confianca: match.score
  };
}

function getStatus(score) {
  if (score >= 80) return "Encontrado";
  if (score >= 50) return "Revisar";
  return "Não encontrado";
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function initializeDatabaseSummary() {
  const allProducts = [
    ...CATALOGO_PRODUTOS,
    ...DAISA_PRODUCTS,
    ...ELECON_PRODUCTS,
    ...ARCELOR_PRODUCTS,
    ...BURNDY_PRODUCTS
  ];
  const totalVariants =
    catalogVariants.length +
    daisaCatalogVariants.length +
    eleconCatalogVariants.length +
    arcelorCatalogVariants.length +
    burndyCatalogVariants.length;
  const categories = new Set(allProducts.map((product) => product.categoria));
  document.querySelector("#stat-products").textContent = formatNumber(allProducts.length);
  document.querySelector("#stat-variants").textContent = formatNumber(totalVariants);
  document.querySelector("#stat-categories").textContent = categories.size;
  document.querySelector("#database-summary").textContent =
    `${formatNumber(totalVariants)} códigos em 5 catálogos disponíveis`;
  elements.manualFeedback.textContent =
    `Informe os dados acima para consultar ${formatNumber(totalVariants)} combinações das cinco bases.`;
}

function activateTab(tabName) {
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  elements.panels.forEach((panel) =>
    panel.classList.toggle("active", panel.id === `${tabName}-panel`));
}

function activateStage(stageId, step) {
  elements.stages.forEach((stage) => stage.classList.toggle("active", stage.id === stageId));
  elements.steps.forEach((stepElement) => {
    const number = Number(stepElement.dataset.step);
    stepElement.classList.toggle("active", number === step);
    stepElement.classList.toggle("complete", number < step);
  });
}

function getWorksheetCellValue(worksheet, rowIndex, columnIndex) {
  const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
  if (!cell) return "";
  if (cell.w !== undefined) return String(cell.w);
  if (cell.v && typeof cell.v === "object") {
    if (cell.v.richText) {
      return cell.v.richText.map((part) => part.text || "").join("");
    }
    if (cell.v.text !== undefined) return String(cell.v.text);
    if (cell.v.result !== undefined) return String(cell.v.result);
  }
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  return "";
}

function normalizarHeader(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function headerMatchScore(value) {
  const normalized = normalizarHeader(value);
  if (normalized === "observacoes") return 100;
  if (normalized === "observacao") return 95;
  if (/^observac(?:ao|oes)?\b/.test(normalized)) return 85;
  if (normalized.includes("observac")) return 70;
  return 0;
}

function excelJsCellText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text || "").join("");
  }
  if (value.text !== undefined) return String(value.text);
  if (value.result !== undefined) return String(value.result);
  if (value.formula !== undefined && value.result !== undefined) {
    return String(value.result);
  }
  return String(value);
}

function localizarColunaObservacoes(worksheet) {
  const candidates = [];

  if (worksheet?.getRow) {
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const value = excelJsCellText(cell.value);
        const score = headerMatchScore(value);
        if (score) {
          candidates.push({
            rowIndex: rowNumber - 1,
            columnIndex: colNumber - 1,
            value,
            score
          });
        }
      });
    });
  } else {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const value = getWorksheetCellValue(worksheet, row, col);
        const score = headerMatchScore(value);
        if (score) candidates.push({ rowIndex: row, columnIndex: col, value, score });
      }
    }
  }

  candidates.sort((a, b) =>
    b.score - a.score ||
    a.rowIndex - b.rowIndex ||
    a.columnIndex - b.columnIndex);
  const selected = candidates[0];
  if (!selected) {
    console.log({ headersEncontrados: [], colunaObservacoes: null });
    throw new Error(
      "Coluna Observações não encontrada mesmo após busca flexível"
    );
  }

  const headersEncontrados = [];
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  if (worksheet?.getRow) {
    const headerRow = worksheet.getRow(selected.rowIndex + 1);
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      const value = excelJsCellText(cell.value).trim();
      if (value) headersEncontrados.push(value);
    });
  } else {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const value = getWorksheetCellValue(
        worksheet,
        selected.rowIndex,
        col
      ).trim();
      if (value) headersEncontrados.push(value);
    }
  }
  console.log({
    headersEncontrados,
    colunaObservacoes: selected.columnIndex + 1
  });
  return selected;
}

function encontrarColunaObservacoes(worksheet) {
  return localizarColunaObservacoes(worksheet).columnIndex + 1;
}

function localizarCabecalhoExato(worksheet, nome) {
  if (normalizarHeader(nome).includes("observac")) {
    return localizarColunaObservacoes(worksheet);
  }

  if (worksheet?.getRow) {
    let selected = null;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (
          !selected &&
          normalizarHeader(excelJsCellText(cell.value)) === normalizarHeader(nome)
        ) {
          selected = { rowIndex: rowNumber - 1, columnIndex: colNumber - 1 };
        }
      });
    });
    if (selected) return selected;
  } else {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        if (
          normalizarHeader(getWorksheetCellValue(worksheet, row, col)) ===
          normalizarHeader(nome)
        ) {
          return { rowIndex: row, columnIndex: col };
        }
      }
    }
  }
  throw new Error(`Coluna ${nome} não encontrada`);
}

function encontrarIndiceColuna(worksheet, nome) {
  if (normalizarHeader(nome).includes("observac")) {
    return encontrarColunaObservacoes(worksheet);
  }
  return localizarCabecalhoExato(worksheet, nome).columnIndex + 1;
}

function loadSelectedSheet() {
  const sheet = state.workbook.Sheets[elements.sheetSelect.value];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const header = localizarCabecalhoExato(sheet, "Observações");
  state.headerRowIndex = header.rowIndex;
  state.headers = [];
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    state.headers.push(
      getWorksheetCellValue(sheet, state.headerRowIndex, col).trim() ||
      `Coluna ${col + 1}`
    );
  }

  state.rows = [];
  for (let rowIndex = state.headerRowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const row = state.headers.map((_, relativeColumn) =>
      getWorksheetCellValue(sheet, rowIndex, range.s.c + relativeColumn));
    const data = Object.fromEntries(
      state.headers.map((headerName, index) => [headerName, row[index] ?? ""])
    );
    Object.defineProperty(data, "__excelRow", {
      value: rowIndex,
      enumerable: false
    });
    if (Object.values(data).some((cell) => String(cell).trim())) {
      state.rows.push(data);
    }
  }

  elements.fileDetails.textContent =
    `${formatNumber(state.rows.length)} linhas · ${state.headers.length} colunas`;
}

async function handleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    window.alert("Selecione um arquivo XLSX para preservar integralmente o layout.");
    return;
  }

  try {
    const data = await file.arrayBuffer();
    state.originalBuffer = data.slice(0);
    state.workbook = XLSX.read(data, {
      type: "array",
      cellDates: true,
      cellStyles: true,
      bookVBA: true
    });
    state.file = file;
    elements.sheetSelect.replaceChildren();

    state.workbook.SheetNames.forEach((sheetName) => {
      const option = document.createElement("option");
      option.value = sheetName;
      option.textContent = sheetName;
      elements.sheetSelect.appendChild(option);
    });

    loadSelectedSheet();
    elements.fileName.textContent = file.name;
    elements.fileSummary.hidden = false;
  } catch (error) {
    window.alert(`Não foi possível ler a planilha: ${error.message}`);
  }
}

function autoMapField(field) {
  const normalizedHeaders = state.headers.map((header) => normalizeText(header));
  const exactIndex = normalizedHeaders.findIndex((header) =>
    field.aliases.some((alias) => header === normalizeText(alias)));
  if (exactIndex >= 0) return state.headers[exactIndex];

  const partialIndex = normalizedHeaders.findIndex((header) =>
    field.aliases.some((alias) =>
      header.includes(normalizeText(alias)) || normalizeText(alias).includes(header)));
  return partialIndex >= 0 ? state.headers[partialIndex] : "";
}

function renderMapping() {
  elements.mappingGrid.replaceChildren();
  state.mapping = {};

  FIELD_DEFINITIONS.forEach((field) => {
    const wrapper = document.createElement("div");
    wrapper.className = `mapping-field${field.required ? " required" : ""}`;
    const label = document.createElement("label");
    label.htmlFor = `map-${field.key}`;
    label.textContent = field.label;
    const select = document.createElement("select");
    select.id = `map-${field.key}`;
    select.dataset.field = field.key;
    select.innerHTML = '<option value="">Não mapear</option>';

    state.headers.forEach((header) => {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      select.appendChild(option);
    });

    select.value = autoMapField(field);
    state.mapping[field.key] = select.value;
    select.addEventListener("change", () => {
      state.mapping[field.key] = select.value;
    });

    wrapper.append(label, select);
    elements.mappingGrid.appendChild(wrapper);
  });
}

function renderPreview() {
  const headers = state.headers.slice(0, 8);
  const rows = state.rows.slice(0, 5);
  elements.previewTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map((row) => `
        <tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>
      `).join("")}
    </tbody>
  `;
  elements.rowCount.textContent = `${formatNumber(state.rows.length)} linhas para processar`;
}

function mappedQuery(row) {
  return Object.fromEntries(
    FIELD_DEFINITIONS
      .filter((field) => !field.destination)
      .map((field) => [field.key, state.mapping[field.key] ? row[state.mapping[field.key]] : ""])
  );
}

function findObservationHeader() {
  return state.headers.find((header) =>
    headerMatchScore(header) > 0) || "";
}

function isSearchableProductRow(query) {
  const description = `${query.descricao} ${query.especificacao}`.trim();
  const dimensionSource = `${query.dimensao} ${query.tamanho}`.trim() || description;
  const dimensions = extrairDimensoes(dimensionSource);
  const line = extractRequestedLine(query);
  return Boolean(
    (description || String(query.codigoFabricante || "").trim()) &&
    (line || dimensions.lista.length)
  );
}

function logCriticalSearchDebug({
  linhaDetectada,
  dimensaoDetectada,
  acabamentoDetectado,
  colunaObservacoesIndex,
  codigoFinalEncontrado,
  status
}) {
  const entry = {
    linhaDetectada,
    dimensaoDetectada,
    acabamentoDetectado,
    colunaObservacoesIndex,
    codigoFinalEncontrado,
    status
  };
  console.log(entry);
  return entry;
}

function runCrossing() {
  if (!state.mapping.descricao && !state.mapping.codigoFabricante) {
    window.alert("Mapeie ao menos a coluna Descrição ou Código fabricante.");
    return;
  }
  const observationHeader = findObservationHeader();
  if (!observationHeader) {
    window.alert("Mapeie a coluna Observações, que receberá o código final.");
    return;
  }
  state.mapping.observacoes = observationHeader;
  const worksheet = state.workbook.Sheets[elements.sheetSelect.value];
  const observationColumnIndex = encontrarIndiceColuna(
    worksheet,
    "Observações"
  );

  elements.runCrossing.disabled = true;
  elements.runCrossing.textContent = "Cruzando produtos...";

  window.setTimeout(() => {
    state.results = state.rows.flatMap((original, index) => {
      const query = mappedQuery(original);
      query.item = original.Item || original.item || index + 1;
      if (!isSearchableProductRow(query)) {
        logCriticalSearchDebug({
          linhaDetectada: "",
          dimensaoDetectada: [],
          acabamentoDetectado: "",
          colunaObservacoesIndex: observationColumnIndex,
          codigoFinalEncontrado: "",
          status: "Ignorado: linha sem dados suficientes de produto"
        });
        return [];
      }

      const { matches: candidates, diagnostic } = searchAllCatalogs(
        query,
        6,
        { strict: true, debug: true }
      );
      const match = candidates[0];
      const score = match?.score || 0;
      const alternatives = candidates.filter((candidate) =>
        candidate.score >= 50 && candidate.score >= score - 12);
      const ambiguous =
        alternatives.length > 1 &&
        alternatives[1].score >= score - 3 &&
        alternatives[1].variant.tag !== match?.variant.tag;
      const status = ambiguous && score >= 80 ? "Revisar" : getStatus(score);
      logCriticalSearchDebug({
        linhaDetectada: diagnostic.linhaExtraida,
        dimensaoDetectada: diagnostic.dimensoesExtraidas,
        acabamentoDetectado:
          diagnostic.codigoAcabamento || diagnostic.acabamentoExtraido,
        colunaObservacoesIndex: observationColumnIndex,
        codigoFinalEncontrado: match?.variant.tag || "N/E",
        status
      });

      return [{
        id: index + 1,
        excelRow: original.__excelRow,
        original,
        query,
        status,
        score,
        match: status === "Não encontrado" ? null : match,
        motivoFalha: diagnostic.motivoFalha,
        alternatives,
        confirmed: status === "Encontrado",
        editedTag:
          status === "Encontrado"
            ? match.variant.tag
            : status === "Não encontrado"
              ? "N/E"
              : ""
      }];
    });

    state.page = 1;
    applyResultFilters();
    updateResultStats();
    activateStage("results-stage", 3);
    elements.runCrossing.disabled = false;
    elements.runCrossing.textContent = "Cruzar produtos";
  }, 30);
}

function sourceSummary(result) {
  const description = result.query.descricao || result.query.especificacao || "Sem descrição";
  const details = [
    result.query.dimensao,
    result.query.tamanho,
    result.query.acabamento,
    result.query.rosca
  ].filter(Boolean).join(" · ");
  return { description, details };
}

function renderResults() {
  const start = (state.page - 1) * state.pageSize;
  const pageResults = state.filteredResults.slice(start, start + state.pageSize);

  elements.resultsBody.innerHTML = pageResults.map((result) => {
    const source = sourceSummary(result);
    const match = result.match;
    const confidenceClass = result.score >= 80 ? "high" : result.score >= 50 ? "medium" : "low";
    const alternatives = result.alternatives || [];
    const alternativesControl = alternatives.length > 1
      ? `
        <select class="alternative-select" data-result-id="${result.id}" aria-label="Escolher correspondência">
          ${alternatives.map((alternative) => `
            <option value="${escapeHtml(alternative.variant.tag)}"
              ${alternative.variant.tag === match?.variant.tag ? "selected" : ""}>
              ${escapeHtml(alternative.marca || "CISER")} ·
              ${escapeHtml(alternative.product.linha)} ·
              ${escapeHtml(alternative.variant.dimensao)} ·
              ${escapeHtml(alternative.variant.acabamento)} ·
              ${escapeHtml(alternative.variant.tag)} (${alternative.score}%)
            </option>
          `).join("")}
        </select>
      `
      : "";

    return `
      <tr>
        <td>${result.id}</td>
        <td class="source-data">
          <strong>${escapeHtml(source.description)}</strong>
          <span>${escapeHtml(source.details || result.query.codigoFabricante)}</span>
        </td>
        <td class="catalog-match">
          ${match
            ? `<strong>${escapeHtml(match.product.nome)}</strong>
               <span>${escapeHtml(match.marca || "CISER")} ·
               ${escapeHtml(match.product.categoria)} · ${escapeHtml(match.product.rosca)}</span>
               ${alternativesControl}`
            : '<span class="not-found">Não encontrado</span>'}
        </td>
        <td class="line-code">${match
          ? `${escapeHtml(match.marca || "CISER")} · ${escapeHtml(match.product.linha)}`
          : "—"}</td>
        <td>${match
          ? `${escapeHtml(match.variant.dimensao)} × ${escapeHtml(match.variant.comprimento)}`
          : "—"}</td>
        <td>${match
          ? match.marca !== "CISER"
            ? `${escapeHtml(match.variant.referencia)} · ${escapeHtml(match.variant.codigoBase)}`
            : `${escapeHtml(match.variant.referencia)} · emb. ${escapeHtml(match.variant.embalagem || "—")}`
          : "—"}</td>
        <td>${match ? escapeHtml(match.variant.acabamento) : "—"}</td>
        <td>
          <input
            class="tag-input"
            type="text"
            value="${escapeHtml(result.editedTag)}"
            data-result-id="${result.id}"
            aria-label="Editar TAG da linha ${result.id}"
            placeholder="${match ? `Sugestão: ${escapeHtml(match.variant.tag)}` : "N/E"}"
          >
          ${result.status === "Revisar"
            ? `<button class="use-suggestion" type="button" data-result-id="${result.id}">Usar sugestão</button>`
            : ""}
        </td>
        <td class="page-code">${match ? escapeHtml(match.product.paginaCatalogo) : "—"}</td>
        <td><span class="confidence ${confidenceClass}">${result.score}% · ${result.status}</span></td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".tag-input").forEach((input) => {
    input.addEventListener("change", () => {
      const result = state.results.find((item) => item.id === Number(input.dataset.resultId));
      if (!result) return;
      const enteredValue = input.value.trim();
      const normalizedValue = normalizeText(enteredValue);
      result.editedTag = enteredValue || "N/E";
      result.confirmed =
        Boolean(enteredValue) &&
        normalizedValue !== "codigo nao encontrado" &&
        normalizedValue !== "nao encontrado" &&
        normalizedValue !== "n/e";
      result.status = result.confirmed ? "Encontrado" : "Não encontrado";
      updateResultStats();
      applyResultFilters();
    });
  });

  document.querySelectorAll(".alternative-select").forEach((select) => {
    select.addEventListener("change", () => {
      const result = state.results.find((item) => item.id === Number(select.dataset.resultId));
      const selected = result?.alternatives.find(
        (alternative) => alternative.variant.tag === select.value
      );
      if (!result || !selected) return;
      result.match = selected;
      result.score = selected.score;
      result.editedTag = selected.variant.tag;
      result.confirmed = true;
      result.status = "Encontrado";
      updateResultStats();
      applyResultFilters();
    });
  });

  document.querySelectorAll(".use-suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      const result = state.results.find((item) => item.id === Number(button.dataset.resultId));
      if (!result?.match) return;
      result.editedTag = result.match.variant.tag;
      result.confirmed = true;
      result.status = "Encontrado";
      updateResultStats();
      applyResultFilters();
    });
  });

  renderPagination();
}

function renderPagination() {
  const pages = Math.ceil(state.filteredResults.length / state.pageSize);
  elements.pagination.replaceChildren();
  if (pages <= 1) return;

  const visiblePages = Array.from({ length: pages }, (_, index) => index + 1)
    .filter((page) => page === 1 || page === pages || Math.abs(page - state.page) <= 2);

  visiblePages.forEach((page, index) => {
    if (index && page - visiblePages[index - 1] > 1) {
      const gap = document.createElement("span");
      gap.textContent = "…";
      elements.pagination.appendChild(gap);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = page;
    button.classList.toggle("active", page === state.page);
    button.addEventListener("click", () => {
      state.page = page;
      renderResults();
    });
    elements.pagination.appendChild(button);
  });
}

function applyResultFilters() {
  const term = normalizeText(elements.resultFilter.value);
  const status = elements.statusFilter.value;

  state.filteredResults = state.results.filter((result) => {
    const haystack = normalizeText([
      ...Object.values(result.original),
      result.match?.product.nome,
      result.match?.product.linha,
      result.editedTag
    ].join(" "));
    return (!term || haystack.includes(term)) && (!status || result.status === status);
  });

  const pages = Math.max(1, Math.ceil(state.filteredResults.length / state.pageSize));
  state.page = Math.min(state.page, pages);
  renderResults();
}

function updateResultStats() {
  const counts = {
    "Encontrado": 0,
    "Revisar": 0,
    "Não encontrado": 0
  };
  state.results.forEach((result) => {
    counts[result.status] += 1;
  });
  document.querySelector("#total-result").textContent = state.results.length;
  document.querySelector("#found-result").textContent = counts.Encontrado;
  document.querySelector("#review-result").textContent = counts.Revisar;
  document.querySelector("#not-found-result").textContent = counts["Não encontrado"];
}

function decodeXml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getXmlAttribute(fragment, attributeName) {
  return fragment.match(
    new RegExp(`\\b${attributeName.replace(":", "\\:")}="([^"]*)"`)
  )?.[1] || "";
}

function normalizeZipPath(basePath, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${basePath}/${target}`.split("/");
  const normalized = [];
  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  });
  return normalized.join("/");
}

async function findWorksheetXmlPath(zip, sheetName) {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relationshipsXml = await zip
    .file("xl/_rels/workbook.xml.rels")
    ?.async("string");
  if (!workbookXml || !relationshipsXml) {
    throw new Error("Estrutura interna do XLSX não reconhecida.");
  }

  const sheetFragments = workbookXml.match(/<sheet\b[^>]*\/?>/g) || [];
  const sheet = sheetFragments.find(
    (fragment) => decodeXml(getXmlAttribute(fragment, "name")) === sheetName
  );
  if (!sheet) {
    throw new Error(`A aba "${sheetName}" não foi encontrada no arquivo original.`);
  }

  const relationshipId = getXmlAttribute(sheet, "r:id");
  const relationships = relationshipsXml.match(/<Relationship\b[^>]*\/?>/g) || [];
  const relationship = relationships.find(
    (fragment) => getXmlAttribute(fragment, "Id") === relationshipId
  );
  const target = relationship && getXmlAttribute(relationship, "Target");
  if (!target) {
    throw new Error(`Não foi possível localizar o XML da aba "${sheetName}".`);
  }
  return normalizeZipPath("xl", target);
}

function replaceCellValue(sheetXml, cellReference, value) {
  const escapedReference = cellReference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cellPattern = new RegExp(
    `<c\\b([^>]*\\br="${escapedReference}"[^>]*)>([\\s\\S]*?)<\\/c>`,
    "i"
  );
  const selfClosingPattern = new RegExp(
    `<c\\b([^>]*\\br="${escapedReference}"[^>]*)\\/>`,
    "i"
  );
  const inlineValue = `<is><t xml:space="preserve">${escapeXml(value)}</t></is>`;

  const buildCell = (attributes) => {
    const preserved = attributes
      .replace(/\s+t="[^"]*"/gi, "")
      .replace(/\s*\/\s*$/, "");
    return `<c${preserved} t="inlineStr">${inlineValue}</c>`;
  };

  if (cellPattern.test(sheetXml)) {
    return sheetXml.replace(cellPattern, (_, attributes) => buildCell(attributes));
  }
  if (selfClosingPattern.test(sheetXml)) {
    return sheetXml.replace(selfClosingPattern, (_, attributes) => buildCell(attributes));
  }

  const rowNumber = cellReference.match(/\d+$/)?.[0];
  const rowPattern = new RegExp(
    `(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(<\\/row>)`,
    "i"
  );
  const newCell = `<c r="${cellReference}" t="inlineStr">${inlineValue}</c>`;
  if (rowPattern.test(sheetXml)) {
    return sheetXml.replace(
      rowPattern,
      (_, opening, contents, closing) => {
        const targetColumn = XLSX.utils.decode_cell(cellReference).c;
        const cellRegex = /<c\b[^>]*\br="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/gi;
        let match;
        while ((match = cellRegex.exec(contents))) {
          if (XLSX.utils.decode_col(match[1]) > targetColumn) {
            return `${opening}${contents.slice(0, match.index)}${newCell}` +
              `${contents.slice(match.index)}${closing}`;
          }
        }
        return `${opening}${contents}${newCell}${closing}`;
      }
    );
  }

  throw new Error(`A linha da célula ${cellReference} não existe na planilha original.`);
}

function exportCellValue(result) {
  const value = String(result.editedTag || "").trim();
  const normalized = normalizeText(value);
  if (
    !value ||
    value === "-" ||
    normalized === "codigo nao encontrado" ||
    normalized === "nao encontrado" ||
    normalized === "n/e"
  ) {
    return "N/E";
  }
  return value;
}

async function buildPreservedWorkbook(
  originalBuffer,
  sheetName,
  results
) {
  const originalWorkbook = XLSX.read(originalBuffer.slice(0), {
    type: "array",
    cellStyles: true,
    cellFormula: true,
    bookVBA: true
  });
  const originalWorksheet = originalWorkbook.Sheets[sheetName];
  if (!originalWorksheet) {
    throw new Error(`A aba "${sheetName}" não foi encontrada no arquivo original.`);
  }
  const observationHeader = localizarCabecalhoExato(
    originalWorksheet,
    "Observações"
  );
  const observationColumn = encontrarIndiceColuna(
    originalWorksheet,
    "Observações"
  ) - 1;
  const originalRange = XLSX.utils.decode_range(
    originalWorksheet["!ref"] || "A1:A1"
  );

  const zip = await JSZip.loadAsync(originalBuffer.slice(0));
  const worksheetPath = await findWorksheetXmlPath(zip, sheetName);
  const worksheetFile = zip.file(worksheetPath);
  if (!worksheetFile) throw new Error("O XML da aba selecionada não foi encontrado.");
  let worksheetXml = await worksheetFile.async("string");

  const writtenRows = new Set();
  results.forEach((result) => {
    if (
      !Number.isInteger(result.excelRow) ||
      result.excelRow <= observationHeader.rowIndex ||
      result.excelRow > originalRange.e.r
    ) {
      throw new Error(`Linha Excel inválida para exportação: ${result.excelRow + 1}`);
    }
    if (writtenRows.has(result.excelRow)) {
      throw new Error(`A linha ${result.excelRow + 1} seria preenchida mais de uma vez.`);
    }
    writtenRows.add(result.excelRow);
    const cellReference =
      `${XLSX.utils.encode_col(observationColumn)}${result.excelRow + 1}`;
    worksheetXml = replaceCellValue(
      worksheetXml,
      cellReference,
      exportCellValue(result)
    );
  });

  // Somente os valores das células de Observações são alterados.
  zip.file(worksheetPath, worksheetXml);
  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}

async function exportResults() {
  if (!state.results.length) return;
  if (!state.originalBuffer) {
    window.alert("Importe novamente o arquivo XLSX original.");
    return;
  }
  const worksheet = state.workbook.Sheets[elements.sheetSelect.value];
  encontrarIndiceColuna(worksheet, "Observações");

  const button = document.querySelector("#export-results");
  button.disabled = true;
  button.textContent = "Preservando layout...";

  try {
    const output = await buildPreservedWorkbook(
      state.originalBuffer,
      elements.sheetSelect.value,
      state.results
    );
    const blob = new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "planilha_preenchida_ciser.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    window.alert(`Não foi possível exportar mantendo o layout: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Exportar planilha preenchida";
  }
}

function renderManualResults(grouped, manufacturers = MANUFACTURER_ORDER) {
  elements.manualResults.innerHTML = manufacturers.map((fabricante) => {
    const results = grouped[fabricante] || [];
    const cards = results.map((result) => `
      <article class="manual-result">
        <header>
          <div>
            <h3>${escapeHtml(result.produto)}</h3>
            <p>${escapeHtml(result.fabricante)} · Página ${escapeHtml(result.pagina || "—")}</p>
          </div>
          <span class="confidence ${result.confianca >= 80 ? "high" : result.confianca >= 50 ? "medium" : "low"}">
            ${result.confianca}%
          </span>
        </header>
        <div class="manual-details">
          <div><span>Fabricante</span><strong>${escapeHtml(result.fabricante)}</strong></div>
          <div><span>Linha / família</span><strong>${escapeHtml(result.linha || "—")}</strong></div>
          <div><span>Dimensão</span><strong>${escapeHtml(result.dimensao || "—")}</strong></div>
          <div><span>Referência</span><strong>${escapeHtml(result.referencia || "—")}</strong></div>
          <div><span>Acabamento / sistema</span><strong>${escapeHtml(result.acabamento || "—")}</strong></div>
          <div><span>Código final</span><strong>${escapeHtml(result.codigoFinal)}</strong></div>
        </div>
      </article>
    `).join("");
    return `
      <section class="manufacturer-group" data-manufacturer="${fabricante}">
        <div class="manufacturer-group-heading">
          <h3>${fabricante}</h3>
          <span>${results.length} ${results.length === 1 ? "resultado" : "resultados"}</span>
        </div>
        ${results.length
          ? `<div class="manufacturer-result-grid">${cards}</div>`
          : '<p class="manufacturer-empty">Nenhum resultado neste fabricante.</p>'}
      </section>
    `;
  }).join("");
}

elements.tabs.forEach((tab) =>
  tab.addEventListener("click", () => activateTab(tab.dataset.tab)));

elements.fileInput.addEventListener("change", () => handleFile(elements.fileInput.files[0]));
elements.sheetSelect.addEventListener("change", loadSelectedSheet);

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
  });
});

elements.dropZone.addEventListener("drop", (event) => handleFile(event.dataTransfer.files[0]));

elements.continueMapping.addEventListener("click", () => {
  loadSelectedSheet();
  renderMapping();
  renderPreview();
  activateStage("mapping-stage", 2);
});

document.querySelector("#back-import").addEventListener("click", () => activateStage("import-stage", 1));
document.querySelector("#new-import").addEventListener("click", () => activateStage("import-stage", 1));
elements.runCrossing.addEventListener("click", runCrossing);
document.querySelector("#export-results").addEventListener("click", exportResults);
elements.resultFilter.addEventListener("input", () => {
  state.page = 1;
  applyResultFilters();
});
elements.statusFilter.addEventListener("change", () => {
  state.page = 1;
  applyResultFilters();
});

elements.manualForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = {
    descricao: document.querySelector("#manual-description").value,
    especificacao: "",
    dimensao: document.querySelector("#manual-dimension").value,
    tamanho: "",
    acabamento: document.querySelector("#manual-finish").value,
    rosca: "",
    codigoFabricante: document.querySelector("#manual-description").value
  };

  if (!Object.values(query).some((value) => String(value).trim())) {
    elements.manualFeedback.textContent = "Informe ao menos um dado para pesquisar.";
    elements.manualResults.replaceChildren();
    return;
  }

  const manufacturers = Array.from(
    document.querySelectorAll('input[name="manual-manufacturer"]:checked')
  ).map((input) => input.value);
  if (!manufacturers.length) {
    elements.manualFeedback.textContent =
      "Selecione ao menos um fabricante para pesquisar.";
    elements.manualResults.replaceChildren();
    return;
  }

  const grouped = searchMultiCatalog(query, {
    manufacturers,
    limitPerManufacturer: 5
  });
  const total = manufacturers.reduce(
    (sum, fabricante) => sum + grouped[fabricante].length,
    0
  );
  elements.manualFeedback.textContent = total
    ? `${total} resultados separados por fabricante. Confira dimensão, referência e acabamento antes de usar o código.`
    : "Nenhum resultado nos fabricantes selecionados.";
  renderManualResults(grouped, manufacturers);
});

initializeDatabaseSummary();
