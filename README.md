# JSON Template HTML Parser

Dieses Projekt nimmt HTML + ein JSON-Template entgegen und extrahiert Daten via Cheerio.
Unten findest du eine vollständige Auflistung der Template-Funktionen inkl. Beispielen.

## Grundidee

Ein Template kann entweder `selects` (mehrere benannte Auswahlen) enthalten oder
kompatibel zu älteren Varianten `selectOne` / `selectAll` auf Root-Level.

## Template-Schema (Übersicht)

- `selects`: Objekt mit mehreren benannten Auswahlen.
  - `{key}` → `selectOne` oder `selectAll`
- `selectOne`: Einzelne Auswahl (erstes Match, sonst `null`)
- `selectAll`: Mehrere Auswahlen (Array)

Jede Auswahl (`selectOne` / `selectAll`) unterstützt:
- `from`: CSS-Selector als String (Pflicht)
- `where`: optionaler Filter (aktuell nur `eq`)
- `return`: Objekt mit Feldern und Expressions (Pflicht)
- `post`: optionale Nachfilter für `selectAll`

## Auswahl: `selectOne` / `selectAll`

### `from`
Wählt die Basiselemente.

```json
{
  "from": ".product"
}
```

### `where` (aktuell nur `eq`)
Filtert Elemente, bei denen zwei Expressions gleich sind.

```json
{
  "where": { "eq": [ { "text": { "selector": ".label" } }, { "var": "expected" } ] }
}
```

### `return`
Legt fest, welche Felder extrahiert werden.

```json
{
  "return": {
    "title": { "text": { "selector": "h2" } },
    "link": { "attr": { "selector": "a", "name": "href" } }
  }
}
```

### `post` (nur bei `selectAll`)
Optionales Filtern des Ergebnis-Arrays.

#### `post.notEmpty`
Entfernt Einträge, bei denen bestimmte Felder leer sind.

```json
{
  "post": { "notEmpty": ["title", "link"] }
}
```

#### `post.exclude`
Schließt Einträge aus, wenn ein Feld einen bestimmten Wert hat oder ein Selector matcht.

```json
{
  "post": {
    "exclude": { "field": "label", "values": ["Hersteller:"] }
  }
}
```

```json
{
  "post": {
    "exclude": { "selector": ".--active-link" }
  }
}
```

#### `post.drop`
Ignoriert eine Anzahl von Einträgen am Anfang und/oder Ende.

```json
{
  "post": {
    "drop": { "head": 1, "tail": 1 }
  }
}
```
## Expressions (Funktionen) in `return` / `where`

### `var`
Liest Variablen aus dem Request (`vars`). Damit kannst du Werte von außen einfließen lassen,
z. B. zum Vergleichen in `where`, zum Ergänzen von Feldern oder um Labels/IDs direkt zu setzen.

```json
{ "var": "expected" }
```

### `text`
Textinhalt eines Elements.

```json
{ "text": { "selector": ".price" } }
```

### `html`
HTML eines Elements.

```json
{ "html": { "selector": ".description" } }
```

### `attr`
Attributwert eines Elements.

```json
{ "attr": { "selector": "a", "name": "href" } }
```

## Vollständiges Beispiel mit `selects`

```json
{
  "selects": {
    "products": {
      "type": "selectAll",
      "from": ".product",
      "where": { "eq": [ { "text": { "selector": ".status" } }, { "var": "status" } ] },
      "return": {
        "title": { "text": { "selector": "h2" } },
        "price": { "text": { "selector": ".price" } },
        "link": { "attr": { "selector": "a", "name": "href" } }
      },
      "post": { "notEmpty": ["title", "price"] }
    },
    "featured": {
      "type": "selectOne",
      "from": ".featured",
      "return": {
        "title": { "text": { "selector": "h1" } },
        "html": { "html": { "selector": ".hero" } }
      }
    }
  }
}
```

## Beispiel-Request

```json
{
  "html": "<html>...</html>",
  "vars": { "status": "Auf Lager" },
  "template": {
    "selectOne": {
      "from": ".product",
      "return": {
        "title": { "text": { "selector": "h2" } }
      }
    }
  }
}
```
