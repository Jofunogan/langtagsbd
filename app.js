const resultsElement = document.querySelector('#results');
const formElement = document.querySelector('#search-form');
const queryElement = document.querySelector('#query');
const languagePicker = document.querySelector('.language-picker');
const languageTrigger = document.querySelector('#language-trigger');
const languageValue = document.querySelector('#language-value');
const languageOptions = document.querySelector('#language-options');
const titleElement = document.querySelector('#results-title');
const countElement = document.querySelector('#result-count');
const resultsSection = document.querySelector('.results-section');
const tagSuggestionsSection = document.querySelector('#tag-suggestions');
const tagSuggestionList = document.querySelector('#tag-suggestion-list');
const favoritesSection = document.querySelector('#favorites-section');
const favoritesResults = document.querySelector('#favorites-results');
const favoriteCount = document.querySelector('#favorite-count');
const searchFilters = document.querySelector('#search-filters');
const scopePicker = document.querySelector('#scope-picker');
const scopeTrigger = document.querySelector('#scope-trigger');
const scopeValue = document.querySelector('#scope-value');
const scopeOptions = document.querySelector('#scope-options');

let library = [];
let hasSearched = false;
let selectedLanguage = 'all';
let selectedScope = 'tags';
const favoriteStorageKey = 'lang-tags-bd:favorites';

function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(favoriteStorageKey) ?? '[]');
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

const favoriteIds = loadFavorites();

const knownLanguageColors = {
  html: ['#ffe0cc', '#78350f', '#fff0e7'],
  css: ['#dceaff', '#1e40af', '#eaf2ff'],
  javascript: ['#fff0a8', '#713f12', '#fff9e6'],
  typescript: ['#e2dcff', '#4338a0', '#f1efff'],
  python: ['#d9f0d2', '#28552b', '#eaf4e8'],
  java: ['#ffdcd7', '#8f2e24', '#fcebe8'],
  json: ['#eadcf8', '#60368a', '#f0ebfa'],
  sql: ['#cef0e8', '#14594d', '#e7f4f1'],
  rust: ['#f2d8c5', '#733b1c', '#f8eee7']
};

function applyLanguageColors(element, language) {
  const key = normalize(language);
  let colors = knownLanguageColors[key];
  if (!colors) {
    const hue = [...key].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 360, 0);
    colors = [`hsl(${hue} 70% 94%)`, `hsl(${hue} 45% 32%)`];
  }
  element.style.setProperty('--language-background', colors[0]);
  element.style.setProperty('--language-foreground', colors[1]);
  element.style.setProperty('--language-header-background', colors[2] ?? colors[0]);
}

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

async function loadLibrary() {
  try {
    const response = await fetch('./database/manifest.json');
    if (!response.ok) throw new Error(`Não foi possível carregar o manifesto (${response.status}).`);
    const manifest = await response.json();
    const categories = Object.entries(manifest.categories ?? {});
    const loaded = await Promise.all(categories.map(async ([language, files]) => {
      const entries = await Promise.all(files.map(async (file) => {
        const itemResponse = await fetch(`./database/${encodeURIComponent(language)}/${encodeURIComponent(file)}`);
        if (!itemResponse.ok) throw new Error(`Não foi possível carregar ${file}.`);
        const payload = await itemResponse.json();
        const records = Array.isArray(payload) ? payload : [payload];
        return records.map((item) => ({ ...item, language, file: item.file ?? file }));
      }));
      return entries;
    }));
    library = loaded.flat(2);
    populateLanguages(categories.map(([language]) => language));
    renderHomeFavorites();
    renderTagSuggestions();
  } catch (error) {
    showMessage('Não foi possível carregar a biblioteca. Abra o projeto por um servidor local e confira database/manifest.json.');
    console.error(error);
  }
}

function populateLanguages(languages) {
  for (const language of languages) {
    const item = document.createElement('li');
    item.setAttribute('role', 'presentation');
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'language-option';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.dataset.value = language;
    option.dataset.language = normalize(language);
    applyLanguageColors(option, language);
    option.textContent = language;
    item.append(option);
    languageOptions.append(item);
  }
}

function closeLanguageOptions(returnFocus = false) {
  languageOptions.hidden = true;
  languageTrigger.setAttribute('aria-expanded', 'false');
  languagePicker.classList.remove('is-open');
  if (returnFocus) languageTrigger.focus();
}

function closeScopeOptions(returnFocus = false) {
  scopeOptions.hidden = true;
  scopeTrigger.setAttribute('aria-expanded', 'false');
  scopePicker.classList.remove('is-open');
  if (returnFocus) scopeTrigger.focus();
}

function updateScope(value) {
  selectedScope = value;
  scopeOptions.querySelectorAll('[role="option"]').forEach((option) => {
    option.setAttribute('aria-selected', String(option.dataset.value === value));
  });
  scopeValue.textContent = scopeOptions.querySelector(`[data-value="${value}"]`)?.textContent ?? 'TAGS';
  closeScopeOptions();
  if (queryElement.value.trim()) {
    const { items, heading } = search(queryElement.value, selectedLanguage, selectedScope);
    render(items, heading);
  }
}

