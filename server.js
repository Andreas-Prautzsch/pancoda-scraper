import express from "express";
import * as cheerio from "cheerio";

const app = express();
app.use(express.json({ limit: "8mb" }));

// Optional: simple token auth
const TOKEN = process.env.PARSER_TOKEN || "";
app.use((req, res, next) => {
  if (!TOKEN) return next();
  if (req.headers["x-parser-token"] === TOKEN) return next();
  return res.status(401).json({ error: "unauthorized" });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/parse", (req, res) => {
  try {
    const { html, vars = {}, template } = req.body ?? {};
    if (typeof html !== "string" || !html) {
      return res.status(400).json({ error: "missing html" });
    }
    if (!template || typeof template !== "object") {
      return res.status(400).json({ error: "missing template" });
    }

    const $ = cheerio.load(html);

    const result = runTemplate({ $, vars, template });
    return res.json({ result });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

function runTemplate({ $, vars, template }) {
  if (template.selects) {
    const out = {};
    for (const [key, spec] of Object.entries(template.selects)) {
      if (spec.type === "selectAll") {
        out[key] = execSelect({ $, vars, spec, mode: "all" });
      } else if (spec.type === "selectOne") {
        out[key] = execSelect({ $, vars, spec, mode: "one" });
      }
    }
    return out;
  }

  // backward compatibility
  if (template.selectOne) return execSelect({ $, vars, spec: template.selectOne, mode: "one" });
  if (template.selectAll) return execSelect({ $, vars, spec: template.selectAll, mode: "all" });

  throw new Error("template invalid");
}

function execSelect({ $, vars, spec, mode }) {
  const from = spec.from;
  if (typeof from !== "string" || !from) throw new Error("select.from missing");

  const nodes = $(from).toArray().map((n) => $(n));

  // filter via where (optional)
  let filtered = nodes;
  if (spec.where) filtered = nodes.filter((node) => evalWhere({ $, vars, node, where: spec.where }));

  const mapper = (node) => evalReturn({ $, vars, node, ret: spec.return });

  if (mode === "one") {
    const first = filtered[0];
    return first ? mapper(first) : null;
  }

  // mode all
  let pairs = filtered.map((node) => ({ node, row: mapper(node) }));

  // optional post filters (very small feature set)
  if (spec.post?.notEmpty) {
    const fields = Array.isArray(spec.post.notEmpty) ? spec.post.notEmpty : [spec.post.notEmpty];
    pairs = pairs.filter(({ row }) => fields.every((f) => row?.[f] != null && String(row[f]).trim() !== ""));
  }

  if (spec.post?.exclude) {
    // exclude: { field: "label", values: ["Hersteller:"] } or { selector: ".--active-link" }
    const { field, values, selector } = spec.post.exclude || {};
    if (selector) {
      const selectors = Array.isArray(selector) ? selector : [selector];
      const matchesSelector = (node, sel) => node.is(sel) || node.find(sel).length > 0;
      pairs = pairs.filter(({ node }) => selectors.every((sel) => !matchesSelector(node, sel)));
    }
    if (field && Array.isArray(values)) {
      const set = new Set(values);
      pairs = pairs.filter(({ row }) => !set.has(row?.[field]));
    }
  }

  if (spec.post?.drop) {
    // drop: { head: 1, tail: 1 }
    const head = Number(spec.post.drop.head || 0);
    const tail = Number(spec.post.drop.tail || 0);
    const start = Number.isFinite(head) && head > 0 ? head : 0;
    const end = Number.isFinite(tail) && tail > 0 ? -tail : undefined;
    pairs = end === undefined ? pairs.slice(start) : pairs.slice(start, end);
  }

  return pairs.map(({ row }) => row);
}

function evalWhere({ $, vars, node, where }) {
  // supported: { eq: [expr, expr] }
  if (where.eq) {
    const [a, b] = where.eq;
    return String(evalExpr({ $, vars, node, expr: a }) ?? "") === String(evalExpr({ $, vars, node, expr: b }) ?? "");
  }
  throw new Error("where supports only eq for now");
}

function evalReturn({ $, vars, node, ret }) {
  if (!ret || typeof ret !== "object") throw new Error("select.return missing");
  const out = {};
  for (const [key, expr] of Object.entries(ret)) {
    out[key] = evalExpr({ $, vars, node, expr });
  }
  return out;
}

function evalExpr({ $, vars, node, expr }) {
  // expr forms:
  // { var: "name" }
  // { text: { selector: "..." } }
  // { html: { selector: "..." } }
  // { attr: { selector: "...", name: "href" } }
  if (!expr || typeof expr !== "object") return null;

  if (expr.var) return vars[expr.var];

  if (expr.text) {
    const sel = expr.text.selector;
    const el = node.find(sel).first();
    return el.length ? el.text().trim() : null;
  }

  if (expr.html) {
    const sel = expr.html.selector;
    const el = node.find(sel).first();
    return el.length ? $.html(el) : null;
  }

  if (expr.attr) {
    const sel = expr.attr.selector;
    const name = expr.attr.name;
    const el = node.find(sel).first();
    return el.length ? (el.attr(name) ?? null) : null;
  }

  return null;
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`parser listening on ${port}`));
