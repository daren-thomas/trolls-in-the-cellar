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
    const markdowns = [];

    for (const sourcePath of config.sources) {
      const sourceFile = this.resolveSourceFile(sourcePath, file.path);
      if (!sourceFile) {
        throw new Error(`Could not find generator source: ${sourcePath}`);
      }
      markdowns.push(await this.app.vault.read(sourceFile));
    }

    markdowns.push(await this.app.vault.read(file));
    return this.collectTables(markdowns.join("\n\n"));
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

  collectTables(markdown) {
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

    if (blocks.length === 0) {
      throw new Error("No troll-food block found in this note.");
    }

    return this.engine.parse(blocks.join("\n\n"));
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