function getElementName(item) {
  const fileName = item.file?.replace(/\.json$/i, '') ?? '';
  const names = { paragrafo: 'p', 'link-meta': 'link', 'path-svg': 'path', 'atributos-globais': 'div' };
  return names[fileName] ?? fileName;
}

function getAttributeExample(element, attribute) {
  if (attribute === 'data-*') return '<div data-exemplo="valor">Conteúdo</div>';
  const isVoidElement = ['input', 'meta', 'link', 'img', 'br', 'hr', 'source', 'area'].includes(element);
  const examples = {
    class: isVoidElement ? `<${element} class="destaque">` : `<${element} class="destaque">Conteúdo</${element}>`,
    id: isVoidElement ? `<${element} id="secao-principal">` : `<${element} id="secao-principal">Conteúdo</${element}>`,
    href: '<a href="https://exemplo.com">Acessar página</a>',
    rel: '<link rel="stylesheet" href="styles.css">',
    src: '<script src="app.js" defer></script>',
    defer: '<script src="app.js" defer></script>',
    async: '<script src="analytics.js" async></script>',
    for: '<label for="email">E-mail</label>\n<input id="email" type="email">',
    type: element === 'button' ? '<button type="button">Abrir</button>' : '<input type="email">',
    name: '<input name="email" type="email">',
    value: '<input type="text" value="Exemplo">',
    placeholder: '<input type="text" placeholder="Digite seu nome">',
    autocomplete: '<input type="email" autocomplete="email">',
    required: '<input type="email" required>',
    disabled: '<button type="button" disabled>Indisponível</button>',
    action: '<form action="/cadastro">...</form>',
    method: '<form method="post">...</form>',
    charset: '<meta charset="utf-8">',
    name: '<input name="email" type="email">',
    content: '<meta name="description" content="Resumo da página">',
    'http-equiv': '<meta http-equiv="refresh" content="30">',
    lang: '<html lang="pt-BR">...</html>',
    dir: '<html dir="rtl">...</html>',
    media: '<link rel="stylesheet" href="print.css" media="print">',
    viewBox: '<svg viewBox="0 0 24 24">...</svg>',
    width: '<svg width="24" viewBox="0 0 24 24">...</svg>',
    height: '<svg height="24" viewBox="0 0 24 24">...</svg>',
    rows: '<textarea rows="4"></textarea>',
    cols: '<textarea cols="30"></textarea>',
    readonly: '<textarea readonly>Texto protegido</textarea>',
    tabindex: '<pre tabindex="0">Código acessível</pre>',
    d: '<path d="M4 12h16"></path>',
    fill: '<path d="M4 12h16" fill="none"></path>',
    stroke: '<path d="M4 12h16" stroke="currentColor"></path>',
    'stroke-width': '<path d="M4 12h16" stroke-width="2"></path>',
    'aria-label': isVoidElement ? `<${element} aria-label="Descrição acessível">` : `<${element} aria-label="Descrição acessível">...</${element}>`,
    'aria-hidden': isVoidElement ? `<${element} aria-hidden="true">` : `<${element} aria-hidden="true">...</${element}>`,
    'aria-live': '<section aria-live="polite">Resultados atualizados</section>',
    'aria-busy': '<section aria-busy="true">Carregando...</section>',
    'aria-pressed': '<button aria-pressed="true">Favorito</button>',
    'aria-labelledby': '<section aria-labelledby="titulo">...</section>',
    role: '<form role="search">...</form>',
    hidden: '<section hidden>Conteúdo oculto</section>'
  };
  if (examples[attribute]) return examples[attribute];
  return isVoidElement
    ? `<${element} ${attribute}="valor">`
    : `<${element} ${attribute}="valor">Conteúdo</${element}>`;
}

