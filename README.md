# Trolls in the Cellar

Perchance-style random generators, written as plain Markdown, directly inside
Obsidian.

Trolls in the Cellar turns notes into small creative engines. Write named
tables in a `random-table` block, add a `generator` block, and Obsidian renders
an interactive roller with copyable results in Reading view. It is built for
tabletop RPG prep, but the format is plain enough for names, rumors, omens,
loot, locations, prompts, and anything else that benefits from structured
randomness.

## Quick Example

````markdown
# Trap Generator

```random-table
template
  {element} {trap} triggered by {trigger}

element
  flaming
  icy
  poisonous

trap
  darts
  spears
  a spiked pit

trigger
  tripwires
  floor plates
  a jeweled skull
```

```generator
table: template
count: 5
format: list
```
````

In Reading view, the `generator` block becomes a roller with **Roll** and
**Copy** buttons.

## Generator Blocks

Use a fenced `generator` block to configure what gets rolled.

```text
table: template
count: 10
format: list
```

Supported options:

- `table`: the table to roll, defaulting to `template`
- `count`: number of results to generate, from 1 to 100
- `format`: `list` or `paragraph`
- `source` / `sources`: extra notes containing reusable `random-table` blocks

The plugin also adds the command **Roll current note generator**, which rolls the
first `generator` block in the active note, copies the result, and shows it in a
notice.

## Table Syntax

Tables are plain text. A non-indented line starts a table. Indented lines are
entries.

```text
template
  A {condition} {item}
  [[100-500]] {coin_type} pieces

coin_type
  copper ^3
  silver ^2
  gold
```

Supported syntax:

- `{table}` rolls once on a named table
- `[[min-max]]` rolls an integer in a range
- `entry ^3` weights an entry by repeating it three times
- `{"one"|"two"}` chooses one literal option
- `{{table_a}|{table_b}}` chooses between table results
- `{"common"|"rare" ^4}` gives extra weight to the last option
- `3 x {table}` rolls a table multiple times and joins the results

The engine is intentionally small and practical. It uses repeated expansion
passes with a recursion limit, so deeply nested generator syntax should stay
simple.

## Reusable Source Notes

For small generators, keep table data in the same note:

````markdown
```random-table
template
  {thing}

thing
  a brass key
  a cracked mirror
```
````

For large libraries, hide backing tables in Obsidian comments:

```text
%% random-table
template
  {thing}
%%
```

Then reference shared notes from a generator:

```text
sources:
  - [[_tables/Common Generator Tables]]
  - [[_tables/NPC Generator Tables]]
table: npc
count: 6
```

`source:` and `sources:` accept wikilinks or vault-relative paths. Comma-separated
source lists are also supported.

## Installation

This plugin is not yet published as an Obsidian community plugin.

During development, install it with
[BRAT](https://github.com/TfTHacker/obsidian42-brat) by adding this repository:

```text
daren-thomas/trolls-in-the-cellar
```

For manual testing, copy `main.js`, `manifest.json`, and `styles.css` into:

```text
.obsidian/plugins/trolls-in-the-cellar/
```

Then enable **Trolls in the Cellar** in Obsidian's Community Plugins settings.

## Origin

This plugin began as an Obsidian adaptation of this CC0 generator template by
Mike Shea:

https://github.com/mshea/lazy_gm_tools/blob/main/5e_artisanal_database/generators/generator_template/index.html

See [NOTICE.md](NOTICE.md) for source links and licensing notes.

## License

Trolls in the Cellar is released under CC0 1.0 Universal. See [LICENSE](LICENSE).
