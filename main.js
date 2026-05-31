/*
 * Trolls in the Cellar — Perchance-style random generators for Obsidian.
 *
 * Released under CC0 1.0 Universal (public domain dedication). See LICENSE.
 *
 * Adapted from Mike Shea's CC0 generator template:
 * https://github.com/mshea/lazy_gm_tools/blob/main/5e_artisanal_database/generators/generator_template/index.html
 * See NOTICE.md for source links and licensing notes.
 */
const { Notice, Plugin } = require("obsidian");

class GeneratorEngine {
  parse(text) {
    const result = {};
    let currentKey = null;

    for (const line of text.trim().split(/\r?\n/)) {
      if (!line.trim()) continue;

      if (!/^\s/.test(line)) {
        currentKey = line.trim().replace(/:$/, "");
        if (!result[currentKey]) result[currentKey] = [];
        continue;
      }

      if (!currentKey) continue;

      const trimmed = line.trim();
      const weightMatch = trimmed.match(/^(.+?)\s*\^(\d+)$/);
      if (!weightMatch) {
        result[currentKey].push(trimmed);
        continue;
      }

      const item = weightMatch[1];
      const weight = Number.parseInt(weightMatch[2], 10);
      for (let i = 0; i < weight; i++) result[currentKey].push(item);
    }

    return result;
  }

  roll(data, tableName = "template") {
    const table = data[tableName];
    if (!table || table.length === 0) {
      throw new Error(`Missing random table: ${tableName}`);
    }

    return this.fill(this.pick(table), data);
  }

  fill(template, data) {
    let result = template;

    for (let i = 0; i < 10 && (result.includes("{") || result.includes("[[")); i++) {
      const before = result;
      result = this.processRanges(result);
      result = this.processDoubleBraceChoices(result, data);
      result = this.processSingleBraceChoices(result, data);
      result = this.processQuantityPatterns(result, data);
      result = this.processTableReferences(result, data);
      if (result === before) break;
    }

    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  processRanges(text) {
    return text.replace(/\[\[(\d+)-(\d+)\]\]/g, (_match, min, max) => {
      const low = Number.parseInt(min, 10);
      const high = Number.parseInt(max, 10);
      return String(Math.floor(Math.random() * (high - low + 1)) + low);
    });
  }

  processDoubleBraceChoices(text, data) {
    let result = text;
    let startIndex = 0;

    while (true) {
      const openIndex = result.indexOf("{{", startIndex);
      if (openIndex === -1) break;

      const closeIndex = this.findMatchingDoubleBrace(result, openIndex);
      if (closeIndex === -1) break;

      const content = result.substring(openIndex + 2, closeIndex);
      const { cleanContent, weight } = this.extractWeight(content);
      const options = cleanContent
        .split("|")
        .map((option) => option.replace(/^\{/, "").replace(/\}$/, "").trim())
        .filter(Boolean);

      if (options.length < 2) {
        startIndex = closeIndex + 2;
        continue;
      }

      const choices = this.createWeightedChoices(options, data, weight);
      const selected = this.pick(choices);
      result = result.substring(0, openIndex) + selected + result.substring(closeIndex + 2);
      startIndex = openIndex + selected.length;
    }

    return result;
  }

  findMatchingDoubleBrace(text, startIndex) {
    let braceCount = 0;

    for (let i = startIndex + 2; i < text.length - 1; i++) {
      const pair = text.substring(i, i + 2);
      if (pair === "{{") {
        braceCount++;
        i++;
      } else if (pair === "}}") {
        if (braceCount === 0) return i;
        braceCount--;
        i++;
      }
    }

    return -1;
  }

  processSingleBraceChoices(text, data) {
    return text.replace(/\{([^}]+)\}/g, (match, content) => {
      if (!content.includes("|")) return match;

      const { cleanContent, weight } = this.extractWeight(content);
      const options = cleanContent.map ? cleanContent : cleanContent.split("|");
      const cleaned = options.map((option) => {
        const trimmed = option.trim();
        const quoted = trimmed.match(/^"([^"]+)"$/);
        return quoted ? quoted[1] : trimmed;
      });

      return this.pick(this.createWeightedChoices(cleaned, data, weight));
    });
  }

  processQuantityPatterns(text, data) {
    return text.replace(/(\d+)\s+x\s+\{([^}]+)\}/g, (match, quantity, tableName) => {
      const qty = Number.parseInt(quantity, 10);
      const table = data[tableName];
      if (!table || table.length === 0) return match;
      if (qty === 0) return "";

      const items = [];
      for (let i = 0; i < qty; i++) items.push(this.pick(table));
      return items.join(", ");
    });
  }

  processTableReferences(text, data) {
    return text.replace(/{(.*?)}/g, (match, key) => {
      const table = data[key.trim()];
      return table && table.length > 0 ? this.pick(table) : match;
    });
  }

  extractWeight(content) {
    const weightMatch = content.match(/\s*\^(\d+)$/);
    return {
      cleanContent: content.replace(/\s*\^\d+$/, ""),
      weight: weightMatch ? Number.parseInt(weightMatch[1], 10) : 1,
    };
  }

  createWeightedChoices(options, data, weight) {
    const choices = [];

    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const table = data[option];
      const value = table && table.length > 0 ? this.pick(table) : option;
      const count = i === options.length - 1 ? weight : 1;
      for (let j = 0; j < count; j++) choices.push(value);
    }

    return choices;
  }
}