function getAttributeDescription(attribute) {
  const descriptions = {
    action: 'Define o destino dos dados enviados pelo formulário.',
    accesskey: 'Define uma tecla de atalho para focar ou ativar o elemento.',
    autocapitalize: 'Sugere como letras devem ser capitalizadas durante a digitação.',
    autocorrect: 'Sugere se a correção automática de texto deve ser ativada.',
    autofocus: 'Solicita foco automático quando a página ou diálogo é aberto.',
    contenteditable: 'Permite editar o conteúdo diretamente na página.',
    data: 'O prefixo data- guarda dados personalizados no elemento.',
    draggable: 'Indica se o elemento pode ser arrastado.',
    enterkeyhint: 'Sugere o rótulo da tecla Enter em teclados virtuais.',
    headingoffset: 'Ajusta o nível dos títulos dentro do elemento.',
    headingreset: 'Impede que o ajuste de nível de títulos ultrapasse este elemento.',
    inert: 'Desativa interação, foco e leitura assistiva para o elemento e descendentes.',
    inputmode: 'Sugere o tipo de teclado virtual para entrada de dados.',
    is: 'Associa um elemento nativo a um componente personalizado incorporado.',
    itemid: 'Identifica o item de microdados por uma URL.',
    itemprop: 'Define uma propriedade de microdados para o item.',
    itemref: 'Relaciona elementos adicionais às propriedades de microdados.',
    itemscope: 'Cria um item de microdados e define seu escopo.',
    itemtype: 'Define o tipo de item de microdados por uma URL.',
    nonce: 'Fornece um valor usado por políticas de segurança de conteúdo.',
    popover: 'Define o elemento como um popover que pode ser exibido sobre a página.',
    slot: 'Indica em qual ponto de inserção de um componente o conteúdo será colocado.',
    spellcheck: 'Indica se o navegador pode verificar ortografia e gramática.',
    style: 'Aplica declarações CSS diretamente ao elemento.',
    translate: 'Indica se o texto do elemento deve ser traduzido.',
    writingsuggestions: 'Sugere se o navegador deve oferecer sugestões de escrita.',
    'data-*': 'Armazena um dado personalizado usando um nome iniciado por data-.',
    'aria-describedby': 'Associa uma descrição acessível a outro elemento.',
    'aria-busy': 'Indica que a região ainda está sendo atualizada.',
    'aria-hidden': 'Oculta o elemento de leitores de tela.',
    'aria-label': 'Dá um nome acessível ao elemento.',
    'aria-labelledby': 'Usa outro elemento como nome acessível.',
    'aria-level': 'Informa o nível hierárquico de um título.',
    'aria-live': 'Anuncia atualizações a leitores de tela.',
    'aria-pressed': 'Indica se o botão está ativo.',
    async: 'Executa o script assim que termina de carregar.',
    autocomplete: 'Controla sugestões e preenchimento automático.',
    charset: 'Define a codificação de caracteres.',
    class: 'Aplica classes para estilizar ou localizar o elemento.',
    cols: 'Define a largura da área de texto em caracteres.',
    content: 'Informa o valor de um metadado.',
    d: 'Define os comandos do desenho no SVG.',
    defer: 'Executa o script após a leitura do HTML.',
    dir: 'Define a direção de leitura do texto.',
    disabled: 'Desativa o controle e impede sua interação.',
    fill: 'Define a cor de preenchimento da forma SVG.',
    for: 'Associa o rótulo ao campo pelo id.',
    form: 'Associa o controle a um formulário pelo id.',
    height: 'Define a altura do elemento ou SVG.',
    href: 'Informa o destino de um link ou recurso.',
    'http-equiv': 'Define metadados equivalentes a cabeçalhos HTTP.',
    id: 'Cria um identificador único para o elemento.',
    lang: 'Informa o idioma do conteúdo.',
    media: 'Aplica o recurso ao tipo de mídia indicado.',
    method: 'Define o método de envio, como GET ou POST.',
    name: 'Identifica o valor enviado pelo campo.',
    novalidate: 'Desativa a validação automática do formulário.',
    onload: 'Executa uma ação quando o recurso carrega.',
    placeholder: 'Mostra uma dica enquanto o campo está vazio.',
    readonly: 'Impede edição, mas mantém o valor selecionável.',
    rel: 'Descreve a relação com o recurso vinculado.',
    required: 'Exige preenchimento antes do envio.',
    role: 'Informa a função do elemento às tecnologias assistivas.',
    rows: 'Define a altura da área de texto em linhas.',
    src: 'Informa o endereço do arquivo externo.',
    stroke: 'Define a cor do contorno da forma SVG.',
    'stroke-width': 'Define a espessura do contorno SVG.',
    tabindex: 'Controla o foco e a ordem de navegação por teclado.',
    type: 'Define o tipo ou comportamento do elemento.',
    value: 'Define o valor inicial ou enviado pelo controle.',
    viewBox: 'Define a área de coordenadas para escalar o SVG.',
    width: 'Define a largura do elemento ou SVG.'
  };
  return descriptions[attribute] ?? 'Configura o comportamento ou a identificação do elemento HTML.';
}

function closeAttributePopups(except = null) {
  document.querySelectorAll('.attribute-item.is-open, .value-item.is-open').forEach((item) => {
    if (item === except) return;
    window.clearTimeout(item.attributePopupDismissTimer);
    item.attributePopupDismissTimer = null;
    item.classList.remove('is-open', 'is-pinned');
    item.querySelector('.attribute-chip, .value-chip')?.setAttribute('aria-expanded', 'false');
    item.querySelector('.attribute-popup')?.setAttribute('aria-hidden', 'true');
  });
}

function scheduleAttributePopupDismiss(item) {
  window.clearTimeout(item.attributePopupDismissTimer);
  item.attributePopupDismissTimer = window.setTimeout(() => {
    if (item.classList.contains('is-pinned') || item.matches(':hover')) return;
    item.classList.remove('is-open');
    item.querySelector('.attribute-chip, .value-chip')?.setAttribute('aria-expanded', 'false');
    item.querySelector('.attribute-popup')?.setAttribute('aria-hidden', 'true');
    item.attributePopupDismissTimer = null;
  }, 2000);
}

