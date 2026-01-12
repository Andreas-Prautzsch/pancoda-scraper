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


## Beispiel Verwendung in n8n workflow

```json
{
  "nodes": [
    {
      "parameters": {
        "url": "={{ $json.url }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.3,
      "position": [
        256,
        -16
      ],
      "id": "877b2b5e-67a1-4739-8aa3-b0a474d2dcb3",
      "name": "Get HTML"
    },
    {
      "parameters": {
        "jsCode": "const html = $input.first().json.data ?? '';\n\nreturn [{\n  json: {\n    payload: {\n      html,\n      template: {\n        selects: {\n          teasers: {\n            type: \"selectAll\",\n            from: \".company-teaser\",\n            return: {\n              title: { text: { selector: \".teaser_title\" } }\n            },\n            post: { notEmpty: [\"title\"] }\n          },\n          pagination: {\n            type: \"selectAll\",\n            from: \".pagination_page-item\",\n            return: {\n              href: {\n                attr: {\n                  selector: \"a\",\n                  name: \"href\"\n                }\n              }\n            },\n            post: { notEmpty: [\"href\"] }\n          }\n        }\n      }\n    }\n  }\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        480,
        -16
      ],
      "id": "c29354fa-1ee4-423e-a571-cefeb59b8930",
      "name": "Find all .company-teaser Payload"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "DEINE URL",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.payload }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.3,
      "position": [
        720,
        -16
      ],
      "id": "f9f03526-7ebd-4cea-ad68-791a5c80eb03",
      "name": "HTTP Request - Cheerio"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "d266eb19-ef74-4bca-9ea8-37f54b51bfac",
              "name": "teasers",
              "value": "={{ $json.result.teasers }}",
              "type": "string"
            },
            {
              "id": "639a8d0a-8abf-4099-aa33-82c255131b77",
              "name": "pagination",
              "value": "={{ $json.result.pagination }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        928,
        -16
      ],
      "id": "aee155ae-63cc-4cdd-baea-9a6ffa67015a",
      "name": "Return"
    },
    {
      "parameters": {
        "workflowInputs": {
          "values": [
            {
              "name": "url"
            }
          ]
        }
      },
      "id": "7f74754d-56c0-4c47-b7d7-0ba62e546b76",
      "typeVersion": 1.1,
      "name": "Start",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "position": [
        48,
        -16
      ]
    }
  ],
  "connections": {
    "Get HTML": {
      "main": [
        [
          {
            "node": "Find all .company-teaser Payload",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Find all .company-teaser Payload": {
      "main": [
        [
          {
            "node": "HTTP Request - Cheerio .company-teaser",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request - Cheerio .company-teaser": {
      "main": [
        [
          {
            "node": "Return",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Start": {
      "main": [
        [
          {
            "node": "Get HTML",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "meta": {
    "instanceId": "48437a253cc89d3156e59b762215d84c2f0d673e0b650937813e9974cd6a85c2"
  }
}
```