module.exports = class RandomTableGeneratorPlugin extends Plugin {
  async onload() {
    this.engine = new GeneratorEngine();

    this.registerMarkdownCodeBlockProcessor("troll-speak", async (source, el, ctx) => {
      await this.renderGeneratorBlock(source, el, ctx);
    });

    this.registerMarkdownCodeBlockProcessor("troll-food", (source, el) => {
      this.renderTableDataBlock(source, el);
    });

    this.addCommand({
      id: "roll-current-note-generator",
      name: "Roll current note generator",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice("No active note.");
          return;
        }

        try {
          const content = await this.app.vault.read(file);
          const config = this.extractFirstGeneratorConfig(content);
          const data = await this.collectTablesForGenerator(file, config);
          const result = this.engine.roll(data, config.table);
          await navigator.clipboard.writeText(result);
          new Notice(`Rolled: ${result}`);
        } catch (error) {
          new Notice(error.message);
        }
      },
    });
  }

  renderTableDataBlock(source, el) {
    el.empty();
    el.addClass("rtg-table-data");

    const details = el.createEl("details");
    details.createEl("summary", { text: "Random table data" });
    details.createEl("pre", { text: source.trim() });
  }

  async renderGeneratorBlock(source, el, ctx) {
    const config = this.parseGeneratorConfig(source);
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);

    if (!file) {
      this.renderError(el, "Could not load source note.");
      return;
    }

    let data;
    try {
      data = await this.collectTablesForGenerator(file, config);
    } catch (error) {
      this.renderError(el, error.message);
      return;
    }

    el.empty();
    el.addClass("rtg-widget");

    const controls = el.createDiv({ cls: "rtg-controls" });
    const rollButton = controls.createEl("button", { text: "Roll" });
    const copyButton = controls.createEl("button", { text: "Copy" });
    const output = el.createDiv({ cls: "rtg-output" });

    let latest = [];

    const roll = () => {
      try {
        latest = [];
        output.empty();

        for (let i = 0; i < config.count; i++) {
          latest.push(this.engine.roll(data, config.table));
        }

        this.renderResults(output, latest, config.format);
      } catch (error) {
        this.renderError(output, error.message);
      }
    };

    rollButton.addEventListener("click", roll);
    copyButton.addEventListener("click", async () => {
      if (latest.length === 0) roll();
      await navigator.clipboard.writeText(latest.join("\n"));
      new Notice("Generated result copied.");
    });

    roll();
  }

  async collectTablesForGenerator(file, config) {
    const data = {};

    for (const sourcePath of config.sources) {
      const sourceFile = this.resolveSourceFile(sourcePath, file.path);
      if (!sourceFile) {
        throw new Error(`Could not find generator source: ${sourcePath}`);
      }
      const sourceData = this.collectTablesFromMarkdown(await this.app.vault.read(sourceFile), sourceFile.basename);
      this.mergeTableData(data, sourceData);
    }

    this.mergeTableData(data, this.collectTablesFromMarkdown(await this.app.vault.read(file), file.basename));

    if (Object.keys(data).length === 0) {
      throw new Error("No troll-food blocks or Markdown dice tables found.");
    }

    return data;
  }

  resolveSourceFile(sourcePath, currentPath) {
    const cleanPath = sourcePath
      .trim()
      .replace(/^\[\[/, "")
      .replace(/\]\]$/, "")
      .split("|")[0]
      .trim();

    const linked = this.app.metadataCache.getFirstLinkpathDest(cleanPath, currentPath);
    if (linked) return linked;

    const direct = this.app.vault.getAbstractFileByPath(cleanPath);
    if (direct) return direct;

    if (!cleanPath.endsWith(".md")) {
      return this.app.vault.getAbstractFileByPath(`${cleanPath}.md`);
    }

    return null;
  }

  collectTablesFromMarkdown(markdown, pageName) {
    const data = {};
    const blocks = [];
    const fencedRegex = /```troll-food\s*\n([\s\S]*?)```/g;
    const commentRegex = /%%\s*troll-food\s*\n([\s\S]*?)%%/g;
    let match;

    while ((match = fencedRegex.exec(markdown)) !== null) {
      blocks.push(match[1]);
    }

    while ((match = commentRegex.exec(markdown)) !== null) {
      blocks.push(match[1]);
    }

    if (blocks.length > 0) {
      this.mergeTableData(data, this.engine.parse(blocks.join("\n\n")));
    }

    this.mergeTableData(data, this.parseMarkdownDiceTables(markdown, pageName));
    return data;
  }

  mergeTableData(target, source) {
    for (const [key, entries] of Object.entries(source)) {
      if (!target[key]) target[key] = [];
      target[key].push(...entries);
    }
  }

  parseMarkdownDiceTables(markdown, pageName) {
    const lines = markdown.split(/\r?\n/);
    const records = [];
    const headingStack = [];

    for (let i = 0; i < lines.length; i++) {
      const heading = lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        headingStack.length = heading[1].length - 1;
        const headingName = this.cleanMarkdownTableCell(heading[2]);
        if (!(heading[1].length === 1 && headingName === pageName)) {
          headingStack.push(headingName);
        }
        continue;
      }

      if (!this.looksLikeTableStart(lines, i)) continue;

      const tableLines = [];
      while (i < lines.length && this.isPotentialMarkdownTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;

      const parsed = this.parseMarkdownTable(tableLines);
      if (!parsed || parsed.headers.length < 2 || !this.isDiceColumnHeader(parsed.headers[0])) continue;

      const headingPath = headingStack.filter(Boolean).join("/");
      for (let columnIndex = 1; columnIndex < parsed.headers.length; columnIndex++) {
        const columnName = this.cleanMarkdownTableCell(parsed.headers[columnIndex]);
        if (!columnName) continue;

        const entries = [];
        for (const row of parsed.rows) {
          const value = this.cleanMarkdownTableCell(row[columnIndex] || "");
          if (!value) continue;

          const weight = this.rowWeight(row[0] || "");
          for (let copy = 0; copy < weight; copy++) entries.push(value);
        }

        if (entries.length === 0) continue;

        const fullKey = headingPath ? `${pageName}/${headingPath}/${columnName}` : `${pageName}/${columnName}`;
        const pageAliasKey = `${pageName}/${columnName}`;
        const localAliasKey = columnName;
        records.push({ fullKey, pageAliasKey, localAliasKey, entries });
      }
    }

    const data = {};
    const pageAliasCounts = {};
    const localAliasCounts = {};
    for (const record of records) {
      pageAliasCounts[record.pageAliasKey] = (pageAliasCounts[record.pageAliasKey] || 0) + 1;
      localAliasCounts[record.localAliasKey] = (localAliasCounts[record.localAliasKey] || 0) + 1;
      if (!data[record.fullKey]) data[record.fullKey] = [];
      data[record.fullKey].push(...record.entries);
    }

    for (const record of records) {
      if (pageAliasCounts[record.pageAliasKey] === 1 && record.pageAliasKey !== record.fullKey) {
        if (!data[record.pageAliasKey]) data[record.pageAliasKey] = [];
        data[record.pageAliasKey].push(...record.entries);
      }

      if (localAliasCounts[record.localAliasKey] !== 1) continue;
      if (!data[record.localAliasKey]) data[record.localAliasKey] = [];
      data[record.localAliasKey].push(...record.entries);
    }

    return data;
  }

  looksLikeTableStart(lines, index) {
    return this.isPotentialMarkdownTableRow(lines[index] || "") && this.isMarkdownSeparatorRow(lines[index + 1] || "");
  }

  parseMarkdownTable(lines) {
    if (lines.length < 2 || !this.isMarkdownSeparatorRow(lines[1])) return null;

    const headers = this.splitMarkdownTableRow(lines[0]);
    const rows = [];
    for (let i = 2; i < lines.length; i++) {
      if (this.isMarkdownSeparatorRow(lines[i])) continue;
      const row = this.splitMarkdownTableRow(lines[i]);
      while (row.length < headers.length) row.push("");
      rows.push(row);
    }

    return { headers, rows };
  }

  splitMarkdownTableRow(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  isMarkdownSeparatorRow(line) {
    if (!this.isPotentialMarkdownTableRow(line)) return false;
    const cells = this.splitMarkdownTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell.trim()));
  }

  isPotentialMarkdownTableRow(line) {
    return /\|/.test(line || "");
  }

  isDiceColumnHeader(header) {
    const normalized = this.cleanMarkdownTableCell(header).toLowerCase();
    return (
      /^d\d+(?:\s*\+\s*d\d+)*$/.test(normalized) ||
      /^\d+d\d+$/.test(normalized) ||
      /^dice\s*:?\s*\d*d?\d+$/.test(normalized) ||
      /\bd\d+\b/.test(normalized) && /\broll\b/.test(normalized) ||
      normalized === "roll"
    );
  }

  rowWeight(value) {
    const normalized = this.cleanMarkdownTableCell(value).replace(/\s/g, "");
    const range = normalized.match(/^(\d+)[\-\u2013\u2014](\d+)$/);
    if (!range) return 1;

    const start = Number.parseInt(range[1], 10);
    let end = Number.parseInt(range[2], 10);
    if (end === 0 && start > 0) end = 100;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
    return Math.max(1, end - start + 1);
  }

  cleanMarkdownTableCell(value) {
    return value
      .trim()
      .replace(/`?dice\+?:\s*\[\[[^\]#]+#\^([^\]\|]+)(?:\|[^\]]*)?\]\]`?/g, "{$1}")
      .replace(/\*\*/g, "")
      .replace(/^`|`$/g, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  extractFirstGeneratorConfig(markdown) {
    const match = markdown.match(/```troll-speak\s*\n([\s\S]*?)```/);
    return this.parseGeneratorConfig(match ? match[1] : "");
  }

  parseGeneratorConfig(source) {
    const config = {
      table: "template",
      count: 1,
      format: "list",
      sources: [],
    };
    let activeListKey = null;

    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (activeListKey && /^\s*-\s+/.test(line)) {
        config[activeListKey].push(trimmed.replace(/^-\s+/, "").trim());
        continue;
      }

      activeListKey = null;
      const match = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
      if (!match) continue;

      const key = match[1].toLowerCase();
      const value = match[2];

      if (key === "table") config.table = value || config.table;
      if (key === "source" || key === "sources") {
        activeListKey = "sources";
        config.sources.push(...this.parseSourceList(value));
      }
      if (key === "count") {
        const count = Number.parseInt(value, 10);
        if (Number.isFinite(count)) config.count = Math.max(1, Math.min(count, 100));
      }
      if (key === "format" && ["list", "paragraph"].includes(value)) config.format = value;
    }

    return config;
  }

  parseSourceList(value) {
    const sources = [];
    let current = "";
    let wikilinkDepth = 0;

    for (let i = 0; i < value.length; i++) {
      const pair = value.substring(i, i + 2);

      if (pair === "[[") {
        wikilinkDepth++;
        current += pair;
        i++;
        continue;
      }

      if (pair === "]]" && wikilinkDepth > 0) {
        wikilinkDepth--;
        current += pair;
        i++;
        continue;
      }

      if (value[i] === "," && wikilinkDepth === 0) {
        if (current.trim()) sources.push(current.trim());
        current = "";
        continue;
      }

      current += value[i];
    }

    if (current.trim()) sources.push(current.trim());
    return sources;
  }

  renderResults(container, results, format) {
    container.empty();

    if (format === "paragraph") {
      for (const result of results) container.createEl("p", { text: result });
      return;
    }

    const list = container.createEl("ol");
    for (const result of results) list.createEl("li", { text: result });
  }

  renderError(container, message) {
    container.empty();
    container.createEl("p", { cls: "rtg-error", text: message });
  }
};