function bindPopupInteractions(trigger, item, popup) {
  const open = (pin = false) => {
    window.clearTimeout(item.attributePopupDismissTimer);
    item.attributePopupDismissTimer = null;
    closeAttributePopups(item);
    item.classList.add('is-open');
    item.classList.toggle('is-pinned', pin);
    trigger.setAttribute('aria-expanded', 'true');
    popup.setAttribute('aria-hidden', 'false');
  };

  trigger.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') open();
  });
  item.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !item.classList.contains('is-pinned')) scheduleAttributePopupDismiss(item);
  });
  popup.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(item.attributePopupDismissTimer);
    item.attributePopupDismissTimer = null;
    item.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    popup.setAttribute('aria-hidden', 'false');
  });
  popup.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !item.classList.contains('is-pinned')) scheduleAttributePopupDismiss(item);
  });
  trigger.addEventListener('focus', () => open());
  trigger.addEventListener('blur', () => {
    if (!item.classList.contains('is-pinned')) scheduleAttributePopupDismiss(item);
  });
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const shouldPin = !item.classList.contains('is-pinned');
    if (shouldPin) open(true);
    else {
      window.clearTimeout(item.attributePopupDismissTimer);
      item.attributePopupDismissTimer = null;
      item.classList.remove('is-open', 'is-pinned');
      trigger.setAttribute('aria-expanded', 'false');
      popup.setAttribute('aria-hidden', 'true');
    }
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeAttributePopups();
    trigger.focus();
  });
}

function getValueExample(group, option) {
  const attribute = group.attribute;
  const context = (group.context ?? '').toLowerCase();
  const elementByAttribute = {
    loading: 'img', sandbox: 'iframe', allowfullscreen: 'iframe',
    formtarget: 'button', formenctype: 'button', formmethod: 'button', formaction: 'button',
    enctype: 'form', method: 'form', action: 'form', novalidate: 'form',
    muted: 'video', autoplay: 'video', controls: 'video', loop: 'video', preload: 'video', poster: 'video',
    start: 'ol', reversed: 'ol', srcset: 'img', sizes: 'img', decoding: 'img', fetchpriority: 'img',
    download: 'a', target: 'a', hreflang: 'a', cite: 'blockquote', datetime: 'time',
    colspan: 'td', rowspan: 'td', scope: 'th', open: 'details', kind: 'track', srclang: 'track',
    rows: 'textarea', cols: 'textarea', label: 'option', span: 'col',
    integrity: 'script', crossorigin: 'script', async: 'script', defer: 'script', type: 'input',
    autocomplete: 'input', accept: 'input', min: 'input', max: 'input', step: 'input', pattern: 'input',
    rel: 'a', href: 'a', src: 'img', value: 'input', name: 'input', checked: 'input', required: 'input',
    charset: 'meta', content: 'meta', 'http-equiv': 'meta'
  };
  const element = context.includes('iframe') ? 'iframe'
    : context.includes('input') ? 'input'
      : context.includes('button') ? 'button'
        : context.includes('ol') ? 'ol'
          : context.includes('script') ? 'script'
            : context.includes('form') ? 'form'
              : context.includes('link') ? 'link'
                : context.includes('area') ? 'area'
                  : context.includes('img') ? 'img'
                    : context.includes('video') ? 'video'
                      : context.includes('audio') ? 'audio'
                        : context.includes('a e ') ? 'a' : elementByAttribute[attribute] ?? 'div';
  const booleanKind = (group.kind ?? '').toLowerCase().includes('boolean');
  const isAbsent = /^ausente/i.test(option);
  const value = booleanKind ? '' : option;
  const attributeText = booleanKind
    ? (isAbsent ? '' : attribute)
    : `${attribute}="${value.replaceAll('"', '&quot;')}"`;
  const isVoid = ['input', 'link', 'area', 'img'].includes(element);
  const content = element === 'script' ? '/* código */' : 'Conteúdo';
  return isVoid
    ? `<${element}${attributeText ? ` ${attributeText}` : ''}>`
    : `<${element}${attributeText ? ` ${attributeText}` : ''}>${content}</${element}>`;
}

function getCssValueExample(item, group, value) {
  if (item.file === 'css-valores-globais.json' && value === '!important') {
    return `.elemento {\n  ${group.attribute}: rebeccapurple !important;\n}`;
  }
  if (item.file !== 'css-valores-media-queries.json') {
    return `.elemento {\n  ${group.attribute}: ${value};\n}`;
  }
  const sampleValues = {
    'any-hover': 'hover', 'any-pointer': 'fine', 'aspect-ratio': '16/9', color: '8',
    'color-gamut': 'p3', 'display-mode': 'standalone', 'dynamic-range': 'high',
    'forced-colors': 'active', height: '40rem', hover: 'hover', 'inverted-colors': 'inverted',
    monochrome: '0', orientation: 'landscape', 'overflow-block': 'scroll', 'overflow-inline': 'scroll',
    pointer: 'fine', 'prefers-color-scheme': 'dark', 'prefers-contrast': 'more',
    'prefers-reduced-data': 'reduce', 'prefers-reduced-motion': 'reduce',
    'prefers-reduced-transparency': 'reduce', resolution: '2dppx', scan: 'progressive',
    scripting: 'enabled', shape: 'rect', update: 'fast', 'video-dynamic-range': 'high',
    'horizontal-viewport-segments': '2', 'vertical-viewport-segments': '2', width: '40rem'
  };
  return `@media (${value}: ${sampleValues[value] ?? 'value'}) {\n  .elemento { display: block; }\n}`;
}

