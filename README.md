# Trolls in the Cellar

Perchance-style random generators, written as plain Markdown, directly inside
Obsidian.

Trolls in the Cellar turns notes into small creative engines. Write named
tables in a `troll-food` block, add a `troll-speak` block, and Obsidian renders
an interactive roller with copyable results in Reading view. It is built for
tabletop RPG prep, but the format is plain enough for names, rumors, omens,
loot, locations, prompts, and anything else that benefits from structured
randomness.

## Quick Example

````markdown
# Trap Generator

```troll-food
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

```troll-speak
table: template
count: 5
format: list
```
````

In Reading view, the `troll-speak` block becomes a roller with **Roll** and
**Copy** buttons.

## Troll Speak Blocks

Use a fenced `troll-speak` block to configure what gets rolled.

```text
table: template
count: 10
format: list
```

Supported options:

- `table`: the table to roll, defaulting to `template`
- `count`: number of results to generate, from 1 to 100
- `format`: `list` or `paragraph`
- `source` / `sources`: extra notes containing reusable `troll-food` blocks

The plugin also adds the command **Roll current note generator**, which rolls the
first `troll-speak` block in the active note, copies the result, and shows it in
a notice.

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
```troll-food
template
  {thing}

thing
  a brass key
  a cracked mirror
```
````

For large libraries, hide backing tables in Obsidian comments:

```text
%% troll-food
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

## Markdown Dice Tables

Readable Markdown tables can also feed generators. If a Markdown table's first
header cell looks like a dice or roll column, Trolls in the Cellar turns every
other column into a rollable table.

```markdown
## Character Goals

| d20 | Objective | Reason | Complication |
| --- | --------- | ------ | ------------ |
| 1   | Recover an heirloom | A debt is owed | A rival wants it too |
| 2-3 | Escort a witness | They know too much | The witness is lying |
```

From a note named `Character Seeds`, this creates:

```text
{Character Seeds/Character Goals/Objective}
{Character Seeds/Character Goals/Reason}
{Character Seeds/Character Goals/Complication}
```

If a column name is unique within the page, a shorter page-level alias is also
available:

```text
{Character Seeds/Objective}
```

Ranges in the dice column weight entries. In the example above, the `2-3` row is
twice as likely as the `1` row.

Columns are exposed as independent roll tables. If you combine several columns
in one `troll-food` template, each column is rolled separately.

For compatibility with existing notes, Dice Roller links inside Markdown table
cells are interpreted as Trolls table references at roll time. This is useful
when imported Markdown tables already contain references to other roll tables.
For example:

```text
`dice: [[MazeRatsTables#^PhysicalEffects]]`
```

is interpreted as:

```text
{PhysicalEffects}
```

## Installation

Trolls in the Cellar is available in the Obsidian community plugin directory.
In Obsidian, open **Settings → Community plugins → Browse**, search for
**Trolls in the Cellar**, install it, and enable it. You can also install it
from the
[community listing](https://community.obsidian.md/plugins/trolls-in-the-cellar).

To track pre-release builds, install it with
[BRAT](https://github.com/TfTHacker/obsidian42-brat) by adding this repository:

```text
daren-thomas/trolls-in-the-cellar
```

For manual installation, copy `main.js`, `manifest.json`, and `styles.css` into:

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
