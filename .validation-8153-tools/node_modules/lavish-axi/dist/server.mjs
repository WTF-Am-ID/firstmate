#!/usr/bin/env node

// src/server-log.js
function formatServerLogLine(line, now = /* @__PURE__ */ new Date()) {
  return `${now.toISOString()} ${line}`;
}
var STDIO_STAMPED = /* @__PURE__ */ Symbol.for("lavish-axi.stdio-timestamped");
function serverStdioIsTimestamped() {
  return Boolean(globalThis[STDIO_STAMPED]);
}
function createTimestampedWrite(write, now = () => /* @__PURE__ */ new Date()) {
  let atLineStart = true;
  return function timestampedWrite(chunk, encoding, callback) {
    let enc = encoding;
    let cb = callback;
    if (typeof encoding === "function") {
      cb = encoding;
      enc = void 0;
    }
    const str = chunkToString(chunk, enc);
    let out = "";
    for (let i = 0; i < str.length; i += 1) {
      if (atLineStart) {
        out += formatServerLogLine("", now());
        atLineStart = false;
      }
      const ch = str[i];
      out += ch;
      if (ch === "\n") atLineStart = true;
    }
    return write(out, enc, cb);
  };
}
function installServerStdioTimestamps() {
  if (serverStdioIsTimestamped()) return;
  globalThis[STDIO_STAMPED] = true;
  process.stdout.write = createTimestampedWrite(process.stdout.write.bind(process.stdout));
  process.stderr.write = createTimestampedWrite(process.stderr.write.bind(process.stderr));
}
function chunkToString(chunk, encoding) {
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) {
    const bufferEncoding = (
      /** @type {BufferEncoding} */
      typeof encoding === "string" ? encoding : "utf8"
    );
    return chunk.toString(bufferEncoding);
  }
  return String(chunk);
}

// bin/lavish-axi-server.js
installServerStdioTimestamps();
var fatalExitScheduled = false;
function handleFatalServerError(kind, error) {
  const detail = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[lavish] ${kind}: ${detail}`);
  if (fatalExitScheduled) return;
  fatalExitScheduled = true;
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
}
process.on("uncaughtException", (error) => handleFatalServerError("uncaught exception", error));
try {
  await import("./cli.mjs");
} catch (error) {
  handleFatalServerError("server startup failed", error);
}