function updateLanguage(value) {
  selectedLanguage = value;
  languageOptions.querySelectorAll('[role="option"]').forEach((option) => {
    option.setAttribute('aria-selected', String(option.dataset.value === value));
  });
  closeLanguageOptions();
  if (hasSearched) {
    const { items, heading } = search(queryElement.value, selectedLanguage, selectedScope);
    render(items, heading);
  } else {
    renderHomeFavorites();
    renderTagSuggestions();
  }
}

function renderHomeFavorites() {
  const favoriteItems = library.filter((item) =>
    favoriteIds.has(JSON.stringify([item.language, item.file]))
    && (selectedLanguage === 'all' || item.language === selectedLanguage));
  favoritesResults.replaceChildren();
  favoritesSection.hidden = hasSearched || Boolean(queryElement.value.trim()) || favoriteItems.length === 0;
  favoriteCount.textContent = favoriteItems.length
    ? `${favoriteItems.length} ${favoriteItems.length === 1 ? 'item' : 'itens'}`
    : '';
  for (const item of favoriteItems) favoritesResults.append(makeCard(item));
}

function renderTagSuggestions() {
  const source = library.filter((item) => selectedLanguage === 'all' || item.language === selectedLanguage);
  const seen = new Set();
  const recentTags = [];
  for (const item of [...source].reverse()) {
    for (const tag of [...(item.tags ?? [])].reverse()) {
      const key = normalize(tag);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recentTags.push({ tag, language: item.language });
      if (recentTags.length === 10) break;
    }
    if (recentTags.length === 10) break;
  }

  tagSuggestionList.replaceChildren();
  for (const { tag, language } of recentTags) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-suggestion';
    applyLanguageColors(button, language);
    button.textContent = language === 'css' ? tag : `#${tag}`;
    button.addEventListener('click', () => {
      queryElement.value = tag;
      queryElement.dispatchEvent(new Event('input', { bubbles: true }));
      queryElement.focus();
    });
    tagSuggestionList.append(button);
  }
  tagSuggestionsSection.hidden = recentTags.length === 0;
}

function search(query, language, scope = 'all') {
  const selected = library.filter((item) => language === 'all' || item.language === language);
  const term = normalize(query);
  if (!term) return { items: selected, heading: 'Conteúdos disponíveis' };
  const valuesFor = (item) => (item.valueGroups ?? []).flatMap((group) => [
    group.attribute, group.context, group.kind, group.description,
    ...(group.options ?? []), ...(group.examples ?? [])
  ]);

  const fields = {
    title: (item) => [item.title, item.file?.replace(/\.json$/i, '')],
    tags: (item) => item.tags ?? [],
    attributes: (item) => item.attributes ?? [],
    values: valuesFor,
    configurations: (item) => item.configurations ?? [],
    code: (item) => [item.code ?? ''],
    all: (item) => [item.title, item.file?.replace(/\.json$/i, ''), item.description,
      ...(item.tags ?? []), ...(item.attributes ?? []), ...valuesFor(item),
      ...(item.configurations ?? []), item.code ?? '']
  };
  const headings = {
    title: 'Resultados por título',
    tags: 'Resultados por tags',
    attributes: 'Resultados por atributos',
    values: 'Resultados por valores',
    configurations: 'Resultados por configurações',
    code: 'Resultados no código',
    all: 'Resultados por conteúdo'
  };
  const matches = selected.filter((item) => fields[scope](item)
    .some((value) => normalize(value).includes(term)
      || (scope === 'attributes' && normalize(value) === 'data-*' && /^data-[a-z0-9_-]+$/i.test(query.trim()))));

  if (scope === 'all') {
    const titleMatches = matches.filter((item) => fields.title(item)
      .some((value) => normalize(value).includes(term)));
    if (titleMatches.length) return { items: titleMatches, heading: 'Resultados por título' };
  }
  return { items: matches, heading: headings[scope] ?? headings.all };
}

function render(items, heading) {
  favoritesSection.hidden = true;
  resultsSection.hidden = false;
  searchFilters.hidden = false;
  hasSearched = true;
  titleElement.textContent = heading;
  countElement.textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;
  resultsSection.setAttribute('aria-busy', 'false');
  resultsElement.replaceChildren();
  if (!items.length) {
    showMessage('Nenhum resultado encontrado. Tente outra palavra ou selecione outra linguagem.');
    return;
  }
  for (const item of items) resultsElement.append(makeCard(item));
}

