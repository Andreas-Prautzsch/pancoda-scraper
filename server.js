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
  // template supports: { selectOne: {...} } or { selectAll: {...} }
  if (template.selectOne) return execSelect({ $, vars, spec: template.selectOne, mode: "one" });
  if (template.selectAll) return execSelect({ $, vars, spec: template.selectAll, mode: "all" });

  throw new Error("template must include selectOne or selectAll");
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
  const out = filtered.map(mapper);

  // optional post filters (very small feature set)
  if (spec.post?.notEmpty) {
    const fields = Array.isArray(spec.post.notEmpty) ? spec.post.notEmpty : [spec.post.notEmpty];
    return out.filter((row) => fields.every((f) => row?.[f] != null && String(row[f]).trim() !== ""));
  }

  if (spec.post?.exclude) {
    // exclude: { field: "label", values: ["Hersteller:"] }
    const { field, values } = spec.post.exclude || {};
    if (field && Array.isArray(values)) {
      const set = new Set(values);
      return out.filter((row) => !set.has(row?.[field]));
    }
  }

  return out;
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
