/**
 * ts-dts-bundler
 * ---------------------------------------------------------------
 * A dependency-crawling bundler for TypeScript ambient declaration
 * (.d.ts) files served over HTTP (e.g. via esm.sh).
 *
 * Given an entry point — either:
 *   - a direct URL to a .d.ts file, or
 *   - an npm package specifier (e.g. "lodash", "@types/node", "@angular/core")
 *
 * ...it recursively discovers all import/export/reference dependencies,
 * fetches them concurrently (firing requests the instant they're
 * discovered, never blocking on siblings), and produces a single
 * bundled text output ordered via dependency-first topological sort.
 * ---------------------------------------------------------------
 */

// ------------------------------------------------------------------
// Public types
// ------------------------------------------------------------------

export interface BundleProps {
  /** URL to a .d.ts file, or an npm package specifier. */
  entry: string;
  /** Optional fetch implementation override (defaults to global fetch). */
  fetchImpl?: typeof fetch;
  /** Called synchronously as soon as each event occurs. */
  onUpdate?: (update: BundleUpdate) => void;
}

export type BundleUpdate =
  | ResolvingUpdate
  | ResolvedUpdate
  | ResolveFailedUpdate
  | FileStartedUpdate
  | FileDownloadedUpdate
  | FileFailedUpdate
  | ProgressUpdate
  | DoneUpdate;

/** Emitted when a bare package specifier begins entry resolution. */
export interface ResolvingUpdate {
  type: "resolving";
  input: string;
  attemptUrl: string;
}

/** Emitted when a package specifier successfully resolves to a .d.ts URL. */
export interface ResolvedUpdate {
  type: "resolved";
  input: string;
  resolvedUrl: string;
}

/** Emitted when package-name resolution itself fails. */
export interface ResolveFailedUpdate {
  type: "resolve-failed";
  input: string;
  error: string;
}

/** Emitted the instant a fetch is kicked off for a discovered URL. */
export interface FileStartedUpdate {
  type: "started";
  url: string;
}

/** Emitted when a file finishes downloading successfully. */
export interface FileDownloadedUpdate {
  type: "downloaded";
  url: string;
  bytes: number;
}

/** Emitted when a file fails to download or is otherwise unreachable. */
export interface FileFailedUpdate {
  type: "failed";
  url: string;
  error: string;
}

/** Emitted after every started/downloaded/failed event with aggregate counts. */
export interface ProgressUpdate {
  type: "progress";
  discovered: number;
  pending: number;
  succeeded: number;
  failed: number;
  percent: number; // 0-100, based on settled/discovered
}

/** Emitted once, at the very end, right before bundle() resolves. */
export interface DoneUpdate {
  type: "done";
  result: BundleResult;
}

export interface BundleFileSummary {
  url: string;
  status: "success" | "failed";
  error?: string;
}

export interface BundleSummary {
  entry: string;
  resolvedEntryUrl: string;
  totalDiscovered: number;
  succeeded: number;
  failed: number;
  failedFiles: BundleFileSummary[];
}

export interface BundleResult {
  /** Final bundled declaration text, dependency-ordered. */
  text: string;
  /** High-level counts & metadata about the crawl. */
  summary: BundleSummary;
}

// ------------------------------------------------------------------
// Internal graph node
// ------------------------------------------------------------------

interface GraphNode {
  status: "ok" | "failed";
  content: string;
  deps: string[];
  error?: string;
}

// ------------------------------------------------------------------
// Public entry point
// ------------------------------------------------------------------