function makeCard(item) {
  const card = document.createElement('article');
  card.className = 'result-card';
  const top = document.createElement('div');
  top.className = 'card-top';
  applyLanguageColors(top, item.language);
  const badge = document.createElement('span');
  badge.className = 'language-badge';
  badge.textContent = item.language;
  applyLanguageColors(badge, item.language);
  const file = document.createElement('span');
  file.className = 'file-name';
  file.textContent = item.file;
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'favorite-button';
  favoriteButton.setAttribute('aria-label', 'Favoritar card');
  favoriteButton.setAttribute('aria-pressed', 'false');
  favoriteButton.title = 'Favoritar';
  const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  star.setAttribute('viewBox', '0 0 24 24');
  star.setAttribute('aria-hidden', 'true');
  const starPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  starPath.setAttribute('d', 'm12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 3z');
  star.append(starPath);
  favoriteButton.append(star);
  const favoriteId = JSON.stringify([item.language, item.file]);
  const updateFavoriteButton = () => {
    const isFavorite = favoriteIds.has(favoriteId);
    favoriteButton.classList.toggle('is-favorite', isFavorite);
    favoriteButton.setAttribute('aria-pressed', String(isFavorite));
    favoriteButton.setAttribute('aria-label', isFavorite ? 'Remover dos favoritos' : 'Favoritar card');
    favoriteButton.title = isFavorite ? 'Remover dos favoritos' : 'Favoritar';
  };
  favoriteButton.addEventListener('click', () => {
    if (favoriteIds.has(favoriteId)) favoriteIds.delete(favoriteId);
    else favoriteIds.add(favoriteId);
    try {
      localStorage.setItem(favoriteStorageKey, JSON.stringify([...favoriteIds]));
    } catch (error) {
      console.warn('Não foi possível salvar favoritos neste navegador.', error);
    }
    updateFavoriteButton();
    renderHomeFavorites();
  });
  updateFavoriteButton();
  actions.append(file, favoriteButton);
  top.append(badge, actions);

  const title = document.createElement('h3');
  title.textContent = item.title;
  const description = document.createElement('p');
  description.className = 'description';
  description.textContent = item.description;
  card.append(top, title, description);

  const detailKey = selectedScope === 'attributes' ? 'attributes'
    : selectedScope === 'values' ? 'valueGroups'
      : selectedScope === 'configurations' ? 'configurations' : null;
  const detailValues = detailKey ? item[detailKey] : null;
  if (Array.isArray(detailValues) && detailValues.length) {
    const detailSection = document.createElement('div');
    detailSection.className = `card-details card-details-${detailKey}`;
    const detailLabel = document.createElement('span');
    detailLabel.className = 'card-details-label';
    detailLabel.textContent = detailKey === 'attributes' ? 'Atributos'
      : detailKey === 'valueGroups' ? 'Valores aceitos' : 'Configurações';
    detailSection.append(detailLabel);
    const detailList = document.createElement('div');
    detailList.className = 'card-details-list';
    const elementName = getElementName(item);
    for (const value of detailValues) {
      if (detailKey === 'attributes') {
        const attributeItem = document.createElement('div');
        attributeItem.className = 'attribute-item';
        const detail = document.createElement('button');
        detail.type = 'button';
        detail.className = 'attribute-chip';
        detail.textContent = value;
        detail.setAttribute('aria-haspopup', 'true');
        detail.setAttribute('aria-expanded', 'false');
        const popup = document.createElement('div');
        popup.id = `attribute-example-${Math.random().toString(36).slice(2)}`;
        popup.className = 'attribute-popup';
        popup.setAttribute('role', 'tooltip');
        popup.setAttribute('aria-hidden', 'true');
        detail.setAttribute('aria-describedby', popup.id);
        const exampleLabel = document.createElement('span');
        exampleLabel.className = 'attribute-popup-label';
        exampleLabel.textContent = 'Exemplo';
        const explanation = document.createElement('p');
        explanation.className = 'attribute-popup-description';
        explanation.textContent = getAttributeDescription(value);
        const example = document.createElement('code');
        if (item.language === 'css') {
          const initialValue = (item.valueGroups ?? []).find((group) => group.attribute === value)?.examples?.[0] ?? 'valor';
          const cssProperty = value === '--*' ? '--nome-personalizado' : value;
          exampleLabel.textContent = 'Declaração CSS';
          explanation.textContent = item.description;
          example.textContent = `.elemento {\n  ${cssProperty}: ${initialValue};\n}`;
        } else {
          example.textContent = getAttributeExample(elementName, value);
        }
        popup.append(exampleLabel, explanation, example);
        attributeItem.append(detail, popup);

        detail.addEventListener('pointerenter', (event) => {
          if (event.pointerType !== 'mouse') return;
          window.clearTimeout(attributeItem.attributePopupDismissTimer);
          attributeItem.attributePopupDismissTimer = null;
          closeAttributePopups(attributeItem);
          attributeItem.classList.add('is-open');
          detail.setAttribute('aria-expanded', 'true');
          popup.setAttribute('aria-hidden', 'false');
        });
        attributeItem.addEventListener('pointerleave', (event) => {
          if (event.pointerType !== 'mouse' || attributeItem.classList.contains('is-pinned')) return;
          scheduleAttributePopupDismiss(attributeItem);
        });
        popup.addEventListener('pointerenter', (event) => {
          if (event.pointerType !== 'mouse') return;
          window.clearTimeout(attributeItem.attributePopupDismissTimer);
          attributeItem.attributePopupDismissTimer = null;
          attributeItem.classList.add('is-open');
          detail.setAttribute('aria-expanded', 'true');
          popup.setAttribute('aria-hidden', 'false');
        });
        popup.addEventListener('pointerleave', (event) => {
          if (event.pointerType !== 'mouse' || attributeItem.classList.contains('is-pinned')) return;
          scheduleAttributePopupDismiss(attributeItem);
        });
        detail.addEventListener('focus', () => {
          window.clearTimeout(attributeItem.attributePopupDismissTimer);
          attributeItem.attributePopupDismissTimer = null;
          closeAttributePopups(attributeItem);
          attributeItem.classList.add('is-open');
          detail.setAttribute('aria-expanded', 'true');
          popup.setAttribute('aria-hidden', 'false');
        });
        detail.addEventListener('blur', () => {
          if (attributeItem.classList.contains('is-pinned')) return;
          scheduleAttributePopupDismiss(attributeItem);
        });
        detail.addEventListener('click', (event) => {
          event.stopPropagation();
          window.clearTimeout(attributeItem.attributePopupDismissTimer);
          attributeItem.attributePopupDismissTimer = null;
          const willOpen = !attributeItem.classList.contains('is-pinned');
          closeAttributePopups(attributeItem);
          attributeItem.classList.toggle('is-open', willOpen);
          attributeItem.classList.toggle('is-pinned', willOpen);
          detail.setAttribute('aria-expanded', String(willOpen));
          popup.setAttribute('aria-hidden', String(!willOpen));
        });
        detail.addEventListener('keydown', (event) => {
          if (event.key !== 'Escape') return;
          closeAttributePopups();
          detail.focus();
        });
        detailList.append(attributeItem);
      } else if (detailKey === 'valueGroups') {
        const group = document.createElement('div');
        group.className = 'html-value-group';
        const heading = document.createElement('strong');
        heading.textContent = `${value.attribute}${value.context ? ` · ${value.context}` : ''}`;
        const note = document.createElement('p');
        note.textContent = value.description;
        group.append(heading, note);
        const values = [...(value.options ?? []), ...(value.examples ?? [])];
        if (values.length) {
          const chips = document.createElement('div');
          chips.className = 'html-value-options';
          for (const option of values) {
            const valueItem = document.createElement('span');
            valueItem.className = 'value-item';
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'value-chip';
            chip.textContent = option;
            chip.setAttribute('aria-haspopup', 'true');
            chip.setAttribute('aria-expanded', 'false');
            const popup = document.createElement('div');
            popup.id = `value-example-${Math.random().toString(36).slice(2)}`;
            popup.className = 'attribute-popup';
            popup.setAttribute('role', 'tooltip');
            popup.setAttribute('aria-hidden', 'true');
            chip.setAttribute('aria-describedby', popup.id);
            const exampleLabel = document.createElement('span');
            exampleLabel.className = 'attribute-popup-label';
            exampleLabel.textContent = `${value.attribute} · ${option}`;
            const explanation = document.createElement('p');
            explanation.className = 'attribute-popup-description';
            explanation.textContent = `${value.description}${value.kind ? ` Formato: ${value.kind}.` : ''}`;
            const example = document.createElement('code');
            example.textContent = item.language === 'css'
              ? getCssValueExample(item, value, option)
              : getValueExample(value, option);
            popup.append(exampleLabel, explanation, example);
            valueItem.append(chip, popup);
            bindPopupInteractions(chip, valueItem, popup);
            chips.append(valueItem);
          }
          group.append(chips);
        }
        detailList.append(group);
      } else {
        const detail = document.createElement('span');
        detail.textContent = value;
        detailList.append(detail);
      }
    }
    detailSection.append(detailList);
    card.append(detailSection);
  }
  if (item.code) {
    const codeContainer = document.createElement('div');
    codeContainer.className = 'code-container';
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.type = 'button';
    copyButton.textContent = 'Copiar';
    copyButton.setAttribute('aria-label', `Copiar código: ${item.title}`);
    const code = document.createElement('pre');
    code.className = 'code-block';
    code.textContent = item.code;
    copyButton.addEventListener('click', async () => {
      try {
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(item.code);
          } catch {
            copyWithFallback(item.code);
          }
        } else {
          copyWithFallback(item.code);
        }
        copyButton.textContent = 'Copiado!';
        window.setTimeout(() => { copyButton.textContent = 'Copiar'; }, 1500);
      } catch (error) {
        copyButton.textContent = 'Erro ao copiar';
        window.setTimeout(() => { copyButton.textContent = 'Copiar'; }, 1800);
        console.error('Não foi possível copiar o código.', error);
      }
    });
    codeContainer.append(code, copyButton);
    card.append(codeContainer);
  }
  return card;
}

function copyWithFallback(value) {
  const temporaryInput = document.createElement('textarea');
  temporaryInput.value = value;
  temporaryInput.setAttribute('readonly', '');
  temporaryInput.style.position = 'fixed';
  temporaryInput.style.opacity = '0';
  document.body.append(temporaryInput);
  temporaryInput.select();
  const copied = document.execCommand('copy');
  temporaryInput.remove();
  if (!copied) throw new Error('A cópia não foi autorizada pelo navegador.');
}

function showMessage(message) {
  favoritesSection.hidden = true;
  tagSuggestionsSection.hidden = true;
  resultsElement.replaceChildren();
  const state = document.createElement('div');
  state.className = 'empty-state';
  state.textContent = message;
  resultsElement.append(state);
  countElement.textContent = '';
  resultsSection.setAttribute('aria-busy', 'false');
}

formElement.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!queryElement.value.trim()) {
    hasSearched = false;
    resultsSection.hidden = true;
    searchFilters.hidden = true;
    renderHomeFavorites();
    renderTagSuggestions();
    return;
  }
  favoritesSection.hidden = true;
  resultsSection.setAttribute('aria-busy', 'true');
  const { items, heading } = search(queryElement.value, selectedLanguage, selectedScope);
  render(items, heading);
});

queryElement.addEventListener('input', () => {
  if (!queryElement.value.trim()) {
    hasSearched = false;
    resultsSection.hidden = true;
    searchFilters.hidden = true;
    resultsElement.replaceChildren();
    countElement.textContent = '';
    renderHomeFavorites();
    renderTagSuggestions();
    return;
  }
  favoritesSection.hidden = true;
  tagSuggestionsSection.hidden = true;
  const { items, heading } = search(queryElement.value, selectedLanguage, selectedScope);
  render(items, heading);
});