export async function bundle(props: BundleProps): Promise<BundleResult> {
  const fetchFn = props.fetchImpl ?? fetch;
  const emit = (u: BundleUpdate) => props.onUpdate?.(u);

  const seen = new Set<string>();
  const pending = new Set<Promise<void>>();
  const graph = new Map<string, GraphNode>();
  const counts = { succeeded: 0, failed: 0 };

  function emitProgress() {
    const discovered = seen.size;
    const settled = counts.succeeded + counts.failed;
    const percent = discovered > 0 ? Math.floor((settled / discovered) * 100) : 0;
    emit({
      type: "progress",
      discovered,
      pending: discovered - settled,
      succeeded: counts.succeeded,
      failed: counts.failed,
      percent,
    });
  }

  function crawl(url: string) {
    if (seen.has(url)) return;
    seen.add(url);
    emitProgress();
    const p = doCrawl(url);
    pending.add(p);
    p.finally(() => pending.delete(p));
  }

  async function doCrawl(url: string): Promise<void> {
    emit({ type: "started", url });
    try {
      const res = await fetchFn(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      counts.succeeded++;
      emit({ type: "downloaded", url, bytes: text.length });
      emitProgress();

      const finalUrl = (res as Response).url || url;
      const { deps, cleaned } = extractDeps(text);

      const resolvedDeps: string[] = [];
      for (const d of deps) {
        const resolved = resolveSpec(d, finalUrl);
        if (resolved) {
          resolvedDeps.push(resolved);
          crawl(resolved);
        }
      }

      graph.set(url, { status: "ok", content: cleaned, deps: resolvedDeps });
    } catch (err: any) {
      const message = err?.message ?? String(err);
      counts.failed++;
      emit({ type: "failed", url, error: message });
      emitProgress();
      graph.set(url, { status: "failed", content: "", deps: [], error: message });
    }
  }

  // ---- resolve entry (URL or package name) --------------------------

  let resolvedEntryUrl: string;
  try {
    if (looksLikeUrl(props.entry)) {
      resolvedEntryUrl = props.entry;
    } else {
      resolvedEntryUrl = await resolvePackageToTypesUrl(props.entry, fetchFn, emit);
    }
  } catch (err: any) {
    const message = err?.message ?? String(err);
    emit({ type: "resolve-failed", input: props.entry, error: message });
    const result: BundleResult = {
      text: `/* Failed to resolve entry "${props.entry}": ${message} */\n`,
      summary: {
        entry: props.entry,
        resolvedEntryUrl: "",
        totalDiscovered: 0,
        succeeded: 0,
        failed: 0,
        failedFiles: [{ url: props.entry, status: "failed", error: message }],
      },
    };
    emit({ type: "done", result });
    return result;
  }

  // ---- crawl ----------------------------------------------------------

  crawl(resolvedEntryUrl);
  while (pending.size > 0) {
    await Promise.all([...pending]);
  }

  // ---- build final result ----------------------------------------------

  const result = buildResult(props.entry, resolvedEntryUrl, graph, seen);
  emit({ type: "done", result });
  return result;
}

// ------------------------------------------------------------------
// Package-name resolution (esm.sh convention)
// ------------------------------------------------------------------

function looksLikeUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

function looksLikeDts(url: string): boolean {
  return /\.d\.ts$/i.test(url.split("?")[0].split("#")[0]);
}

async function resolvePackageToTypesUrl(pkgName: string, fetchFn: typeof fetch, emit: (u: BundleUpdate) => void): Promise<string> {
  const name = pkgName.trim().replace(/^\/+|\/+$/g, "");
  const esmUrl = "https://esm.sh/" + name;

  emit({ type: "resolving", input: pkgName, attemptUrl: esmUrl });

  const res = await fetchFn(esmUrl, { method: "GET" });
  const finalUrl = (res as Response).url || esmUrl;

  // Case 1: esm.sh redirected straight to a .d.ts file
  // e.g. https://esm.sh/@types/node -> https://esm.sh/@types/node@X/index.d.ts
  if (looksLikeDts(finalUrl)) {
    emit({ type: "resolved", input: pkgName, resolvedUrl: finalUrl });
    return finalUrl;
  }

  // Case 2: normal JS module response carrying x-typescript-types header
  const typesHeader = res.headers.get("x-typescript-types");
  if (typesHeader) {
    const resolved = new URL(typesHeader, finalUrl).href;
    emit({ type: "resolved", input: pkgName, resolvedUrl: resolved });
    return resolved;
  }

  throw new Error(`Could not resolve types for package "${name}" (status ${res.status}, ` + `no x-typescript-types header, final URL was ${finalUrl})`);
}

// ------------------------------------------------------------------
// Dependency extraction
// ------------------------------------------------------------------

type DepKind = "path" | "types";

interface Dep {
  spec: string;
  kind: DepKind;
}

function extractDeps(src: string): { deps: Dep[]; cleaned: string } {
  const deps: Dep[] = [];
  const push = (spec: string | undefined, kind: DepKind) => {
    if (spec) deps.push({ spec, kind });
  };
  let out = src;

  // /// <reference path="...">
  out = out.replace(/\/\/\/\s*<reference\s+path\s*=\s*["']([^"']+)["']\s*\/?>\s*\r?\n?/g, (_m, p) => {
    push(p, "path");
    return "";
  });

  // /// <reference types="...">
  out = out.replace(/\/\/\/\s*<reference\s+types\s*=\s*["']([^"']+)["']\s*\/?>\s*\r?\n?/g, (_m, p) => {
    push(p, "types");
    return "";
  });

  // side-effect only import: import 'x';
  out = out.replace(/import\s*["']([^"']+)["']\s*;?/g, (_m, p) => {
    push(p, "path");
    return "";
  });

  // import ... from 'x'; (incl. import type ... from 'x';)
  out = out.replace(/import\s+(?:type\s+)?[\s\S]*?\bfrom\s+["']([^"']+)["']\s*;?/g, (_m, p) => {
    push(p, "path");
    return "";
  });

  // export * [as ns] from 'x';  export type * from 'x';
  out = out.replace(/export\s+(?:type\s+)?\*(?:\s+as\s+[\w$]+)?\s*from\s+["']([^"']+)["']\s*;?/g, (_m, p) => {
    push(p, "path");
    return "";
  });

  // export { ... } from 'x';  export type { ... } from 'x';
  out = out.replace(/export\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s+["']([^"']+)["']\s*;?/g, (_m, p) => {
    push(p, "path");
    return "";
  });

  // inline dynamic type-import expression e.g. import('./foo').Bar
  // discovered as a dependency, but left in place since it's used as a type reference.
  const dynRe = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let dm: RegExpExecArray | null;
  while ((dm = dynRe.exec(out))) {
    push(dm[1], "path");
  }

  // drop sourceMappingURL comments
  out = out.replace(/\/\/#\s*sourceMappingURL=.*$/gm, "");

  // cosmetic: collapse excessive blank lines
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  return { deps, cleaned: out };
}

function resolveSpec(dep: Dep, baseUrl: string): string | null {
  try {
    if (dep.kind === "types") {
      if (/^https?:\/\//.test(dep.spec)) return dep.spec;
      return new URL("https://esm.sh/@types/" + dep.spec, baseUrl).href;
    }
    return new URL(dep.spec, baseUrl).href;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Topological ordering + final text assembly
// ------------------------------------------------------------------

function topoSort(root: string, graph: Map<string, GraphNode>): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (url: string) => {
    if (visited.has(url)) return;
    visited.add(url);
    const node = graph.get(url);
    if (!node) return;
    if (node.status === "ok") {
      for (const d of node.deps) visit(d);
    }
    order.push(url);
  };

  visit(root);
  return order;
}

function buildResult(entry: string, resolvedEntryUrl: string, graph: Map<string, GraphNode>, seen: Set<string>): BundleResult {
  const order = topoSort(resolvedEntryUrl, graph);
  const failedFiles: BundleFileSummary[] = [];
  const parts: string[] = [];
  let succeeded = 0;

  for (const url of order) {
    const node = graph.get(url);
    if (!node) continue;
    if (node.status === "failed") {
      failedFiles.push({ url, status: "failed", error: node.error });
      parts.push(`// ===== FAILED TO LOAD: ${url} (${node.error}) =====`);
      continue;
    }
    succeeded++;
    if (!node.content) continue;
    parts.push(`// ===== ${url} =====\n${node.content}`);
  }

  const header = [
    "/*",
    " * Auto-bundled TypeScript declarations",
    ` * Entry: ${entry}`,
    ` * Resolved entry URL: ${resolvedEntryUrl}`,
    ` * Files loaded: ${succeeded}`,
    ` * Files failed: ${failedFiles.length}`,
    ...(failedFiles.length ? [" * Failed URLs:", ...failedFiles.map((f) => ` *   - ${f.url} (${f.error})`)] : []),
    " */",
    "",
  ].join("\n");

  const text = header + "\n" + parts.join("\n\n") + "\n";

  const summary: BundleSummary = {
    entry,
    resolvedEntryUrl,
    totalDiscovered: seen.size,
    succeeded,
    failed: failedFiles.length,
    failedFiles,
  };

  return { text, summary };
}