scopeTrigger.addEventListener('click', () => {
  const willOpen = scopeOptions.hidden;
  scopeOptions.hidden = !willOpen;
  scopeTrigger.setAttribute('aria-expanded', String(willOpen));
  scopePicker.classList.toggle('is-open', willOpen);
  if (willOpen) {
    const selected = scopeOptions.querySelector('[aria-selected="true"]');
    (selected ?? scopeOptions.querySelector('[role="option"]'))?.focus();
  }
});

scopeOptions.addEventListener('click', (event) => {
  const option = event.target.closest('[role="option"]');
  if (option) updateScope(option.dataset.value);
});

scopeTrigger.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  scopeOptions.hidden = false;
  scopeTrigger.setAttribute('aria-expanded', 'true');
  scopePicker.classList.add('is-open');
  const selected = scopeOptions.querySelector('[aria-selected="true"]');
  (selected ?? scopeOptions.querySelector('[role="option"]'))?.focus();
});

scopeOptions.addEventListener('keydown', (event) => {
  const options = [...scopeOptions.querySelectorAll('[role="option"]')];
  const currentIndex = options.indexOf(document.activeElement);
  let nextIndex = currentIndex;
  if (event.key === 'ArrowDown') nextIndex = Math.min(options.length - 1, currentIndex + 1);
  else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = options.length - 1;
  else if (event.key === 'Escape') {
    event.preventDefault();
    closeScopeOptions(true);
    return;
  } else if (event.key === 'Tab') {
    closeScopeOptions();
    return;
  } else return;
  event.preventDefault();
  options[nextIndex]?.focus();
});

languageTrigger.addEventListener('click', () => {
  const willOpen = languageOptions.hidden;
  languageOptions.hidden = !willOpen;
  languageTrigger.setAttribute('aria-expanded', String(willOpen));
  languagePicker.classList.toggle('is-open', willOpen);
  if (willOpen) {
    const selected = languageOptions.querySelector('[aria-selected="true"]');
    (selected ?? languageOptions.querySelector('[role="option"]'))?.focus();
  }
});

languageOptions.addEventListener('click', (event) => {
  const option = event.target.closest('[role="option"]');
  if (option) updateLanguage(option.dataset.value);
});

languageTrigger.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  languageOptions.hidden = false;
  languageTrigger.setAttribute('aria-expanded', 'true');
  languagePicker.classList.add('is-open');
  const selected = languageOptions.querySelector('[aria-selected="true"]');
  (selected ?? languageOptions.querySelector('[role="option"]'))?.focus();
});

languageOptions.addEventListener('keydown', (event) => {
  const options = [...languageOptions.querySelectorAll('[role="option"]')];
  const currentIndex = options.indexOf(document.activeElement);
  let nextIndex = currentIndex;
  if (event.key === 'ArrowDown') nextIndex = Math.min(options.length - 1, currentIndex + 1);
  else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = options.length - 1;
  else if (event.key === 'Escape') {
    event.preventDefault();
    closeLanguageOptions(true);
    return;
  } else if (event.key === 'Tab') {
    closeLanguageOptions();
    return;
  } else return;
  event.preventDefault();
  options[nextIndex]?.focus();
});

document.addEventListener('click', (event) => {
  if (!languagePicker.contains(event.target)) closeLanguageOptions();
  if (!scopePicker.contains(event.target)) closeScopeOptions();
  if (!event.target.closest('.attribute-item, .value-item')) closeAttributePopups();
});

loadLibrary();
