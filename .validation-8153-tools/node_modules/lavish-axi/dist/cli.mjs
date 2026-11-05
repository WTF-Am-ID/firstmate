#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/cli.js
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  createReadStream,
  existsSync as existsSync3,
  mkdirSync as mkdirSync2,
  openSync,
  readFileSync as readFileSync2,
  realpathSync as realpathSync2,
  writeFileSync as writeFileSync2
} from "node:fs";
import { access as access2, readFile as readFile7, writeFile as writeFile4 } from "node:fs/promises";
import { get as httpGet2 } from "node:http";
import { isIP as isIP4 } from "node:net";
import os4 from "node:os";
import path11 from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
import { AxiError, installSessionStartHooks, RESERVED_COMMANDS, runAxiCli } from "axi-sdk-js";

// src/playbooks.js
var PLAYBOOK_ROUTER_INSTRUCTION = "MUST open each matching playbook before writing HTML. Match against the use_when trigger; one artifact often combines several playbooks.";
var PLAYBOOK_ROUTER_HELP = "One artifact often combines several playbooks (for example a plan that includes a comparison and a diagram), so MUST open each matching playbook before writing HTML.";
var PLAYBOOKS = [
  {
    id: "diagram",
    use_when: "Explain relationships, flows, state, architecture, and concepts with illustrations",
    choose: [
      "Default to hand-authored inline SVG: it gives proportion, emphasis, spatial metaphor, and annotation-ready structure that generated layouts cannot.",
      "Use Mermaid only when the user asks for an editable whiteboard: rendered Mermaid in a `.mermaid` container becomes an Excalidraw whiteboard in the Lavish browser.",
      "For large systems, draw a small overview illustration and put detail in module cards below it, instead of one dense auto-laid graph."
    ],
    structure: [
      "Assume the reader knows nothing about the system or concept: explain from zero; do not presume prior familiarity.",
      "Prefer one concept per diagram: a sequence of simple single-concept illustrations over one dense figure that combines several; layer understanding step by step.",
      "Lead with the question the diagram answers, not with the implementation detail that produced it.",
      "Keep the first visual to the core relationship, then put dense evidence or file references below it.",
      "For complex systems, separate topology from detail so the overview stays readable."
    ],
    design_rules: [
      "Size with viewBox plus width:100%; never fixed pixel dimensions, and keep every element inside the viewBox.",
      "Color through currentColor and the page's CSS custom properties so figures follow the artifact's light and dark themes.",
      "Give every meaningful node, edge, and region a stable id and a <title> so reviewers can annotate precisely.",
      "Keep labels to a few words and put prose beside the figure in HTML - SVG text does not wrap, so short labels are also the overflow discipline.",
      "Keep figures self-contained: no external images, fonts, or scripts, so exports render offline.",
      "Render-verify before serving: screenshot the artifact in light, dark, and a narrow viewport - the layout audit deliberately skips SVG interiors.",
      "When the user asked for a whiteboard, initialize Mermaid theme-aware with the `lavish-axi design` snippet rather than hardcoding one theme; to show flowchart nodes as icons from the user's Excalidraw libraries, follow `whiteboard_tooling.library_icons` there."
    ],
    pitfalls: [
      "Do not cram every file or function into one figure when a layered explanation would be clearer.",
      "Do not hand-build boxes-and-arrows from div/flexbox: inline SVG owns figures, HTML owns the prose around them.",
      "Do not reach for Mermaid to save authoring effort - it surrenders position, size, and emphasis to the engine.",
      "Do not present unverified architecture claims as facts. Cite the files or commands that support them."
    ],
    lavish_notes: [
      "A Lavish diagram should invite precise annotation: make modules, edges, and captions easy to click and discuss.",
      "When a relationship is uncertain, label it as a question so the user can resolve it in the review loop."
    ]
  },
  {
    id: "table",
    use_when: "Turn dense records into scan-friendly review surfaces",
    choose: [
      "Use a table when rows share the same fields and the user needs to compare evidence quickly.",
      "Use cards when each record has a different shape or needs a long explanation.",
      "Use summaries above the table when counts, risk levels, or statuses change how the table should be read."
    ],
    structure: [
      "Start with a short summary of what the rows prove or require.",
      "Group columns by the decision they support: identity, evidence, status, action.",
      "Keep raw details available, but make the primary status visible without reading every cell."
    ],
    design_rules: [
      "Use semantic table markup when the data is tabular.",
      "Protect long paths, code symbols, URLs, and prose from overflowing on narrow screens.",
      "Use restrained color for status and severity so the table remains readable when printed or skimmed."
    ],
    pitfalls: [
      "Do not paste a terminal table into HTML and call it done.",
      "Do not hide the important conclusion below a large undifferentiated grid.",
      "Do not use color as the only status signal."
    ],
    lavish_notes: [
      "A Lavish table should make individual rows easy annotation targets.",
      "If a row implies a follow-up change, include an action control that queues a specific prompt.",
      "When one action covers multiple rows and completeness matters, also follow the input playbook's tracked batch pattern so the reviewer submits one explicit ID set for item-by-item accounting."
    ]
  },
  {
    id: "comparison",
    use_when: "Show options, tradeoffs, and current vs target behavior",
    choose: [
      "Use before and after when the same system is changing over time.",
      "Use option cards when the user needs to choose between mutually exclusive directions.",
      "Use a scorecard only when the criteria are explicit and comparable."
    ],
    structure: [
      "Name the decision at the top of the artifact.",
      "Show the concrete behavior or artifact shape for each side, not just abstract pros and cons.",
      "End with a recommendation only when the evidence actually supports one."
    ],
    design_rules: [
      "Keep corresponding details aligned so differences are visible without hunting.",
      "Use visual hierarchy to separate primary tradeoffs from secondary notes.",
      "Make the cost of each option as visible as the benefit."
    ],
    pitfalls: [
      "Do not make every option look equally recommended if one is clearly preferred.",
      "Do not compare vague summaries when concrete examples are available.",
      "Do not bury assumptions that would change the recommendation."
    ],
    lavish_notes: [
      "A Lavish comparison should let the user annotate the exact option or tradeoff they want changed.",
      "If the goal is selection, provide controls that queue the chosen option with rationale."
    ]
  },
  {
    id: "plan",
    use_when: "Explain a product or technical plan before implementation",
    choose: [
      "Use this when the user needs to inspect a feature approach before implementation begins.",
      "Use it when the user explicitly asked for a PRD, technical design, implementation plan or proposal.",
      "Use a lighter comparison or diagram playbook when the plan is only a single small design choice."
    ],
    structure: [
      "Start with the goal, the current state, and desired behavior.",
      "Then describe a proposed approach, focusing on high level decisions.",
      "At the end, list any risks you see, and open questions you have, and follow the 'comparison' playbook to provide options for the user to choose from."
    ],
    design_rules: [
      "Verify each claim against the codebase before presenting it as fact.",
      "When discussing frontend experiences, prefer visually mocking the experience under a consistent design system as the real product over describing it with text.",
      "The plan needs to be self-contained enough that another developer can read it and fully implement the proposal."
    ],
    pitfalls: [
      "Do not leave resolved open questions in the artifact. Update existing content to reflect the decision and remove the open question.",
      "Do not only focus on ambiguous decisions and omit the actual proposal.",
      "Do not omit failure modes, migration concerns, or backwards compatibility questions."
    ],
    lavish_notes: ["A Lavish plan should make a plan and its uncertainties easy to annotate before code exists."]
  },
  {
    id: "code",
    use_when: "Render source code, code files, patches, PR diffs, and before/after code inside Lavish artifacts",
    choose: [
      "Use this whenever an artifact shows source code: a snippet, full file, patch, PR diff, local change set, or before/after code.",
      "Use File for one code file, FileDiff for old/new versions or parsed patch metadata, and CodeView only when several files or diffs need coordinated navigation.",
      "Choose split layout for careful side-by-side review when width allows; choose unified layout when space is tight, changes are mostly additive, or mobile readability matters."
    ],
    structure: [
      "Place the path, language, and reason to inspect the code immediately before each rendered file or diff.",
      "Keep evidence close to each claim with file paths, line references, or annotations next to the relevant code.",
      "For multi-file changes, group files by user-facing area or task instead of dumping a raw patch in repository order."
    ],
    design_rules: [
      `Rendering MUST use @pierre/diffs, not hand-rolled <pre> blocks or another diff library. This verified no-build standalone HTML snippet renders one file and one split diff from esm.sh:
\`\`\`html
<div id="file"></div>
<div id="diff"></div>
<script type="module">
  import { File, FileDiff } from "https://esm.sh/@pierre/diffs@1.2.10?bundle";

  const theme = { light: "github-light", dark: "github-dark" };
  const options = { theme, themeType: "dark", overflow: "wrap" };
  const oldFile = {
    name: "src/greeting.ts",
    contents: "export function greet(name: string) {\\n  return \\"Hello \\" + name;\\n}\\n\\nconsole.log(greet(\\"Lavish\\"));\\n",
  };
  const newFile = {
    name: "src/greeting.ts",
    contents: "export function greet(name: string) {\\n  return \\"Hello, \\" + name + \\"!\\";\\n}\\n\\nconsole.log(greet(\\"Lavish\\"));\\n",
  };

  new File(options).render({
    containerWrapper: document.querySelector("#file"),
    file: newFile,
  });

  new FileDiff({ ...options, diffStyle: "split" }).render({
    containerWrapper: document.querySelector("#diff"),
    oldFile,
    newFile,
  });

</script>
\`\`\``,
      "Pick a Shiki theme pair that matches the artifact's DaisyUI or Tailwind direction and light or dark mode; replace the GitHub pair above when the page is not GitHub-like.",
      'Use FileDiff diffStyle: "split" for side-by-side review and diffStyle: "unified" for stacked reading; keep overflow: "wrap" unless horizontal alignment is essential.',
      "Use @pierre/diffs line annotations, selections, and headers when calling out specific lines so notes stay attached to code."
    ],
    pitfalls: [
      "Do not render code as static screenshots, plain <pre> blocks, or markdown pasted into HTML.",
      "Do not choose an arbitrary default Shiki theme that clashes with the page palette or dark mode.",
      "Do not show huge unrelated files when a focused render range, parsed patch file, or grouped summary would be clearer.",
      "Do not separate a claim from the code lines that prove it."
    ],
    lavish_notes: [
      "A Lavish code artifact should make each file, hunk, and relevant line easy to annotate precisely.",
      "When a user action should trigger a fix, queue prompts that name the file path, line range, and desired change.",
      "If the artifact combines code with a plan, table, or comparison, read those playbooks too and keep @pierre/diffs responsible for the code surface."
    ]
  },
  {
    id: "input",
    use_when: "Must be used when the agent needs to collect user input on decisions, choices, preferences, triage, scope, or other structured feedback from within the artifact",
    choose: [
      "Use this when the user needs to select, tune, triage, annotate, or edit a structured choice.",
      "Use controls for decisions the user can make faster visually than by writing a prompt.",
      "Use an opt-in tracked batch when the agent must preserve completeness across a multi-item decision, such as findings to fixes, constraints to implementation, or recommendations to follow-up work.",
      "Use plain annotations when the artifact only needs open-ended feedback."
    ],
    structure: [
      "Make each decision surface visible: what is being chosen, what the options mean, and what happens next.",
      "For a tracked batch, give every candidate item a short, stable, visible ID and let the reviewer select or disposition items with editable native controls.",
      "Keep reversible selection state local in the artifact until the user explicitly submits that question.",
      "Pair each question with a Submit or Queue answer control that sends exactly one prompt for the final answer.",
      "Show selected state separately from queued state so the user trusts what will be sent back."
    ],
    design_rules: [
      `Set data-lavish-annotate="off" on <html> for decision, choice, and form-shaped pages; leave annotation on (the default, or "on") when reviewing a frontend or layout. Unknown values default to on. The toolbar can override the page default and keeps the reviewer's choice across artifact reloads.`,
      "Native controls - radios, checkboxes, text inputs, selects, textareas, buttons, options, labels, disclosure summaries, and contenteditable regions - and custom widgets with an interactive ARIA role (button, checkbox, combobox, menuitem, option, radio, switch, tab, treeitem, and the menuitem variants) are interactive automatically: clicks toggle, focus, and type instead of annotating, so they do not need data-lavish-action. An <a href> stays annotatable when it carries one of these roles or sits inside such a widget. Build choice and option UIs from these whenever you can.",
      "For reversible choices, do not call window.lavish.queuePrompt() from radio change handlers or option click handlers. Those handlers should only update local selected state.",
      "Use a per-question form submit or explicit Queue answer button to read the current values and call window.lavish.queuePrompt() exactly once for the final answer.",
      "Put data-lavish-action only on custom (non-native) elements that should act like a feedback control - typically a styled div or span you made clickable - so Lavish does not annotate it and shows a pointer cursor instead.",
      "Use data-lavish-question on a question wrapper or pass queueKey when multiple pre-send updates should replace the prior unsent answer for the same question.",
      "Pass options such as tag, text, selector, target, data, queueKey, or element when they help the agent understand exactly what the user chose.",
      "For a tracked batch, queue the final selected set once in a concise, bounded data.items array; include each item's stable ID, concise label, and requested disposition, and explicitly tell the agent to account for every submitted ID before reporting completion.",
      "Call window.lavish.sendQueuedPrompts() only when the control should immediately send committed feedback instead of waiting for the user to press Send to Agent.",
      "Make queued prompts specific enough that the agent can act without asking a follow-up question.",
      "Keep native browser controls accessible and readable on mobile."
    ],
    pitfalls: [
      "Do not queue one prompt per radio change, checkbox toggle, dropdown change, or choice-button click when the user can still change their mind.",
      "Do not create controls whose queued prompt is unclear or too vague to execute.",
      "Do not hide the difference between selected locally and queued for the agent.",
      "Do not require interaction for content the user only needs to read."
    ],
    lavish_notes: [
      "Lavish is strongest when the artifact becomes a focused review surface and not just a static page.",
      `A native single-choice question should submit the final value: \`<form data-lavish-question="plan" onsubmit="event.preventDefault(); const choice = new FormData(event.currentTarget).get('plan'); if (choice) window.lavish.queuePrompt('Use the ' + choice + ' plan', { tag: 'choice', text: 'Plan: ' + choice, element: event.currentTarget, data: { question: 'plan', answer: choice } });"><label><input type="radio" name="plan" value="Starter"> Starter</label><label><input type="radio" name="plan" value="Pro"> Pro</label><button type="submit">Queue this answer</button></form>\`.`,
      `A tracked batch should submit the final selected set once: <form data-lavish-question="tracked-review" onsubmit="event.preventDefault(); const selected = [...event.currentTarget.querySelectorAll('input[name=items]:checked')].map((input) => ({ id: input.value, label: input.dataset.label, disposition: input.dataset.disposition })); if (selected.length) window.lavish.queuePrompt('Act on every selected item and return an item-by-item receipt. Account for every submitted ID before reporting completion.', { tag: 'tracked-batch', text: 'Apply ' + selected.length + ' selected review items', element: event.currentTarget, data: { items: selected } });"><label><input type="checkbox" name="items" value="R-03" data-label="Preserve rollback behavior" data-disposition="must-address"> R-03 \u2014 Preserve rollback behavior</label><label><input type="checkbox" name="items" value="R-08" data-label="Reuse the existing error surface" data-disposition="must-address"> R-08 \u2014 Reuse the existing error surface</label><button type="submit">Queue selected items</button></form>`,
      `For a decision artifact a human may open by double-clicking the HTML, optionally include this standalone answer-copy control: it copies every question's answers as text the human pastes back into the chat for the agent to read. It works without Lavish and remains absent unless you write it into the artifact:
\`\`\`html
<div>
  <button type="button" onclick="(async (btn) => {
    const copyRun = btn._lavishCopyRun = (btn._lavishCopyRun || 0) + 1;
    const qs = [...document.querySelectorAll('[data-lavish-question]')];
    const status = btn.parentElement.querySelector('[data-lavish-copy-all-status]');
    btn.parentElement.querySelector('[data-lavish-copy-all-manual]')?.remove();
    const out = [];
    for (const q of qs) {
      const key = q.getAttribute('data-lavish-question')?.trim() || 'Question';
      const lines = [];
      for (const el of q.querySelectorAll('input, select, textarea')) {
        if (el.matches(':disabled')) continue;
        if (el.closest('[data-lavish-question]') !== q) continue;
        const isChoice = el.matches('input[type=checkbox], input[type=radio]');
        if (isChoice && !el.checked) continue;
        if (el.matches('input[type=button], input[type=submit], input[type=reset], input[type=image], input[type=hidden], input[type=file], input[type=range], input[type=color]')) continue;
        let vals;
        if (el instanceof HTMLSelectElement) {
          vals = [...el.selectedOptions].filter((o) => !o.disabled && !o.closest('optgroup[disabled]')).map((o) => o.value.trim()).filter(Boolean);
        } else {
          const v = isChoice && (!el.hasAttribute('value') || !el.value.trim())
            ? el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label')?.trim() || el.name || ''
            : el.value.trim();
          vals = v ? [v] : [];
        }
        const label = el.name || el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label')?.trim() || el.getAttribute('placeholder')?.trim() || el.tagName.toLowerCase();
        for (const v of vals) lines.push('  ' + label + ': ' + v.split('\\n').join('\\n    '));
      }
      if (lines.length) out.push(key + ':\\n' + lines.join('\\n'));
    }
    const text = out.join('\\n\\n');
    if (!text) {
      status.textContent = qs.length ? 'No answers to copy yet.' : 'No questions or answers to copy.';
      return;
    }
    status.textContent = '';
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      if (copyRun !== btn._lavishCopyRun) return;
      status.textContent = 'Answers copied.';
      return;
    } catch {}
    if (copyRun !== btn._lavishCopyRun) return;
    const tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.readOnly = true;
    tmp.setAttribute('aria-hidden', 'true');
    tmp.style.position = 'fixed';
    tmp.style.left = '-10000px';
    document.body.append(tmp);
    tmp.focus();
    tmp.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    tmp.remove();
    if (ok) {
      status.textContent = 'Answers copied.';
      return;
    }
    btn.parentElement.querySelector('[data-lavish-copy-all-manual]')?.remove();
    const man = document.createElement('textarea');
    man.value = text;
    man.readOnly = true;
    man.rows = Math.min(12, Math.max(3, text.split('\\n').length));
    man.setAttribute('aria-label', 'Answers to copy manually');
    man.dataset.lavishCopyAllManual = '';
    btn.insertAdjacentElement('afterend', man);
    man.focus();
    man.select();
    status.textContent = 'Clipboard unavailable. Copy the answers below manually.';
  })(this)">Copy all answers</button>
  <span data-lavish-copy-all-status role="status" aria-live="polite"></span>
</div>
\`\`\``,
      "The agent's tracked-batch completion receipt must give every submitted ID exactly one outcome: addressed with concrete evidence, deferred with a reason, or rejected with a reason. Evidence may cover several IDs. Before declaring completion, compare the submitted ID set with the receipt ID set and surface every missing ID.",
      "A custom choice UI should make option buttons update local state, then use a separate Queue answer button with data-lavish-action to queue the final selected value.",
      "Use window.lavish.queuePrompt for user intent, not internal analytics or UI-only state changes.",
      "End input paths with an obvious way for the user to send feedback back to the agent."
    ]
  },
  {
    id: "explanation",
    use_when: "Explain an existing system, PR, incident, or decision to a reader who was not there - when the goal is understanding what is and why, not choosing a direction or inspecting a plan before implementation",
    choose: [
      "Use this when the reader needs to understand something that already exists: a PR's mechanism, an incident's root cause, an architecture, a past decision.",
      "Use the plan playbook when the reader must inspect and approve an approach before implementation begins; use comparison when they must choose between options.",
      "Combine with diagram for flows or architecture, table for evidence inventories, and code when the mechanism lives in specific lines."
    ],
    structure: [
      "Lead with the one-sentence answer to the question the reader actually has, before any mechanism.",
      "Then show only what changed or how it works - a flow or before/after of the relevant slice, not a diagram of the whole system.",
      "Keep evidence (file paths, line references, links, commands) subordinate to the narrative: cited where a claim needs support, never inlined wholesale.",
      "Make each claim its own section or annotation target so the reader can push back on exactly the part they disagree with.",
      "End with what was deliberately left out and where to look next, not a summary that restates the piece."
    ],
    design_rules: [
      "Define unfamiliar terms at first use; for the reader's starting point, follow the diagram playbook's assume-nothing rule rather than restating it here.",
      "Name the question the explanation answers at the top, so the reader knows whether it is their question.",
      "Put prose beside figures - inline SVG for the flow or before/after, HTML for the reasoning - per the diagram playbook.",
      "Link evidence rather than pasting logs or diffs; inlined evidence buries the narrative and goes stale.",
      "Distinguish verified claims (cited to files, commands, or links) from inference; label uncertain reasoning as a question."
    ],
    pitfalls: [
      "Do not restate the PR body, diff, or ticket file-by-file; the source documents already exist and the reader can open them.",
      "Do not bury the answer under a diagram of the entire system when the question is about one slice of it.",
      "Do not present inferred reasoning as verified fact; cite or label it."
    ],
    lavish_notes: [
      "A Lavish explanation should let the reader annotate the exact claim they doubt or want expanded.",
      "When an explanation surfaces a disagreement, queue prompts that name the claim and the evidence gap."
    ]
  },
  {
    id: "slides",
    use_when: "Create a deliberate presentation when slides are requested",
    choose: [
      "Use slides only when the user asks for a deck, presentation, talk, or paced walkthrough.",
      "Use a scroll page when the user needs reference material, detailed review, or dense evidence.",
      "Use one idea per slide when the artifact has a narrative arc."
    ],
    structure: [
      "Plan the story before writing the slide markup.",
      "Open with the point, build context, show evidence, and close with the decision or next action.",
      "Vary slide composition so the deck does not feel like repeated cards."
    ],
    design_rules: [
      "Keep slide text sparse and let visuals carry the explanation.",
      "Use large type, strong alignment, and deliberate whitespace rather than dense paragraphs.",
      "Make navigation and screen-size assumptions explicit in the artifact."
    ],
    pitfalls: [
      "Do not turn every explainer into slides by default.",
      "Do not paste a scroll-page outline into fixed-size frames without rewriting the narrative.",
      "Do not make consecutive slides with the same spatial composition unless repetition is the point."
    ],
    lavish_notes: [
      "A Lavish slide deck can still collect feedback, but each prompt should refer to a slide or decision.",
      "Use slides for persuasion or presentation, not for dense code review."
    ]
  }
];
function listPlaybooks() {
  return PLAYBOOKS.map(({ id, use_when }) => ({ id, use_when }));
}
function findPlaybook(id) {
  return PLAYBOOKS.find((playbook) => playbook.id === id) || null;
}
function playbookIds() {
  return PLAYBOOKS.map((playbook) => playbook.id);
}

// src/design-reference.js
var TAILWIND_BROWSER_VERSION = "4.2.4";
var DAISYUI_VERSION = "5.5.19";
var MERMAID_VERSION = "11.15.0";
var DESIGN_CDN_URLS = {
  tailwind: `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@${TAILWIND_BROWSER_VERSION}/dist/index.global.js`,
  daisyui: `https://cdn.jsdelivr.net/npm/daisyui@${DAISYUI_VERSION}/daisyui.css`,
  daisyuiThemes: `https://cdn.jsdelivr.net/npm/daisyui@${DAISYUI_VERSION}/themes.css`
};
var MERMAID_CDN_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;
var DESIGN_CDN_SNIPPET = `<link rel="stylesheet" href="${DESIGN_CDN_URLS.daisyui}">
<link rel="stylesheet" href="${DESIGN_CDN_URLS.daisyuiThemes}">
<script src="${DESIGN_CDN_URLS.tailwind}"></script>`;
var MERMAID_CDN_SNIPPET = `<script type="module">
  import mermaid from "${MERMAID_CDN_URL}";

  // Render Mermaid in a theme that matches the artifact page, and re-render when
  // the viewer flips the page theme - Mermaid never restyles an already-rendered
  // SVG on its own, so a fixed theme clashes in either light or dark mode.
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // Normalize any CSS color the browser produces (rgb, oklch, hsl, named, ...)
  // to [r, g, b, a] bytes via a 1x1 canvas, so parsing never breaks on modern
  // color syntaxes like DaisyUI's oklch() values.
  const paint = document.createElement("canvas").getContext("2d");
  function toRgba(color) {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = "#000";
    paint.fillStyle = color;
    paint.fillRect(0, 0, 1, 1);
    return paint.getImageData(0, 0, 1, 1).data;
  }

  function compositeRgba(foreground, background) {
    const foregroundAlpha = foreground[3] / 255;
    const backgroundAlpha = background[3] / 255;
    const alpha = foregroundAlpha + backgroundAlpha * (1 - foregroundAlpha);
    if (alpha === 0) return [0, 0, 0, 0];
    return [
      (foreground[0] * foregroundAlpha + background[0] * backgroundAlpha * (1 - foregroundAlpha)) / alpha,
      (foreground[1] * foregroundAlpha + background[1] * backgroundAlpha * (1 - foregroundAlpha)) / alpha,
      (foreground[2] * foregroundAlpha + background[2] * backgroundAlpha * (1 - foregroundAlpha)) / alpha,
      alpha * 255,
    ];
  }

  function pageIsDark() {
    // Trust the actually-rendered page background so this works with any theming
    // mechanism: prefers-color-scheme, a data-theme attribute, or plain CSS.
    const root = document.documentElement;
    const rootBackground = toRgba(getComputedStyle(root).backgroundColor);
    const bodyBackground = document.body ? toRgba(getComputedStyle(document.body).backgroundColor) : [0, 0, 0, 0];
    const [r, g, b, a] = compositeRgba(bodyBackground, rootBackground);
    if (a > 0) {
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
    }
    const colorScheme = getComputedStyle(root).colorScheme;
    if (colorScheme.includes("dark") && !colorScheme.includes("light")) return true;
    if (colorScheme.includes("light") && !colorScheme.includes("dark")) return false;
    return darkQuery.matches;
  }

  const diagrams = [...document.querySelectorAll(".mermaid")].map((el) => ({ el, src: el.innerHTML }));
  let applied;
  let rendering = false;
  let queued = false;
  function queueRender() {
    queued = true;
    if (rendering) return;
    void render();
  }
  async function render() {
    rendering = true;
    try {
      while (queued) {
        queued = false;
        const theme = pageIsDark() ? "dark" : "default";
        if (theme === applied) continue;
        mermaid.initialize({ startOnLoad: false, theme, securityLevel: "strict" });
        for (const { el, src } of diagrams) {
          el.removeAttribute("data-processed");
          el.innerHTML = src;
        }
        try {
          await mermaid.run({ nodes: diagrams.map((d) => d.el) });
        } catch (error) {
          console.error("Mermaid diagram render failed:", error);
          return;
        }
        applied = theme;
      }
    } finally {
      rendering = false;
      if (queued) queueRender();
    }
  }

  // First render once stylesheets are applied (no wrong-theme flash), then keep
  // the diagrams in sync with page-theme toggles and OS light/dark changes.
  if (document.readyState === "complete") queueRender();
  else window.addEventListener("load", queueRender, { once: true });
  const themeObserver = new MutationObserver(queueRender);
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    themeObserver.observe(el, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
  }
  document.addEventListener("change", queueRender, true);
  document.addEventListener(
    "transitionend",
    ({ propertyName }) => {
      if (propertyName === "background-color") queueRender();
    },
    true,
  );
  darkQuery.addEventListener("change", queueRender);
</script>`;
var LAYOUT_SAFETY_CSS_SNIPPET = `<style>
  *, *::before, *::after { box-sizing: border-box; }
  :where(.grid, .flex, .layout-grid, .layout-flex) > *,
  :where([style*="display: grid"], [style*="display:grid"], [style*="display: flex"], [style*="display:flex"]) > * {
    min-width: 0;
  }
  :where(p, h1, h2, h3, h4, h5, h6, li, dd, blockquote, figcaption, td, th, .badge, .label) {
    overflow-wrap: anywhere;
  }
  :where(img, svg, video, canvas, iframe) {
    max-width: 100%;
    height: auto;
  }
</style>`;
var REVISION_REGISTRY_SNIPPET = `<script type="application/json" data-lavish-revisions>
[{ "id": "r1", "label": "Round 1", "timestamp": "2026-01-01T10:00:00Z", "summary": "Tightened the pricing copy" }]
</script>
<section data-lavish-revision="r1">...the block you changed...</section>`;
var DESIGN_PRIORITY_RULE = "Decide the design direction in this strict priority order, and only move to the next step when the current one truly yields nothing: (1) if the user asked for a specific look or named design system, use that; (2) otherwise you must first inspect the project the artifact is about - the subject or product whose content or UI it represents, which may differ from your current working directory - and match that project's design system: Tailwind or theme config, shared CSS variables or design tokens, component library, brand assets, or existing styled pages. If the artifact previews, proposes, or mocks a specific app's UI, render it in that app's own design system so it faithfully shows the product, even when you are running in a different repo; (3) only when both steps come up empty, use the Lavish-recommended Tailwind CSS browser runtime v4 + DaisyUI v5, available via CDN, and prefer that CDN snippet over hand-writing styles unless explicitly instructed otherwise by the user.";
var DESIGN_SYSTEM_HINT = "Lavish does not auto-inject any design system - artifacts stay portable so they render identically when opened directly without lavish-axi running. Before writing any HTML: " + DESIGN_PRIORITY_RULE + " Run `lavish-axi design` for a content-to-playbook router, a copy-pasteable CDN snippet, the whiteboard (Mermaid) opt-in snippet, and the DaisyUI component reference. When you deliver the artifact, state which of the three design sources you used and why.";
var DAISYUI_THEMES = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk"
];
function createDesignOutput() {
  return {
    playbook_router: {
      instruction: PLAYBOOK_ROUTER_INSTRUCTION,
      playbooks: listPlaybooks()
    },
    design: {
      summary: "Use this Lavish CDN fallback only if (1) the user gave no design direction and (2) you already inspected the project the artifact is about and found no design system or style conventions to match. If you have not checked the subject project yet, check first. Lavish does not auto-inject any design system; artifacts stay portable HTML. Paint an explicit page background and readable text. " + DESIGN_PRIORITY_RULE + " Lavish adds only its SDK script to your file and never wraps a fragment, so start it with `<!doctype html>`: without one the page renders in quirks mode, where `<table>` text stops inheriting the color a wrapper theme sets. Paste the CDN snippet below into your `<head>`.",
      cdn_snippet: DESIGN_CDN_SNIPPET,
      cdn_urls: DESIGN_CDN_URLS,
      versions: { tailwind: TAILWIND_BROWSER_VERSION, daisyui: DAISYUI_VERSION },
      latest_docs: "https://daisyui.com/components/",
      docs_note: "Use this command for common syntax. Read the latest DaisyUI docs for full details when using advanced or unfamiliar components.",
      layout_safety_snippet: LAYOUT_SAFETY_CSS_SNIPPET,
      layout_safety_note: "Optional copy-paste CSS for artifacts with dense nested grid/flex layouts, badges, wide monospace or pixel fonts, or local media. Paste it into the artifact yourself when useful. Lavish never auto-injects it, so direct-open portability stays intact.",
      other_design_systems: "If the user asks for a different design system (Bootstrap, custom CSS, plain HTML, etc.), use that instead - Lavish does not require DaisyUI."
    },
    whiteboard_tooling: {
      use_when: "Opt-in only: author a diagram as Mermaid in a `.mermaid` container solely when the user asks for an editable whiteboard - Lavish turns it into an Excalidraw whiteboard whose edits come back as feedback. Every other figure is hand-authored inline SVG per the diagram playbook.",
      mermaid_cdn_snippet: MERMAID_CDN_SNIPPET,
      cdn_urls: { mermaid: MERMAID_CDN_URL },
      versions: { mermaid: MERMAID_VERSION },
      library_icons: {
        use_when: "Optional, in a whiteboard flowchart such as an architecture or system diagram: show a node as an icon from an Excalidraw library the user installed. Run `lavish-axi libraries` to see what is installed and `lavish-axi libraries --search <text>` for exact item refs; skip this when nothing is installed.",
        syntax: "%% lavish-icon <node-id> <library-id>/<item name>",
        example: "flowchart LR\n  %% lavish-icon api aws-architecture-icons/AWS Lambda\n  user([Customer]) --> api[Orders API]",
        notes: "One comment line per icon node, in flowcharts only. Keep the node's label naming the component: the icon sits above it. Mermaid ignores `%%` lines, so exported, shared, and directly opened copies show the plain node, and so does the whiteboard when the library or item is missing. A library item the reviewer drops on the whiteboard arrives in the edit summary as `Added library item <ref>`; add it to the Mermaid source as a node with its own `%% lavish-icon` line."
      }
    },
    revision_marking: {
      use_when: "Opt-in only: on a regeneration that answers the reviewer's feedback, declare what you changed so the browser can show a Revisions legend. Skip it on a first draft, and skip it when you rewrote the whole artifact - a legend that marks everything says nothing.",
      registry_snippet: REVISION_REGISTRY_SNIPPET,
      how: 'Append one entry per round to the `data-lavish-revisions` JSON (oldest first, stable `id`s), and put `data-lavish-revision="<id>"` on each block you actually edited or added. Lavish reads them and never restyles the page, so the saved file looks the same opened directly.'
    },
    tab_meta: "Opt-in: a long-lived artifact can show live state on the background browser tab with `window.lavish?.setDocumentMeta?.({ title, icon })`; see the README.",
    theme_usage: [
      'Default to `<html data-theme="luxury">` - it matches the Lavish look. Pick a different theme from the list below only when the user asked for one or the content clearly calls for it.',
      'Set a nested section theme with `<section data-theme="night">`.',
      "Prefer semantic colors such as `bg-base-100`, `bg-base-200`, `text-base-content`, `bg-primary`, `text-primary-content`, `alert-warning`, and `btn-primary` so themes remain readable.",
      "Avoid hardcoded Tailwind color names for text and surfaces unless the user asked for exact colors.",
      "Use Tailwind responsive prefixes such as `sm:`, `md:`, `lg:`, and `xl:` for layout changes.",
      'Never `@apply` DaisyUI classes (such as `text-base-content/40`, `bg-base-200`, or `btn`) inside `<style type="text/tailwindcss">` - the Tailwind browser runtime does not know them, and one unknown utility aborts the entire compile, leaving the page with no Tailwind styles at all. Put DaisyUI classes directly on elements, or write plain CSS with theme variables such as `var(--color-base-200)`.'
    ],
    themes: DAISYUI_THEMES,
    components: {
      actions: ["button", "dropdown", "fab", "modal", "swap", "theme-controller"],
      data_display: [
        "accordion",
        "avatar",
        "badge",
        "card",
        "carousel",
        "chat",
        "collapse",
        "countdown",
        "diff",
        "hover-3d",
        "hover-gallery",
        "kbd",
        "list",
        "stat",
        "status",
        "table",
        "text-rotate",
        "timeline"
      ],
      navigation: ["breadcrumbs", "dock", "link", "menu", "navbar", "pagination", "steps", "tabs"],
      feedback: ["alert", "loading", "progress", "radial-progress", "skeleton", "toast", "tooltip"],
      data_input: [
        "calendar",
        "checkbox",
        "fieldset",
        "file-input",
        "filter",
        "label",
        "radio",
        "range",
        "rating",
        "select",
        "input",
        "textarea",
        "toggle",
        "validator"
      ],
      layout: ["divider", "drawer", "footer", "hero", "indicator", "join", "mask", "stack"],
      mockup: ["mockup-browser", "mockup-code", "mockup-phone", "mockup-window"]
    },
    modifiers: {
      colors: ["neutral", "primary", "secondary", "accent", "info", "success", "warning", "error"],
      sizes: ["xs", "sm", "md", "lg", "xl"],
      styles: ["outline", "dash", "soft", "ghost", "link"],
      placements: ["start", "center", "end", "top", "middle", "bottom", "left", "right"]
    },
    reference: {
      button: {
        classes: [
          "btn",
          "btn-neutral",
          "btn-primary",
          "btn-secondary",
          "btn-accent",
          "btn-info",
          "btn-success",
          "btn-warning",
          "btn-error",
          "btn-outline",
          "btn-dash",
          "btn-soft",
          "btn-ghost",
          "btn-link",
          "btn-xs",
          "btn-sm",
          "btn-md",
          "btn-lg",
          "btn-xl",
          "btn-wide",
          "btn-block",
          "btn-square",
          "btn-circle",
          "btn-active",
          "btn-disabled"
        ],
        syntax: '<button class="btn btn-primary">Save</button>',
        notes: [
          'Use `btn` on `<button>`, `<a role="button">`, `<input>`, or `<label>`.',
          'For class-only disabled state, add `btn-disabled tabindex="-1" role="button" aria-disabled="true"`.',
          "Use `btn-square` or `btn-circle` for icon-only buttons and provide an accessible label."
        ]
      },
      card: {
        classes: [
          "card",
          "card-body",
          "card-title",
          "card-actions",
          "card-border",
          "card-dash",
          "card-side",
          "image-full",
          "card-xs",
          "card-sm",
          "card-md",
          "card-lg",
          "card-xl"
        ],
        syntax: '<div class="card card-border bg-base-100"><div class="card-body"><h2 class="card-title">Title</h2><p>Text</p><div class="card-actions justify-end"><button class="btn btn-primary">Act</button></div></div></div>',
        notes: [
          "Use `lg:card-side` for responsive horizontal cards.",
          "Use `card-border` for a bordered card without custom CSS."
        ]
      },
      alert: {
        classes: [
          "alert",
          "alert-outline",
          "alert-dash",
          "alert-soft",
          "alert-info",
          "alert-success",
          "alert-warning",
          "alert-error",
          "alert-vertical",
          "alert-horizontal"
        ],
        syntax: '<div role="alert" class="alert alert-warning"><span>Check this before shipping.</span></div>',
        notes: [
          'Use `role="alert"` for important status messages.',
          "Use `sm:alert-horizontal` to switch from stacked to horizontal layouts."
        ]
      },
      badge: {
        classes: [
          "badge",
          "badge-outline",
          "badge-dash",
          "badge-soft",
          "badge-ghost",
          "badge-neutral",
          "badge-primary",
          "badge-secondary",
          "badge-accent",
          "badge-info",
          "badge-success",
          "badge-warning",
          "badge-error",
          "badge-xs",
          "badge-sm",
          "badge-md",
          "badge-lg",
          "badge-xl"
        ],
        syntax: '<span class="badge badge-soft badge-warning">Risk</span>',
        notes: ["Use badges for short statuses and labels, not long prose."]
      },
      table: {
        classes: [
          "table",
          "table-zebra",
          "table-pin-rows",
          "table-pin-cols",
          "table-xs",
          "table-sm",
          "table-md",
          "table-lg",
          "table-xl"
        ],
        syntax: '<div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"><table class="table table-zebra"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table></div>',
        notes: ["Wrap tables in `overflow-x-auto` for mobile.", "Use semantic table markup for tabular data."]
      },
      modal: {
        classes: [
          "modal",
          "modal-box",
          "modal-action",
          "modal-backdrop",
          "modal-toggle",
          "modal-open",
          "modal-top",
          "modal-middle",
          "modal-bottom",
          "modal-start",
          "modal-end"
        ],
        syntax: '<button class="btn" onclick="details_modal.showModal()">Open</button><dialog id="details_modal" class="modal"><div class="modal-box"><h3 class="text-lg font-bold">Title</h3><p class="py-4">Content</p><div class="modal-action"><form method="dialog"><button class="btn">Close</button></form></div></div></dialog>',
        notes: [
          "Prefer native `<dialog>` with `showModal()` for accessibility.",
          "Use unique IDs for every modal.",
          "Use `modal-bottom sm:modal-middle` for mobile-friendly responsive placement."
        ]
      },
      collapse: {
        classes: [
          "collapse",
          "collapse-title",
          "collapse-content",
          "collapse-arrow",
          "collapse-plus",
          "collapse-open",
          "collapse-close"
        ],
        syntax: '<div tabindex="0" class="collapse collapse-arrow bg-base-200"><div class="collapse-title">Title</div><div class="collapse-content"><p>Hidden detail</p></div></div>',
        notes: [
          "Use a checkbox child for independently toggleable collapses.",
          "Use radio inputs with the same name for accordion behavior where only one item stays open."
        ]
      },
      drawer: {
        classes: [
          "drawer",
          "drawer-toggle",
          "drawer-content",
          "drawer-side",
          "drawer-overlay",
          "drawer-end",
          "drawer-open"
        ],
        syntax: '<div class="drawer lg:drawer-open"><input id="nav" type="checkbox" class="drawer-toggle"><div class="drawer-content"><label for="nav" class="btn drawer-button lg:hidden">Menu</label></div><div class="drawer-side"><label for="nav" aria-label="close sidebar" class="drawer-overlay"></label><ul class="menu bg-base-200 min-h-full w-80 p-4"><li><button>Item</button></li></ul></div></div>',
        notes: [
          "Every page region belongs inside `drawer-content` or `drawer-side`.",
          "The hidden `drawer-toggle` input needs a unique ID.",
          "Use labels with `for` to open and close the drawer."
        ]
      },
      navbar: {
        classes: ["navbar", "navbar-start", "navbar-center", "navbar-end"],
        syntax: '<div class="navbar bg-base-200"><div class="navbar-start"><a class="btn btn-ghost text-xl">Title</a></div><div class="navbar-end"><button class="btn btn-primary">Action</button></div></div>',
        notes: ["Use the start, center, and end parts to align content horizontally."]
      },
      menu: {
        classes: [
          "menu",
          "menu-title",
          "menu-dropdown",
          "menu-dropdown-toggle",
          "menu-disabled",
          "menu-active",
          "menu-focus",
          "menu-dropdown-show",
          "menu-xs",
          "menu-sm",
          "menu-md",
          "menu-lg",
          "menu-xl",
          "menu-horizontal",
          "menu-vertical"
        ],
        syntax: '<ul class="menu bg-base-200 rounded-box"><li><button class="menu-active">Item</button></li><li><a>Link</a></li></ul>',
        notes: ["Use `lg:menu-horizontal` for responsive menus.", "Use `<details>` for collapsible submenus."]
      },
      tabs: {
        classes: [
          "tabs",
          "tab",
          "tab-active",
          "tab-disabled",
          "tabs-box",
          "tabs-border",
          "tabs-lift",
          "tab-content",
          "tab-xs",
          "tab-sm",
          "tab-md",
          "tab-lg",
          "tab-xl"
        ],
        syntax: '<div role="tablist" class="tabs tabs-border"><button role="tab" class="tab tab-active">One</button><button role="tab" class="tab">Two</button></div>',
        notes: ["Use role attributes when tabs are interactive controls."]
      },
      steps: {
        classes: [
          "steps",
          "step",
          "step-primary",
          "step-secondary",
          "step-accent",
          "step-info",
          "step-success",
          "step-warning",
          "step-error",
          "steps-vertical",
          "steps-horizontal"
        ],
        syntax: '<ul class="steps"><li class="step step-primary">Plan</li><li class="step">Build</li><li class="step">Review</li></ul>',
        notes: ["Use `steps-vertical lg:steps-horizontal` for responsive process views."]
      },
      stat: {
        classes: ["stats", "stat", "stat-title", "stat-value", "stat-desc", "stat-figure", "stat-actions"],
        syntax: '<div class="stats stats-vertical lg:stats-horizontal shadow"><div class="stat"><div class="stat-title">Issues</div><div class="stat-value">3</div><div class="stat-desc">Need review</div></div></div>',
        notes: ["Use stats for key numbers above dense detail."]
      },
      progress: {
        classes: [
          "progress",
          "progress-neutral",
          "progress-primary",
          "progress-secondary",
          "progress-accent",
          "progress-info",
          "progress-success",
          "progress-warning",
          "progress-error",
          "radial-progress"
        ],
        syntax: '<progress class="progress progress-primary" value="70" max="100"></progress><div class="radial-progress" style="--value:70;" role="progressbar" aria-valuenow="70">70%</div>',
        notes: [
          "Progress elements need `value` and `max`.",
          'Radial progress uses `--value`, `role="progressbar"`, and `aria-valuenow`.'
        ]
      },
      forms: {
        classes: [
          "input",
          "textarea",
          "select",
          "checkbox",
          "radio",
          "toggle",
          "range",
          "rating",
          "fieldset",
          "fieldset-legend",
          "label",
          "floating-label",
          "validator"
        ],
        syntax: '<fieldset class="fieldset"><legend class="fieldset-legend">Choice</legend><select class="select"><option>One</option></select><p class="label">Helper text</p></fieldset>',
        notes: [
          "Use unique `name` values for each radio, rating, or filter group.",
          "Use matching color and size modifiers such as `input-primary input-lg` when needed."
        ]
      },
      tooltip_toast: {
        classes: [
          "tooltip",
          "tooltip-open",
          "tooltip-top",
          "tooltip-bottom",
          "tooltip-left",
          "tooltip-right",
          "toast",
          "toast-start",
          "toast-center",
          "toast-end",
          "toast-top",
          "toast-middle",
          "toast-bottom"
        ],
        syntax: '<div class="tooltip" data-tip="More context"><button class="btn">Hover</button></div><div class="toast toast-end"><div class="alert alert-success">Saved</div></div>',
        notes: ["Tooltips use `data-tip` for text.", "Toast is a positioned wrapper; put `alert` content inside."]
      },
      mockup: {
        classes: [
          "mockup-browser",
          "mockup-browser-toolbar",
          "mockup-code",
          "mockup-phone",
          "mockup-phone-camera",
          "mockup-phone-display",
          "mockup-window"
        ],
        syntax: '<div class="mockup-code"><pre data-prefix="$"><code>npm test</code></pre></div>',
        notes: [
          "Use `pre data-prefix` for short command prompts, symbols, or line numbers.",
          "Keep `data-prefix` short because DaisyUI renders it in the code gutter; use prose outside the mockup for long labels.",
          "Use mockups for product or terminal examples, not regular prose."
        ]
      },
      utility_rules: {
        classes: [
          "hero",
          "hero-content",
          "divider",
          "join",
          "join-item",
          "indicator",
          "indicator-item",
          "avatar",
          "chat",
          "chat-start",
          "chat-end",
          "loading",
          "skeleton",
          "diff",
          "timeline"
        ],
        syntax: '<main class="mx-auto max-w-6xl p-6 lg:p-10"><section class="hero bg-base-200 rounded-box"><div class="hero-content text-center"><h1 class="text-5xl font-bold">Review surface</h1></div></section></main>',
        notes: [
          "Compose DaisyUI components with Tailwind utilities for spacing, grid, flex, width, and typography.",
          "Prefer component classes over custom CSS for common UI."
        ]
      }
    }
  };
}

// src/export-bundle.js
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
var EXT_MIME = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".vtt": "text/vtt",
  ".json": "application/json",
  ".txt": "text/plain",
  ".pdf": "application/pdf"
};
var DEFAULT_MAX_DEPTH = 8;
var DEFAULT_MAX_ASSET_BYTES = 10 * 1024 * 1024;
var DEFAULT_MAX_BUNDLE_BYTES = 25 * 1024 * 1024;
var REDACTED_FILE_REF = "about:blank";
var HTML_REF_OPTIONS = { decodeHtmlEntities: true };
var HTML_ENTITY_MAP = {
  amp: "&",
  apos: "'",
  colon: ":",
  gt: ">",
  lt: "<",
  nbsp: "\xA0",
  newline: "\n",
  quot: '"',
  sol: "/",
  tab: "	"
};
var RAW_TEXT_TAGS = /* @__PURE__ */ new Set(["script", "style", "textarea", "title", "iframe", "xmp", "noembed", "noframes"]);
var PLAINTEXT_TAG = "plaintext";
var INERT_CONTENT_TAGS = /* @__PURE__ */ new Set(["template", "noscript"]);
var MEDIA_TAGS = /* @__PURE__ */ new Set(["img", "source", "video", "audio", "track"]);
var SVG_REF_TAGS = /* @__PURE__ */ new Set(["use", "image", "feimage"]);
var SVG_HTML_INTEGRATION_POINTS = /* @__PURE__ */ new Set(["foreignobject", "desc", "title"]);
var HTML_VOID_TAGS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var INERT_RESOURCE_REASON = "resources inside template or noscript content are left unchanged";
var SRCDOC_RESOURCE_REASON = "iframe srcdoc nested HTML is left unchanged";
var UNRESOLVED_LOCAL_ASSET_WARNING_KINDS = /* @__PURE__ */ new Set([
  "behavioral-stylesheet",
  "css-import-depth",
  "css-import-order",
  "fetchable-link",
  "file-url-unresolved",
  "inactive-stylesheet",
  "inline-importmap-local-ref",
  "inline-module-import",
  "load-failed",
  "module-external",
  "nested-svg-resource",
  "outside-root",
  "preload-stylesheet",
  "srcdoc-resource",
  "too-large",
  "unmapped-root-absolute",
  "unterminated-script-src",
  "unsupported-css-import",
  "unsupported-frame",
  "unsupported-script-timing",
  "unsupported-script-type",
  "unsupported-style-type",
  "unsupported-stylesheet-type"
]);
async function buildSelfContainedHtml(html, options = {}) {
  const confineDir = options.confineDir ? path.resolve(options.confineDir) : null;
  const ctx = {
    baseDir: options.baseDir || process.cwd(),
    confineDir,
    readLocalFile: options.readLocalFile || ((absPath, readOptions = {}) => guardedRead(absPath, readOptions.allowOutsideRoot ? null : confineDir, readOptions)),
    resolveAbsolute: typeof options.resolveAbsolute === "function" ? options.resolveAbsolute : () => null,
    maxAssetBytes: resolveBytes(
      options.maxAssetBytes,
      process.env.LAVISH_AXI_EXPORT_MAX_ASSET_BYTES,
      DEFAULT_MAX_ASSET_BYTES
    ),
    maxBundleBytes: resolveBytes(
      options.maxBundleBytes,
      process.env.LAVISH_AXI_EXPORT_MAX_BUNDLE_BYTES,
      DEFAULT_MAX_BUNDLE_BYTES
    ),
    maxDepth: Number.isFinite(options.maxDepth) ? options.maxDepth : DEFAULT_MAX_DEPTH,
    inlinedBytes: 0,
    warnings: (
      /** @type {Array<{ kind: string, ref: string, reason?: string }>} */
      []
    )
  };
  const out = await transform(html, ctx);
  return { html: out, warnings: ctx.warnings };
}
function exportFileName(file) {
  const base = path.basename(String(file || "artifact.html"));
  const stem = base.replace(/\.html?$/i, "");
  return `${stem || "artifact"}.export.html`;
}
function splitExportWarnings(warnings) {
  const unresolved = [];
  const notices = [];
  for (const warning of Array.isArray(warnings) ? warnings : []) {
    if (UNRESOLVED_LOCAL_ASSET_WARNING_KINDS.has(warning?.kind)) unresolved.push(warning);
    else notices.push(warning);
  }
  return { unresolved, notices };
}
function exportWarningSummaries(warnings) {
  return (Array.isArray(warnings) ? warnings : []).map((warning) => ({
    kind: warning.kind,
    ref: warning.ref,
    ...warning.reason ? { reason: warning.reason } : {}
  }));
}
async function transform(html, ctx) {
  const documentBase = resolveDocumentRefBase(html, ctx);
  return transformMarkup(html, documentBase, ctx);
}
async function transformMarkup(markup, baseDir, ctx) {
  let result = "";
  let index = 0;
  const openStack = [];
  while (index < markup.length) {
    const lt = markup.indexOf("<", index);
    if (lt === -1) {
      result += markup.slice(index);
      break;
    }
    result += markup.slice(index, lt);
    const token = readHtmlToken(markup, lt);
    if (!token) {
      result += markup[lt];
      index = lt + 1;
      continue;
    }
    if (token.type === "close") {
      popHtmlParent(openStack, token.tag.toLowerCase());
      result += scrubRawTextFileUrls(token.raw, ctx);
      index = token.end;
      continue;
    }
    if (token.type !== "start") {
      result += token.type === "comment" ? scrubHtmlComment(token.raw, ctx) : scrubRawTextFileUrls(token.raw, ctx);
      index = token.end;
      continue;
    }
    const tagName = token.tag.toLowerCase();
    const elementNamespace = elementNamespaceForTag(tagName, openStack);
    const effectiveSelfClosing = isEffectiveSelfClosingTag(tagName, token.selfClosing, openStack, elementNamespace);
    if (elementNamespace === "html" && tagName === PLAINTEXT_TAG && !effectiveSelfClosing) {
      result += await transformPlaintextElement(token, markup.slice(token.end), baseDir, ctx);
      index = markup.length;
      continue;
    }
    if (elementNamespace === "html" && INERT_CONTENT_TAGS.has(tagName) && !effectiveSelfClosing) {
      const close = findContentClose(markup, token.end, tagName);
      if (close) {
        const body = markup.slice(token.end, close.start);
        result += await transformInertContentElement(token, body, close.raw, baseDir, ctx);
        index = close.end;
        continue;
      }
      warnUnterminatedRawText(tagName, ctx);
      result += await transformInertContentElement(token, markup.slice(token.end), "", baseDir, ctx);
      index = markup.length;
      continue;
    }
    if (isRawTextElementForNamespace(tagName, elementNamespace) && !effectiveSelfClosing) {
      const close = findContentClose(markup, token.end, tagName);
      if (close) {
        const body = markup.slice(token.end, close.start);
        result += await transformRawTextElement(token, body, close.raw, baseDir, ctx, {
          inSvgNamespace: elementNamespace === "svg"
        });
        index = close.end;
        continue;
      }
      warnUnterminatedRawText(tagName, ctx);
      result += await transformUnterminatedRawTextElement(token, markup.slice(token.end), baseDir, ctx, {
        inSvgNamespace: elementNamespace === "svg"
      });
      index = markup.length;
      continue;
    }
    result += await transformStartTag(
      token.tag,
      token.attrs,
      token.selfClosing,
      baseDir,
      ctx,
      currentHtmlParent(openStack),
      elementNamespace
    );
    if (!effectiveSelfClosing && !HTML_VOID_TAGS.has(tagName)) pushHtmlParent(openStack, tagName, elementNamespace);
    index = token.end;
  }
  return result;
}
function isEffectiveSelfClosingTag(tagName, selfClosing, openStack = [], elementNamespace = null) {
  if (!selfClosing) return false;
  if (HTML_VOID_TAGS.has(tagName)) return true;
  const namespace = elementNamespace || elementNamespaceForTag(tagName, openStack);
  return namespace === "svg" || namespace === "math";
}
function currentHtmlParent(openStack) {
  return openStack.length ? stackTag(openStack[openStack.length - 1]) : "";
}
function popHtmlParent(openStack, tagName) {
  const index = findLastStackIndex(openStack, tagName);
  if (index !== -1) openStack.length = index;
}
function pushHtmlParent(openStack, tagName, elementNamespace) {
  openStack.push({ tag: tagName, namespace: childNamespaceForTag(tagName, elementNamespace) });
}
function findLastStackIndex(openStack, tagName) {
  for (let index = openStack.length - 1; index >= 0; index -= 1) {
    if (stackTag(openStack[index]) === tagName) return index;
  }
  return -1;
}
function stackTag(entry) {
  return typeof entry === "string" ? entry : entry.tag;
}
function currentNamespace(openStack) {
  return openStack.length ? openStack[openStack.length - 1].namespace || "html" : "html";
}
function elementNamespaceForTag(tagName, openStack) {
  const namespace = currentNamespace(openStack);
  if (namespace !== "html") return namespace;
  if (tagName === "svg") return "svg";
  if (tagName === "math") return "math";
  return "html";
}
function childNamespaceForTag(tagName, elementNamespace) {
  if (elementNamespace === "html") {
    if (tagName === "svg") return "svg";
    if (tagName === "math") return "math";
    return "html";
  }
  if (elementNamespace === "svg" && SVG_HTML_INTEGRATION_POINTS.has(tagName)) return "html";
  return elementNamespace;
}
function isRawTextElementForNamespace(tagName, elementNamespace) {
  if (elementNamespace === "html") return RAW_TEXT_TAGS.has(tagName);
  return elementNamespace === "svg" && (tagName === "script" || tagName === "style");
}
async function transformInertContentElement(token, body, closeTag, baseDir, ctx) {
  const tagName = token.tag.toLowerCase();
  const startTag = formatStartTag(token.tag, scrubInertAttrs(tagName, token.attrs, baseDir, ctx), false);
  return `${startTag}${transformInertMarkup(body, baseDir, ctx)}${scrubRawTextFileUrls(closeTag, ctx)}`;
}
async function transformPlaintextElement(token, body, baseDir, ctx) {
  const startTag = await transformStartTag(token.tag, token.attrs, false, baseDir, ctx);
  return `${startTag}${scrubRawTextBodyWithoutInlining(token.tag.toLowerCase(), token.attrs, body, baseDir, ctx)}`;
}
function transformInertMarkup(markup, baseDir, ctx, options = {}) {
  const warnLocalRefs = options.warnLocalRefs !== false;
  let result = "";
  let index = 0;
  const openStack = [];
  while (index < markup.length) {
    const lt = markup.indexOf("<", index);
    if (lt === -1) {
      result += scrubRawTextFileUrls(markup.slice(index), ctx);
      break;
    }
    result += scrubRawTextFileUrls(markup.slice(index, lt), ctx);
    const token = readHtmlToken(markup, lt);
    if (!token) {
      result += markup[lt];
      index = lt + 1;
      continue;
    }
    if (token.type !== "start") {
      if (token.type === "close") popHtmlParent(openStack, token.tag.toLowerCase());
      result += token.type === "comment" ? scrubHtmlComment(token.raw, ctx) : scrubRawTextFileUrls(token.raw, ctx);
      index = token.end;
      continue;
    }
    const tagName = token.tag.toLowerCase();
    const elementNamespace = elementNamespaceForTag(tagName, openStack);
    const effectiveSelfClosing = isEffectiveSelfClosingTag(tagName, token.selfClosing, openStack, elementNamespace);
    if (elementNamespace === "html" && tagName === PLAINTEXT_TAG && !effectiveSelfClosing) {
      if (warnLocalRefs) warnInertStartTagRefs(tagName, token.attrs, baseDir, ctx, options, elementNamespace);
      result += transformInertRawTextElement(token, markup.slice(token.end), "", baseDir, ctx, {
        ...options,
        warnLocalRefs: false
      });
      index = markup.length;
      continue;
    }
    if ((elementNamespace === "html" && INERT_CONTENT_TAGS.has(tagName) || isRawTextElementForNamespace(tagName, elementNamespace)) && !effectiveSelfClosing) {
      const close = findContentClose(markup, token.end, tagName);
      const bodyEnd = close ? close.start : markup.length;
      const body = markup.slice(token.end, bodyEnd);
      if (!close) warnUnterminatedRawText(tagName, ctx);
      if (INERT_CONTENT_TAGS.has(tagName)) {
        const attrs = scrubInertAttrs(tagName, token.attrs, baseDir, ctx, options);
        result += `${formatStartTag(token.tag, attrs, false)}${transformInertMarkup(body, baseDir, ctx, options)}${close ? scrubRawTextFileUrls(close.raw, ctx) : ""}`;
      } else {
        result += transformInertRawTextElement(token, body, close ? close.raw : "", baseDir, ctx, {
          ...options,
          inSvgNamespace: elementNamespace === "svg"
        });
      }
      index = close ? close.end : markup.length;
      continue;
    }
    if (warnLocalRefs) warnInertStartTagRefs(tagName, token.attrs, baseDir, ctx, options, elementNamespace);
    result += formatStartTag(
      token.tag,
      scrubInertAttrs(tagName, token.attrs, baseDir, ctx, { ...options, warnLocalRefs: false }),
      token.selfClosing
    );
    if (!effectiveSelfClosing && !HTML_VOID_TAGS.has(tagName)) pushHtmlParent(openStack, tagName, elementNamespace);
    index = token.end;
  }
  return result;
}
async function transformRawTextElement(token, body, closeTag, baseDir, ctx, options = {}) {
  const tagName = token.tag.toLowerCase();
  const safeCloseTag = scrubRawTextFileUrls(closeTag, ctx);
  const namespace = options.inSvgNamespace ? "svg" : "html";
  if (tagName === "style") {
    const startTag = await transformStartTag(token.tag, token.attrs, false, baseDir, ctx, "", namespace);
    if (!isCssStyleElementType(token.attrs)) {
      return `${startTag}${scrubUnsupportedStyleElementBody(body, baseDir, ctx)}${safeCloseTag}`;
    }
    return `${startTag}${escapeRawText(await inlineCss(body, baseDir, ctx, 0, baseDir), "style")}${safeCloseTag}`;
  }
  if (tagName === "script" && options.inSvgNamespace)
    return inlineSvgScript(token.tag, token.attrs, body, safeCloseTag, baseDir, ctx);
  if (tagName === "script") return inlineScript(token.tag, token.attrs, body, safeCloseTag, baseDir, ctx);
  return `${await transformStartTag(token.tag, token.attrs, false, baseDir, ctx, "", namespace)}${scrubRawTextBodyWithoutInlining(
    tagName,
    token.attrs,
    body,
    baseDir,
    ctx
  )}${safeCloseTag}`;
}
async function transformUnterminatedRawTextElement(token, body, baseDir, ctx, options = {}) {
  const tagName = token.tag.toLowerCase();
  if (tagName === "style") {
    const startTag2 = await transformStartTag(
      token.tag,
      token.attrs,
      false,
      baseDir,
      ctx,
      "",
      options.inSvgNamespace ? "svg" : "html"
    );
    if (!isCssStyleElementType(token.attrs))
      return `${startTag2}${scrubUnsupportedStyleElementBody(body, baseDir, ctx)}`;
    return `${startTag2}${escapeRawText(await inlineCss(body, baseDir, ctx, 0, baseDir), "style")}`;
  }
  if (tagName === "script") {
    if (options.inSvgNamespace) return inlineSvgScript(token.tag, token.attrs, body, "", baseDir, ctx);
    const src = getAttr(token.attrs, "src");
    if (!src) return inlineScript(token.tag, token.attrs, body, "", baseDir, ctx);
    warnUnterminatedScriptSrc(src, baseDir, ctx, HTML_REF_OPTIONS);
    const startTag2 = await transformStartTag(
      token.tag,
      replaceUnresolvedAttrRef(token.attrs, "src", src),
      false,
      baseDir,
      ctx,
      "",
      options.inSvgNamespace ? "svg" : "html"
    );
    return `${startTag2}${escapeRawText(scrubRawTextFileUrls(body, ctx), "script")}`;
  }
  const startTag = await transformStartTag(
    token.tag,
    token.attrs,
    false,
    baseDir,
    ctx,
    "",
    options.inSvgNamespace ? "svg" : "html"
  );
  return `${startTag}${scrubRawTextBodyWithoutInlining(token.tag.toLowerCase(), token.attrs, body, baseDir, ctx)}`;
}
function transformInertRawTextElement(token, body, closeTag, baseDir, ctx, options = {}) {
  if (options.warnLocalRefs !== false)
    warnInertStartTagRefs(
      token.tag.toLowerCase(),
      token.attrs,
      baseDir,
      ctx,
      options,
      options.inSvgNamespace ? "svg" : "html"
    );
  const startTag = formatStartTag(
    token.tag,
    scrubInertAttrs(token.tag.toLowerCase(), token.attrs, baseDir, ctx, { ...options, warnLocalRefs: false }),
    false
  );
  return `${startTag}${scrubRawTextBodyWithoutInlining(
    token.tag.toLowerCase(),
    token.attrs,
    body,
    baseDir,
    ctx,
    options
  )}${scrubRawTextFileUrls(closeTag, ctx)}`;
}
function scrubRawTextBodyWithoutInlining(tagName, attrs, body, baseDir, ctx, options = {}) {
  if (tagName === "style") {
    const warningKind = options.warnLocalRefs === false ? null : options.localWarningKind || "inert-resource";
    return scrubCssRefsWithoutInlining(body, baseDir, ctx, {
      localWarningKind: warningKind,
      localWarningReason: options.localWarningReason || INERT_RESOURCE_REASON
    });
  }
  if (tagName === "script") {
    let scrubbed = body;
    const warnActiveScriptDependencies = options.localWarningKind === "srcdoc-resource";
    if (isModuleScript(attrs)) {
      scrubbed = redactInlineModuleFileRefs(scrubbed, ctx, { warnUnresolved: warnActiveScriptDependencies });
      if (warnActiveScriptDependencies) warnInlineModuleImports(scrubbed, baseDir, ctx);
      scrubbed = scrubClassicScriptFileUrlComments(scrubbed, ctx);
    }
    if (isImportMapScript(attrs)) {
      scrubbed = redactInlineImportMapFileRefs(scrubbed, ctx, { warnUnresolved: warnActiveScriptDependencies });
      if (warnActiveScriptDependencies) warnInlineImportMapLocalRefs(scrubbed, baseDir, ctx);
    }
    if (warnActiveScriptDependencies && isClassicScript(attrs)) warnClassicScriptDynamicImports(scrubbed, baseDir, ctx);
    return escapeRawText(scrubRawTextFileUrls(scrubbed, ctx), "script");
  }
  return scrubRawTextFileUrls(body, ctx);
}
async function transformStartTag(tag, attrs, selfClosing, baseDir, ctx, parentTag = "", namespace = "html") {
  const tagName = tag.toLowerCase();
  const elementNamespace = namespace || "html";
  const inHtmlNamespace = elementNamespace === "html";
  const inSvgNamespace = elementNamespace === "svg";
  let next = attrs;
  if (inHtmlNamespace && MEDIA_TAGS.has(tagName)) {
    next = await inlineMediaAttrs(tagName, next, baseDir, ctx, parentTag);
  }
  if (SVG_REF_TAGS.has(tagName) && inSvgNamespace) {
    next = await inlineAttr(next, "href", baseDir, ctx);
    next = await inlineAttr(next, "xlink:href", baseDir, ctx);
  }
  if (tagName === "script" && inSvgNamespace) {
    next = await inlineSvgScriptAttrs(next, baseDir, ctx);
  }
  if (inHtmlNamespace) next = await inlineRenderResourceAttrs(tagName, next, baseDir, ctx);
  next = await inlineStyleAttr(next, baseDir, ctx);
  const isCspMetaTag = inHtmlNamespace && tagName === "meta" && isCspMeta(next);
  if (isCspMetaTag) warnCspMeta(next, ctx);
  if (inHtmlNamespace && tagName === "base") warnBaseHref(next, ctx);
  if (inHtmlNamespace && tagName === "link") {
    const linked = await inlineLink(next, baseDir, ctx);
    if (linked.replacement) return linked.replacement;
    next = linked.attrs;
  }
  next = scrubFileUrlAttrs(next, ctx, { skipNames: fileUrlScrubSkipNames(tagName, isCspMetaTag) });
  return formatStartTag(tag, next, selfClosing);
}
function fileUrlScrubSkipNames(tagName, isCspMetaTag) {
  const names = [];
  if (isCspMetaTag) names.push("content");
  if (tagName === "iframe") names.push("srcdoc");
  return names;
}
function warnBaseHref(attrs, ctx) {
  const attr = findHtmlAttr(attrs, "href");
  if (!attr || !attr.hasValue) return;
  const descriptor = resolveRef(attr.value, localRefBase(ctx.baseDir), ctx, HTML_REF_OPTIONS);
  if (descriptor.kind === "unmapped-root") warnUnresolvedDescriptor(descriptor, attr.value, ctx);
}
function scrubFileUrlAttrs(attrs, ctx, options = {}) {
  let result = attrs;
  const parsed = parseHtmlAttrs(attrs);
  const skipNames = new Set((options.skipNames || []).map((name) => String(name).toLowerCase()));
  for (let index = parsed.length - 1; index >= 0; index -= 1) {
    const attr = parsed[index];
    if (skipNames.has(attr.name.toLowerCase())) continue;
    if (!attr.hasValue || !containsFileUrl(attr.value)) continue;
    ctx.warnings.push({ kind: "file-url-redacted", ref: attr.value });
    result = replaceAttrTokenValue(result, attr, REDACTED_FILE_REF, { preserveEntities: true });
  }
  return result;
}
function scrubInertAttrs(tagName, attrs, baseDir, ctx, options = {}) {
  let result = scrubInertStyleAttr(attrs, baseDir, ctx, options);
  if (tagName === "iframe") result = scrubFrameSrcdoc(result, baseDir, ctx, options);
  const isCspMetaTag = tagName === "meta" && isCspMeta(result);
  if (isCspMetaTag) warnCspMeta(result, ctx);
  result = scrubFileUrlAttrs(result, ctx, { skipNames: fileUrlScrubSkipNames(tagName, isCspMetaTag) });
  return result;
}
function scrubInertStyleAttr(attrs, baseDir, ctx, options = {}) {
  const attr = findHtmlAttr(attrs, "style");
  if (!attr || !attr.hasValue) return attrs;
  const decoded = decodeHtmlCharacterReferences(attr.value);
  const scrubbed = scrubCssRefsWithoutInlining(decoded, baseDir, ctx, {
    localWarningKind: options.warnLocalRefs === false ? null : options.localWarningKind || "inert-resource",
    localWarningReason: options.localWarningReason || INERT_RESOURCE_REASON
  });
  return scrubbed === decoded ? attrs : replaceAttrTokenValue(attrs, attr, scrubbed);
}
async function inlineRenderResourceAttrs(tagName, attrs, baseDir, ctx) {
  if (tagName === "object") return inlineRenderAttr(attrs, "data", baseDir, ctx, { nestedHtml: true });
  if (tagName === "embed") return inlineRenderAttr(attrs, "src", baseDir, ctx, { nestedHtml: true });
  if (tagName === "input") {
    if (getDecisionAttr(attrs, "type").trim().toLowerCase() !== "image") return attrs;
    return inlineRenderAttr(attrs, "src", baseDir, ctx);
  }
  if (tagName === "iframe")
    return scrubFrameSrcdoc(warnFrameSrc(attrs, baseDir, ctx), baseDir, ctx, {
      localWarningKind: "srcdoc-resource",
      localWarningReason: SRCDOC_RESOURCE_REASON
    });
  return attrs;
}
async function inlineRenderAttr(attrs, name, baseDir, ctx, options = {}) {
  const value = getAttr(attrs, name);
  if (!value) return attrs;
  if (options.nestedHtml && (isHtmlDocumentRef(value) || isHtmlDocumentType(attrs))) {
    warnUnsupportedFrame(value, baseDir, ctx, HTML_REF_OPTIONS);
    return replaceUnresolvedAttrRef(attrs, name, value);
  }
  return inlineAttr(attrs, name, baseDir, ctx);
}
async function inlineStyleAttr(attrs, baseDir, ctx) {
  const attr = findHtmlAttr(attrs, "style");
  if (!attr || !attr.hasValue) return attrs;
  const decoded = decodeHtmlCharacterReferences(attr.value);
  const rewritten = await inlineCssUrls(decoded, baseDir, ctx, baseDir, { decodeHtmlEntities: false });
  return rewritten === decoded ? attrs : replaceAttrTokenValue(attrs, attr, rewritten);
}
async function inlineLink(attrs, baseDir, ctx) {
  const rel = getTokenListAttr(attrs, "rel");
  const href = getAttr(attrs, "href");
  if (!href) return { attrs };
  if (rel.includes("stylesheet")) {
    if (!isCssStylesheetType(attrs)) {
      warnUnsupportedStylesheetType(href, baseDir, ctx, HTML_REF_OPTIONS);
      return { attrs: replaceUnresolvedAttrRef(attrs, "href", href) };
    }
    if (isInactiveStylesheet(attrs, rel)) {
      warnInactiveStylesheet(href, baseDir, ctx, HTML_REF_OPTIONS);
      return { attrs: replaceUnresolvedAttrRef(attrs, "href", href) };
    }
    if (hasStylesheetBehaviorAttrs(attrs)) {
      warnBehavioralStylesheet(href, baseDir, ctx, HTML_REF_OPTIONS);
      return { attrs: replaceUnresolvedAttrRef(attrs, "href", href) };
    }
    const loaded = await loadText(href, baseDir, ctx, HTML_REF_OPTIONS);
    if (!loaded) return { attrs: replaceUnresolvedAttrRef(attrs, "href", href) };
    const css = await inlineCss(loaded.text, loaded.baseDir, ctx, 0, baseDir);
    const media = scrubGeneratedHtmlAttrValue(getDecisionAttr(attrs, "media"), ctx);
    return {
      replacement: `<style${media ? ` media="${escapeAttr(media)}"` : ""}>${escapeRawText(css, "style")}</style>`
    };
  }
  if (rel.includes("preload") && getDecisionAttr(attrs, "as").trim().toLowerCase() === "style") {
    warnPreloadStylesheet(href, baseDir, ctx, HTML_REF_OPTIONS);
    return { attrs: replaceUnresolvedAttrRef(attrs, "href", href) };
  }
  if (rel.some((value) => ["icon", "shortcut", "apple-touch-icon", "mask-icon"].includes(value))) {
    const dataUri = await loadDataUri(href, baseDir, ctx, HTML_REF_OPTIONS);
    if (!dataUri) return { attrs: replaceUnresolvedAttrRef(attrs, "href", href) };
    return { attrs: replaceAttrValue(attrs, "href", dataUri) };
  }
  if (isFetchableLinkRel(rel)) {
    warnFetchableLink(href, baseDir, ctx, HTML_REF_OPTIONS);
    return { attrs: replaceUnresolvedAttrRef(attrs, "href", href) };
  }
  return { attrs };
}
function isFetchableLinkRel(rel) {
  return rel.some((value) => ["preload", "modulepreload", "prefetch", "manifest"].includes(value));
}
function isInactiveStylesheet(attrs, rel) {
  return hasAttr(attrs, "disabled") || rel.includes("alternate");
}
function hasStylesheetBehaviorAttrs(attrs) {
  return parseHtmlAttrs(attrs).some((attr) => attr.name.toLowerCase().startsWith("on"));
}
function scrubGeneratedHtmlAttrValue(value, ctx) {
  const text = String(value || "");
  if (!text || !containsFileUrl(text)) return text;
  ctx.warnings.push({ kind: "file-url-redacted", ref: text });
  return REDACTED_FILE_REF;
}
function isCssStylesheetType(attrs) {
  const type = getDecisionAttr(attrs, "type").trim().toLowerCase();
  if (!type) return true;
  return type.split(";")[0].trim() === "text/css";
}
function isCssStyleElementType(attrs) {
  return isCssStylesheetType(attrs);
}
function warnCspMeta(attrs, ctx) {
  if (!isCspMeta(attrs)) return;
  ctx.warnings.push({
    kind: "csp-meta",
    ref: getAttr(attrs, "content") || "Content-Security-Policy",
    reason: "author-set CSP meta is left unchanged and may block inlined export assets"
  });
}
function isCspMeta(attrs) {
  return getDecisionAttr(attrs, "http-equiv").trim().toLowerCase() === "content-security-policy";
}
async function inlineScript(tag, attrs, body, closeTag, baseDir, ctx) {
  const src = getAttr(attrs, "src");
  if (!src) {
    let inlineBody = body;
    if (isModuleScript(attrs)) {
      inlineBody = redactInlineModuleFileRefs(inlineBody, ctx, { warnUnresolved: true });
      warnInlineModuleImports(inlineBody, baseDir, ctx);
      inlineBody = scrubClassicScriptFileUrlComments(inlineBody, ctx);
    }
    if (isImportMapScript(attrs)) {
      inlineBody = redactInlineImportMapFileRefs(inlineBody, ctx, { warnUnresolved: true });
      warnInlineImportMapLocalRefs(inlineBody, baseDir, ctx);
    }
    if (isClassicScript(attrs)) {
      warnClassicScriptDynamicImports(inlineBody, baseDir, ctx);
      inlineBody = scrubClassicScriptFileUrlComments(inlineBody, ctx);
    }
    if (!isClassicScript(attrs) && !isModuleScript(attrs)) inlineBody = scrubRawTextFileUrls(inlineBody, ctx);
    return `${await transformStartTag(tag, attrs, false, baseDir, ctx)}${escapeRawText(inlineBody, "script")}${closeTag}`;
  }
  if (isInjectedLavishSdkSrc(src)) return "";
  if (isModuleScript(attrs)) {
    warnExternalModuleScript(src, baseDir, ctx, HTML_REF_OPTIONS);
    const startTag2 = await transformStartTag(tag, replaceUnresolvedAttrRef(attrs, "src", src), false, baseDir, ctx);
    return `${startTag2}${escapeRawText(scrubRawTextFileUrls(body, ctx), "script")}${closeTag}`;
  }
  if (!isClassicScript(attrs)) {
    warnUnsupportedScriptType(src, baseDir, ctx, HTML_REF_OPTIONS);
    const startTag2 = await transformStartTag(tag, replaceUnresolvedAttrRef(attrs, "src", src), false, baseDir, ctx);
    return `${startTag2}${escapeRawText(scrubRawTextFileUrls(body, ctx), "script")}${closeTag}`;
  }
  if (hasAttr(attrs, "defer") || hasAttr(attrs, "async")) {
    warnUnsupportedScriptTiming(src, baseDir, ctx, HTML_REF_OPTIONS);
    const startTag2 = await transformStartTag(tag, replaceUnresolvedAttrRef(attrs, "src", src), false, baseDir, ctx);
    return `${startTag2}${escapeRawText(scrubRawTextFileUrls(body, ctx), "script")}${closeTag}`;
  }
  const loaded = await loadText(src, baseDir, ctx, HTML_REF_OPTIONS);
  if (!loaded) {
    const startTag2 = await transformStartTag(tag, replaceUnresolvedAttrRef(attrs, "src", src), false, baseDir, ctx);
    return `${startTag2}${escapeRawText(scrubRawTextFileUrls(body, ctx), "script")}${closeTag}`;
  }
  const cleanedAttrs = removeAttrs(attrs, ["src", "integrity", "crossorigin"]);
  const startTag = await transformStartTag(tag, cleanedAttrs, false, baseDir, ctx);
  warnClassicScriptDynamicImports(loaded.text, loaded.baseDir, ctx);
  return `${startTag}${escapeRawText(scrubClassicScriptFileUrlComments(loaded.text, ctx), "script")}${closeTag}`;
}
async function inlineSvgScript(tag, attrs, body, closeTag, baseDir, ctx) {
  const startTag = await transformStartTag(tag, attrs, false, baseDir, ctx, "", "svg");
  const executable = isClassicScript(attrs) || isModuleScript(attrs);
  if (isClassicScript(attrs)) warnClassicScriptDynamicImports(body, baseDir, ctx);
  const scrubbed = executable ? scrubClassicScriptFileUrlComments(body, ctx) : scrubRawTextFileUrls(body, ctx);
  return `${startTag}${escapeRawText(scrubbed, "script")}${closeTag}`;
}
async function inlineSvgScriptAttrs(attrs, baseDir, ctx) {
  let next = attrs;
  next = await inlineSvgScriptAttr(next, "href", baseDir, ctx);
  next = await inlineSvgScriptAttr(next, "xlink:href", baseDir, ctx);
  return next;
}
async function inlineSvgScriptAttr(attrs, name, baseDir, ctx) {
  const value = getAttr(attrs, name);
  if (!value) return attrs;
  const descriptor = resolveRef(value, baseDir, ctx, HTML_REF_OPTIONS);
  if (descriptor.kind !== "file") {
    warnUnresolvedDescriptor(descriptor, value, ctx);
    return replaceUnresolvedAttrRef(attrs, name, value);
  }
  const buffer = await readBudgeted(descriptor, value, ctx);
  if (!buffer) return replaceUnresolvedAttrRef(attrs, name, value);
  const rawText = buffer.toString("utf8");
  if (isClassicScript(attrs)) warnClassicScriptDynamicImports(rawText, path.dirname(descriptor.path), ctx);
  const text = scrubClassicScriptFileUrlComments(rawText, ctx);
  const dataUri = `${toDataUri(Buffer.from(text, "utf8"), pickMime(descriptor.path))}${fragmentSuffix(
    normalizeRefForResolution(value, HTML_REF_OPTIONS)
  )}`;
  return replaceAttrValue(attrs, name, dataUri);
}
async function inlineMediaAttrs(tagName, attrs, baseDir, ctx, parentTag = "") {
  let next = attrs;
  if (tagName === "track" && parentTag !== "video" && parentTag !== "audio") return next;
  if (tagName !== "source" || parentTag === "video" || parentTag === "audio") {
    next = await inlineAttr(next, "src", baseDir, ctx);
  }
  if (tagName === "video") next = await inlineAttr(next, "poster", baseDir, ctx);
  if (tagName === "img" || tagName === "source" && parentTag === "picture") {
    next = await inlineSrcset(next, baseDir, ctx);
  }
  return next;
}
async function inlineAttr(attrs, name, baseDir, ctx) {
  const value = getAttr(attrs, name);
  if (!value) return attrs;
  const dataUri = await loadDataUri(value, baseDir, ctx, HTML_REF_OPTIONS);
  if (!dataUri) return replaceUnresolvedAttrRef(attrs, name, value);
  return replaceAttrValue(attrs, name, dataUri);
}
async function inlineSrcset(attrs, baseDir, ctx) {
  const value = getAttr(attrs, "srcset");
  if (!value) return attrs;
  const candidates = parseSrcsetCandidates(value);
  let result = "";
  let lastIndex = 0;
  let changed = false;
  for (const candidate of candidates) {
    result += value.slice(lastIndex, candidate.urlStart);
    const ref = value.slice(candidate.urlStart, candidate.urlEnd);
    if (isInert(decodeHtmlCharacterReferences(ref.trim()))) {
      result += ref;
    } else {
      const dataUri = await loadDataUri(ref, baseDir, ctx, HTML_REF_OPTIONS);
      if (dataUri) {
        changed = true;
        result += dataUri;
      } else if (shouldRedactUnresolvedRef(ref)) {
        changed = true;
        result += REDACTED_FILE_REF;
      } else {
        result += ref;
      }
    }
    lastIndex = candidate.urlEnd;
  }
  result += value.slice(lastIndex);
  return changed ? replaceAttrValuePreservingEntities(attrs, "srcset", result) : attrs;
}
function parseSrcsetCandidates(value) {
  const candidates = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && (isHtmlSpace(value[index]) || value[index] === ",")) index += 1;
    if (index >= value.length) break;
    const urlStart = index;
    const dataUrl = value.slice(index, index + "data:".length).toLowerCase() === "data:";
    let sawDataPayloadComma = false;
    while (index < value.length) {
      const char = value[index];
      if (isHtmlSpace(char)) break;
      if (char === ",") {
        if (!dataUrl) break;
        if (!sawDataPayloadComma) {
          sawDataPayloadComma = true;
        } else if (isSrcsetCandidateSeparator(value, index)) {
          break;
        }
      }
      index += 1;
    }
    let urlEnd = index;
    while (urlEnd > urlStart && value[urlEnd - 1] === ",") urlEnd -= 1;
    if (urlEnd > urlStart) candidates.push({ urlStart, urlEnd });
    while (index < value.length && value[index] !== ",") index += 1;
    if (index < value.length && value[index] === ",") index += 1;
  }
  return candidates;
}
function isSrcsetCandidateSeparator(value, commaIndex) {
  let cursor = commaIndex + 1;
  while (cursor < value.length && isHtmlSpace(value[cursor])) cursor += 1;
  return cursor >= value.length || cursor > commaIndex + 1;
}
function isHtmlSpace(char) {
  return /[\t\n\f\r ]/.test(char);
}
async function inlineCss(css, baseDir, ctx, depth, outputBaseDir) {
  const withImports = await inlineCssImports(css, baseDir, ctx, depth, outputBaseDir);
  return inlineCssUrls(withImports.css, baseDir, ctx, outputBaseDir);
}
async function inlineCssImports(css, baseDir, ctx, depth, outputBaseDir) {
  const prelude = collectCssPrelude(css);
  const imports = prelude.segments.filter((segment) => segment.type === "import");
  const startBytes = ctx.inlinedBytes;
  const prepared = /* @__PURE__ */ new Map();
  const classifications = /* @__PURE__ */ new Map();
  let complete = true;
  let failureIndex = -1;
  let failureCause = "";
  if (prelude.hasNamespace && imports.length > 0) {
    complete = false;
    failureIndex = 0;
    failureCause = "namespace";
  } else {
    for (let importIndex = 0; importIndex < imports.length; importIndex += 1) {
      const item = imports[importIndex];
      const classification = classifyCssImport(item.parsed, baseDir, ctx, depth);
      classifications.set(item, classification);
      if (classification.kind !== "candidate") {
        complete = false;
        failureIndex = importIndex;
        failureCause = classification.kind;
        break;
      }
      const loaded = await loadTextFromDescriptor(classification.descriptor, item.parsed.ref, ctx);
      if (!loaded) {
        complete = false;
        failureIndex = importIndex;
        failureCause = "load";
        break;
      }
      const inner = await prepareCssImportInline(loaded.text, loaded.baseDir, ctx, depth + 1, outputBaseDir);
      if (!inner.inlineable) {
        complete = false;
        failureIndex = importIndex;
        failureCause = inner.reason || "nested";
        break;
      }
      prepared.set(item, item.parsed.media ? `@media ${item.parsed.media}{${inner.css}}` : inner.css);
    }
  }
  if (!complete) ctx.inlinedBytes = startBytes;
  let result = "";
  for (const segment of prelude.segments) {
    if (segment.type !== "import") {
      result += segment.text;
      continue;
    }
    if (complete) {
      result += prepared.has(segment) ? prepared.get(segment) : segment.rule;
      continue;
    }
    warnExternalizedCssImport(
      segment,
      baseDir,
      ctx,
      depth,
      imports.indexOf(segment),
      failureIndex,
      failureCause,
      classifications.get(segment)
    );
    result += rebaseCssImportRule(segment.rule, segment.parsed, baseDir, outputBaseDir);
  }
  const body = rewriteLateCssImports(css.slice(prelude.bodyStart), baseDir, ctx, outputBaseDir);
  return { css: result + body.css, complete: complete && body.complete, hasNamespace: prelude.hasNamespace };
}
async function prepareCssImportInline(css, baseDir, ctx, depth, outputBaseDir) {
  const withImports = await inlineCssImports(css, baseDir, ctx, depth, outputBaseDir);
  if (!withImports.complete)
    return { inlineable: false, css: "", reason: withImports.hasNamespace ? "namespace" : "nested" };
  if (withImports.hasNamespace) return { inlineable: false, css: "", reason: "namespace" };
  return { inlineable: true, css: await inlineCssUrls(withImports.css, baseDir, ctx, outputBaseDir) };
}
function collectCssPrelude(css) {
  const segments = [];
  let index = 0;
  while (index < css.length) {
    const start = index;
    const commentEnd = css.startsWith("/*", index) ? findCssCommentEnd(css, index) : -1;
    if (commentEnd !== -1) {
      segments.push({ type: "text", text: css.slice(index, commentEnd) });
      index = commentEnd;
      continue;
    }
    if (/\s/.test(css[index])) {
      index += 1;
      while (index < css.length && /\s/.test(css[index])) index += 1;
      segments.push({ type: "text", text: css.slice(start, index) });
      continue;
    }
    if (startsCssKeyword(css, index, "@import")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) break;
      const rule = css.slice(index, ruleEnd + 1);
      const parsed = parseCssImportRule(rule);
      if (!parsed) break;
      segments.push({ type: "import", rule, parsed });
      index = ruleEnd + 1;
      continue;
    }
    if (startsCssKeyword(css, index, "@charset")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) break;
      segments.push({ type: "text", text: css.slice(index, ruleEnd + 1) });
      index = ruleEnd + 1;
      continue;
    }
    if (startsCssKeyword(css, index, "@layer")) {
      const statementEnd = findCssPreludeStatementEnd(css, index);
      if (statementEnd !== -1 && css[statementEnd] === ";") {
        segments.push({ type: "text", text: css.slice(index, statementEnd + 1) });
        index = statementEnd + 1;
        continue;
      }
    }
    if (startsCssKeyword(css, index, "@namespace")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) break;
      segments.push({ type: "namespace", text: css.slice(index, ruleEnd + 1) });
      index = ruleEnd + 1;
      continue;
    }
    break;
  }
  return { segments, bodyStart: index, hasNamespace: segments.some((segment) => segment.type === "namespace") };
}
function classifyCssImport(parsed, baseDir, ctx, depth) {
  if (depth >= ctx.maxDepth) return { kind: "depth" };
  if (parsed.media && !isPlainCssMediaQueryList(parsed.media)) return { kind: "unsupported" };
  const descriptor = resolveRef(parsed.ref, baseDir, ctx, { cssSyntax: true });
  return descriptor.kind === "file" ? { kind: "candidate", descriptor } : { kind: descriptor.kind, descriptor };
}
function warnExternalizedCssImport(item, baseDir, ctx, depth, importIndex, failureIndex, failureCause, classification) {
  classification = classification || classifyCssImport(item.parsed, baseDir, ctx, depth);
  if (classification.kind === "candidate") {
    if (importIndex === failureIndex && failureCause === "load") return;
    warnCssImportOrder(item.parsed.ref, classification.descriptor, ctx);
    return;
  }
  if (classification.kind === "depth") {
    warnCssImportDepth(item.parsed.ref, baseDir, ctx);
  } else if (classification.kind === "unsupported") {
    warnUnsupportedCssImport(item.parsed.ref, baseDir, ctx, item.parsed.media);
  } else {
    warnUnresolvedDescriptor(classification.descriptor || { kind: classification.kind }, item.parsed.ref, ctx);
  }
}
function rewriteLateCssImports(css, baseDir, ctx, outputBaseDir) {
  let result = "";
  let index = 0;
  let complete = true;
  while (index < css.length) {
    const commentEnd = css.startsWith("/*", index) ? findCssCommentEnd(css, index) : -1;
    if (commentEnd !== -1) {
      result += scrubCssComment(css.slice(index, commentEnd), ctx);
      index = commentEnd;
      continue;
    }
    if (css[index] === '"' || css[index] === "'") {
      const stringEnd = findCssStringEnd(css, index);
      result += css.slice(index, stringEnd);
      index = stringEnd;
      continue;
    }
    if (startsCssKeyword(css, index, "@import")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) {
        result += css.slice(index);
        break;
      }
      const rule = css.slice(index, ruleEnd + 1);
      const parsed = parseCssImportRule(rule);
      if (parsed) {
        complete = false;
        warnLateCssImport(parsed.ref, baseDir, ctx);
        result += rebaseCssImportRule(rule, parsed, baseDir, outputBaseDir);
      } else {
        result += rule;
      }
      index = ruleEnd + 1;
      continue;
    }
    result += css[index];
    index += 1;
  }
  return { css: result, complete };
}
async function inlineCssUrls(css, baseDir, ctx, outputBaseDir, options = {}) {
  let result = "";
  let index = 0;
  while (index < css.length) {
    const commentEnd = css.startsWith("/*", index) ? findCssCommentEnd(css, index) : -1;
    if (commentEnd !== -1) {
      result += scrubCssComment(css.slice(index, commentEnd), ctx);
      index = commentEnd;
      continue;
    }
    if (css[index] === '"' || css[index] === "'") {
      const stringEnd = findCssStringEnd(css, index);
      result += css.slice(index, stringEnd);
      index = stringEnd;
      continue;
    }
    if (startsCssKeyword(css, index, "@import")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) {
        result += css.slice(index);
        break;
      }
      const rule = css.slice(index, ruleEnd + 1);
      const parsed = parseCssImportRule(rule);
      result += scrubCopiedCssImportRule(rule, parsed, baseDir, ctx, options);
      index = ruleEnd + 1;
      continue;
    }
    if (startsCssKeyword(css, index, "@namespace")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) {
        result += css.slice(index);
        break;
      }
      result += rebaseCssNamespaceRule(css.slice(index, ruleEnd + 1), baseDir, outputBaseDir, ctx);
      index = ruleEnd + 1;
      continue;
    }
    const conditionalBlock = parseCssConditionalAtRuleBlock(css, index);
    if (conditionalBlock) {
      result += scrubCssNonFetchPrelude(css.slice(index, conditionalBlock.bodyStart), baseDir, ctx, options);
      result += await inlineCssUrls(
        css.slice(conditionalBlock.bodyStart, conditionalBlock.bodyEnd),
        baseDir,
        ctx,
        outputBaseDir,
        options
      );
      result += css.slice(conditionalBlock.bodyEnd, conditionalBlock.end);
      index = conditionalBlock.end;
      continue;
    }
    const imageSet = parseCssImageSetFunction(css, index);
    if (imageSet) {
      result += css.slice(index, imageSet.argsStart);
      result += await inlineCssImageSetArgs(
        css.slice(imageSet.argsStart, imageSet.argsEnd),
        baseDir,
        ctx,
        outputBaseDir,
        options
      );
      result += css.slice(imageSet.argsEnd, imageSet.end);
      index = imageSet.end;
      continue;
    }
    const token = parseCssUrlToken(css, index);
    if (!token) {
      result += css[index];
      index += 1;
      continue;
    }
    result += await rewriteCssUrlToken(token, baseDir, ctx, outputBaseDir, options);
    index = token.end;
  }
  return result;
}
function scrubCopiedCssImportRule(rule, parsed, baseDir, ctx, options = {}) {
  if (!parsed) return rule;
  const scrubbed = scrubCssRefWithoutInlining(parsed.ref, baseDir, ctx, {
    ...options,
    localWarningKind: null,
    seen: /* @__PURE__ */ new Set()
  });
  return scrubbed.replacement ? `${rule.slice(0, parsed.refStart)}${scrubbed.replacement}${rule.slice(parsed.refEnd)}` : rule;
}
async function rewriteCssUrlToken(token, baseDir, ctx, outputBaseDir, options = {}) {
  const trimmed = token.ref.trim();
  const refForResolution = options.decodeHtmlEntities ? decodeHtmlCharacterReferences(trimmed) : trimmed;
  if (isInert(refForResolution)) return token.raw;
  const dataUri = await loadDataUri(trimmed, baseDir, ctx, { ...options, cssSyntax: true });
  return dataUri ? `url(${token.quote}${dataUri}${token.quote})` : rebaseCssUrlToken(token, baseDir, outputBaseDir);
}
async function inlineCssImageSetArgs(args, baseDir, ctx, outputBaseDir, options = {}) {
  let result = "";
  let index = 0;
  let depth = 0;
  while (index < args.length) {
    const commentEnd = args.startsWith("/*", index) ? findCssCommentEnd(args, index) : -1;
    if (commentEnd !== -1) {
      result += scrubCssComment(args.slice(index, commentEnd), ctx);
      index = commentEnd;
      continue;
    }
    if (depth === 0) {
      const token = parseCssUrlToken(args, index);
      if (token) {
        result += await rewriteCssUrlToken(token, baseDir, ctx, outputBaseDir, options);
        index = token.end;
        continue;
      }
    }
    if (args[index] === '"' || args[index] === "'") {
      const token = parseCssString(args, index);
      if (depth === 0) {
        const rewritten = await rewriteCssStringUrlOperand(token.value, baseDir, ctx, outputBaseDir, options);
        result += rewritten.changed ? quoteCssString(rewritten.value, args[index]) : args.slice(index, token.end);
      } else {
        result += args.slice(index, token.end);
      }
      index = token.end;
      continue;
    }
    if (args[index] === "(") depth += 1;
    if (args[index] === ")") depth = Math.max(0, depth - 1);
    result += args[index];
    index += 1;
  }
  return result;
}
function scrubCssRefsWithoutInlining(css, baseDir, ctx, options = {}) {
  return scrubCssRefsWithoutInliningInner(css, baseDir, ctx, { ...options, seen: /* @__PURE__ */ new Set() });
}
function scrubCssRefsWithoutInliningInner(css, baseDir, ctx, options) {
  let result = "";
  let index = 0;
  while (index < css.length) {
    const commentEnd = css.startsWith("/*", index) ? findCssCommentEnd(css, index) : -1;
    if (commentEnd !== -1) {
      result += scrubCssComment(css.slice(index, commentEnd), ctx);
      index = commentEnd;
      continue;
    }
    if (startsCssKeyword(css, index, "@import")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) {
        result += css.slice(index);
        break;
      }
      const rule = css.slice(index, ruleEnd + 1);
      const parsed = parseCssImportRule(rule);
      const scrubbed = parsed ? scrubCssRefWithoutInlining(parsed.ref, baseDir, ctx, options) : null;
      result += scrubbed && scrubbed.replacement ? `${rule.slice(0, parsed.refStart)}${scrubbed.replacement}${rule.slice(parsed.refEnd)}` : rule;
      index = ruleEnd + 1;
      continue;
    }
    if (startsCssKeyword(css, index, "@namespace")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) {
        result += css.slice(index);
        break;
      }
      result += rebaseCssNamespaceRule(css.slice(index, ruleEnd + 1), baseDir, baseDir, ctx);
      index = ruleEnd + 1;
      continue;
    }
    const conditionalBlock = parseCssConditionalAtRuleBlock(css, index);
    if (conditionalBlock) {
      result += scrubCssNonFetchPrelude(css.slice(index, conditionalBlock.bodyStart), baseDir, ctx, options);
      result += scrubCssRefsWithoutInliningInner(
        css.slice(conditionalBlock.bodyStart, conditionalBlock.bodyEnd),
        baseDir,
        ctx,
        options
      );
      result += css.slice(conditionalBlock.bodyEnd, conditionalBlock.end);
      index = conditionalBlock.end;
      continue;
    }
    const imageSet = parseCssImageSetFunction(css, index);
    if (imageSet) {
      result += css.slice(index, imageSet.argsStart);
      result += scrubCssImageSetArgsWithoutInlining(
        css.slice(imageSet.argsStart, imageSet.argsEnd),
        baseDir,
        ctx,
        options
      );
      result += css.slice(imageSet.argsEnd, imageSet.end);
      index = imageSet.end;
      continue;
    }
    if (css[index] === '"' || css[index] === "'") {
      const stringEnd = findCssStringEnd(css, index);
      result += css.slice(index, stringEnd);
      index = stringEnd;
      continue;
    }
    const token = parseCssUrlToken(css, index);
    if (token) {
      const scrubbed = scrubCssRefWithoutInlining(token.ref, baseDir, ctx, options);
      result += scrubbed.replacement ? `url(${token.quote}${scrubbed.replacement}${token.quote})` : token.raw;
      index = token.end;
      continue;
    }
    result += css[index];
    index += 1;
  }
  return result;
}
function scrubCssNonFetchPrelude(css, baseDir, ctx, options = {}) {
  return scrubCssRefsWithoutInliningInner(css, baseDir, ctx, {
    ...options,
    localWarningKind: null,
    seen: options.seen || /* @__PURE__ */ new Set()
  });
}
function scrubCssImageSetArgsWithoutInlining(args, baseDir, ctx, options) {
  let result = "";
  let index = 0;
  let depth = 0;
  while (index < args.length) {
    const commentEnd = args.startsWith("/*", index) ? findCssCommentEnd(args, index) : -1;
    if (commentEnd !== -1) {
      result += scrubCssComment(args.slice(index, commentEnd), ctx);
      index = commentEnd;
      continue;
    }
    if (depth === 0) {
      const token = parseCssUrlToken(args, index);
      if (token) {
        const scrubbed = scrubCssRefWithoutInlining(token.ref, baseDir, ctx, options);
        result += scrubbed.replacement ? `url(${token.quote}${scrubbed.replacement}${token.quote})` : token.raw;
        index = token.end;
        continue;
      }
    }
    if (args[index] === '"' || args[index] === "'") {
      const token = parseCssString(args, index);
      if (depth === 0) {
        const scrubbed = scrubCssRefWithoutInlining(token.value, baseDir, ctx, options);
        result += scrubbed.replacement ? quoteCssString(scrubbed.replacement, args[index]) : args.slice(index, token.end);
      } else {
        result += args.slice(index, token.end);
      }
      index = token.end;
      continue;
    }
    if (args[index] === "(") depth += 1;
    if (args[index] === ")") depth = Math.max(0, depth - 1);
    result += args[index];
    index += 1;
  }
  return result;
}
function scrubCssRefWithoutInlining(ref, baseDir, ctx, options) {
  const refOptions = { cssSyntax: true, decodeHtmlEntities: Boolean(options.decodeHtmlEntities) };
  if (shouldRedactUnresolvedRef(ref, refOptions)) {
    if (shouldWarnRedactedLocalRefAsUnresolved(options)) {
      pushCssScrubWarning(ctx, options, {
        kind: options.localWarningKind,
        ref,
        reason: options.localWarningReason || SRCDOC_RESOURCE_REASON
      });
    }
    pushCssScrubWarning(ctx, options, { kind: "file-url-redacted", ref });
    return { replacement: REDACTED_FILE_REF };
  }
  if (!options.localWarningKind) return { replacement: "" };
  const descriptor = resolveRef(ref, baseDir, ctx, refOptions);
  if (descriptor.kind === "file") {
    pushCssScrubWarning(ctx, options, {
      kind: options.localWarningKind,
      ref,
      reason: options.localWarningReason
    });
  } else if (descriptor.kind === "escape" || descriptor.kind === "unmapped-root") {
    pushCssScrubWarning(ctx, options, unresolvedDescriptorWarning(descriptor, ref));
  }
  return { replacement: "" };
}
function shouldWarnRedactedLocalRefAsUnresolved(options = {}) {
  return options.localWarningKind === "srcdoc-resource" || options.localWarningKind === "nested-svg-resource";
}
function pushCssScrubWarning(ctx, options, warning) {
  const key = `${warning.kind}\0${warning.ref}`;
  if (options.seen.has(key)) return;
  options.seen.add(key);
  ctx.warnings.push(warning);
}
function findCssResourceRefs(css) {
  const refs = [];
  let index = 0;
  while (index < css.length) {
    const commentEnd = css.startsWith("/*", index) ? findCssCommentEnd(css, index) : -1;
    if (commentEnd !== -1) {
      index = commentEnd;
      continue;
    }
    if (css[index] === '"' || css[index] === "'") {
      index = findCssStringEnd(css, index);
      continue;
    }
    if (startsCssKeyword(css, index, "@import")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) break;
      const parsed = parseCssImportRule(css.slice(index, ruleEnd + 1));
      if (parsed) refs.push(parsed.ref);
      index = ruleEnd + 1;
      continue;
    }
    if (startsCssKeyword(css, index, "@namespace")) {
      const ruleEnd = findCssAtRuleEnd(css, index);
      if (ruleEnd === -1) break;
      index = ruleEnd + 1;
      continue;
    }
    const conditionalBlock = parseCssConditionalAtRuleBlock(css, index);
    if (conditionalBlock) {
      refs.push(...findCssResourceRefs(css.slice(conditionalBlock.bodyStart, conditionalBlock.bodyEnd)));
      index = conditionalBlock.end;
      continue;
    }
    const imageSet = parseCssImageSetFunction(css, index);
    if (imageSet) {
      refs.push(...findCssImageSetArgRefs(css.slice(imageSet.argsStart, imageSet.argsEnd)));
      index = imageSet.end;
      continue;
    }
    const token = parseCssUrlToken(css, index);
    if (token) {
      refs.push(token.ref);
      index = token.end;
      continue;
    }
    index += 1;
  }
  return refs;
}
function findCssImageSetArgRefs(args) {
  const refs = [];
  let index = 0;
  let depth = 0;
  while (index < args.length) {
    const commentEnd = args.startsWith("/*", index) ? findCssCommentEnd(args, index) : -1;
    if (commentEnd !== -1) {
      index = commentEnd;
      continue;
    }
    if (depth === 0) {
      const token = parseCssUrlToken(args, index);
      if (token) {
        refs.push(token.ref);
        index = token.end;
        continue;
      }
    }
    if (args[index] === '"' || args[index] === "'") {
      const token = parseCssString(args, index);
      if (depth === 0) refs.push(token.value);
      index = token.end;
      continue;
    }
    if (args[index] === "(") depth += 1;
    if (args[index] === ")") depth = Math.max(0, depth - 1);
    index += 1;
  }
  return refs;
}
async function rewriteCssStringUrlOperand(ref, baseDir, ctx, outputBaseDir, options = {}) {
  const trimmed = String(ref || "").trim();
  const refForResolution = normalizeRefForResolution(trimmed, { ...options, cssSyntax: true }).trim();
  if (isInert(refForResolution)) return { changed: false, value: ref };
  const dataUri = await loadDataUri(trimmed, baseDir, ctx, { ...options, cssSyntax: true });
  if (dataUri) return { changed: true, value: dataUri };
  if (shouldRedactUnresolvedRef(trimmed, { ...options, cssSyntax: true }))
    return { changed: true, value: REDACTED_FILE_REF };
  const rebased = rebaseLocalCssRef(trimmed, baseDir, outputBaseDir, { ...options, cssSyntax: true });
  return rebased ? { changed: true, value: rebased } : { changed: false, value: ref };
}
function rebaseCssUrlToken(token, baseDir, outputBaseDir) {
  if (shouldRedactUnresolvedRef(token.ref, { cssSyntax: true })) {
    return `url(${token.quote}${REDACTED_FILE_REF}${token.quote})`;
  }
  const rebased = rebaseLocalCssRef(token.ref, baseDir, outputBaseDir, { cssSyntax: true });
  return rebased ? `url(${token.quote}${rebased}${token.quote})` : token.raw;
}
function rebaseCssImportRule(rule, parsed, baseDir, outputBaseDir) {
  if (shouldRedactUnresolvedRef(parsed.ref, { cssSyntax: true })) {
    return `${rule.slice(0, parsed.refStart)}${REDACTED_FILE_REF}${rule.slice(parsed.refEnd)}`;
  }
  const rebased = rebaseLocalCssRef(parsed.ref, baseDir, outputBaseDir, { cssSyntax: true });
  if (!rebased) return rule;
  return `${rule.slice(0, parsed.refStart)}${rebased}${rule.slice(parsed.refEnd)}`;
}
function rebaseCssNamespaceRule(rule, baseDir, outputBaseDir, ctx) {
  const parsed = parseCssNamespaceRule(rule);
  if (!parsed) return rule;
  if (shouldRedactUnresolvedRef(parsed.ref, { cssSyntax: true })) {
    ctx.warnings.push({ kind: "file-url-redacted", ref: parsed.ref });
    return `${rule.slice(0, parsed.refStart)}${REDACTED_FILE_REF}${rule.slice(parsed.refEnd)}`;
  }
  const rebased = rebaseLocalCssRef(parsed.ref, baseDir, outputBaseDir, { cssSyntax: true });
  if (!rebased) return rule;
  return `${rule.slice(0, parsed.refStart)}${rebased}${rule.slice(parsed.refEnd)}`;
}
function rebaseLocalCssRef(ref, baseDir, outputBaseDir, options = {}) {
  const trimmed = normalizeRefForResolution(ref, options).trim();
  const base = normalizeRefBase(baseDir);
  const outputBase = normalizeRefBase(outputBaseDir);
  if (base.kind !== "local" || outputBase.kind !== "local") return "";
  if (path.resolve(base.dir) === path.resolve(outputBase.dir)) return "";
  if (!isRelativeLocalRef(trimmed)) return "";
  const { pathPart, suffix } = splitRefSuffix(trimmed);
  if (!pathPart) return "";
  const absPath = path.resolve(base.dir, decodeLocalPath(pathPart));
  const relative = path.relative(path.resolve(outputBase.dir), absPath);
  if (!relative || path.isAbsolute(relative)) return "";
  return `${encodeRelativeRef(relative.split(path.sep).join("/"))}${suffix}`;
}
function isRelativeLocalRef(ref) {
  if (isInert(ref)) return false;
  if (ref.startsWith("/") || ref.startsWith("//") || /^https?:\/\//i.test(ref)) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(ref);
}
function splitRefSuffix(ref) {
  const match = String(ref).match(/^([^?#]*)(.*)$/s);
  return { pathPart: match ? match[1] : ref, suffix: match ? match[2] : "" };
}
function encodeRelativeRef(ref) {
  return String(ref).split("/").map((part) => encodeURIComponent(part)).join("/");
}
function parseCssImportRule(rule) {
  let index = cssKeywordEnd(rule, 0, "@import");
  if (index === -1) return null;
  index = skipCssWhitespaceAndComments(rule, index);
  let ref;
  let refStart;
  let refEnd;
  if (startsCssKeyword(rule, index, "url")) {
    const token = parseCssUrlToken(rule, index);
    if (!token) return null;
    ref = token.ref.trim();
    refStart = token.refStart;
    refEnd = token.refEnd;
    index = token.end;
  } else if (rule[index] === '"' || rule[index] === "'") {
    refStart = index + 1;
    const token = parseCssString(rule, index);
    ref = token.value;
    refEnd = token.end - 1;
    index = token.end;
  } else {
    return null;
  }
  const semicolon = rule.lastIndexOf(";");
  if (semicolon === -1) return null;
  const media = rule.slice(skipCssWhitespaceAndComments(rule, index), semicolon).trim();
  return { ref, media, refStart, refEnd };
}
function parseCssNamespaceRule(rule) {
  let index = cssKeywordEnd(rule, 0, "@namespace");
  if (index === -1) return null;
  index = skipCssWhitespaceAndComments(rule, index);
  let parsed = parseCssNamespaceRef(rule, index);
  if (parsed) return parsed;
  const prefix = consumeCssIdentifier(rule, index);
  if (!prefix) return null;
  index = skipCssWhitespaceAndComments(rule, prefix.end);
  parsed = parseCssNamespaceRef(rule, index);
  return parsed;
}
function parseCssNamespaceRef(rule, index) {
  if (startsCssKeyword(rule, index, "url")) {
    const token = parseCssUrlToken(rule, index);
    if (!token) return null;
    return { ref: token.ref.trim(), refStart: token.refStart, refEnd: token.refEnd };
  }
  if (rule[index] === '"' || rule[index] === "'") {
    const token = parseCssString(rule, index);
    return { ref: token.value, refStart: index + 1, refEnd: token.end - 1 };
  }
  return null;
}
function parseCssUrlToken(css, index) {
  const keywordEnd = cssKeywordEnd(css, index, "url");
  const paren = keywordEnd === -1 ? -1 : skipCssWhitespaceAndComments(css, keywordEnd);
  if (keywordEnd === -1 || css[paren] !== "(") return null;
  let cursor = skipCssWhitespaceAndComments(css, paren + 1);
  let quote = "";
  let ref;
  let refStart;
  let refEnd;
  if (css[cursor] === '"' || css[cursor] === "'") {
    refStart = cursor + 1;
    const token = parseCssString(css, cursor);
    quote = css[cursor];
    ref = token.value;
    refEnd = token.end - 1;
    cursor = skipCssWhitespaceAndComments(css, token.end);
    if (css[cursor] !== ")") return null;
    cursor += 1;
  } else {
    const start = cursor;
    while (cursor < css.length && css[cursor] !== ")") {
      if (css[cursor] === '"' || css[cursor] === "'") return null;
      if (css.startsWith("/*", cursor) || /\s/.test(css[cursor])) {
        const close = skipCssWhitespaceAndComments(css, cursor);
        if (css[close] !== ")") return null;
        ref = css.slice(start, cursor);
        refStart = start;
        refEnd = cursor;
        cursor = close + 1;
        return { raw: css.slice(index, cursor), ref, quote, end: cursor, refStart, refEnd };
      }
      cursor = css[cursor] === "\\" ? readCssEscape(css, cursor).end : cursor + 1;
    }
    if (css[cursor] !== ")") return null;
    ref = css.slice(start, cursor);
    refStart = start;
    refEnd = cursor;
    cursor += 1;
  }
  return { raw: css.slice(index, cursor), ref, quote, end: cursor, refStart, refEnd };
}
function parseCssImageSetFunction(css, index) {
  let keywordEnd = cssKeywordEnd(css, index, "image-set");
  if (keywordEnd === -1) keywordEnd = cssKeywordEnd(css, index, "-webkit-image-set");
  const paren = keywordEnd === -1 ? -1 : skipCssWhitespaceAndComments(css, keywordEnd);
  if (keywordEnd === -1 || css[paren] !== "(") return null;
  const close = findCssFunctionEnd(css, paren);
  return close === -1 ? null : { argsStart: paren + 1, argsEnd: close, end: close + 1 };
}
function parseCssConditionalAtRuleBlock(css, index) {
  if (!startsCssKeyword(css, index, "@supports") && !startsCssKeyword(css, index, "@media") && !startsCssKeyword(css, index, "@container")) {
    return null;
  }
  const open = findCssAtRuleBlockStart(css, index);
  if (open === -1) return null;
  const close = findCssBlockEnd(css, open);
  if (close === -1) return null;
  return { bodyStart: open + 1, bodyEnd: close, end: close + 1 };
}
function findCssAtRuleBlockStart(css, index) {
  let cursor = index;
  let parenDepth = 0;
  while (cursor < css.length) {
    if (css.startsWith("/*", cursor)) {
      cursor = findCssCommentEnd(css, cursor);
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      cursor = findCssStringEnd(css, cursor);
      continue;
    }
    if (css[cursor] === "(") {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (css[cursor] === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      cursor += 1;
      continue;
    }
    if (css[cursor] === ";" && parenDepth === 0) return -1;
    if (css[cursor] === "{" && parenDepth === 0) return cursor;
    cursor += 1;
  }
  return -1;
}
function findCssBlockEnd(css, openParen) {
  let cursor = openParen;
  let depth = 0;
  while (cursor < css.length) {
    if (css.startsWith("/*", cursor)) {
      cursor = findCssCommentEnd(css, cursor);
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      cursor = findCssStringEnd(css, cursor);
      continue;
    }
    if (css[cursor] === "{") depth += 1;
    if (css[cursor] === "}") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
    cursor += 1;
  }
  return -1;
}
function findCssFunctionEnd(css, openParen) {
  let cursor = openParen;
  let depth = 0;
  while (cursor < css.length) {
    if (css.startsWith("/*", cursor)) {
      cursor = findCssCommentEnd(css, cursor);
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      cursor = findCssStringEnd(css, cursor);
      continue;
    }
    if (css[cursor] === "(") depth += 1;
    if (css[cursor] === ")") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
    cursor += 1;
  }
  return -1;
}
function parseCssString(css, index) {
  const quote = css[index];
  let cursor = index + 1;
  let value = "";
  while (cursor < css.length) {
    const char = css[cursor];
    if (char === "\\") {
      value += css.slice(cursor, Math.min(cursor + 2, css.length));
      cursor += 2;
      continue;
    }
    if (char === quote) {
      return { value, end: cursor + 1 };
    }
    value += char;
    cursor += 1;
  }
  return { value, end: css.length };
}
function findCssStringEnd(css, index) {
  return parseCssString(css, index).end;
}
function findCssCommentEnd(css, index) {
  const end = css.indexOf("*/", index + 2);
  return end === -1 ? css.length : end + 2;
}
function scrubHtmlComment(raw, ctx) {
  const text = String(raw);
  const closed = text.endsWith("-->");
  const bodyEnd = closed ? text.length - 3 : text.length;
  return `${text.slice(0, 4)}${scrubFileUrlsInCommentBody(text.slice(4, bodyEnd), ctx)}${closed ? "-->" : ""}`;
}
function scrubCssComment(raw, ctx) {
  const text = String(raw);
  const closed = text.endsWith("*/");
  const bodyEnd = closed ? text.length - 2 : text.length;
  return `${text.slice(0, 2)}${scrubFileUrlsInCommentBody(text.slice(2, bodyEnd), ctx)}${closed ? "*/" : ""}`;
}
function scrubFileUrlsInCommentBody(text, ctx) {
  const input = String(text);
  let result = "";
  let index = 0;
  while (index < input.length) {
    if (isTextUrlDelimiter(input[index])) {
      result += input[index];
      index += 1;
      continue;
    }
    const start = index;
    while (index < input.length && !isTextUrlDelimiter(input[index])) index += 1;
    result += scrubFileUrlsInTextToken(input.slice(start, index), ctx);
  }
  return result;
}
function isTextUrlDelimiter(char) {
  return `	
\f\r "'<>()=[]{}`.includes(char);
}
function scrubFileUrlsInTextToken(token, ctx) {
  for (let index = 0; index < token.length; index += 1) {
    if (index > 0 && /[a-z0-9+.-]/i.test(token[index - 1])) continue;
    const ref = token.slice(index);
    if (!isFileSchemeRef(ref, { cssSyntax: true, decodeHtmlEntities: true })) continue;
    ctx.warnings.push({ kind: "file-url-redacted", ref });
    return `${token.slice(0, index)}${REDACTED_FILE_REF}`;
  }
  return token;
}
function scrubRawTextFileUrls(text, ctx) {
  return scrubFileUrlsInCommentBody(text, ctx);
}
function scrubClassicScriptFileUrlComments(source, ctx) {
  const input = String(source);
  let result = "";
  let index = 0;
  while (index < input.length) {
    if (input.startsWith("//", index)) {
      const end = input.indexOf("\n", index + 2);
      const bodyEnd = end === -1 ? input.length : end;
      result += `//${scrubFileUrlsInCommentBody(input.slice(index + 2, bodyEnd), ctx)}`;
      if (end === -1) {
        index = input.length;
      } else {
        result += "\n";
        index = end + 1;
      }
      continue;
    }
    if (input.startsWith("/*", index)) {
      const end = input.indexOf("*/", index + 2);
      const bodyEnd = end === -1 ? input.length : end;
      result += `/*${scrubFileUrlsInCommentBody(input.slice(index + 2, bodyEnd), ctx)}${end === -1 ? "" : "*/"}`;
      index = end === -1 ? input.length : end + 2;
      continue;
    }
    if (input.startsWith("<!--", index)) {
      const end = input.indexOf("\n", index + 4);
      const bodyEnd = end === -1 ? input.length : end;
      result += `<!--${scrubFileUrlsInCommentBody(input.slice(index + 4, bodyEnd), ctx)}`;
      if (end === -1) {
        index = input.length;
      } else {
        result += "\n";
        index = end + 1;
      }
      continue;
    }
    if (input.startsWith("-->", index) && isJsHtmlCloseCommentStart(input, index)) {
      const end = input.indexOf("\n", index + 3);
      const bodyEnd = end === -1 ? input.length : end;
      result += `-->${scrubFileUrlsInCommentBody(input.slice(index + 3, bodyEnd), ctx)}`;
      if (end === -1) {
        index = input.length;
      } else {
        result += "\n";
        index = end + 1;
      }
      continue;
    }
    if (input[index] === '"' || input[index] === "'") {
      const end = parseJsString(input, index).end;
      result += input.slice(index, end);
      index = end;
      continue;
    }
    if (input[index] === "`") {
      const end = skipJsTemplate(input, index);
      result += input.slice(index, end);
      index = end;
      continue;
    }
    if (input[index] === "/" && isLikelyJsRegexStart(input, index)) {
      const end = skipJsRegex(input, index);
      result += input.slice(index, end);
      index = end;
      continue;
    }
    result += input[index];
    index += 1;
  }
  return result;
}
function isJsHtmlCloseCommentStart(input, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const char = input[cursor];
    if (char === "\n" || char === "\r") return true;
    if (char !== " " && char !== "	" && char !== "\f" && char !== "\v") return false;
  }
  return true;
}
function findCssAtRuleEnd(css, index) {
  let cursor = index;
  let parenDepth = 0;
  while (cursor < css.length) {
    if (css.startsWith("/*", cursor)) {
      cursor = findCssCommentEnd(css, cursor);
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      cursor = findCssStringEnd(css, cursor);
      continue;
    }
    if (css[cursor] === "(") {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (css[cursor] === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      cursor += 1;
      continue;
    }
    if (css[cursor] === ";" && parenDepth === 0) return cursor;
    cursor += 1;
  }
  return -1;
}
function findCssPreludeStatementEnd(css, index) {
  let cursor = index;
  let parenDepth = 0;
  while (cursor < css.length) {
    if (css.startsWith("/*", cursor)) {
      cursor = findCssCommentEnd(css, cursor);
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      cursor = findCssStringEnd(css, cursor);
      continue;
    }
    if (css[cursor] === "(") {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (css[cursor] === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      cursor += 1;
      continue;
    }
    if ((css[cursor] === ";" || css[cursor] === "{") && parenDepth === 0) return cursor;
    cursor += 1;
  }
  return -1;
}
function skipCssWhitespace(css, index) {
  let cursor = index;
  while (cursor < css.length && /\s/.test(css[cursor])) cursor += 1;
  return cursor;
}
function skipCssWhitespaceAndComments(css, index) {
  let cursor = index;
  while (cursor < css.length) {
    const next = skipCssWhitespace(css, cursor);
    if (!css.startsWith("/*", next)) return next;
    cursor = findCssCommentEnd(css, next);
  }
  return cursor;
}
function startsCssKeyword(css, index, keyword) {
  return cssKeywordEnd(css, index, keyword) !== -1;
}
function cssKeywordEnd(css, index, keyword) {
  if (!hasCssIdentifierBoundaryBefore(css, index)) return -1;
  const expected = String(keyword).toLowerCase();
  if (expected.startsWith("@")) {
    if (css[index] !== "@") return -1;
    const ident2 = consumeCssIdentifier(css, index + 1);
    if (!ident2 || `@${ident2.value.toLowerCase()}` !== expected) return -1;
    return ident2.end;
  }
  const ident = consumeCssIdentifier(css, index);
  if (!ident || ident.value.toLowerCase() !== expected) return -1;
  return ident.end;
}
function hasCssIdentifierBoundaryBefore(css, index) {
  const before = css[index - 1] || "";
  return before !== "\\" && !isCssIdentChar(before);
}
function isPlainCssMediaQueryList(tail) {
  return !startsUnsupportedCssImportTail(tail);
}
function startsUnsupportedCssImportTail(tail) {
  const index = skipCssWhitespaceAndComments(tail, 0);
  const ident = consumeCssIdentifier(tail, index);
  if (!ident) return false;
  const cursor = ident.end;
  const value = ident.value.toLowerCase();
  if (value === "layer") return true;
  return tail[cursor] === "(";
}
function isCssIdentChar(char) {
  return Boolean(char) && /[a-z0-9_-]/i.test(char);
}
function consumeCssIdentifier(css, index) {
  let cursor = index;
  let value = "";
  while (cursor < css.length) {
    if (css[cursor] === "\\") {
      const escaped = readCssEscape(css, cursor);
      value += escaped.value;
      cursor = escaped.end;
      continue;
    }
    if (!isCssIdentChar(css[cursor])) break;
    value += css[cursor];
    cursor += 1;
  }
  return cursor === index ? null : { value, end: cursor };
}
function readCssEscape(input, index) {
  if (index + 1 >= input.length) return { value: "\\", end: index + 1 };
  const next = input[index + 1];
  if (next === "\r" && input[index + 2] === "\n") return { value: "", end: index + 3 };
  if (/[\n\r\f]/.test(next)) return { value: "", end: index + 2 };
  if (/[\da-f]/i.test(next)) {
    let cursor = index + 1;
    let hex = "";
    while (cursor < input.length && hex.length < 6 && /[\da-f]/i.test(input[cursor])) {
      hex += input[cursor];
      cursor += 1;
    }
    const value = decodeNumericCharacterReference(Number.parseInt(hex, 16), "");
    if (cursor < input.length && /[\t\n\f\r ]/.test(input[cursor])) cursor += 1;
    return { value, end: cursor };
  }
  return { value: next, end: index + 2 };
}
function readHtmlToken(html, index) {
  if (html[index] !== "<") return null;
  if (html.startsWith("<!--", index)) {
    const end2 = html.indexOf("-->", index + 4);
    const tokenEnd = end2 === -1 ? html.length : end2 + 3;
    return { type: "comment", raw: html.slice(index, tokenEnd), end: tokenEnd };
  }
  const next = html[index + 1] || "";
  if (next === "!" || next === "?") {
    const end2 = findHtmlTagEnd(html, index);
    if (end2 === -1) return null;
    return { type: "special", raw: html.slice(index, end2 + 1), end: end2 + 1 };
  }
  if (next === "/") {
    const name2 = readHtmlTagName(html, index + 2);
    if (!name2) return null;
    const end2 = findHtmlTagEnd(html, index);
    if (end2 === -1) return null;
    return { type: "close", tag: name2.value, raw: html.slice(index, end2 + 1), end: end2 + 1 };
  }
  const name = readHtmlTagName(html, index + 1);
  if (!name) return null;
  const end = findHtmlTagEnd(html, index);
  if (end === -1) return null;
  let attrsEnd = end;
  let cursor = end - 1;
  while (cursor > name.end && isHtmlSpace(html[cursor])) cursor -= 1;
  const selfClosing = html[cursor] === "/" && isSelfClosingSlash(html, name.end, end, cursor);
  if (selfClosing) attrsEnd = cursor;
  return {
    type: "start",
    tag: name.value,
    attrs: html.slice(name.end, attrsEnd),
    selfClosing,
    raw: html.slice(index, end + 1),
    end: end + 1
  };
}
function isSelfClosingSlash(html, attrsStart, tagEnd, slashIndex) {
  const attrs = html.slice(attrsStart, tagEnd);
  const slashOffset = slashIndex - attrsStart;
  for (const attr of parseHtmlAttrs(attrs)) {
    if (attr.hasValue && !attr.quote && attr.valueRawStart <= slashOffset && slashOffset < attr.valueRawEnd) {
      return false;
    }
  }
  return true;
}
function readHtmlTagName(html, index) {
  if (!/[a-z]/i.test(html[index] || "")) return null;
  let cursor = index + 1;
  while (cursor < html.length && /[\w:-]/.test(html[cursor])) cursor += 1;
  const value = html.slice(index, cursor);
  const next = html[cursor] || "";
  if (next && !/[\t\n\f\r />]/.test(next)) return null;
  return { value, end: cursor };
}
function findHtmlTagEnd(html, index) {
  let quote = "";
  for (let cursor = index + 1; cursor < html.length; cursor += 1) {
    const char = html[cursor];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return cursor;
  }
  return -1;
}
function findRawTextClose(html, index, tag) {
  let cursor = index;
  while (cursor < html.length) {
    const lt = html.indexOf("</", cursor);
    if (lt === -1) return null;
    const token = readHtmlToken(html, lt);
    if (token?.type === "close" && token.tag.toLowerCase() === tag) {
      return { start: lt, raw: token.raw, end: token.end };
    }
    cursor = lt + 2;
  }
  return null;
}
function findContentClose(html, index, tag) {
  if (tag === "template") return findTemplateClose(html, index);
  return findRawTextClose(html, index, tag);
}
function findTemplateClose(html, index) {
  let depth = 1;
  let cursor = index;
  while (cursor < html.length) {
    const lt = html.indexOf("<", cursor);
    if (lt === -1) return null;
    const token = readHtmlToken(html, lt);
    if (!token) {
      cursor = lt + 1;
      continue;
    }
    if (token.type === "close" && token.tag.toLowerCase() === "template") {
      depth -= 1;
      if (depth === 0) return { start: lt, raw: token.raw, end: token.end };
      cursor = token.end;
      continue;
    }
    if (token.type === "start") {
      const tagName = token.tag.toLowerCase();
      const effectiveSelfClosing = isEffectiveSelfClosingTag(tagName, token.selfClosing);
      if (tagName === "template" && !effectiveSelfClosing) {
        depth += 1;
        cursor = token.end;
        continue;
      }
      if (tagName === PLAINTEXT_TAG && !effectiveSelfClosing) return null;
      if (RAW_TEXT_TAGS.has(tagName) && !effectiveSelfClosing) {
        const close = findRawTextClose(html, token.end, tagName);
        if (!close) return null;
        cursor = close.end;
        continue;
      }
    }
    cursor = token.end;
  }
  return null;
}
function resolveDocumentRefBase(html, ctx) {
  const href = findFirstDocumentBaseHref(html);
  if (!href) return localRefBase(ctx.baseDir);
  return refBaseFromHref(href, ctx.baseDir);
}
function findFirstDocumentBaseHref(html) {
  let index = 0;
  const openStack = [];
  while (index < html.length) {
    const lt = html.indexOf("<", index);
    if (lt === -1) break;
    const token = readHtmlToken(html, lt);
    if (!token) {
      index = lt + 1;
      continue;
    }
    if (token.type === "close") {
      popHtmlParent(openStack, token.tag.toLowerCase());
      index = token.end;
      continue;
    }
    if (token.type === "start") {
      const tag = token.tag.toLowerCase();
      const elementNamespace = elementNamespaceForTag(tag, openStack);
      const effectiveSelfClosing = isEffectiveSelfClosingTag(tag, token.selfClosing, openStack, elementNamespace);
      if (elementNamespace === "html" && tag === "base") {
        const href = getAttr(token.attrs, "href");
        if (href) return href;
      }
      if (elementNamespace === "html" && tag === PLAINTEXT_TAG && !effectiveSelfClosing) break;
      if (elementNamespace === "html" && INERT_CONTENT_TAGS.has(tag) && !effectiveSelfClosing) {
        const close = findContentClose(html, token.end, tag);
        if (close) {
          index = close.end;
          continue;
        }
        break;
      }
      if (isRawTextElementForNamespace(tag, elementNamespace) && !effectiveSelfClosing) {
        const close = findContentClose(html, token.end, tag);
        if (close) {
          index = close.end;
          continue;
        }
        break;
      }
      if (!effectiveSelfClosing && !HTML_VOID_TAGS.has(tag)) pushHtmlParent(openStack, tag, elementNamespace);
    }
    index = token.end;
  }
  return null;
}
function refBaseFromHref(href, documentDir) {
  const trimmed = decodeHtmlCharacterReferences(String(href || "").trim());
  const schemeRef = normalizeRefForScheme(trimmed, HTML_REF_OPTIONS);
  if (!trimmed || isInert(schemeRef || trimmed)) return localRefBase(documentDir);
  if (schemeRef.startsWith("//") || /^https?:\/\//i.test(schemeRef)) return { kind: "remote" };
  if (isFileSchemeRef(trimmed, HTML_REF_OPTIONS)) {
    try {
      const fileHref = stripQueryAndHash(schemeRef);
      return localRefBase(directoryFromBasePath(fileURLToPath(fileHref), fileHref));
    } catch {
      return { kind: "remote" };
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(schemeRef)) return { kind: "remote" };
  const { pathPart } = splitRefSuffix(trimmed);
  if (!pathPart) return localRefBase(documentDir);
  if (trimmed.startsWith("/")) return { kind: "root", path: rootDirectoryFromBasePath(pathPart) };
  return localRefBase(directoryFromBasePath(path.resolve(documentDir, decodeLocalPath(pathPart)), pathPart));
}
function directoryFromBasePath(absPath, ref) {
  const value = String(ref || "");
  return value.endsWith("/") ? absPath : path.dirname(absPath);
}
function rootDirectoryFromBasePath(ref) {
  const decoded = decodeLocalPath(ref);
  if (!decoded || decoded === "/") return "/";
  const normalized = path.posix.normalize(decoded);
  const directory = decoded.endsWith("/") ? normalized : path.posix.dirname(normalized);
  return directory.endsWith("/") ? directory : `${directory}/`;
}
function localRefBase(dir) {
  return { kind: "local", dir: path.resolve(dir) };
}
function normalizeRefBase(base) {
  if (base && typeof base === "object" && typeof base.kind === "string") return base;
  return localRefBase(base);
}
function rootRelativeRef(basePath, ref) {
  const { pathPart, suffix } = splitRefSuffix(ref);
  const joined = path.posix.normalize(path.posix.join(basePath, decodeLocalPath(pathPart)));
  return `${joined.startsWith("/") ? joined : `/${joined}`}${suffix}`;
}
function resolveRef(ref, baseDir, ctx, options = {}) {
  const trimmed = normalizeRefForResolution(ref, options).trim();
  const schemeRef = normalizeRefForScheme(ref, options);
  const base = normalizeRefBase(baseDir);
  if (isInert(schemeRef || trimmed)) return { kind: "skip" };
  if (schemeRef.startsWith("//") || /^https?:\/\//i.test(schemeRef)) return { kind: "skip" };
  if (isFileSchemeRef(ref, options)) {
    try {
      const resolved2 = fileURLToPath(schemeRef.replace(/#.*$/, ""));
      if (ctx.confineDir && isOutside(ctx.confineDir, resolved2)) return { kind: "escape", path: resolved2 };
      return { kind: "file", path: resolved2 };
    } catch {
      return { kind: "unparseable-file-url" };
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(schemeRef)) return { kind: "skip" };
  if (base.kind === "remote") return { kind: "skip" };
  const effectiveRef = base.kind === "root" && !trimmed.startsWith("/") ? rootRelativeRef(base.path, trimmed) : trimmed;
  const localPath = decodeLocalPath(stripQueryAndHash(effectiveRef));
  if (effectiveRef.startsWith("/")) {
    const mapped = ctx.resolveAbsolute(localPath);
    return mapped ? { kind: "file", path: mapped, allowOutsideRoot: true } : { kind: "unmapped-root", ref: effectiveRef };
  }
  const resolved = resolveLocalPathPreservingTrailingSlash(base.dir, localPath);
  if (ctx.confineDir && isOutside(ctx.confineDir, resolved)) return { kind: "escape", path: resolved };
  return { kind: "file", path: resolved };
}
function resolveLocalPathPreservingTrailingSlash(baseDir, localPath) {
  const resolved = path.resolve(baseDir, localPath);
  return localPath.endsWith("/") && !resolved.endsWith(path.sep) ? `${resolved}${path.sep}` : resolved;
}
function warnUnresolvedDescriptor(descriptor, ref, ctx) {
  const warning = unresolvedDescriptorWarning(descriptor, ref);
  if (warning) ctx.warnings.push(warning);
  if (descriptor.kind === "unparseable-file-url") ctx.warnings.push({ kind: "file-url-redacted", ref });
}
function unresolvedDescriptorWarning(descriptor, ref) {
  if (descriptor.kind === "escape") return { kind: "outside-root", ref };
  if (descriptor.kind === "unparseable-file-url") {
    return {
      kind: "file-url-unresolved",
      ref,
      reason: "file URL could not be resolved to a local file and was redacted"
    };
  }
  if (descriptor.kind === "unmapped-root") {
    return {
      kind: "unmapped-root-absolute",
      ref: descriptor.ref || ref,
      reason: "root-absolute reference has no trusted local mapping and is left unchanged"
    };
  }
  return null;
}
async function loadText(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  return loadTextFromDescriptor(descriptor, ref, ctx);
}
async function loadTextFromDescriptor(descriptor, ref, ctx, options = {}) {
  if (descriptor.kind !== "file") {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
    return null;
  }
  const buffer = await readBudgeted(descriptor, ref, ctx, options);
  if (!buffer) return null;
  return { text: buffer.toString("utf8"), baseDir: path.dirname(descriptor.path), byteLength: buffer.length };
}
async function loadDataUri(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind !== "file") {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
    return null;
  }
  const buffer = await readBudgeted(descriptor, ref, ctx);
  if (!buffer) return null;
  const mime = pickMime(descriptor.path);
  if (mime === "image/svg+xml") {
    const svg = sanitizeSvgTextForDataUri(buffer.toString("utf8"), path.dirname(descriptor.path), ctx);
    return `${toDataUri(Buffer.from(svg, "utf8"), mime)}${fragmentSuffix(normalizeRefForResolution(ref, options))}`;
  }
  return toDataUri(buffer, mime);
}
function sanitizeSvgTextForDataUri(svg, baseDir, ctx) {
  return transformInertMarkup(svg, baseDir, ctx, {
    localWarningKind: "nested-svg-resource",
    localWarningReason: "nested SVG resources are left as references inside inlined SVG assets"
  });
}
function warnUnsupportedScriptTiming(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "unsupported-script-timing",
      ref,
      reason: "defer and async scripts are left as references to preserve execution timing"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnInactiveStylesheet(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "inactive-stylesheet",
      ref,
      reason: "inactive stylesheet links are left as references to preserve disabled or alternate state"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnBehavioralStylesheet(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "behavioral-stylesheet",
      ref,
      reason: "stylesheet links with event handler attributes are left as references to preserve behavior"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnPreloadStylesheet(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "preload-stylesheet",
      ref,
      reason: "preload-as-style links are left as references to preserve activation behavior"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnFetchableLink(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "fetchable-link",
      ref,
      reason: "fetchable link hints are left as references"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnExternalModuleScript(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "module-external",
      ref,
      reason: "module scripts are left as references to preserve relative imports"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnUnterminatedScriptSrc(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "unterminated-script-src",
      ref,
      reason: "unterminated script src is left as a reference to preserve raw-text parsing"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnUnsupportedScriptType(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "unsupported-script-type",
      ref,
      reason: "non-classic script types are left as references"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnUnsupportedStylesheetType(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "unsupported-stylesheet-type",
      ref,
      reason: "non-CSS stylesheet links are left as references"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function scrubUnsupportedStyleElementBody(css, baseDir, ctx) {
  return scrubCssRefsWithoutInlining(css, baseDir, ctx, {
    localWarningKind: "unsupported-style-type",
    localWarningReason: "non-CSS style elements are left unchanged"
  });
}
function warnFrameSrc(attrs, baseDir, ctx) {
  const ref = getAttr(attrs, "src");
  if (!ref) return attrs;
  warnUnsupportedFrame(ref, baseDir, ctx, HTML_REF_OPTIONS);
  return replaceUnresolvedAttrRef(attrs, "src", ref);
}
function scrubFrameSrcdoc(attrs, baseDir, ctx, options = {}) {
  const attr = findHtmlAttr(attrs, "srcdoc");
  if (!attr || !attr.hasValue) return attrs;
  const decoded = decodeHtmlCharacterReferences(attr.value);
  const scrubbed = transformInertMarkup(decoded, baseDir, ctx, {
    localWarningKind: options.localWarningKind || "inert-resource",
    localWarningReason: options.localWarningReason || SRCDOC_RESOURCE_REASON
  });
  return scrubbed === decoded ? attrs : replaceAttrTokenValue(attrs, attr, scrubbed);
}
function warnUnsupportedFrame(ref, baseDir, ctx, options = {}) {
  const descriptor = resolveRef(ref, baseDir, ctx, options);
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "unsupported-frame",
      ref,
      reason: "iframe documents are left as references because nested HTML is not bundled"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnInertStartTagRefs(tagName, attrs, baseDir, ctx, options = {}, namespace = "html") {
  const elementNamespace = namespace || "html";
  const inHtmlNamespace = elementNamespace === "html";
  const inSvgNamespace = elementNamespace === "svg";
  if (inHtmlNamespace && MEDIA_TAGS.has(tagName)) {
    warnInertAttrRef(attrs, "src", baseDir, ctx, HTML_REF_OPTIONS, options);
    if (tagName === "video") warnInertAttrRef(attrs, "poster", baseDir, ctx, HTML_REF_OPTIONS, options);
    if (tagName === "img" || tagName === "source") warnInertSrcsetRefs(attrs, baseDir, ctx, options);
  }
  if (SVG_REF_TAGS.has(tagName) && inSvgNamespace) {
    warnInertAttrRef(attrs, "href", baseDir, ctx, HTML_REF_OPTIONS, options);
    warnInertAttrRef(attrs, "xlink:href", baseDir, ctx, HTML_REF_OPTIONS, options);
  }
  if (inHtmlNamespace && tagName === "object") warnInertAttrRef(attrs, "data", baseDir, ctx, HTML_REF_OPTIONS, options);
  if (tagName === "script" && inSvgNamespace) {
    warnInertAttrRef(attrs, "href", baseDir, ctx, HTML_REF_OPTIONS, options);
    warnInertAttrRef(attrs, "xlink:href", baseDir, ctx, HTML_REF_OPTIONS, options);
  }
  if (inHtmlNamespace && (tagName === "embed" || tagName === "script" || tagName === "iframe")) {
    warnInertAttrRef(attrs, "src", baseDir, ctx, HTML_REF_OPTIONS, options);
  }
  if (inHtmlNamespace && tagName === "input" && getDecisionAttr(attrs, "type").trim().toLowerCase() === "image") {
    warnInertAttrRef(attrs, "src", baseDir, ctx, HTML_REF_OPTIONS, options);
  }
  if (inHtmlNamespace && tagName === "link") {
    const rel = getTokenListAttr(attrs, "rel");
    if (rel.includes("stylesheet") || rel.some((value) => ["icon", "shortcut", "apple-touch-icon", "mask-icon"].includes(value)) || isFetchableLinkRel(rel)) {
      warnInertAttrRef(attrs, "href", baseDir, ctx, HTML_REF_OPTIONS, options);
    }
  }
  warnInertStyleRefs(attrs, baseDir, ctx, options);
}
function warnInertAttrRef(attrs, name, baseDir, ctx, refOptions = {}, warningOptions = {}) {
  const ref = getAttr(attrs, name);
  if (ref) warnInertResource(ref, baseDir, ctx, refOptions, warningOptions);
}
function warnInertSrcsetRefs(attrs, baseDir, ctx, options = {}) {
  const value = getAttr(attrs, "srcset");
  if (!value) return;
  for (const candidate of parseSrcsetCandidates(value)) {
    warnInertResource(value.slice(candidate.urlStart, candidate.urlEnd), baseDir, ctx, HTML_REF_OPTIONS, options);
  }
}
function warnInertStyleRefs(attrs, baseDir, ctx, options = {}) {
  const attr = findHtmlAttr(attrs, "style");
  if (!attr || !attr.hasValue) return;
  const decoded = decodeHtmlCharacterReferences(attr.value);
  const seen = /* @__PURE__ */ new Set();
  for (const ref of findCssResourceRefs(decoded)) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    warnInertResource(ref, baseDir, ctx, { cssSyntax: true }, options);
  }
}
function warnInertResource(ref, baseDir, ctx, refOptions = {}, warningOptions = {}) {
  if (shouldRedactUnresolvedRef(ref, refOptions)) {
    if (shouldWarnRedactedLocalRefAsUnresolved(warningOptions)) {
      ctx.warnings.push({
        kind: warningOptions.localWarningKind,
        ref,
        reason: warningOptions.localWarningReason || SRCDOC_RESOURCE_REASON
      });
    }
    return;
  }
  const descriptor = resolveRef(ref, baseDir, ctx, refOptions);
  if (descriptor.kind !== "file") {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
    return;
  }
  ctx.warnings.push({
    kind: warningOptions.localWarningKind || "inert-resource",
    ref,
    reason: warningOptions.localWarningReason || INERT_RESOURCE_REASON
  });
}
function warnInlineModuleImports(body, baseDir, ctx) {
  for (const ref of findInlineModuleImportRefs(body)) {
    const normalized = normalizeJsRefForScheme(ref);
    if (!isLocalModuleImport(normalized)) continue;
    warnInlineModuleImport(normalized, baseDir, ctx);
  }
}
function warnClassicScriptDynamicImports(body, baseDir, ctx) {
  for (const ref of findInlineDynamicImportRefs(body)) {
    const normalized = normalizeJsRefForScheme(ref);
    if (!isLocalModuleImport(normalized)) continue;
    warnInlineModuleImport(normalized, baseDir, ctx);
  }
}
function redactInlineModuleFileRefs(body, ctx, options = {}) {
  const refs = findInlineModuleImportRefTokens(body).filter((ref) => isFileSchemeJsRef(ref.value));
  if (refs.length === 0) return body;
  for (const ref of refs) {
    if (options.warnUnresolved) pushInlineModuleImportWarning(ctx, ref.value);
    ctx.warnings.push({ kind: "file-url-redacted", ref: ref.value });
  }
  let result = body;
  for (let index = refs.length - 1; index >= 0; index -= 1) {
    const ref = refs[index];
    result = `${result.slice(0, ref.rawStart)}${quoteJsModuleSpecifier(REDACTED_FILE_REF, ref.quote)}${result.slice(
      ref.rawEnd
    )}`;
  }
  return result;
}
function warnInlineImportMapLocalRefs(body, baseDir, ctx) {
  for (const ref of findImportMapLocalRefs(body)) {
    const descriptor = resolveRef(ref, baseDir, ctx);
    if (descriptor.kind === "file") {
      pushInlineImportMapLocalRefWarning(ctx, ref);
    } else {
      warnUnresolvedDescriptor(descriptor, ref, ctx);
    }
  }
}
function redactInlineImportMapFileRefs(body, ctx, options = {}) {
  let map;
  try {
    map = JSON.parse(body);
  } catch {
    return body;
  }
  let changed = false;
  const redactImports = (imports) => {
    if (!imports || typeof imports !== "object" || Array.isArray(imports)) return imports;
    let redacted = false;
    const nextImports = {};
    for (const [key, value] of Object.entries(imports)) {
      let nextKey = key;
      let nextValue = value;
      if (isFileSchemeRef(key)) {
        if (options.warnUnresolved) pushInlineImportMapLocalRefWarning(ctx, key);
        ctx.warnings.push({ kind: "file-url-redacted", ref: key });
        nextKey = REDACTED_FILE_REF;
        redacted = true;
      }
      if (typeof value === "string" && isFileSchemeRef(value)) {
        if (options.warnUnresolved) pushInlineImportMapLocalRefWarning(ctx, value);
        ctx.warnings.push({ kind: "file-url-redacted", ref: value });
        nextValue = REDACTED_FILE_REF;
        redacted = true;
      }
      nextImports[nextKey] = nextValue;
    }
    if (redacted) changed = true;
    return redacted ? nextImports : imports;
  };
  if (map && map.imports) map.imports = redactImports(map.imports);
  if (map && map.scopes && typeof map.scopes === "object" && !Array.isArray(map.scopes)) {
    const scopes = {};
    for (const [scopePrefix, scopedImports] of Object.entries(map.scopes)) {
      let nextPrefix = scopePrefix;
      if (isFileSchemeRef(scopePrefix)) {
        if (options.warnUnresolved) pushInlineImportMapLocalRefWarning(ctx, scopePrefix);
        ctx.warnings.push({ kind: "file-url-redacted", ref: scopePrefix });
        nextPrefix = REDACTED_FILE_REF;
        changed = true;
      }
      scopes[nextPrefix] = redactImports(scopedImports);
    }
    map.scopes = scopes;
  }
  return changed ? JSON.stringify(map) : body;
}
function pushInlineModuleImportWarning(ctx, ref) {
  ctx.warnings.push({
    kind: "inline-module-import",
    ref,
    reason: "inline module imports are left as references"
  });
}
function pushInlineImportMapLocalRefWarning(ctx, ref) {
  ctx.warnings.push({
    kind: "inline-importmap-local-ref",
    ref,
    reason: "inline import maps are left unchanged; local mapped modules are not bundled"
  });
}
function warnInlineModuleImport(ref, baseDir, ctx) {
  const descriptor = resolveRef(ref, baseDir, ctx);
  if (descriptor.kind === "file") {
    pushInlineModuleImportWarning(ctx, ref);
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnUnsupportedCssImport(ref, baseDir, ctx, tail) {
  const descriptor = resolveRef(ref, baseDir, ctx, { cssSyntax: true });
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "unsupported-css-import",
      ref,
      reason: `CSS @import tail is left unchanged: ${tail}`
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnCssImportDepth(ref, baseDir, ctx) {
  const descriptor = resolveRef(ref, baseDir, ctx, { cssSyntax: true });
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "css-import-depth",
      ref,
      reason: `CSS @import recursion reached max depth ${ctx.maxDepth}`
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnCssImportOrder(ref, descriptor, ctx) {
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "css-import-order",
      ref,
      reason: "CSS @import is left as a reference to preserve import ordering"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnLateCssImport(ref, baseDir, ctx) {
  const descriptor = resolveRef(ref, baseDir, ctx, { cssSyntax: true });
  if (descriptor.kind === "file") {
    ctx.warnings.push({
      kind: "late-css-import",
      ref,
      reason: "CSS @import appears outside the valid top-level import prelude and is left unchanged"
    });
  } else {
    warnUnresolvedDescriptor(descriptor, ref, ctx);
  }
}
function warnUnterminatedRawText(tagName, ctx) {
  ctx.warnings.push({
    kind: "unterminated-raw-text",
    ref: tagName,
    reason: "raw-text or inert content continues to EOF and is left unbundled"
  });
}
function isModuleScript(attrs) {
  return getDecisionAttr(attrs, "type").trim().toLowerCase() === "module";
}
function isImportMapScript(attrs) {
  return getDecisionAttr(attrs, "type").trim().toLowerCase() === "importmap";
}
function isClassicScript(attrs) {
  const type = getDecisionAttr(attrs, "type").trim().toLowerCase();
  if (!type) return true;
  const mime = type.split(";")[0].trim();
  return CLASSIC_SCRIPT_MIME_TYPES.has(mime);
}
var CLASSIC_SCRIPT_MIME_TYPES = /* @__PURE__ */ new Set([
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript"
]);
function findInlineModuleImportRefs(source) {
  return findInlineModuleImportRefTokens(source).map((ref) => ref.value);
}
function findInlineDynamicImportRefs(source) {
  return findInlineModuleImportRefTokens(source).filter((ref) => ref.importKind === "dynamic").map((ref) => ref.value);
}
function findInlineModuleImportRefTokens(source) {
  const refs = [];
  let index = 0;
  while (index < source.length) {
    const skipped = skipJsIgnored(source, index);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    if (startsJsKeyword(source, index, "import") && !isJsPropertyAccessKeyword(source, index)) {
      const parsed = parseJsImport(source, index);
      refs.push(...parsed.refs);
      index = Math.max(parsed.end, index + "import".length);
      continue;
    }
    if (startsJsKeyword(source, index, "export")) {
      const parsed = parseJsExport(source, index);
      refs.push(...parsed.refs);
      index = Math.max(parsed.end, index + "export".length);
      continue;
    }
    index += 1;
  }
  return refs;
}
function findImportMapLocalRefs(body) {
  let map;
  try {
    map = JSON.parse(body);
  } catch {
    return [];
  }
  const refs = [];
  const seen = /* @__PURE__ */ new Set();
  collectImportMapAddressRefs(map && map.imports, refs, seen);
  if (map && map.scopes && typeof map.scopes === "object" && !Array.isArray(map.scopes)) {
    for (const [scopePrefix, scopedImports] of Object.entries(map.scopes)) {
      collectImportMapScopeRef(scopePrefix, refs, seen);
      collectImportMapAddressRefs(scopedImports, refs, seen);
    }
  }
  return refs;
}
function collectImportMapAddressRefs(imports, refs, seen) {
  if (!imports || typeof imports !== "object" || Array.isArray(imports)) return;
  for (const value of Object.values(imports)) {
    if (typeof value !== "string" || !isLocalImportMapAddress(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    refs.push(value);
  }
}
function collectImportMapScopeRef(scopePrefix, refs, seen) {
  if (typeof scopePrefix !== "string" || !isLocalImportMapAddress(scopePrefix)) return;
  if (seen.has(scopePrefix)) return;
  seen.add(scopePrefix);
  refs.push(scopePrefix);
}
function isLocalImportMapAddress(ref) {
  const trimmed = String(ref || "").trim();
  if (!trimmed || isInert(trimmed)) return false;
  if (trimmed.startsWith("//") || /^https?:\/\//i.test(trimmed)) return false;
  if (isFileSchemeRef(trimmed)) return true;
  return !/^[a-z][a-z0-9+.-]*:/i.test(trimmed);
}
function parseJsImport(source, index) {
  let cursor = skipJsWhitespaceAndComments(source, index + "import".length);
  if (source[cursor] === ".") return { refs: [], end: cursor + 1 };
  if (source[cursor] === "(") {
    cursor = skipJsWhitespaceAndComments(source, cursor + 1);
    if (source[cursor] === "`") {
      const token2 = parseJsTemplateImportToken(source, cursor);
      token2.importKind = "dynamic";
      return { refs: token2.value ? [token2] : [], end: token2.end };
    }
    if (source[cursor] !== '"' && source[cursor] !== "'") return { refs: [], end: cursor + 1 };
    const token = parseJsStringToken(source, cursor);
    token.importKind = "dynamic";
    return { refs: [token], end: token.end };
  }
  if (source[cursor] === '"' || source[cursor] === "'") {
    const token = parseJsStringToken(source, cursor);
    token.importKind = "bare";
    return { refs: [token], end: token.end };
  }
  const found = findJsImportFromRef(source, cursor);
  return { refs: found.ref ? [found.ref] : [], end: found.end };
}
function parseJsExport(source, index) {
  const cursor = skipJsWhitespaceAndComments(source, index + "export".length);
  const found = findJsImportFromRef(source, cursor);
  return { refs: found.ref ? [found.ref] : [], end: found.end };
}
function findJsImportFromRef(source, index) {
  let cursor = index;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  while (cursor < source.length) {
    const skipped = skipJsIgnored(source, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }
    if (source[cursor] === "{") braceDepth += 1;
    if (source[cursor] === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (source[cursor] === "[") bracketDepth += 1;
    if (source[cursor] === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    if (source[cursor] === "(") parenDepth += 1;
    if (source[cursor] === ")") parenDepth = Math.max(0, parenDepth - 1);
    const topLevel = braceDepth === 0 && bracketDepth === 0 && parenDepth === 0;
    if (topLevel && source[cursor] === ";") return { ref: null, end: cursor + 1 };
    if (topLevel && cursor !== index && (startsJsKeyword(source, cursor, "import") || startsJsKeyword(source, cursor, "export"))) {
      return { ref: null, end: cursor };
    }
    if (topLevel && startsJsKeyword(source, cursor, "from")) {
      const refStart = skipJsWhitespaceAndComments(source, cursor + "from".length);
      if (source[refStart] === '"' || source[refStart] === "'") {
        const token = parseJsStringToken(source, refStart);
        return { ref: token, end: token.end };
      }
    }
    cursor += 1;
  }
  return { ref: null, end: cursor };
}
function isLocalModuleImport(ref) {
  const trimmed = String(ref || "").trim();
  if (!trimmed || isInert(trimmed)) return false;
  if (trimmed.startsWith("//") || /^https?:\/\//i.test(trimmed)) return false;
  return trimmed.startsWith("/") || /^\.{1,2}\//.test(trimmed);
}
function isFileSchemeJsRef(ref) {
  return /^file:/i.test(normalizeJsRefForScheme(ref));
}
function normalizeJsRefForScheme(ref) {
  return decodeJsEscapes(String(ref || "")).replace(/[\t\n\r]/g, "").trim();
}
function skipJsWhitespaceAndComments(source, index) {
  let cursor = index;
  while (cursor < source.length) {
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (source.startsWith("//", cursor)) {
      const next = source.indexOf("\n", cursor + 2);
      cursor = next === -1 ? source.length : next + 1;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      const next = source.indexOf("*/", cursor + 2);
      cursor = next === -1 ? source.length : next + 2;
      continue;
    }
    break;
  }
  return cursor;
}
function skipJsIgnored(source, index) {
  if (source.startsWith("//", index)) {
    const next = source.indexOf("\n", index + 2);
    return next === -1 ? source.length : next + 1;
  }
  if (source.startsWith("/*", index)) {
    const next = source.indexOf("*/", index + 2);
    return next === -1 ? source.length : next + 2;
  }
  if (source[index] === "/" && isLikelyJsRegexStart(source, index)) return skipJsRegex(source, index);
  if (source[index] === '"' || source[index] === "'") return parseJsString(source, index).end;
  if (source[index] === "`") return skipJsTemplate(source, index);
  return index;
}
function parseJsString(source, index) {
  const quote = source[index];
  let cursor = index + 1;
  let value = "";
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\\") {
      value += source.slice(cursor, Math.min(cursor + 2, source.length));
      cursor += 2;
      continue;
    }
    if (char === quote) return { value, end: cursor + 1 };
    value += char;
    cursor += 1;
  }
  return { value, end: source.length };
}
function parseJsStringToken(source, index) {
  const parsed = parseJsString(source, index);
  return {
    value: parsed.value,
    quote: source[index],
    rawStart: index,
    rawEnd: parsed.end,
    end: parsed.end
  };
}
function parseJsTemplateImportToken(source, index) {
  const end = skipJsTemplate(source, index);
  return {
    value: source.slice(index + 1, Math.max(index + 1, end - 1)),
    quote: "`",
    rawStart: index,
    rawEnd: end,
    end
  };
}
function skipJsTemplate(source, index) {
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === "`") return cursor + 1;
    cursor += 1;
  }
  return source.length;
}
function isLikelyJsRegexStart(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
  if (cursor < 0) return true;
  return /[([{=:;,!?&|+\-*~^<>%]/.test(source[cursor]);
}
function skipJsRegex(source, index) {
  let cursor = index + 1;
  let inClass = false;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === "[") inClass = true;
    if (source[cursor] === "]") inClass = false;
    if (source[cursor] === "/" && !inClass) {
      cursor += 1;
      while (cursor < source.length && /[a-z]/i.test(source[cursor])) cursor += 1;
      return cursor;
    }
    cursor += 1;
  }
  return source.length;
}
function startsJsKeyword(source, index, keyword) {
  if (source.slice(index, index + keyword.length) !== keyword) return false;
  const before = source[index - 1] || "";
  const after = source[index + keyword.length] || "";
  return !isJsIdentChar(before) && !isJsIdentChar(after);
}
function isJsPropertyAccessKeyword(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
  return source[cursor] === ".";
}
function isJsIdentChar(char) {
  return Boolean(char) && /[a-z0-9_$]/i.test(char);
}
function decodeJsEscapes(value) {
  const input = String(value);
  let result = "";
  let index = 0;
  while (index < input.length) {
    if (input[index] !== "\\") {
      result += input[index];
      index += 1;
      continue;
    }
    if (index + 1 >= input.length) {
      result += "\\";
      break;
    }
    const next = input[index + 1];
    if (next === "\r" && input[index + 2] === "\n") {
      index += 3;
      continue;
    }
    if (/[\n\r]/.test(next)) {
      index += 2;
      continue;
    }
    if (next === "x" && /^[\da-f]{2}$/i.test(input.slice(index + 2, index + 4))) {
      result += decodeNumericCharacterReference(Number.parseInt(input.slice(index + 2, index + 4), 16), "");
      index += 4;
      continue;
    }
    if (next === "u" && input[index + 2] === "{") {
      const close = input.indexOf("}", index + 3);
      const hex = close === -1 ? "" : input.slice(index + 3, close);
      if (/^[\da-f]+$/i.test(hex)) {
        result += decodeNumericCharacterReference(Number.parseInt(hex, 16), "");
        index = close + 1;
        continue;
      }
    }
    if (next === "u" && /^[\da-f]{4}$/i.test(input.slice(index + 2, index + 6))) {
      result += decodeNumericCharacterReference(Number.parseInt(input.slice(index + 2, index + 6), 16), "");
      index += 6;
      continue;
    }
    result += next;
    index += 2;
  }
  return result;
}
async function readBudgeted(descriptor, ref, ctx, options = {}) {
  const countBytes = options.countBytes !== false;
  const remainingBundleBytes = ctx.maxBundleBytes - ctx.inlinedBytes;
  if (remainingBundleBytes <= 0) {
    ctx.warnings.push({ kind: "too-large", ref, reason: `would exceed per-bundle cap ${ctx.maxBundleBytes}` });
    return null;
  }
  let buffer;
  try {
    buffer = toBuffer(
      await ctx.readLocalFile(descriptor.path, {
        allowOutsideRoot: Boolean(descriptor.allowOutsideRoot),
        maxAssetBytes: ctx.maxAssetBytes,
        maxBundleBytes: ctx.maxBundleBytes,
        maxBundleRemaining: remainingBundleBytes
      })
    );
  } catch (error) {
    if (error && error.code === "OUTSIDE_ROOT") {
      ctx.warnings.push({ kind: "outside-root", ref });
    } else if (error && error.code === "TOO_LARGE") {
      ctx.warnings.push({ kind: "too-large", ref, reason: error instanceof Error ? error.message : String(error) });
    } else {
      ctx.warnings.push({ kind: "load-failed", ref, reason: error instanceof Error ? error.message : String(error) });
    }
    return null;
  }
  if (buffer.length > ctx.maxAssetBytes) {
    ctx.warnings.push({
      kind: "too-large",
      ref,
      reason: `${buffer.length} bytes exceeds per-asset cap ${ctx.maxAssetBytes}`
    });
    return null;
  }
  if (countBytes && ctx.inlinedBytes + buffer.length > ctx.maxBundleBytes) {
    ctx.warnings.push({ kind: "too-large", ref, reason: `would exceed per-bundle cap ${ctx.maxBundleBytes}` });
    return null;
  }
  if (countBytes) ctx.inlinedBytes += buffer.length;
  return buffer;
}
async function guardedRead(absPath, confineDir, readOptions = {}) {
  const real = await realpath(absPath);
  if (confineDir) {
    let root;
    try {
      root = await realpath(confineDir);
    } catch {
      root = path.resolve(confineDir);
    }
    if (isOutside(root, real)) {
      throw Object.assign(new Error(`refusing to read ${absPath} outside the artifact directory`), {
        code: "OUTSIDE_ROOT"
      });
    }
  }
  const stats = await stat(real);
  if (Number.isFinite(readOptions.maxAssetBytes) && stats.size > readOptions.maxAssetBytes) {
    throw Object.assign(new Error(`${stats.size} bytes exceeds per-asset cap ${readOptions.maxAssetBytes}`), {
      code: "TOO_LARGE"
    });
  }
  if (Number.isFinite(readOptions.maxBundleRemaining) && stats.size > readOptions.maxBundleRemaining) {
    throw Object.assign(new Error(`would exceed per-bundle cap ${readOptions.maxBundleBytes}`), {
      code: "TOO_LARGE"
    });
  }
  return readFile(real);
}
function isInert(ref) {
  return !ref || ref.startsWith("#") || /^%23/i.test(ref) || /^(data|blob|about|javascript|mailto|tel):/i.test(ref);
}
function isHtmlDocumentRef(ref) {
  const locator = normalizeRefForResolution(ref, HTML_REF_OPTIONS).trim();
  const { pathPart } = splitRefSuffix(locator);
  return [".html", ".htm", ".xhtml"].includes(path.extname(decodeLocalPath(pathPart)).toLowerCase());
}
function isHtmlDocumentType(attrs) {
  const type = getDecisionAttr(attrs, "type").trim().toLowerCase().split(";")[0].trim();
  return type === "text/html" || type === "application/xhtml+xml";
}
function shouldRedactUnresolvedRef(ref, options = {}) {
  return isFileSchemeRef(ref, options);
}
function containsFileUrl(ref) {
  return /(^|[^a-z0-9+.-])file:/i.test(normalizeHtmlRefForScheme(ref));
}
function isFileSchemeRef(ref, options = {}) {
  return /^file:/i.test(normalizeRefForScheme(ref, options));
}
function replaceUnresolvedAttrRef(source, name, ref) {
  return shouldRedactUnresolvedRef(ref) ? replaceAttrValue(source, name, REDACTED_FILE_REF) : source;
}
function isInjectedLavishSdkSrc(src) {
  const value = String(src || "").trim();
  if (!value.startsWith("/sdk.js?")) return false;
  const params = new URLSearchParams(value.slice("/sdk.js?".length));
  return params.has("key");
}
function isOutside(root, target) {
  const relative = path.relative(root, target);
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}
function stripQueryAndHash(ref) {
  return ref.replace(/[?#].*$/, "");
}
function fragmentSuffix(ref) {
  const value = String(ref).trim();
  const hashIndex = value.indexOf("#");
  return hashIndex === -1 ? "" : value.slice(hashIndex);
}
function normalizeRefForResolution(ref, options = {}) {
  let value = String(ref);
  if (options.decodeHtmlEntities) value = decodeHtmlCharacterReferences(value);
  return options.cssSyntax ? decodeCssEscapes(value) : value;
}
function normalizeRefForScheme(ref, options = {}) {
  return options.cssSyntax ? normalizeCssRefForScheme(ref, options) : normalizeHtmlRefForScheme(ref);
}
function normalizeHtmlRefForScheme(ref) {
  return decodeHtmlCharacterReferences(String(ref || "")).replace(/[\t\n\r]/g, "").trim();
}
function normalizeCssRefForScheme(ref, options = {}) {
  const value = options.decodeHtmlEntities ? decodeHtmlCharacterReferences(String(ref || "")) : String(ref || "");
  return decodeCssEscapes(value).replace(/[\t\n\f\r ]/g, "").trim();
}
function decodeHtmlCharacterReferences(value) {
  return String(value).replace(
    /&(?:#(\d+);?|#x([\da-f]+);?|([a-z][a-z0-9]+);|([a-z][a-z0-9]+)(?=[^a-z0-9=]|$))/gi,
    (match, decimal, hex, named, legacyNamed) => {
      if (decimal) return decodeNumericCharacterReference(Number.parseInt(decimal, 10), match);
      if (hex) return decodeNumericCharacterReference(Number.parseInt(hex, 16), match);
      const entity = named || legacyNamed;
      return HTML_ENTITY_MAP[entity.toLowerCase()] ?? match;
    }
  );
}
function decodeCssEscapes(value) {
  const input = String(value);
  let result = "";
  let index = 0;
  while (index < input.length) {
    if (input[index] !== "\\") {
      result += input[index];
      index += 1;
      continue;
    }
    if (index + 1 >= input.length) {
      result += "\\";
      break;
    }
    const next = input[index + 1];
    if (next === "\r" && input[index + 2] === "\n") {
      index += 3;
      continue;
    }
    if (/[\n\r\f]/.test(next)) {
      index += 2;
      continue;
    }
    if (/[\da-f]/i.test(next)) {
      const escaped = readCssEscape(input, index);
      result += escaped.value;
      index = escaped.end;
      continue;
    }
    result += next;
    index += 2;
  }
  return result;
}
function decodeNumericCharacterReference(codePoint, fallback) {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 1114111) return fallback;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}
function decodeLocalPath(ref) {
  return String(ref).split("/").map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  }).join("/");
}
function pickMime(locator) {
  const ext = path.extname(stripQueryAndHash(locator)).toLowerCase();
  return EXT_MIME[ext] || "application/octet-stream";
}
function toDataUri(buffer, mime) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return Buffer.from(value);
}
function formatStartTag(tag, attrs, selfClosing) {
  if (selfClosing) return `<${tag}${String(attrs).replace(/\s+$/, "")} />`;
  return `<${tag}${attrs}>`;
}
function escapeRawText(text, tag) {
  return String(text).replace(new RegExp(`</(${tag})`, "gi"), "<\\/$1");
}
function getAttr(attrs, name) {
  const attr = findHtmlAttr(attrs, name);
  return attr && attr.hasValue ? attr.value : "";
}
function getDecisionAttr(attrs, name) {
  const value = getAttr(attrs, name);
  return value ? decodeHtmlCharacterReferences(value) : "";
}
function getTokenListAttr(attrs, name) {
  return getDecisionAttr(attrs, name).toLowerCase().split(/\s+/).filter(Boolean);
}
function hasAttr(attrs, name) {
  return Boolean(findHtmlAttr(attrs, name));
}
function replaceAttrValue(source, name, value) {
  const attr = findHtmlAttr(source, name);
  return attr ? replaceAttrTokenValue(source, attr, value) : source;
}
function replaceAttrValuePreservingEntities(source, name, value) {
  const attr = findHtmlAttr(source, name);
  return attr ? replaceAttrTokenValue(source, attr, value, { preserveEntities: true }) : source;
}
function removeAttrs(attrs, names) {
  const remove = new Set(names.map((name) => String(name).toLowerCase()));
  const parsed = parseHtmlAttrs(attrs);
  let result = "";
  let lastIndex = 0;
  for (const attr of parsed) {
    if (!remove.has(attr.name.toLowerCase())) continue;
    result += attrs.slice(lastIndex, attr.start);
    lastIndex = attr.end;
  }
  result += attrs.slice(lastIndex);
  const trimmed = result.trim();
  return trimmed ? ` ${trimmed}` : "";
}
function findHtmlAttr(attrs, name) {
  const lower = String(name).toLowerCase();
  return parseHtmlAttrs(attrs).find((attr) => attr.name.toLowerCase() === lower) || null;
}
function parseHtmlAttrs(attrs) {
  const input = String(attrs || "");
  const parsed = [];
  let index = 0;
  while (index < input.length) {
    while (index < input.length && isHtmlSpace(input[index])) index += 1;
    if (index >= input.length) break;
    if (input[index] === "/") {
      index += 1;
      continue;
    }
    if (/[<>"'=]/.test(input[index])) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < input.length && !/[\t\n\f\r />"'=]/.test(input[index])) index += 1;
    if (index === start) {
      index += 1;
      continue;
    }
    const name = input.slice(start, index);
    const nameEnd = index;
    let cursor = index;
    while (cursor < input.length && isHtmlSpace(input[cursor])) cursor += 1;
    if (input[cursor] !== "=") {
      parsed.push({
        start,
        end: nameEnd,
        name,
        nameEnd,
        hasValue: false,
        value: "",
        valueRawStart: nameEnd,
        valueRawEnd: nameEnd,
        quote: ""
      });
      index = cursor;
      continue;
    }
    cursor += 1;
    while (cursor < input.length && isHtmlSpace(input[cursor])) cursor += 1;
    const valueRawStart = cursor;
    let valueStart = cursor;
    let valueEnd;
    let valueRawEnd;
    let quote = "";
    if (input[cursor] === '"' || input[cursor] === "'") {
      quote = input[cursor];
      valueStart = cursor + 1;
      cursor += 1;
      while (cursor < input.length && input[cursor] !== quote) cursor += 1;
      valueEnd = cursor;
      valueRawEnd = cursor < input.length ? cursor + 1 : cursor;
    } else {
      while (cursor < input.length && !/[\t\n\f\r >]/.test(input[cursor])) cursor += 1;
      valueEnd = cursor;
      valueRawEnd = cursor;
    }
    parsed.push({
      start,
      end: valueRawEnd,
      name,
      nameEnd,
      hasValue: true,
      value: input.slice(valueStart, valueEnd),
      valueRawStart,
      valueRawEnd,
      quote
    });
    index = valueRawEnd;
  }
  return parsed;
}
function replaceAttrTokenValue(source, attr, value, options = {}) {
  const quote = attr.quote || '"';
  const raw = options.preserveEntities ? quoteAttrValuePreservingEntities(value, quote) : quoteAttrValue(value, quote);
  if (!attr.hasValue) {
    return `${source.slice(0, attr.nameEnd)}=${raw}${source.slice(attr.nameEnd)}`;
  }
  return `${source.slice(0, attr.valueRawStart)}${raw}${source.slice(attr.valueRawEnd)}`;
}
function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
function quoteAttrValuePreservingEntities(value, preferredQuote) {
  const text = String(value);
  if (!text.includes(preferredQuote)) return `${preferredQuote}${text}${preferredQuote}`;
  const alternateQuote = preferredQuote === '"' ? "'" : '"';
  if (!text.includes(alternateQuote)) return `${alternateQuote}${text}${alternateQuote}`;
  return `"${text.replace(/"/g, "&quot;")}"`;
}
function quoteAttrValue(value, preferredQuote) {
  const quote = preferredQuote === "'" ? "'" : '"';
  return `${quote}${escapeAttrForQuote(value, quote)}${quote}`;
}
function escapeAttrForQuote(value, quote) {
  let escaped = String(value).replace(/&/g, "&amp;");
  escaped = quote === '"' ? escaped.replace(/"/g, "&quot;") : escaped.replace(/'/g, "&#39;");
  return escaped;
}
function quoteCssString(value, quote) {
  return `${quote}${String(value).replace(/\\/g, "\\\\").replace(new RegExp(escapeRegExp(quote), "g"), `\\${quote}`).replace(/\n/g, "\\a ").replace(/\r/g, "\\d ")}${quote}`;
}
function quoteJsModuleSpecifier(value, quote) {
  if (quote === "`") {
    return `\`${String(value).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
  }
  const preferred = quote === "'" ? "'" : '"';
  return `${preferred}${String(value).replace(/\\/g, "\\\\").replace(new RegExp(escapeRegExp(preferred), "g"), `\\${preferred}`).replace(/\n/g, "\\n").replace(/\r/g, "\\r")}${preferred}`;
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function resolveBytes(optionValue, envValue, fallback) {
  if (Number.isFinite(optionValue) && optionValue > 0) return optionValue;
  const parsed = Number(envValue);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

// src/html-app.js
var DEFAULT_API_URL = "https://api.ht-ml.app";
var PUBLISH_TIMEOUT_MS = 3e4;
var SITE_ID_RE = /^[A-Za-z0-9._-]+$/;
function htmlAppApiUrl(env = process.env) {
  return String(env.LAVISH_AXI_HTML_APP_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}
function createHtmlAppPayload(html, options = {}) {
  const body = { html_content: String(html ?? "") };
  const password = optionalString(options.password);
  if (password) body.password = password;
  return body;
}
function createHtmlAppUpdatePayload(html, options = {}) {
  const body = { html_content: String(html ?? "") };
  const password = optionalString(options.password);
  if (password) body.password = password;
  return body;
}
function normalizeSiteId(value) {
  const siteId = optionalString(value);
  if (!siteId) throw new Error("a site_id is required");
  if (/^[a-z]+:\/\//i.test(siteId)) {
    throw new Error(`expected a site_id (such as abc123) rather than a URL: ${siteId}`);
  }
  if (!SITE_ID_RE.test(siteId) || /^\.+$/.test(siteId)) {
    throw new Error(`not a valid site_id: ${siteId}`);
  }
  return siteId;
}
function createUnpublishedPageHtml() {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unpublished</title><style>html{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:Canvas;color:CanvasText}p{max-width:30rem;padding:2rem;text-align:center}</style></head><body><p>This page has been unpublished. Its contents are no longer available.</p></body></html>';
}
async function publishToHtmlApp(html, options = {}) {
  const env = options.env || process.env;
  const token = optionalString(options.token ?? env.LAVISH_AXI_HTML_APP_TOKEN);
  const data = await requestHtmlApp({
    method: "POST",
    path: "/v1/sites",
    body: createHtmlAppPayload(html, options),
    bearer: token,
    options,
    env
  });
  const url = optionalString(data.url);
  const updateKey = optionalString(data.update_key);
  const siteId = echoedSiteId(data.site_id, "");
  if (!url || !updateKey) {
    const missing = [!url && "a url", !updateKey && "an update_key"].filter(Boolean).join(" or ");
    throw htmlAppIncompleteResponseError(`ht-ml.app published the page but its response did not include ${missing}`, {
      url,
      siteId,
      updateKey,
      status: String(data.status || "")
    });
  }
  return {
    url,
    site_id: siteId,
    update_key: updateKey,
    status: String(data.status || "")
  };
}
function echoedSiteId(echoed, fallback) {
  const value = optionalString(echoed);
  if (!value) return fallback;
  try {
    return normalizeSiteId(value);
  } catch {
    return fallback;
  }
}
async function updateHtmlApp(siteId, html, options = {}) {
  const env = options.env || process.env;
  const site = normalizeSiteId(siteId);
  const updateKey = optionalString(options.updateKey);
  if (!updateKey) {
    throw new Error("ht-ml.app update failed: an update_key is required to change a published page");
  }
  const data = await requestHtmlApp({
    method: "PUT",
    path: `/v1/sites/${encodeURIComponent(site)}`,
    body: createHtmlAppUpdatePayload(html, options),
    bearer: updateKey,
    options,
    env,
    action: "update"
  });
  return {
    url: optionalString(data.url) || optionalString(options.url),
    site_id: echoedSiteId(data.site_id, site),
    status: String(data.status || "")
  };
}
function hostRejectedShareWrite(error) {
  const status = error instanceof Error ? Number(
    /** @type {any} */
    error.status
  ) : Number.NaN;
  return Number.isInteger(status) && status >= 400 && status < 500;
}
function htmlAppIncompleteResponseError(message, received = {}) {
  const error = new Error(message);
  const present = Object.fromEntries(Object.entries(received).filter(([, value]) => value));
  Object.defineProperty(error, "published", { value: true, enumerable: true });
  Object.defineProperty(error, "received", { value: present, enumerable: true });
  return error;
}
function publishedDespiteError(error) {
  if (!(error instanceof Error) || /** @type {any} */
  error.published !== true) return null;
  return (
    /** @type {any} */
    error.received || {}
  );
}
function htmlAppRequestError(message, details = {}) {
  const { status, cause } = details;
  const error = new Error(message, cause ? { cause } : void 0);
  if (status !== void 0) Object.defineProperty(error, "status", { value: status, enumerable: true });
  return error;
}
async function requestHtmlApp({ method, path: path12, body, bearer, options, env, action = "publish" }) {
  const apiUrl = (options.apiUrl ? String(options.apiUrl).replace(/\/+$/, "") : "") || htmlAppApiUrl(env);
  const fetchImpl = options.fetch || fetch;
  const headers = { "content-type": "application/json", "user-agent": "lavish-axi" };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || PUBLISH_TIMEOUT_MS);
  let response;
  let text;
  try {
    response = await fetchImpl(`${apiUrl}${path12}`, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    text = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw htmlAppRequestError(`ht-ml.app ${action} timed out`, { cause: error });
    }
    throw htmlAppRequestError(`ht-ml.app ${action} failed: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error
    });
  } finally {
    clearTimeout(timeout);
  }
  const data = text ? parseJson(text) : {};
  if (!response.ok) {
    throw htmlAppRequestError(`ht-ml.app ${action} failed: ${describeError(response.status, data, text)}`, {
      status: response.status
    });
  }
  return data;
}
function describeError(status, data, text) {
  const detail = optionalString(data.detail || data.error || data.message);
  if (detail) return detail;
  if (status === 422) return "the HTML failed ht-ml.app's content safety scan";
  if (status === 401) return "unauthorized (invalid update_key, or the site is password protected)";
  if (status === 403) return "forbidden";
  return text ? text.slice(0, 200) : `HTTP ${status}`;
}
function optionalString(value) {
  return String(value ?? "").trim();
}
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

// src/local-address.js
import os2 from "node:os";

// src/paths.js
import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { isIP } from "node:net";
import os from "node:os";
import path2 from "node:path";
var LOOPBACK_HOST = "127.0.0.1";
var IPV6_LOOPBACK_HOST = "::1";
function isWildcardHost(host) {
  const value = String(host || "").trim().toLowerCase();
  const unbracketed = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  const family = isIP(unbracketed);
  if (family === 4) return unbracketed === "0.0.0.0";
  if (family !== 6) return false;
  try {
    const normalized = new URL(`http://[${unbracketed}]/`).hostname.slice(1, -1);
    return normalized === "::" || normalized === "::ffff:0:0";
  } catch {
    return false;
  }
}
function bindHost(env = process.env) {
  return env.LAVISH_AXI_HOST?.trim() || LOOPBACK_HOST;
}
function resolveListenHosts({ host, env = process.env, tailscale = null, extraHosts = [] } = {}) {
  const envHost = env.LAVISH_AXI_HOST?.trim() || "";
  const autoTailscale = !envHost;
  const requested = host || bindHost(env);
  const primary = isWildcardHost(requested) ? LOOPBACK_HOST : requested || LOOPBACK_HOST;
  const hosts = [primary, LOOPBACK_HOST];
  if (autoTailscale && tailscale?.ipv4 && tailscale.ipv4 !== primary && !isWildcardHost(tailscale.ipv4)) {
    hosts.push(tailscale.ipv4);
  }
  hosts.push(...extraHosts);
  return sanitizeListenHosts(hosts);
}
function sanitizeListenHosts(hosts) {
  const out = [];
  for (const value of hosts || []) {
    const host = String(value || "").trim();
    if (!host || isWildcardHost(host)) continue;
    if (!out.includes(host)) out.push(host);
  }
  return out.length ? out : [LOOPBACK_HOST];
}
async function resolveConcreteListenHosts(hosts, { lookup = dnsLookup, keepUnresolved = false } = {}) {
  const resolved = [];
  for (const host of hosts) {
    const addresses = await lookup(host, { all: true, verbatim: true }).catch((error) => {
      if (keepUnresolved) return [];
      throw error;
    });
    if (!Array.isArray(addresses) || addresses.length === 0) {
      if (!keepUnresolved) throw new Error(`Listen host did not resolve: ${host}`);
      if (!resolved.includes(host)) resolved.push(host);
      continue;
    }
    if (addresses.some(({ address: address2 }) => isWildcardHost(address2))) {
      throw new Error(`Listen host resolves to an all-interfaces address: ${host}`);
    }
    const address = addresses[0]?.address;
    if (!address || !isIP(address)) throw new Error(`Listen host did not resolve to an IP address: ${host}`);
    if (!resolved.includes(address)) resolved.push(address);
  }
  return resolved;
}
function resolveLinkHost({ env = process.env, tailscale = null, fallbackHost = LOOPBACK_HOST } = {}) {
  if (tailscale?.magicDnsName) return tailscale.magicDnsName;
  const explicit = env.LAVISH_AXI_LINK_HOST?.trim();
  if (explicit) return explicit;
  return isWildcardHost(fallbackHost) ? LOOPBACK_HOST : fallbackHost || LOOPBACK_HOST;
}
function clientHost(env = process.env) {
  return resolveListenHosts({ env })[0];
}
function extraAllowedHosts(env = process.env) {
  return (env.LAVISH_AXI_ALLOWED_HOSTS || "").split(/\s+/).filter(Boolean);
}
function hostForUrl(host) {
  if (host.includes(":") && !host.startsWith("[")) return `[${host}]`;
  return host;
}
function stateDir() {
  return process.env.LAVISH_AXI_STATE_DIR || path2.join(os.homedir(), ".lavish-axi");
}
function stateFile() {
  return path2.join(stateDir(), "state.json");
}
function stateId(file = stateFile()) {
  const directory = path2.dirname(path2.resolve(file));
  let canonicalDirectory;
  try {
    canonicalDirectory = realpathSync(directory);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    canonicalDirectory = directory;
  }
  return createHash("sha256").update(path2.join(canonicalDirectory, path2.basename(file))).digest("hex").slice(0, 16);
}
function serverLogFile() {
  return path2.join(stateDir(), "server.log");
}
async function ensureStateDir() {
  await mkdir(stateDir(), { recursive: true });
}
function defaultPort() {
  return Number(process.env.LAVISH_AXI_PORT || 4387);
}

// src/local-address.js
function localInterfaceAddresses(interfaces = safeNetworkInterfaces()) {
  const addresses = [];
  for (const entries of Object.values(interfaces || {})) {
    for (const entry of entries || []) {
      const address = typeof entry?.address === "string" ? entry.address : "";
      if (!address || isWildcardHost(address)) continue;
      const family = entry.family === 4 ? "IPv4" : entry.family === 6 ? "IPv6" : entry.family;
      if (family !== "IPv4" && family !== "IPv6") continue;
      if (family === "IPv6" && /^fe[89ab]/i.test(address)) continue;
      if (!addresses.includes(address)) addresses.push(address);
    }
  }
  return addresses;
}
function safeNetworkInterfaces() {
  try {
    return os2.networkInterfaces();
  } catch {
    return {};
  }
}

// src/plugin.js
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { createRequire } from "node:module";
import os3 from "node:os";
import path3 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var crossSpawn = createRequire(import.meta.url)("cross-spawn");
var PLUGIN_AUTHOR = Object.freeze({ name: "Kun Chen", url: "https://github.com/kunchenguid" });
function spawnPluginClientSync(command, args) {
  return crossSpawn.sync(command, args, { encoding: "utf8" });
}
function resolvePluginRoot() {
  return path3.resolve(fileURLToPath2(new URL("../", import.meta.url)));
}
function readPluginManifest(root) {
  try {
    return JSON.parse(readFileSync(path3.join(root, "plugin.json"), "utf8"));
  } catch {
    return null;
  }
}
function isStalePluginLocation(candidate, pluginName) {
  const manifest = readPluginManifest(candidate);
  if (manifest) return manifest.name === pluginName;
  return !existsSync(candidate) && path3.basename(candidate) === pluginName;
}
function computeVsCodePluginLocationsUpdate(settings, pluginRoot, pluginName) {
  const updated = structuredClone(settings && typeof settings === "object" ? settings : {});
  const existing = updated["chat.pluginLocations"];
  const locations = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  let changed = false;
  for (const key of Object.keys(locations)) {
    if (key !== pluginRoot && isStalePluginLocation(key, pluginName)) {
      delete locations[key];
      changed = true;
    }
  }
  if (locations[pluginRoot] !== true) {
    locations[pluginRoot] = true;
    changed = true;
  }
  updated["chat.pluginLocations"] = locations;
  return [updated, changed];
}
function resolveVsCodeSettingsFile(env = process.env, homeDir = os3.homedir(), platform = process.platform) {
  const platformPath = platform === "win32" ? path3.win32 : path3.posix;
  if (platform === "win32") {
    return platformPath.join(
      env.APPDATA || platformPath.join(homeDir, "AppData", "Roaming"),
      "Code",
      "User",
      "settings.json"
    );
  }
  if (platform === "darwin") {
    return platformPath.join(homeDir, "Library", "Application Support", "Code", "User", "settings.json");
  }
  return platformPath.join(
    env.XDG_CONFIG_HOME || platformPath.join(homeDir, ".config"),
    "Code",
    "User",
    "settings.json"
  );
}
function resolveCursorLocalPluginsDir(homeDir = os3.homedir()) {
  return path3.join(homeDir, ".cursor", "plugins", "local");
}
function writeTextFileAtomically(file, content, operations = {}) {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const write = operations.writeFileSync || writeFileSync;
  const rename3 = operations.renameSync || renameSync;
  const remove = operations.rmSync || rmSync;
  const chmod2 = operations.chmodSync || chmodSync;
  const stat6 = operations.statSync || statSync;
  let mode;
  try {
    mode = stat6(file).mode & 511;
  } catch {
  }
  try {
    write(temporary, content, mode === void 0 ? "utf8" : { encoding: "utf8", mode });
    if (mode !== void 0) chmod2(temporary, mode);
    rename3(temporary, file);
  } catch (error) {
    try {
      remove(temporary, { force: true });
    } catch {
    }
    throw error;
  }
}
function createDirectoryLink(createSymlink, pluginRoot, linkPath, platform) {
  if (platform === "win32") {
    try {
      createSymlink(pluginRoot, linkPath, "junction");
      return;
    } catch {
    }
  }
  createSymlink(pluginRoot, linkPath);
}
function linkCursorLocalPlugin(localPluginsDir, pluginRoot, pluginName, operations = {}) {
  const target = path3.join(localPluginsDir, pluginName);
  const platform = operations.platform || process.platform;
  const createSymlink = (linkTarget, linkPath) => createDirectoryLink(operations.symlinkSync || symlinkSync, linkTarget, linkPath, platform);
  const rename3 = operations.renameSync || renameSync;
  const remove = operations.rmSync || rmSync;
  let existing = null;
  try {
    existing = lstatSync(target);
  } catch {
  }
  if (existing && !existing.isSymbolicLink()) {
    return { status: "occupied", target };
  }
  if (existing) {
    if (path3.resolve(readlinkSync(target)) === pluginRoot) return { status: "current", target };
    mkdirSync(localPluginsDir, { recursive: true });
    const replacement = `${target}.${process.pid}.${randomUUID()}.tmp`;
    const previous = `${target}.${process.pid}.${randomUUID()}.old`;
    let movedPrevious = false;
    try {
      createSymlink(pluginRoot, replacement);
      if (platform === "win32") {
        rename3(target, previous);
        movedPrevious = true;
      }
      rename3(replacement, target);
      if (movedPrevious) remove(previous, { force: true });
    } catch (error) {
      try {
        remove(replacement, { force: true });
        if (movedPrevious) rename3(previous, target);
      } catch {
      }
      return { status: "unsupported", target, reason: linkFailureReason(error) };
    }
    return { status: "repaired", target };
  }
  mkdirSync(localPluginsDir, { recursive: true });
  try {
    createSymlink(pluginRoot, target);
  } catch (error) {
    return { status: "unsupported", target, reason: linkFailureReason(error) };
  }
  return { status: "linked", target };
}
function linkFailureReason(error) {
  const message = String(error instanceof Error ? error.message : error).split("\n")[0];
  return message || "link creation failed";
}

// src/self-paint.js
var ROOT_TAG_RE = /<(?:html|body)\b([^>]*)>/gi;
var STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
var CSS_RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
var ROOT_SELECTOR_TOKEN_RE = /(^|[\s,>~+])(html|body|:root|\*)(?![\w-])/i;
var SELF_PAINT_WARNING = "This artifact never paints its own page surface: no background on html/body/:root, no bg-* class or data-theme on html/body, and no stylesheet that could set one. Lavish injects no design system, so text that assumes a dark or light host surface can render invisible. Set an explicit background and readable text.";
function analyzeSelfPaint(html) {
  const source = typeof html === "string" ? html : "";
  if (/<link\b[^>]*\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(source)) {
    return { painted: true, signal: "stylesheet-link" };
  }
  if (/<script\b[^>]*\bsrc\s*=\s*["']?[^"'>]*tailwind/i.test(source)) {
    return { painted: true, signal: "tailwind-runtime" };
  }
  if (/<meta\b[^>]*\bname\s*=\s*["']?color-scheme/i.test(source)) {
    return { painted: true, signal: "color-scheme" };
  }
  for (const [, attrs] of source.matchAll(ROOT_TAG_RE)) {
    if (/\bdata-theme\s*=/i.test(attrs)) return { painted: true, signal: "data-theme" };
    const className = attrValue(attrs, "class");
    if (className && /(^|[^\w-])bg-/i.test(className)) return { painted: true, signal: "background-class" };
    const style = attrValue(attrs, "style");
    if (style && /background/i.test(style)) return { painted: true, signal: "inline-background" };
    if (style && /color-scheme\s*:/i.test(style)) return { painted: true, signal: "color-scheme" };
  }
  for (const [, css] of source.matchAll(STYLE_BLOCK_RE)) {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    if (/@import\b/i.test(stripped)) return { painted: true, signal: "css-import" };
    if (/color-scheme\s*:/i.test(stripped)) return { painted: true, signal: "color-scheme" };
    for (const [, selector, declarations] of stripped.matchAll(CSS_RULE_RE)) {
      if (!/background/i.test(declarations)) continue;
      if (ROOT_SELECTOR_TOKEN_RE.test(selector)) return { painted: true, signal: "root-background-rule" };
    }
  }
  return { painted: false, signal: null };
}
function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

// src/server.js
import crypto6 from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync as existsSync2 } from "node:fs";
import { readFile as readFile6, realpath as realpath4 } from "node:fs/promises";
import { createServer, get as httpGet } from "node:http";
import { isIP as isIP3 } from "node:net";
import { homedir } from "node:os";
import path10 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import chokidar from "chokidar";
import express from "express";

// src/artifact-revisions.js
var artifact_revisions_exports = {};
__export(artifact_revisions_exports, {
  collectRevisionMarks: () => collectRevisionMarks,
  exactRevisionText: () => exactRevisionText,
  isAddressableRevisionId: () => isAddressableRevisionId,
  isUniqueElementId: () => isUniqueElementId,
  normalizeRevisionEntry: () => normalizeRevisionEntry,
  parseRevisionRegistry: () => parseRevisionRegistry,
  readArtifactRevisions: () => readArtifactRevisions,
  revisionLimits: () => revisionLimits,
  revisionPalette: () => revisionPalette,
  revisionPresentationForIndex: () => revisionPresentationForIndex,
  revisionSelectorFor: () => revisionSelectorFor,
  truncateRevisionText: () => truncateRevisionText
});
function revisionPalette() {
  return [
    { hex: "#0072b2", borderStyle: "solid", pattern: "none" },
    { hex: "#d55e00", borderStyle: "dashed", pattern: "diagonal" },
    { hex: "#009e73", borderStyle: "dotted", pattern: "none" },
    { hex: "#cc79a7", borderStyle: "double", pattern: "dots" },
    { hex: "#56b4e9", borderStyle: "dashed", pattern: "none" },
    { hex: "#e69f00", borderStyle: "solid", pattern: "diagonal" }
  ];
}
function revisionPresentationForIndex(index) {
  const palette = revisionPalette();
  const position = Number.isInteger(index) && index >= 0 ? index % palette.length : 0;
  return palette[position];
}
function revisionLimits() {
  return {
    // One row per palette entry, derived rather than written down: a cap larger
    // than the palette would hand the seventh revision the first one's colour
    // *and* its border and pattern, which is precisely the case the palette
    // exists to prevent.
    entries: revisionPalette().length,
    rawEntries: 256,
    marks: 200,
    rawMarks: 2e3,
    registryBytes: 64 * 1024,
    id: 60,
    label: 80,
    summary: 400,
    timestamp: 40,
    excerpt: 120,
    selector: 400,
    selectorDepth: 32
  };
}
function truncateRevisionText(value, max) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).trim();
  const limit = Number.isInteger(max) && max > 0 ? max : 0;
  if (!limit || text.length <= limit) return text;
  return text.slice(0, limit);
}
function isAddressableRevisionId(id) {
  const text = typeof id === "string" || typeof id === "number" ? String(id) : "";
  return text.length > 0 && text === text.trim() && !/\s/.test(text);
}
function exactRevisionText(value, max) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text.length > 0 && text.length <= max ? text : "";
}
function normalizeRevisionEntry(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const limits = revisionLimits();
  const id = exactRevisionText(entry.id, limits.id);
  if (!isAddressableRevisionId(id)) return null;
  return {
    id,
    index: Number.isInteger(index) && index >= 0 ? index : 0,
    label: truncateRevisionText(entry.label, limits.label) || id,
    timestamp: truncateRevisionText(entry.timestamp, limits.timestamp),
    summary: truncateRevisionText(entry.summary, limits.summary),
    mark_count: 0
  };
}
function parseRevisionRegistry(doc) {
  const script = doc && doc.querySelector ? doc.querySelector("script[data-lavish-revisions]") : null;
  if (!script) return [];
  const limits = revisionLimits();
  const text = String(script.textContent || "").trim();
  if (!text || text.length > limits.registryBytes) return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const revisions = [];
  const seen = /* @__PURE__ */ new Set();
  let examined = 0;
  for (const raw of parsed) {
    if (examined >= limits.rawEntries || revisions.length >= limits.entries) break;
    examined += 1;
    const entry = normalizeRevisionEntry(raw, revisions.length);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    revisions.push(entry);
  }
  return revisions;
}
function isUniqueElementId(doc, id) {
  if (!doc || typeof doc.querySelectorAll !== "function") return false;
  try {
    const found = doc.querySelectorAll(`#${id}`);
    return Boolean(found) && found.length === 1;
  } catch {
    return false;
  }
}
function revisionSelectorFor(element, doc) {
  const limits = revisionLimits();
  const parts = [];
  let node = element;
  let depth = 0;
  while (node && node.nodeType === 1) {
    if (depth >= limits.selectorDepth) return "";
    const tag = String(node.tagName || "").toLowerCase();
    if (!tag) return "";
    const id = node.getAttribute ? String(node.getAttribute("id") || "").trim() : "";
    if (id && /^[A-Za-z][-\w]*$/.test(id) && isUniqueElementId(doc, id)) {
      parts.unshift(`#${id}`);
      return parts.join(" > ");
    }
    const parent2 = node.parentElement;
    let part = tag;
    if (parent2 && parent2.children) {
      const siblings = [];
      for (const child of parent2.children) {
        if (String(child.tagName || "").toLowerCase() === tag) siblings.push(child);
      }
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent2;
    depth += 1;
  }
  return parts[0] === "html" ? parts.join(" > ") : "";
}
function collectRevisionMarks(doc, revisions) {
  const limits = revisionLimits();
  const declared = /* @__PURE__ */ new Map();
  for (const revision of Array.isArray(revisions) ? revisions : []) {
    if (revision && isAddressableRevisionId(revision.id)) declared.set(revision.id, revision);
  }
  const marks = [];
  const elements = doc && doc.querySelectorAll ? doc.querySelectorAll("[data-lavish-revision]") : [];
  let examined = 0;
  for (const element of elements) {
    if (examined >= limits.rawMarks || marks.length >= limits.marks) break;
    examined += 1;
    const id = element.getAttribute ? exactRevisionText(element.getAttribute("data-lavish-revision"), limits.id) : "";
    if (!declared.has(id)) continue;
    const selector = exactRevisionText(revisionSelectorFor(element, doc), limits.selector);
    if (!selector) continue;
    declared.get(id).mark_count += 1;
    marks.push({
      revision_id: id,
      selector,
      tag: String(element.tagName || "").toLowerCase(),
      excerpt: truncateRevisionText(String(element.textContent || "").replace(/\s+/g, " "), limits.excerpt)
    });
  }
  return marks;
}
function readArtifactRevisions(doc) {
  const revisions = parseRevisionRegistry(doc);
  const marks = collectRevisionMarks(doc, revisions);
  return { revisions, marks };
}

// src/mermaid-node.js
var mermaid_node_exports = {};
__export(mermaid_node_exports, {
  isMermaidSvg: () => isMermaidSvg,
  mermaidNodeElement: () => mermaidNodeElement,
  mermaidNodeFrom: () => mermaidNodeFrom,
  normalizeMermaidNodeTarget: () => normalizeMermaidNodeTarget,
  readNodeLabel: () => readNodeLabel
});
function isMermaidSvg(svg) {
  if (!svg) return false;
  const id = svg.id || "";
  if (id.startsWith("mermaid-") || id.startsWith("mermaid_")) return true;
  if (svg.getAttribute?.("aria-roledescription")) return true;
  return !!(svg.closest && svg.closest(".mermaid, [data-lavish-mermaid]"));
}
function readNodeLabel(labelEl) {
  if (!labelEl) return "";
  let source = labelEl;
  if (labelEl.querySelector?.("br") && labelEl.cloneNode) {
    source = labelEl.cloneNode(true);
    for (const br of source.querySelectorAll("br")) br.replaceWith(document.createTextNode(" "));
  }
  return (source.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
}
function mermaidNodeElement(el) {
  if (!el || !el.closest) return null;
  const node = el.closest("g.node, g.nodes > g");
  if (!node) return null;
  const svg = node.closest("svg");
  return svg && isMermaidSvg(svg) ? node : null;
}
function mermaidNodeFrom(el, selector) {
  const node = mermaidNodeElement(el);
  if (!node) return null;
  const svg = node.closest("svg");
  const labelEl = node.querySelector(".nodeLabel, .label, foreignObject span, text");
  return {
    type: "mermaid-node",
    diagramId: svg.id || "",
    nodeId: node.id || "",
    label: readNodeLabel(labelEl),
    selector: typeof selector === "function" ? selector(node) : ""
  };
}
function normalizeMermaidNodeTarget(target) {
  return {
    type: "mermaid-node",
    diagramId: String(target.diagramId || ""),
    nodeId: String(target.nodeId || ""),
    label: String(target.label || ""),
    selector: String(target.selector || "")
  };
}

// src/table-cell.js
var table_cell_exports = {};
__export(table_cell_exports, {
  tableCellSpansRows: () => tableCellSpansRows,
  tableCellTarget: () => tableCellTarget,
  tableColumnLabel: () => tableColumnLabel,
  tableColumnSpan: () => tableColumnSpan,
  tableHeaderRow: () => tableHeaderRow,
  tableRowCells: () => tableRowCells,
  tableRowGroup: () => tableRowGroup,
  tableRowIsShifted: () => tableRowIsShifted,
  tableRowsIn: () => tableRowsIn,
  tableSpanValue: () => tableSpanValue,
  tableTagName: () => tableTagName,
  tableText: () => tableText
});
function tableTagName(element) {
  return String(element?.tagName || element?.nodeName || "").toLowerCase();
}
function tableText(element) {
  return String(element?.innerText || element?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 240);
}
function tableRowsIn(element) {
  const rows = [];
  for (const child of Array.from(element?.children || [])) {
    const tag = tableTagName(child);
    if (tag === "td" || tag === "th" || tag === "table") continue;
    if (tag === "tr") rows.push(child);
    else rows.push(...tableRowsIn(child));
  }
  return rows;
}
function tableRowCells(row) {
  return Array.from(row?.children || []).filter((cell) => {
    const tag = tableTagName(cell);
    return tag === "td" || tag === "th";
  });
}
function tableSpanValue(cell, name, parsed) {
  if (typeof parsed === "number" && Number.isInteger(parsed) && parsed >= 0) return parsed;
  const digits = /^[\t\n\f\r ]*(\d+)/.exec(String(cell?.getAttribute?.(name) ?? ""));
  return digits ? Number(digits[1]) : null;
}
function tableColumnSpan(cell) {
  const span = tableSpanValue(cell, "colspan", cell?.colSpan);
  return span !== null && span >= 1 ? span : 1;
}
function tableCellSpansRows(cell, rowDistance = 1) {
  const span = tableSpanValue(cell, "rowspan", cell?.rowSpan);
  const renderedSpan = span === null || span < 0 ? 1 : span;
  return renderedSpan === 0 || renderedSpan > rowDistance;
}
function tableRowGroup(table, row) {
  let ancestor = row?.parentElement || null;
  while (ancestor && ancestor !== table) {
    const tag = tableTagName(ancestor);
    if (tag === "thead" || tag === "tbody" || tag === "tfoot") return ancestor;
    ancestor = ancestor.parentElement;
  }
  return table;
}
function tableRowIsShifted(table, row) {
  if (!table || !row) return true;
  const rows = tableRowsIn(tableRowGroup(table, row));
  const index = rows.indexOf(row);
  if (index < 0) return true;
  for (let i = 0; i < index; i += 1) {
    for (const cell of tableRowCells(rows[i])) {
      if (tableCellSpansRows(cell, index - i)) return true;
    }
  }
  return false;
}
function tableHeaderRow(table) {
  const head = Array.from(table?.children || []).find((child) => tableTagName(child) === "thead");
  if (head) return tableRowsIn(head).at(-1) || null;
  const first = tableRowsIn(table)[0];
  const cells = tableRowCells(first);
  return cells.length > 0 && cells.every((cell) => tableTagName(cell) === "th") ? first : null;
}
function tableColumnLabel(headerRow, cells, index) {
  if (!headerRow) return "";
  const headerCells = tableRowCells(headerRow);
  const width = (cell) => tableColumnSpan(cell);
  const headerWidth = headerCells.reduce((sum, cell) => sum + width(cell), 0);
  const rowWidth = cells.reduce((sum, cell) => sum + width(cell), 0);
  if (headerWidth === 0 || headerWidth !== rowWidth) return "";
  let start = 0;
  for (let i = 0; i < index; i += 1) start += width(cells[i]);
  const end = start + width(cells[index]);
  let cursor = 0;
  for (const header of headerCells) {
    const next = cursor + width(header);
    if (cursor === start && next === end) return tableText(header);
    if (start < next) return "";
    cursor = next;
  }
  return "";
}
function tableCellTarget(element, selectorFor = (_element) => "") {
  const cell = element?.closest?.("td,th");
  const row = cell?.closest?.("tr");
  const table = row?.closest?.("table");
  if (!cell || !row || !table) return null;
  const cells = tableRowCells(row);
  const index = cells.indexOf(cell);
  if (index < 0) return null;
  const headerRow = tableHeaderRow(table);
  const shifted = tableRowIsShifted(table, row);
  const gridShifted = shifted || (headerRow ? tableRowIsShifted(table, headerRow) : false);
  const declaredHeading = cells.find(
    (candidate) => tableTagName(candidate) === "th" && String(candidate.getAttribute?.("scope") || "").toLowerCase() === "row"
  );
  const allHeaderCells = cells.every((candidate) => tableTagName(candidate) === "th");
  const inHeaderSection = headerRow === row || Boolean(cell.closest?.("thead"));
  const rowHeading = inHeaderSection ? null : declaredHeading || (allHeaderCells || shifted ? null : cells[0]);
  return {
    type: "table-cell",
    selector: String(selectorFor(cell) || "").slice(0, 240),
    rowLabel: tableText(rowHeading),
    columnLabel: gridShifted ? "" : tableColumnLabel(headerRow, cells, index),
    text: tableText(cell)
  };
}

// src/artifact-sdk.js
var MODE_TOGGLE_HOTKEY_KEY = "i";
function isModeToggleHotkeyEvent(event) {
  if (event.shiftKey || event.altKey) return false;
  return Boolean(event.metaKey || event.ctrlKey) && String(event.key || "").toLowerCase() === MODE_TOGGLE_HOTKEY_KEY;
}
function deriveLavishQueueKey(element, options = {}) {
  function stringValue(value) {
    return value === null || value === void 0 ? "" : String(value);
  }
  function attributeValue(el, name) {
    if (!el) return "";
    if (el.getAttribute) {
      const value = el.getAttribute(name);
      if (value !== null && value !== void 0) return value;
    }
    return el[name] || "";
  }
  function tagName(el) {
    return stringValue(el?.tagName || el?.nodeName).toLowerCase();
  }
  function closestElementMatching(el, selector) {
    return el && el.closest ? el.closest(selector) : null;
  }
  function elementPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let part = tagName(node) || "element";
      const id = stringValue(attributeValue(node, "id") || node.id).trim();
      if (id) {
        part += `#${id}`;
        parts.unshift(part);
        break;
      }
      const parent2 = node.parentElement;
      if (parent2 && parent2.children) {
        const siblings = [...parent2.children].filter((child) => tagName(child) === tagName(node));
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent2;
    }
    return parts.join(" > ");
  }
  function scopeKey(el) {
    const scope2 = closestElementMatching(el, "form,fieldset") || el?.parentElement || el;
    const tag2 = tagName(scope2) || "scope";
    const explicit = stringValue(
      attributeValue(scope2, "data-lavish-question") || attributeValue(scope2, "id") || attributeValue(scope2, "name")
    ).trim();
    if (explicit) return `${tag2}:${explicit}`;
    return elementPath(scope2) || tag2;
  }
  function controlIdentity(el) {
    const identity = stringValue(attributeValue(el, "name") || attributeValue(el, "id") || el?.name).trim();
    if (identity) return identity;
    return elementPath(el);
  }
  function isKeyedInputType(type2) {
    return !(/* @__PURE__ */ new Set(["button", "submit", "reset", "file", "image", "hidden", "radio", "checkbox"])).has(type2);
  }
  if (Object.hasOwn(options, "queueKey")) {
    return stringValue(options.queueKey).trim();
  }
  const question = closestElementMatching(element, "[data-lavish-question]");
  const questionKey = stringValue(attributeValue(question, "data-lavish-question")).trim();
  if (questionKey) return `question:${questionKey}`;
  const tag = tagName(element);
  const type = stringValue(attributeValue(element, "type") || element?.type).toLowerCase();
  const scope = scopeKey(element);
  if (tag === "input" && type === "radio") {
    const name = stringValue(attributeValue(element, "name") || element?.name).trim();
    if (name) return `radio:${scope}:${name}`;
    return "";
  }
  if (tag === "input" && type === "checkbox") {
    const identity = controlIdentity(element);
    const explicitValue = stringValue(element?.getAttribute ? element.getAttribute("value") : "").trim();
    const option = explicitValue || stringValue(attributeValue(element, "id") || elementPath(element)).trim();
    if (identity) return `checkbox:${scope}:${identity}:${option}`;
    return "";
  }
  if (tag === "select" || tag === "textarea" || tag === "input" && isKeyedInputType(type)) {
    const identity = controlIdentity(element);
    if (identity) return `field:${scope}:${identity}`;
  }
  return "";
}
function isNativeInteractiveControl(el) {
  if (!el || !el.closest) return false;
  if (el.closest(
    "button,input,select,textarea,option,optgroup,label,summary,[contenteditable]:not([contenteditable='false'])"
  )) {
    return true;
  }
  const widget = el.closest(
    "[role='button'],[role='checkbox'],[role='combobox'],[role='menuitem'],[role='menuitemcheckbox'],[role='menuitemradio'],[role='option'],[role='radio'],[role='switch'],[role='tab'],[role='treeitem']"
  );
  if (!widget) return false;
  const link = el.closest("a[href]");
  return !(link && widget.contains(link));
}
function classifySevereTextOverflow({
  fragments,
  box,
  overflowX,
  overflowY,
  isTruncated = false,
  isVisuallyHidden = false,
  minOutsideRatio = 0.2,
  epsilon = 1
}) {
  function overflowOf(fragment, boundary, axis) {
    const start = Number(axis === "horizontal" ? fragment.left : fragment.top);
    const end = Number(axis === "horizontal" ? fragment.right : fragment.bottom);
    const boxStart = Number(axis === "horizontal" ? boundary.left : boundary.top);
    const boxEnd = Number(axis === "horizontal" ? boundary.right : boundary.bottom);
    const explicitSize = Number(axis === "horizontal" ? fragment.width : fragment.height);
    const size = Number.isFinite(explicitSize) ? Math.max(0, explicitSize) : Math.max(0, end - start);
    if (![start, end, boxStart, boxEnd, size].every(Number.isFinite) || size <= 0) {
      return { overflowPx: 0, outsideRatio: 0, centerOutside: false };
    }
    const before = Math.max(0, boxStart - start);
    const after = Math.max(0, end - boxEnd);
    const center = start + size / 2;
    return {
      overflowPx: Math.max(before, after),
      outsideRatio: Math.min(1, (before + after) / size),
      centerOutside: center < boxStart || center > boxEnd
    };
  }
  if (isTruncated || isVisuallyHidden || !box || !Array.isArray(fragments) || fragments.length === 0) return null;
  const clipsX = overflowX === "hidden" || overflowX === "clip";
  const clipsY = overflowY === "hidden" || overflowY === "clip";
  const spillsY = overflowY === "visible";
  const scrollsX = overflowX === "auto" || overflowX === "scroll";
  const scrollsY = overflowY === "auto" || overflowY === "scroll";
  let strongest = null;
  for (const fragment of fragments) {
    const horizontal = overflowOf(fragment, box, "horizontal");
    const vertical = overflowOf(fragment, box, "vertical");
    const severeX = clipsX && !scrollsX && horizontal.overflowPx > epsilon && (horizontal.centerOutside || horizontal.outsideRatio >= minOutsideRatio);
    const severeY = (clipsY || spillsY) && !scrollsY && vertical.overflowPx > epsilon && vertical.centerOutside;
    const candidates = [
      severeX ? { axis: "horizontal", kind: "clipped-text", overflowPx: horizontal.overflowPx } : null,
      severeY ? { axis: "vertical", kind: "clipped-text", overflowPx: vertical.overflowPx } : null
    ];
    for (const candidate of candidates) {
      if (candidate && (!strongest || candidate.overflowPx > strongest.overflowPx)) strongest = candidate;
    }
  }
  return strongest;
}
function classifyMaterialRectEscape({
  rect,
  boundary,
  axes = ["horizontal", "vertical"],
  minOutsidePx = 4,
  minOutsideRatio = 0.2
}) {
  let strongest = null;
  for (const axis of axes) {
    const start = Number(axis === "horizontal" ? rect?.left : rect?.top);
    const end = Number(axis === "horizontal" ? rect?.right : rect?.bottom);
    const boundaryStart = Number(axis === "horizontal" ? boundary?.left : boundary?.top);
    const boundaryEnd = Number(axis === "horizontal" ? boundary?.right : boundary?.bottom);
    const explicitSize = Number(axis === "horizontal" ? rect?.width : rect?.height);
    const size = Number.isFinite(explicitSize) ? Math.max(0, explicitSize) : Math.max(0, end - start);
    if (![start, end, boundaryStart, boundaryEnd, size].every(Number.isFinite) || size <= 0) continue;
    const before = Math.max(0, boundaryStart - start);
    const after = Math.max(0, end - boundaryEnd);
    const outsidePx = Math.max(before, after);
    const outsideRatio = Math.min(1, (before + after) / size);
    const center = start + size / 2;
    const centerOutside = center < boundaryStart || center > boundaryEnd;
    if (outsidePx < minOutsidePx || !centerOutside && outsideRatio < minOutsideRatio) continue;
    const candidate = {
      axis,
      side: before >= after ? "start" : "end",
      overflowPx: outsidePx
    };
    if (!strongest || candidate.overflowPx > strongest.overflowPx) strongest = candidate;
  }
  return strongest;
}
function isMaterialPageOverflow({ overflowPx, viewportWidth, hasEscapedContent }) {
  const overflow = Number(overflowPx);
  const width = Number(viewportWidth);
  const materialThreshold = Math.max(24, Number.isFinite(width) ? width * 0.05 : 24);
  return Boolean(hasEscapedContent) && Number.isFinite(overflow) && overflow >= materialThreshold;
}
function findStableLayoutFindings(first, second) {
  const key = (finding) => `${finding.kind}:${finding.selector}:${finding.axis || ""}`;
  const firstKeys = new Set(
    (Array.isArray(first) ? first : []).filter((finding) => finding?.severity === "error").map(key)
  );
  return (Array.isArray(second) ? second : []).filter(
    (finding) => finding?.severity === "error" && firstKeys.has(key(finding))
  );
}
function isNearTotalOcclusion({ occludedSamples, totalSamples, minSamples = 5, minRatio = 0.9 }) {
  const occluded = Number(occludedSamples);
  const total = Number(totalSamples);
  return Number.isFinite(occluded) && Number.isFinite(total) && total >= minSamples && occluded / total >= minRatio;
}
function attachmentSizeError(size, maxBytes) {
  const cap = Number(maxBytes);
  if (!Number.isFinite(cap) || cap <= 0) return "";
  const n = Number(size);
  if (!Number.isFinite(n) || n <= cap) return "";
  const limit = cap >= 1024 * 1024 ? Math.round(cap / (1024 * 1024)) + " MB" : Math.round(cap / 1024) + " KB";
  return "Image is larger than the " + limit + " limit";
}
function classifyAttachmentBatch(files, options = {}) {
  const { currentCount = 0, maxCount = Infinity, maxBytes = 0, accepted = {} } = options;
  const decisions = [];
  let count = currentCount;
  for (const file of Array.from(files || [])) {
    if (!file || !accepted[file.type]) {
      decisions.push({ kind: "skip" });
      continue;
    }
    const error = attachmentSizeError(file.size, maxBytes);
    if (error) {
      decisions.push({ kind: "error", error });
      continue;
    }
    if (count >= maxCount) {
      decisions.push({ kind: "cap" });
      continue;
    }
    count += 1;
    decisions.push({ kind: "accept", file });
  }
  return decisions;
}
function partitionDroppedFiles(dataTransfer, acceptedMime) {
  const accepted = acceptedMime || {};
  const images = [];
  const unsupported = [];
  if (!dataTransfer) return { images, unsupported };
  const files = Array.from(dataTransfer.files || []).filter(Boolean);
  for (const file of files) {
    if (accepted[file.type]) images.push(file);
    else unsupported.push(file.name || "file");
  }
  if (!files.length) {
    for (const item of Array.from(dataTransfer.items || [])) {
      if (!item || item.kind !== "file") continue;
      if (accepted[item.type]) {
        const file = item.getAsFile();
        if (file) images.push(file);
      } else {
        unsupported.push("file");
      }
    }
  }
  return { images, unsupported };
}
function acceptedImageTypes(list) {
  const named = (Array.isArray(list) ? list : []).map(String).filter(Boolean);
  const mimes = named.length ? named : ["image/png", "image/jpeg", "image/webp"];
  const accepted = {};
  for (const mime of mimes) accepted[mime] = true;
  return { mimes, accepted, accept: mimes.join(",") };
}
function planClipboardPaste(clipboardData, acceptedMime) {
  const { images } = partitionDroppedFiles(clipboardData, acceptedMime);
  const text = clipboardData && clipboardData.getData ? clipboardData.getData("text/plain") : "";
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const names = images.map((file) => String(file && file.name || "")).filter(Boolean);
  const keepTextPaste = lines.length > 0 && !(names.length > 0 && lines.every(
    (line) => names.some((name) => line === name || line.endsWith("/" + name) || line.endsWith("\\" + name))
  ));
  return { images, keepTextPaste };
}
function isTrustedAttachmentResult(event, context = {}) {
  if (!event || !context.parentWindow || event.source !== context.parentWindow) return false;
  const expected = context.nonce;
  if (typeof expected !== "string" || !expected) return false;
  const actual = (event.data || {}).nonce;
  return typeof actual === "string" && actual === expected;
}
function deriveAttachmentNoticeState(state = {}) {
  const itemCount = Number(state.itemCount) || 0;
  const maxCount = Number(state.maxCount) || 0;
  if (state.queueBlocked && state.hasPending) return "Waiting for an image to finish uploading\u2026";
  if (state.queueBlocked && state.hasErrors) return "An image couldn't be attached. Retry or remove it before queuing.";
  if (state.capRejected && maxCount > 0 && itemCount >= maxCount)
    return "You can attach up to " + maxCount + " image" + (maxCount === 1 ? "" : "s") + ".";
  return "";
}
function createArtifactSdk(deriveQueueKey, isNativeInteractive = isNativeInteractiveControl, mermaid = mermaid_node_exports, artifactRevision = 0, artifactLoadToken = "", sessionKey2 = "", options = {}) {
  const { isMermaidSvg: isMermaidSvg2, mermaidNodeFrom: mermaidNodeFrom2, mermaidNodeElement: mermaidNodeElement2 } = mermaid;
  function postArtifactMessage(type, payload = {}) {
    parent.postMessage({ type, ...payload, artifact_load_token: String(artifactLoadToken || "") }, "*");
  }
  const initialAnnotationMode = document.documentElement.getAttribute("data-lavish-annotate") !== "off";
  let annotationMode = initialAnnotationMode;
  let hovered = null;
  let selected = null;
  let ignoreNextClick = false;
  let queuedAnchorSelectors = /* @__PURE__ */ new Set();
  let shadow = null;
  let counter = 0;
  const ids = /* @__PURE__ */ new WeakMap();
  const ATTACHMENT_MAX_COUNT = Number.isFinite(options.maxAttachmentCount) && options.maxAttachmentCount > 0 ? options.maxAttachmentCount : 4;
  const ATTACHMENT_MAX_BYTES = Number.isFinite(options.maxAttachmentBytes) && options.maxAttachmentBytes > 0 ? options.maxAttachmentBytes : 0;
  const ATTACHMENT_IMAGE_TYPES = acceptedImageTypes(options.acceptedImageMime);
  const ATTACHMENT_ACCEPTED_MIME = ATTACHMENT_IMAGE_TYPES.accepted;
  const ATTACHMENT_NONCE = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "n" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  let attachmentLocalCounter = 0;
  let activeAttachments = null;
  const REMOVE_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  function attachmentChipHtml(item, index) {
    const name = escapeAnnotationText(item.name || "image");
    const thumb = item.url ? '<img class="lavish-attachment-thumb" src="' + escapeAnnotationText(item.url) + '" alt="">' : '<span class="lavish-attachment-thumb lavish-attachment-thumb-empty" aria-hidden="true"></span>';
    let status = "";
    if (item.status === "uploading") status = '<span class="lavish-attachment-status">Uploading\u2026</span>';
    else if (item.status === "error")
      status = '<span class="lavish-attachment-status lavish-attachment-status-error">' + escapeAnnotationText(item.error || "Upload failed") + "</span>";
    const retry = item.status === "error" && item.file ? '<button type="button" class="lavish-attachment-retry" data-attachment-retry="' + index + '">Retry</button>' : "";
    return '<div class="lavish-attachment-chip' + (item.status === "error" ? " is-error" : "") + '">' + thumb + '<span class="lavish-attachment-body"><span class="lavish-attachment-name" title="' + name + '">' + name + "</span>" + status + "</span>" + retry + '<button type="button" class="lavish-attachment-remove" data-attachment-remove="' + index + '" aria-label="Remove image" title="Remove">' + REMOVE_ICON + "</button></div>";
  }
  function makeAttachmentsController(listEl, { notify = () => {
  }, onLayout = () => {
  } } = {}) {
    const items = [];
    let capRejected = false;
    let queueBlocked = false;
    function render() {
      if (items.length < ATTACHMENT_MAX_COUNT) capRejected = false;
      if (!hasPending() && !hasErrors()) queueBlocked = false;
      notify(
        deriveAttachmentNoticeState({
          itemCount: items.length,
          maxCount: ATTACHMENT_MAX_COUNT,
          capRejected,
          queueBlocked,
          hasPending: hasPending(),
          hasErrors: hasErrors()
        })
      );
      listEl.innerHTML = items.map((item, index) => attachmentChipHtml(item, index)).join("");
      listEl.hidden = items.length === 0;
      for (const button of listEl.querySelectorAll("[data-attachment-remove]")) {
        button.addEventListener("click", () => removeAt(Number(button.getAttribute("data-attachment-remove"))));
      }
      for (const button of listEl.querySelectorAll("[data-attachment-retry]")) {
        button.addEventListener("click", () => retryAt(Number(button.getAttribute("data-attachment-retry"))));
      }
      onLayout();
    }
    function upload(item) {
      item.status = "uploading";
      item.error = "";
      render();
      item.file.arrayBuffer().then((bytes) => {
        if (!items.includes(item)) return;
        postArtifactMessage("lavish:uploadAttachment", {
          nonce: ATTACHMENT_NONCE,
          localId: item.localId,
          name: item.name,
          mime: item.mime,
          bytes
        });
      }).catch(() => {
        if (!items.includes(item)) return;
        item.status = "error";
        item.error = "Could not read image";
        render();
      });
    }
    function addFiles(fileList) {
      const files = [...fileList || []];
      const decisions = classifyAttachmentBatch(files, {
        currentCount: items.length,
        maxCount: ATTACHMENT_MAX_COUNT,
        maxBytes: ATTACHMENT_MAX_BYTES,
        accepted: ATTACHMENT_ACCEPTED_MIME
      });
      const toUpload = [];
      let added = false;
      for (const decision of decisions) {
        if (decision.kind === "cap") {
          capRejected = true;
        } else if (decision.kind === "error") {
          items.push({
            localId: "att-" + ++attachmentLocalCounter,
            file: null,
            name: decision.file?.name || "image",
            mime: "",
            status: "error",
            id: "",
            error: decision.error,
            url: ""
          });
        } else if (decision.kind === "accept") {
          const item = {
            localId: "att-" + ++attachmentLocalCounter,
            file: decision.file,
            name: decision.file.name || "image",
            mime: decision.file.type,
            status: "uploading",
            id: "",
            error: "",
            url: URL.createObjectURL(decision.file)
          };
          items.push(item);
          toUpload.push(item);
          added = true;
        }
      }
      render();
      for (const item of toUpload) upload(item);
      return added;
    }
    function removeAt(index) {
      const item = items[index];
      if (!item) return;
      if (item.url) URL.revokeObjectURL(item.url);
      items.splice(index, 1);
      render();
    }
    function retryAt(index) {
      if (items[index] && items[index].file) upload(items[index]);
    }
    function rejectUnsupportedBatch(names) {
      for (const name of names || []) {
        items.push({
          localId: "att-" + ++attachmentLocalCounter,
          file: null,
          name: name || "file",
          mime: "",
          status: "error",
          id: "",
          error: "UNSUPPORTED_TYPE",
          url: ""
        });
      }
      render();
    }
    function rejectUnsupported(name) {
      rejectUnsupportedBatch([name]);
    }
    function handleResult(localId, ok, id, error) {
      const item = items.find((entry) => entry.localId === localId);
      if (item) {
        if (ok && id) {
          item.status = "ready";
          item.id = String(id);
          item.error = "";
        } else {
          item.status = "error";
          item.error = String(error || "Upload failed");
        }
        render();
      }
    }
    function collectReady() {
      return items.filter((item) => item.status === "ready" && item.id).map((item) => ({ id: item.id, name: item.name }));
    }
    function hasReady() {
      return items.some((item) => item.status === "ready" && item.id);
    }
    function hasPending() {
      return items.some((item) => item.status === "uploading");
    }
    function hasErrors() {
      return items.some((item) => item.status === "error");
    }
    function setQueueBlocked(value) {
      queueBlocked = Boolean(value);
      render();
    }
    function destroy() {
      for (const item of items) if (item.url) URL.revokeObjectURL(item.url);
      items.length = 0;
    }
    render();
    return {
      addFiles,
      rejectUnsupported,
      rejectUnsupportedBatch,
      handleResult,
      collectReady,
      hasReady,
      hasPending,
      hasErrors,
      setQueueBlocked,
      destroy
    };
  }
  function uid(el) {
    if (!ids.has(el)) ids.set(el, String(++counter));
    return ids.get(el);
  }
  function escapeAnnotationText(value) {
    return String(value).replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
    );
  }
  function selector(el) {
    if (!el || !el.tagName) return "";
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += "#" + CSS.escape(node.id);
        parts.unshift(part);
        break;
      }
      const parent2 = node.parentElement;
      if (parent2) {
        const same = [...parent2.children].filter((x) => x.tagName === node.tagName);
        if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
      }
      parts.unshift(part);
      node = parent2;
    }
    return parts.join(" > ");
  }
  function context(el, { table = false } = {}) {
    const base = {
      uid: uid(el),
      selector: selector(el),
      tag: (el.tagName || "").toLowerCase(),
      text: (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 240)
    };
    const tableTarget = table ? tableCellTarget(el, selector) : null;
    if (tableTarget) base.target = tableTarget;
    const mermaidNode = mermaidNodeFrom2(el, selector);
    if (mermaidNode) {
      base.tag = "mermaid-node";
      base.text = mermaidNode.label || base.text;
      base.target = mermaidNode;
    }
    return base;
  }
  function annotationTargetEl(el) {
    return mermaidNodeElement2(el) || el;
  }
  const mermaidViewports = /* @__PURE__ */ new WeakMap();
  function findMermaidSvgs() {
    const svgs = /* @__PURE__ */ new Set();
    for (const svg of document.querySelectorAll("svg")) {
      if (isMermaidSvg2(svg)) svgs.add(svg);
    }
    return [...svgs];
  }
  function createViewport(svg) {
    const bbox = svg.getBBox ? safeBBox(svg) : null;
    const initial = readViewBox(svg) || (bbox ? { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height } : null);
    if (!initial) return null;
    svg.setAttribute("viewBox", `${initial.x} ${initial.y} ${initial.w} ${initial.h}`);
    const view = { ...initial };
    let frozen = false;
    let panning = null;
    function apply() {
      svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
    }
    function reset() {
      Object.assign(view, initial);
      apply();
    }
    function zoomAt(clientX, clientY, factor) {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      const fx = view.x + view.w * px;
      const fy = view.y + view.h * py;
      const next = Math.min(Math.max(view.w * factor, initial.w / 40), initial.w * 8);
      const scale = next / view.w;
      view.w = next;
      view.h *= scale;
      view.x = fx - (fx - view.x) * scale;
      view.y = fy - (fy - view.y) * scale;
      apply();
    }
    function onWheel(event) {
      if (frozen) return;
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, event.deltaY > 0 ? 1.15 : 1 / 1.15);
    }
    function onPointerDown(event) {
      if (frozen || event.button !== 0) return;
      panning = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
      svg.setPointerCapture?.(event.pointerId);
      svg.style.cursor = "grabbing";
    }
    function onPointerMove(event) {
      if (!panning) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      view.x = panning.vx - (event.clientX - panning.x) / rect.width * view.w;
      view.y = panning.vy - (event.clientY - panning.y) / rect.height * view.h;
      apply();
    }
    function onPointerUp(event) {
      panning = null;
      svg.releasePointerCapture?.(event.pointerId);
      svg.style.cursor = frozen ? "" : "grab";
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerUp);
    function setFrozen(next) {
      frozen = !!next;
      panning = null;
      svg.style.cursor = frozen ? "" : "grab";
      svg.style.touchAction = frozen ? "" : "none";
    }
    setFrozen(false);
    return { reset, setFrozen };
  }
  function safeBBox(svg) {
    try {
      return svg.getBBox();
    } catch {
      return null;
    }
  }
  function readViewBox(svg) {
    const raw = svg.getAttribute?.("viewBox");
    if (!raw) return null;
    const parts = raw.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
    return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
  }
  const whiteboardEmbeds = /* @__PURE__ */ new Map();
  function mermaidContainerIndex(container) {
    return [...document.querySelectorAll(".mermaid")].indexOf(container);
  }
  function whiteboardEmbedHeightPx(svgRect) {
    const headerPx = 96;
    const min = 360;
    const max = Math.max(min, Math.round((window.innerHeight || 800) * 0.8));
    return Math.max(min, Math.min(Math.round(svgRect.height) + headerPx, max));
  }
  function embedWhiteboard(svg) {
    const container = svg.closest(".mermaid");
    if (!container) return;
    const existing = whiteboardEmbeds.get(container);
    if (existing && existing.iframe.isConnected) {
      existing.index = mermaidContainerIndex(container);
      return;
    }
    const index = mermaidContainerIndex(container);
    if (index < 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.height < 40) {
      window.setTimeout(scheduleMermaidEnhance, 150);
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-lavish-ui", "whiteboard-inline");
    iframe.setAttribute("title", "Excalidraw whiteboard");
    iframe.setAttribute("sandbox", "allow-scripts allow-popups");
    iframe.src = whiteboardFrameSrc({ index, diagramId: svg.id || "" });
    iframe.style.cssText = `display:block;width:100%;height:${whiteboardEmbedHeightPx(rect)}px;border:1px solid rgba(128,128,128,.35);border-radius:12px;background:transparent`;
    container.style.display = "none";
    container.insertAdjacentElement("afterend", iframe);
    whiteboardEmbeds.set(container, { iframe, index, diagramId: svg.id || "" });
  }
  function whiteboardEmbedEntries() {
    return [...whiteboardEmbeds.values()].filter((entry) => entry.iframe.isConnected);
  }
  function whiteboardEntryByIndex(index) {
    return whiteboardEmbedEntries().find((entry) => entry.index === Number(index)) || null;
  }
  function whiteboardFrameSrc(entry) {
    const params = new URLSearchParams({
      diagramIndex: String(entry.index),
      diagramId: String(entry.diagramId || ""),
      // The frame's channel token is bound to this session, so the frame page
      // must be told which session it belongs to.
      key: String(sessionKey2 || "")
    });
    return `/whiteboard-frame?${params}`;
  }
  window.addEventListener("message", (event) => {
    if (event.source !== parent) return;
    const msg = event.data || {};
    if (msg.type === "lavish:suspendWhiteboard") {
      const target = whiteboardEntryByIndex(msg.diagramIndex);
      if (target) target.iframe.src = "about:blank";
    }
    if (msg.type === "lavish:resumeWhiteboard") {
      const target = whiteboardEntryByIndex(msg.diagramIndex);
      if (target) target.iframe.src = whiteboardFrameSrc(target);
    }
    if (msg.type === "lavish:requestLayoutDiagnostics") scheduleLayoutAudit(true);
  });
  function enhanceMermaid() {
    for (const svg of findMermaidSvgs()) {
      embedWhiteboard(svg);
      if (mermaidViewports.has(svg)) continue;
      const viewport = createViewport(svg);
      if (viewport) {
        viewport.setFrozen(annotationMode);
        mermaidViewports.set(svg, viewport);
      }
    }
  }
  let mermaidEnhanceScheduled = false;
  function scheduleMermaidEnhance() {
    if (mermaidEnhanceScheduled) return;
    mermaidEnhanceScheduled = true;
    const run2 = () => {
      mermaidEnhanceScheduled = false;
      enhanceMermaid();
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(run2);
    else window.setTimeout(run2, 50);
  }
  function setMermaidFrozen(frozen) {
    for (const svg of findMermaidSvgs()) {
      mermaidViewports.get(svg)?.setFrozen(frozen);
    }
  }
  function closestElement(node) {
    if (!node) return document.body;
    if (node.nodeType === 1) return node;
    return node.parentElement || document.body;
  }
  function nodePath(node, root) {
    const path12 = [];
    let current = node;
    while (current && current !== root) {
      const parentNode = current.parentNode;
      if (!parentNode) break;
      path12.unshift([...parentNode.childNodes].indexOf(current));
      current = parentNode;
    }
    return path12;
  }
  function rangeBoundary(node, offset) {
    const el = closestElement(node);
    return {
      selector: selector(el),
      path: nodePath(node, el),
      offset: Number(offset) || 0
    };
  }
  function textSelectionContext(selection) {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const text = selection.toString().trim().replace(/\s+/g, " ");
    if (range.collapsed || !text) return null;
    const ancestor = closestElement(range.commonAncestorContainer);
    if (isLavishUi(ancestor) || isLavishAction(ancestor) || isInteractiveControl(ancestor)) return null;
    const commonAncestorSelector = selector(ancestor);
    const target = {
      type: "text-range",
      text,
      selector: commonAncestorSelector,
      commonAncestorSelector,
      start: rangeBoundary(range.startContainer, range.startOffset),
      end: rangeBoundary(range.endContainer, range.endOffset)
    };
    return {
      uid: "",
      selector: commonAncestorSelector,
      tag: "text",
      text: text.slice(0, 240),
      target,
      element: ancestor,
      range: range.cloneRange()
    };
  }
  function isLavishUi(el) {
    return !!(el && el.closest && el.closest("[data-lavish-ui]"));
  }
  function isLavishAction(el) {
    return !!(el && el.closest && el.closest("[data-lavish-action]"));
  }
  function isInteractiveControl(el) {
    return isNativeInteractive(el);
  }
  function highlightElement(el) {
    if (!el) return;
    el.style.outline = "var(--lavish-annotate-outline,2px solid #f4c95d)";
    el.style.outlineOffset = "var(--lavish-annotate-offset,2px)";
  }
  function clearHighlight(el) {
    if (el) el.style.outline = "";
  }
  function clearTextHighlight() {
    if (!shadow) return;
    for (const el of [...shadow.querySelectorAll(".lavish-text-highlight")]) el.remove();
  }
  function highlightTextRange(range) {
    clearTextHighlight();
    const root = ensureShadow();
    for (const rect of [...range.getClientRects()]) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const mark = document.createElement("div");
      mark.className = "lavish-text-highlight";
      mark.style.left = rect.left + "px";
      mark.style.top = rect.top + "px";
      mark.style.width = rect.width + "px";
      mark.style.height = rect.height + "px";
      root.appendChild(mark);
    }
  }
  function setAnnotationMode(enabled) {
    annotationMode = !!enabled;
    let style = document.getElementById("lavish-cursor-style");
    if (annotationMode && !style) {
      style = document.createElement("style");
      style.id = "lavish-cursor-style";
      style.textContent = ":root{--lavish-accent:#f4c95d;--lavish-annotate-outline:2px solid var(--lavish-accent);--lavish-annotate-offset:2px}*{cursor:default!important}:where(:is([role='button'],[role='checkbox'],[role='combobox'],[role='menuitem'],[role='menuitemcheckbox'],[role='menuitemradio'],[role='option'],[role='radio'],[role='switch'],[role='tab'],[role='treeitem']):not(a[href])),:where(:is([role='button'],[role='checkbox'],[role='combobox'],[role='menuitem'],[role='menuitemcheckbox'],[role='menuitemradio'],[role='option'],[role='radio'],[role='switch'],[role='tab'],[role='treeitem']):not(a[href])) *{cursor:pointer!important}:where(:is([role='button'],[role='checkbox'],[role='combobox'],[role='menuitem'],[role='menuitemcheckbox'],[role='menuitemradio'],[role='option'],[role='radio'],[role='switch'],[role='tab'],[role='treeitem']) a[href]),:where(:is([role='button'],[role='checkbox'],[role='combobox'],[role='menuitem'],[role='menuitemcheckbox'],[role='menuitemradio'],[role='option'],[role='radio'],[role='switch'],[role='tab'],[role='treeitem']) a[href]) *{cursor:default!important}[data-lavish-action],[data-lavish-action] *{cursor:pointer!important}input,textarea,[contenteditable]:not([contenteditable='false']){cursor:text!important}button,select,label,option,input[type='button'],input[type='submit'],input[type='reset'],input[type='checkbox'],input[type='radio'],input[type='file'],input[type='color'],input[type='range'],input[type='image']{cursor:pointer!important}";
      document.head.appendChild(style);
    }
    if (!annotationMode && style) style.remove();
    if (!annotationMode) closeCard();
    setMermaidFrozen(annotationMode);
  }
  function queuePrompt(prompt, options2 = {}) {
    const originElement = options2.element || document.activeElement || document.body;
    const item = {
      ...context(originElement),
      prompt: String(prompt || "")
    };
    const queueKey = typeof deriveQueueKey === "function" ? deriveQueueKey(originElement, options2) : "";
    if (queueKey) item._lavishQueueKey = String(queueKey);
    if (options2.uid) item.uid = String(options2.uid);
    if (options2.selector) item.selector = String(options2.selector);
    if (options2.tag) item.tag = String(options2.tag);
    if (options2.text) item.text = String(options2.text);
    if (options2.target) item.target = options2.target;
    if (options2.data) item.prompt += "\n\nContext data:\n" + JSON.stringify(options2.data, null, 2);
    if (Array.isArray(options2.attachments) && options2.attachments.length) {
      const attachments = options2.attachments.filter((attachment) => attachment && attachment.id).map(
        (attachment) => attachment.name ? { id: String(attachment.id), name: String(attachment.name) } : { id: String(attachment.id) }
      );
      if (attachments.length) item.attachments = attachments;
    }
    postArtifactMessage("lavish:queuePrompt", { prompt: item });
  }
  function sendQueuedPrompts() {
    postArtifactMessage("lavish:sendQueuedPrompts");
  }
  function endSession() {
    postArtifactMessage("lavish:endSession");
  }
  function snapshot() {
    const lines = [];
    function walk(el, depth) {
      if (!(el instanceof Element) || depth > 6 || isLavishUi(el)) return;
      const c = context(el);
      const name = c.text ? ' "' + c.text.slice(0, 80).replace(/"/g, "'") + '"' : "";
      lines.push("  ".repeat(depth) + "uid=" + c.uid + " " + c.tag + name);
      for (const child of el.children) walk(child, depth + 1);
    }
    walk(document.body, 0);
    return lines.join("\n");
  }
  const layoutAuditSettleMs = 180;
  const layoutAuditMaxWaitMs = 2e3;
  const layoutAuditAnimationMaxWaitMs = 4e3;
  const layoutAuditStableSampleMs = 120;
  let layoutAuditTimer = 0;
  let layoutAuditRun = 0;
  let lastLayoutAuditSignature = null;
  let layoutAuditPublishRequested = false;
  let layoutAuditPassSequence = 0;
  function toPixelNumber(value) {
    const parsed = Number.parseFloat(String(value || "0"));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function roundedOverflowPx(value) {
    return Math.round(Math.max(0, value) * 10) / 10;
  }
  function elementText(el) {
    return String(el?.innerText || el?.textContent || "").trim().replace(/\s+/g, " ");
  }
  function directText(el) {
    return [...el?.childNodes || []].filter((node) => node.nodeType === 3).map((node) => String(node.textContent || "")).join(" ").trim().replace(/\s+/g, " ");
  }
  function isRequiredControl(el) {
    if (!el?.matches?.("button,input,select,textarea,a[href],summary,[data-lavish-action],[role]")) return false;
    if (el.matches("input[type='hidden'],[disabled],[aria-disabled='true']")) return false;
    if (!el.hasAttribute("role")) return true;
    return (/* @__PURE__ */ new Set(["button", "link", "checkbox", "radio", "switch", "textbox", "combobox"])).has(
      String(el.getAttribute("role") || "").toLowerCase()
    );
  }
  function isSemanticTextBoundary(el) {
    return Boolean(
      el?.matches?.(
        "p,h1,h2,h3,h4,h5,h6,button,label,a[href],li,dt,dd,th,td,legend,figcaption,summary,[role='button'],[role='link'],[role='alert'],[role='status']"
      )
    );
  }
  function hasSemanticTextBoundaryAncestor(el) {
    let node = el?.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      if (isSemanticTextBoundary(node)) return true;
      node = node.parentElement;
    }
    return false;
  }
  function auditedText(el) {
    return isSemanticTextBoundary(el) ? elementText(el) : directText(el);
  }
  function rectArea(rect) {
    return Math.max(0, rect.width) * Math.max(0, rect.height);
  }
  function isVisibleForLayoutAudit(el, rect = el.getBoundingClientRect()) {
    if (!el || isLavishUi(el) || rect.width <= 0 || rect.height <= 0) return false;
    let node = el;
    while (node && node.nodeType === 1) {
      const style = getComputedStyle(node);
      const opacity = Number.parseFloat(style.opacity || "1");
      if (style.display === "none" || style.visibility === "hidden" || style.contentVisibility === "hidden" || Number.isFinite(opacity) && opacity <= 0.01) {
        return false;
      }
      node = node.parentElement;
    }
    return true;
  }
  function isIntentionalHorizontalScroller(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const overflowX = getComputedStyle(el).overflowX;
    return overflowX === "auto" || overflowX === "scroll";
  }
  function isIntentionalVerticalScroller(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const overflowY = getComputedStyle(el).overflowY;
    return overflowY === "auto" || overflowY === "scroll";
  }
  function hasIntentionalHorizontalScrollerAncestor(el) {
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      if (isIntentionalHorizontalScroller(node)) return true;
      node = node.parentElement;
    }
    return false;
  }
  function hasReachableVerticalScrollerAncestor(el) {
    let node = el?.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      if (isIntentionalVerticalScroller(node)) {
        const rect = node.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < (window.innerHeight || 0)) return true;
      }
      node = node.parentElement;
    }
    return false;
  }
  function rootVerticalScrollLocked() {
    const values = [document.documentElement, document.body].filter(Boolean).map((node) => getComputedStyle(node).overflowY);
    return values.some((value) => value === "hidden" || value === "clip");
  }
  function paddingBoxRect(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      left: rect.left + toPixelNumber(style.borderLeftWidth),
      right: rect.right - toPixelNumber(style.borderRightWidth),
      top: rect.top + toPixelNumber(style.borderTopWidth),
      bottom: rect.bottom - toPixelNumber(style.borderBottomWidth)
    };
  }
  function textNodesForAudit(el) {
    const descendants = isSemanticTextBoundary(el);
    const nodes = [];
    const pending = [...el?.childNodes || []];
    while (pending.length > 0) {
      const node = pending.shift();
      if (!node) continue;
      if (node.nodeType === 3) {
        if (String(node.textContent || "").trim()) nodes.push(node);
      } else if (descendants && node.nodeType === 1) {
        pending.unshift(...node.childNodes || []);
      }
    }
    return nodes;
  }
  function textFragmentsForAudit(el) {
    const fragments = [];
    for (const textNode of textNodesForAudit(el)) {
      const range = document.createRange();
      range.selectNodeContents(textNode);
      fragments.push(...[...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0));
      range.detach?.();
    }
    return fragments;
  }
  function isIntentionalTextTruncation(style) {
    return style.textOverflow === "ellipsis" || Number.parseInt(style.webkitLineClamp || "0", 10) > 0;
  }
  function hasVisualMask(style) {
    const maskImage = String(style.maskImage || style.webkitMaskImage || "none").toLowerCase();
    const clipPath = String(style.clipPath || "none").toLowerCase();
    return maskImage !== "none" && maskImage !== "" || clipPath !== "none" && clipPath !== "";
  }
  function isRoundedOverflowMask(style) {
    const clips = style.overflowX === "hidden" || style.overflowX === "clip" || style.overflowY === "hidden" || style.overflowY === "clip";
    if (!clips) return false;
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius
    ].some((value) => toPixelNumber(value) > 0);
  }
  function isDiagramLayoutElement(el) {
    return Boolean(el?.closest?.(".mermaid,svg,[data-lavish-ui]"));
  }
  function hasVisualMaskAncestor(el) {
    let node = el;
    while (node && node.nodeType === 1) {
      const style = getComputedStyle(node);
      if (hasVisualMask(style) || isRoundedOverflowMask(style)) return true;
      node = node.parentElement;
    }
    return false;
  }
  function clippingBoundariesFor(el) {
    const boundaries = [];
    let node = el?.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const axes = [];
      if (style.overflowX === "hidden" || style.overflowX === "clip") axes.push("horizontal");
      if (style.overflowY === "hidden" || style.overflowY === "clip") axes.push("vertical");
      if (axes.length > 0 && !hasVisualMask(style) && !isRoundedOverflowMask(style)) {
        boundaries.push({ el: node, box: paddingBoxRect(node), axes });
      }
      node = node.parentElement;
    }
    return boundaries;
  }
  function isStandardVisuallyHidden(el, style, rect) {
    const positioned = style.position === "absolute" || style.position === "fixed";
    const clipped = style.overflowX === "hidden" || style.overflowX === "clip";
    const legacyClip = String(style.clip || "").toLowerCase();
    const clipPath = String(style.clipPath || "").toLowerCase();
    const hasClip = legacyClip !== "auto" || clipPath !== "none" && clipPath !== "";
    return positioned && clipped && rect.width <= 2 && rect.height <= 2 && (style.whiteSpace === "nowrap" || hasClip);
  }
  function hasStandardVisuallyHiddenAncestor(el) {
    let node = el;
    while (node && node.nodeType === 1) {
      const rect = node.getBoundingClientRect();
      if (isStandardVisuallyHidden(node, getComputedStyle(node), rect)) return true;
      node = node.parentElement;
    }
    return false;
  }
  function isExcludedLayoutAuditElement(el) {
    return isDiagramLayoutElement(el) || hasVisualMaskAncestor(el) || hasStandardVisuallyHiddenAncestor(el);
  }
  function collectLayoutAuditElements() {
    return [...document.body?.querySelectorAll("*") || []].filter((el) => el instanceof Element && !isLavishUi(el)).slice(0, 800);
  }
  function pushLayoutFinding(findings, seen, finding) {
    if (finding.severity !== "error") return;
    const selectorValue = finding.selector || "";
    const axis = finding.axis === "vertical" ? "vertical" : "horizontal";
    const key = `${finding.kind}:${selectorValue}:${axis}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      selector: selectorValue,
      kind: String(finding.kind || "layout-failure"),
      axis,
      overflowPx: roundedOverflowPx(finding.overflowPx),
      viewportWidth: Math.round(Number(finding.viewportWidth) || window.innerWidth || 0),
      severity: "error"
    });
  }
  function auditSevereTextOverflow(el, viewportWidth, findings, seen, animationTargets, failedRoots) {
    if (el === document.body || el === document.documentElement) return;
    if (isExcludedLayoutAuditElement(el)) return;
    if (!auditedText(el)) return;
    if (!isSemanticTextBoundary(el) && hasSemanticTextBoundaryAncestor(el)) return;
    if (failedRoots.some((root) => root.contains(el))) return;
    if (isAnimationAssociatedWithElement(el, animationTargets)) return;
    const rect = el.getBoundingClientRect();
    if (!isVisibleForLayoutAudit(el, rect)) return;
    const style = getComputedStyle(el);
    const fragments = textFragmentsForAudit(el);
    let severe = classifySevereTextOverflow({
      fragments,
      box: paddingBoxRect(el),
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      isTruncated: isIntentionalTextTruncation(style),
      isVisuallyHidden: false
    });
    let failureRoot = el;
    for (const boundary of clippingBoundariesFor(el)) {
      const ancestorFailure = classifySevereTextOverflow({
        fragments,
        box: boundary.box,
        overflowX: boundary.axes.includes("horizontal") ? "hidden" : "auto",
        overflowY: boundary.axes.includes("vertical") ? "hidden" : "auto",
        isTruncated: isIntentionalTextTruncation(style),
        isVisuallyHidden: false
      });
      if (ancestorFailure && (!severe || ancestorFailure.overflowPx > severe.overflowPx)) {
        severe = ancestorFailure;
        failureRoot = boundary.el;
      }
    }
    if (!severe) return;
    failedRoots.push(failureRoot);
    pushLayoutFinding(findings, seen, {
      selector: selector(failureRoot),
      kind: severe.kind,
      axis: severe.axis,
      overflowPx: severe.overflowPx,
      viewportWidth,
      severity: "error"
    });
  }
  function materiallyEscapesViewport(rect, viewportWidth, minOutsidePx) {
    return classifyMaterialRectEscape({
      rect,
      boundary: { left: 0, right: viewportWidth, top: 0, bottom: window.innerHeight || 0 },
      axes: ["horizontal"],
      minOutsidePx
    });
  }
  function elementHasMaterialViewportEscape(el, viewportWidth, animationTargets) {
    if (hasIntentionalHorizontalScrollerAncestor(el)) return false;
    if (isAnimationAssociatedWithElement(el, animationTargets)) return false;
    if (isExcludedLayoutAuditElement(el)) return false;
    if (!isSemanticTextBoundary(el) && hasSemanticTextBoundaryAncestor(el)) return false;
    const rect = el.getBoundingClientRect();
    if (!isVisibleForLayoutAudit(el, rect)) return false;
    const style = getComputedStyle(el);
    const positioned = style.position === "absolute" || style.position === "fixed" || style.position === "sticky";
    if (positioned && !isRequiredControl(el)) return false;
    if (isRequiredControl(el)) {
      return materiallyEscapesViewport(rect, viewportWidth, 4)?.side === "end";
    }
    if (!auditedText(el)) return false;
    const materialPx = Math.max(24, viewportWidth * 0.05);
    return textFragmentsForAudit(el).some(
      (fragment) => materiallyEscapesViewport(fragment, viewportWidth, materialPx)?.side === "end"
    );
  }
  function auditUnreachableLeftText(el, viewportWidth, findings, seen, animationTargets) {
    if (hasIntentionalHorizontalScrollerAncestor(el)) return;
    if (isAnimationAssociatedWithElement(el, animationTargets)) return;
    if (isExcludedLayoutAuditElement(el)) return;
    if (!isSemanticTextBoundary(el) && hasSemanticTextBoundaryAncestor(el)) return;
    if (!auditedText(el)) return;
    const rect = el.getBoundingClientRect();
    if (!isVisibleForLayoutAudit(el, rect)) return;
    const style = getComputedStyle(el);
    if (["absolute", "fixed", "sticky"].includes(style.position) && !isRequiredControl(el)) return;
    const materialPx = Math.max(24, viewportWidth * 0.05);
    let escape = null;
    for (const fragment of textFragmentsForAudit(el)) {
      const candidate = materiallyEscapesViewport(fragment, viewportWidth, materialPx);
      if (candidate?.side === "start" && (!escape || candidate.overflowPx > escape.overflowPx)) escape = candidate;
    }
    if (!escape) return;
    pushLayoutFinding(findings, seen, {
      selector: selector(el),
      kind: "viewport-unreachable-content",
      axis: "horizontal",
      overflowPx: escape.overflowPx,
      viewportWidth,
      severity: "error"
    });
  }
  function auditRequiredControlBounds(el, viewportWidth, findings, seen, animationTargets, failedRoots) {
    if (!isRequiredControl(el) || isExcludedLayoutAuditElement(el)) return;
    if (isAnimationAssociatedWithElement(el, animationTargets)) return;
    const rect = el.getBoundingClientRect();
    if (!isVisibleForLayoutAudit(el, rect)) return;
    let clipped = null;
    for (const boundary of clippingBoundariesFor(el)) {
      const escape = classifyMaterialRectEscape({ rect, boundary: boundary.box, axes: boundary.axes });
      if (escape && (!clipped || escape.overflowPx > clipped.escape.overflowPx)) clipped = { boundary, escape };
    }
    if (clipped && !failedRoots.some((root) => root === clipped.boundary.el || root.contains(clipped.boundary.el))) {
      failedRoots.push(clipped.boundary.el);
      pushLayoutFinding(findings, seen, {
        selector: selector(clipped.boundary.el),
        kind: "clipped-control",
        axis: clipped.escape.axis,
        overflowPx: clipped.escape.overflowPx,
        viewportWidth,
        severity: "error"
      });
    }
    const horizontal = hasIntentionalHorizontalScrollerAncestor(el) ? null : materiallyEscapesViewport(rect, viewportWidth, 4);
    if (horizontal?.side === "start") {
      pushLayoutFinding(findings, seen, {
        selector: selector(el),
        kind: "viewport-unreachable-control",
        axis: "horizontal",
        overflowPx: horizontal.overflowPx,
        viewportWidth,
        severity: "error"
      });
    }
    const style = getComputedStyle(el);
    const fixedToViewport = style.position === "fixed" || style.position === "sticky";
    const lockedToViewport = rootVerticalScrollLocked() && !hasReachableVerticalScrollerAncestor(el);
    const scrollY = Number(window.scrollY || window.pageYOffset || 0);
    const verticalRect = fixedToViewport || lockedToViewport ? rect : {
      top: rect.top + scrollY,
      bottom: rect.bottom + scrollY,
      height: rect.height
    };
    const verticalBoundary = fixedToViewport || lockedToViewport ? { top: 0, bottom: window.innerHeight || 0 } : { top: 0, bottom: document.documentElement.scrollHeight };
    const vertical = classifyMaterialRectEscape({
      rect: verticalRect,
      boundary: verticalBoundary,
      axes: ["vertical"]
    });
    if (vertical) {
      pushLayoutFinding(findings, seen, {
        selector: selector(el),
        kind: "viewport-unreachable-control",
        axis: "vertical",
        overflowPx: vertical.overflowPx,
        viewportWidth,
        severity: "error"
      });
    }
  }
  function backgroundIsOpaque(el) {
    const style = getComputedStyle(el);
    if (Number.parseFloat(style.opacity || "1") < 0.95) return false;
    const color = String(style.backgroundColor || "").trim().toLowerCase();
    if (!color || color === "transparent") return false;
    const rgba = color.match(/^rgba?\(([^)]+)\)$/);
    if (!rgba) return false;
    const parts = rgba[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 4) return true;
    const alpha = Number(parts[3]);
    return Number.isFinite(alpha) && alpha >= 0.95;
  }
  function effectiveOpacityTo(node, stopParent) {
    let opacity = 1;
    let current = node;
    while (current && current !== stopParent) {
      const value = Number.parseFloat(getComputedStyle(current).opacity || "1");
      if (Number.isFinite(value)) opacity *= value;
      current = current.parentElement;
    }
    return opacity;
  }
  function opaqueSiblingBlocker(el, point, animationTargets) {
    const top = document.elementFromPoint(point.x, point.y);
    if (!(top instanceof Element) || top === el || el.contains(top) || top.contains(el) || isLavishUi(top)) return null;
    const targetAncestors = [];
    let targetNode = el;
    while (targetNode && targetNode !== document.body && targetNode !== document.documentElement) {
      targetAncestors.push(targetNode);
      targetNode = targetNode.parentElement;
    }
    let node = top;
    let foundOpaqueSurface = false;
    while (node && node !== document.body && node !== document.documentElement) {
      if (isAnimationAssociatedWithElement(node, animationTargets)) return null;
      if (backgroundIsOpaque(node)) foundOpaqueSurface = true;
      const siblingOf = targetAncestors.find((target) => target.parentElement === node.parentElement);
      if (siblingOf && foundOpaqueSurface && effectiveOpacityTo(top, node.parentElement) >= 0.95) return node;
      node = node.parentElement;
    }
    return null;
  }
  function fragmentSamplePoints(fragment) {
    const xs = [0.2, 0.5, 0.8];
    const ys = [0.2, 0.5, 0.8];
    return xs.flatMap(
      (xRatio) => ys.map((yRatio) => ({
        x: fragment.left + fragment.width * xRatio,
        y: fragment.top + fragment.height * yRatio
      }))
    );
  }
  function auditSevereTextOcclusion(elements, viewportWidth, findings, seen, animationTargets) {
    const candidates = elements.filter((el) => !isExcludedLayoutAuditElement(el)).filter((el) => {
      const text = auditedText(el);
      return text.length >= 8 || text.length > 0 && isRequiredControl(el);
    }).filter((el) => isSemanticTextBoundary(el) || !hasSemanticTextBoundaryAncestor(el)).filter((el) => isVisibleForLayoutAudit(el)).filter((el) => getComputedStyle(el).position === "static").filter((el) => !isAnimationAssociatedWithElement(el, animationTargets)).slice(0, 200);
    const failedRoots = [];
    for (const el of candidates) {
      if (failedRoots.some((root) => root.contains(el))) continue;
      const blockers = /* @__PURE__ */ new Map();
      let totalSamples = 0;
      for (const fragment of textFragmentsForAudit(el)) {
        if (rectArea(fragment) < 16) continue;
        for (const point of fragmentSamplePoints(fragment)) {
          if (point.x < 0 || point.y < 0 || point.x > viewportWidth || point.y > window.innerHeight) continue;
          totalSamples += 1;
          const blocker = opaqueSiblingBlocker(el, point, animationTargets);
          if (blocker) blockers.set(blocker, (blockers.get(blocker) || 0) + 1);
        }
      }
      const occludedSamples = Math.max(0, ...blockers.values());
      if (!isNearTotalOcclusion({ occludedSamples, totalSamples })) continue;
      failedRoots.push(el);
      pushLayoutFinding(findings, seen, {
        selector: selector(el),
        kind: "overlapping-text",
        axis: "horizontal",
        overflowPx: 0,
        viewportWidth,
        severity: "error"
      });
    }
  }
  function auditLayout() {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const findings = [];
    const seen = /* @__PURE__ */ new Set();
    const elements = collectLayoutAuditElements();
    const animationTargets = activeAnimationTargets();
    const pageOverflowPx = document.documentElement.scrollWidth - viewportWidth;
    const escapedContent = elements.some((el) => elementHasMaterialViewportEscape(el, viewportWidth, animationTargets));
    if (isMaterialPageOverflow({ overflowPx: pageOverflowPx, viewportWidth, hasEscapedContent: escapedContent })) {
      pushLayoutFinding(findings, seen, {
        selector: "html",
        kind: "page-horizontal-overflow",
        axis: "horizontal",
        overflowPx: pageOverflowPx,
        viewportWidth,
        severity: "error"
      });
    }
    const failedClippingRoots = [];
    for (const el of elements) {
      auditRequiredControlBounds(el, viewportWidth, findings, seen, animationTargets, failedClippingRoots);
    }
    for (const el of elements) {
      auditUnreachableLeftText(el, viewportWidth, findings, seen, animationTargets);
    }
    for (const el of elements) {
      auditSevereTextOverflow(el, viewportWidth, findings, seen, animationTargets, failedClippingRoots);
    }
    auditSevereTextOcclusion(elements, viewportWidth, findings, seen, animationTargets);
    return findings;
  }
  function waitForDocumentFontsReady() {
    try {
      if (document.fonts?.ready) return document.fonts.ready.catch(() => {
      });
    } catch {
    }
    return Promise.resolve();
  }
  function waitForAnimationFrames(count) {
    return new Promise((resolve) => {
      function step(remaining) {
        if (remaining <= 0) {
          resolve();
          return;
        }
        const next = () => step(remaining - 1);
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(next);
        } else {
          window.setTimeout(next, 16);
        }
      }
      step(count);
    });
  }
  function waitForResizeObserverSettle() {
    return new Promise((resolve) => {
      let observer = null;
      let settleTimer = 0;
      let maxTimer = 0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (settleTimer) window.clearTimeout(settleTimer);
        if (maxTimer) window.clearTimeout(maxTimer);
        if (observer) observer.disconnect();
        resolve();
      };
      const scheduleFinish = () => {
        if (settleTimer) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(finish, layoutAuditSettleMs);
      };
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(scheduleFinish);
        const observed = [document.documentElement, document.body, ...[...document.body?.querySelectorAll("*") || []]].filter(Boolean).slice(0, 800);
        for (const el of observed) observer.observe(el);
      }
      scheduleFinish();
      maxTimer = window.setTimeout(finish, layoutAuditMaxWaitMs);
    });
  }
  function waitForDomHydrationQuiescence() {
    return new Promise((resolve) => {
      if (typeof MutationObserver === "undefined" || !document.documentElement) {
        resolve(false);
        return;
      }
      let observer = null;
      let settleTimer = 0;
      let maxTimer = 0;
      let done = false;
      const finish = (quiescent) => {
        if (done) return;
        done = true;
        if (settleTimer) window.clearTimeout(settleTimer);
        if (maxTimer) window.clearTimeout(maxTimer);
        observer?.disconnect();
        resolve(quiescent);
      };
      const scheduleFinish = () => {
        if (settleTimer) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => finish(true), layoutAuditSettleMs);
      };
      observer = new MutationObserver(scheduleFinish);
      observer.observe(document.documentElement, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      scheduleFinish();
      maxTimer = window.setTimeout(() => finish(false), layoutAuditMaxWaitMs);
    });
  }
  function animationTarget(animation) {
    const target = (
      /** @type {any} */
      animation.effect?.target
    );
    if (target instanceof Element) return target;
    return target?.element instanceof Element ? target.element : null;
  }
  function activeDocumentAnimations() {
    if (typeof document.getAnimations !== "function") return [];
    return document.getAnimations().filter((animation) => ["running", "pending"].includes(String(animation.playState))).filter((animation) => !isLavishUi(animationTarget(animation)));
  }
  function activeAnimationTargets() {
    return activeDocumentAnimations().map(animationTarget).filter(Boolean);
  }
  function isAnimationAssociatedWithElement(el, targets) {
    return targets.some((target) => target === el || target.contains(el) || el.contains(target));
  }
  async function waitForFiniteAnimationsSettle() {
    const finite = activeDocumentAnimations().filter((animation) => {
      const endTime = Number(animation.effect?.getComputedTiming?.().endTime);
      return Number.isFinite(endTime);
    });
    if (finite.length === 0) return true;
    let settled = false;
    await Promise.race([
      Promise.all(finite.map((animation) => animation.finished.catch(() => {
      }))).then(() => {
        settled = true;
      }),
      new Promise((resolve) => window.setTimeout(resolve, layoutAuditAnimationMaxWaitMs))
    ]);
    if (!settled) {
      for (const animation of finite) {
        animation.finished.then(
          () => scheduleLayoutAudit(),
          () => scheduleLayoutAudit()
        );
      }
    }
    return settled;
  }
  function publishLayoutAudit(findings, complete, targetPresenceComplete = false) {
    const severe = findings.filter((finding) => finding?.severity === "error");
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const signature = JSON.stringify({ complete, targetPresenceComplete, viewportWidth, severe });
    if (!layoutAuditPublishRequested && signature === lastLayoutAuditSignature) return;
    layoutAuditPublishRequested = false;
    lastLayoutAuditSignature = signature;
    postArtifactMessage("lavish:layoutDiagnostics", {
      complete,
      artifact_revision: artifactRevision,
      artifact_pass_sequence: ++layoutAuditPassSequence,
      target_presence_complete: targetPresenceComplete === true,
      viewport_width: viewportWidth,
      findings: severe
    });
  }
  async function runLayoutAudit(runId) {
    await waitForDocumentFontsReady();
    await waitForResizeObserverSettle();
    const animationsSettled = await waitForFiniteAnimationsSettle();
    await waitForAnimationFrames(2);
    if (runId !== layoutAuditRun) return;
    const first = auditLayout();
    await new Promise((resolve) => window.setTimeout(resolve, layoutAuditStableSampleMs));
    await waitForAnimationFrames(2);
    if (runId !== layoutAuditRun) return;
    const second = auditLayout();
    const domHydrationQuiescent = await waitForDomHydrationQuiescence();
    if (runId !== layoutAuditRun) return;
    const final = domHydrationQuiescent ? auditLayout() : second;
    const targetPresenceComplete = document.readyState === "complete" && domHydrationQuiescent;
    publishLayoutAudit(
      findStableLayoutFindings(domHydrationQuiescent ? second : first, final),
      animationsSettled && targetPresenceComplete,
      targetPresenceComplete
    );
  }
  function scheduleLayoutAudit(publishRequested = false) {
    if (publishRequested) layoutAuditPublishRequested = true;
    if (layoutAuditTimer) window.clearTimeout(layoutAuditTimer);
    const runId = ++layoutAuditRun;
    layoutAuditTimer = window.setTimeout(() => {
      runLayoutAudit(runId).catch(() => {
        if (runId === layoutAuditRun) publishLayoutAudit([], false);
      });
    }, 50);
  }
  function startLayoutAudit() {
    scheduleLayoutAudit();
    window.addEventListener("load", () => scheduleLayoutAudit(), { once: true });
    window.addEventListener("resize", () => scheduleLayoutAudit(), { passive: true });
    window.addEventListener("animationend", () => scheduleLayoutAudit(), { passive: true });
    window.addEventListener("transitionend", () => scheduleLayoutAudit(), { passive: true });
  }
  function reportLocalAssetFailure(event) {
    const el = event.target;
    if (!(el instanceof Element) || isLavishUi(el)) return;
    const tag = String(el.tagName || "").toLowerCase();
    if (!["img", "script", "link", "source", "video", "audio", "iframe"].includes(tag)) return;
    const raw = String(el.getAttribute("src") || el.getAttribute("href") || "");
    if (!raw) return;
    let resolved;
    try {
      resolved = new URL(raw, document.baseURI);
    } catch {
      return;
    }
    if (resolved.origin !== window.location.origin) return;
    postArtifactMessage("lavish:artifactAssetFailure", {
      detail: "<" + tag + "> could not load " + resolved.pathname
    });
  }
  window.addEventListener("error", reportLocalAssetFailure, true);
  let activeCardContext = null;
  let reviewStateTimer = 0;
  let draftRestoreTimer = 0;
  const REVIEW_DRAFT_ANCHOR_SETTLE_MS = 1500;
  function cancelPendingDraftRestore() {
    if (!draftRestoreTimer) return;
    window.clearTimeout(draftRestoreTimer);
    draftRestoreTimer = 0;
  }
  function safeQuerySelector(selector2) {
    try {
      return document.querySelector(String(selector2 || ""));
    } catch {
      return null;
    }
  }
  function lavishQuestionControls() {
    const entries = [];
    for (const scope of document.querySelectorAll("[data-lavish-question]")) {
      const question = String(scope.getAttribute("data-lavish-question") || "");
      const controls = [...scope.querySelectorAll("input,select,textarea")];
      controls.forEach((el, index) => {
        const control = (
          /** @type {any} */
          el
        );
        const type = String(control.getAttribute("type") || control.type || "text").toLowerCase();
        if (["button", "submit", "reset", "file", "image", "password"].includes(type)) return;
        if (entries.length >= 200) return;
        entries.push({
          el: control,
          key: [
            question,
            String(control.getAttribute("name") || control.id || ""),
            type,
            String(control.getAttribute("value") || "")
          ].join("|").slice(0, 300),
          index,
          question,
          type
        });
      });
    }
    return entries;
  }
  function collectReviewState() {
    const card = shadow ? shadow.querySelector(".lavish-annotation-card") : null;
    const textarea = card ? card.querySelector("textarea") : null;
    const text = textarea ? String(textarea.value || "") : "";
    return {
      // A text-range card is anchored to a live Range, which a reload invalidates - restoring it
      // could point the annotation at different text, so only element cards come back.
      card: activeCardContext && activeCardContext.tag !== "text" && text.trim() ? { selector: String(activeCardContext.selector || ""), text: text.slice(0, 4e3) } : null,
      fields: lavishQuestionControls().map((entry) => ({
        key: entry.key,
        index: entry.index,
        question: entry.question,
        type: entry.type,
        value: String(entry.el.value === void 0 || entry.el.value === null ? "" : entry.el.value).slice(0, 2e3),
        checked: entry.type === "checkbox" || entry.type === "radio" ? Boolean(entry.el.checked) : null
      }))
    };
  }
  function scheduleReviewStateReport() {
    if (reviewStateTimer) window.clearTimeout(reviewStateTimer);
    reviewStateTimer = window.setTimeout(() => {
      reviewStateTimer = 0;
      postArtifactMessage("lavish:reviewState", { state: collectReviewState() });
    }, 120);
  }
  function restoreReviewState(state) {
    if (!state || typeof state !== "object") return;
    const fields = Array.isArray(state.fields) ? state.fields : [];
    if (fields.length) {
      const entries = lavishQuestionControls();
      for (const field of fields) {
        const match = entries.find((entry) => entry.key === field.key) || entries.find((entry) => entry.question === field.question && entry.index === field.index);
        if (!match) continue;
        if (field.checked === null) match.el.value = String(field.value ?? "");
        else match.el.checked = Boolean(field.checked);
      }
    }
    const card = state.card;
    if (!card || !card.selector || !String(card.text || "").trim()) return;
    const target = safeQuerySelector(card.selector);
    if (!target) {
      cancelPendingDraftRestore();
      draftRestoreTimer = window.setTimeout(() => {
        draftRestoreTimer = 0;
        if (activeCardContext) return;
        const late = safeQuerySelector(card.selector);
        if (late) {
          showAnnotationCard(late, { restoreText: String(card.text) });
          return;
        }
        postArtifactMessage("lavish:reviewDraftUnrestorable", { selector: String(card.selector) });
      }, REVIEW_DRAFT_ANCHOR_SETTLE_MS);
      return;
    }
    showAnnotationCard(target, { restoreText: String(card.text) });
  }
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el instanceof Element && el.closest("[data-lavish-question]")) scheduleReviewStateReport();
  });
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (el instanceof Element && el.closest("[data-lavish-question]")) scheduleReviewStateReport();
  });
  function ensureShadow() {
    if (shadow) return shadow;
    const host = document.createElement("div");
    host.className = "lavish-annotation-root";
    host.setAttribute("data-lavish-ui", "annotation-root");
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: "open" });
    for (const type of ["keydown", "keypress", "keyup"]) {
      shadow.addEventListener(type, (event) => event.stopPropagation());
    }
    const style = document.createElement("style");
    style.textContent = `:host{all:initial;position:fixed;z-index:2147483647;left:0;top:0;color-scheme:dark;--ink-900:#0f1115;--ink-800:#11141a;--ink-700:#171a21;--ink-600:#1c212b;--steel-700:#2a2f3a;--steel-600:#303745;--steel-500:#3c4557;--steel-400:#8c96aa;--steel-300:#aeb6c6;--steel-200:#b9c0cf;--steel-100:#d8deea;--cream-50:#fffbf3;--cream-100:#f7f3ea;--cream-200:#e8e1cf;--brass-500:#f4c95d;--brass-400:#ffd877;--brass-ink:#17130a;--bg:var(--ink-900);--bg-panel:var(--ink-800);--bg-elevated:var(--ink-600);--fg:var(--cream-100);--fg-faint:var(--steel-300);--border:var(--steel-600);--accent:#f4c95d;--accent-hover:#ffd877;--font-sans:Geist,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--font-mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--radius-md:10px;--radius-xl:14px;--shadow-floating:0 20px 70px rgba(0,0,0,.35);font-family:var(--font-sans)}*{box-sizing:border-box}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.lavish-text-highlight{position:fixed;pointer-events:none;background:rgba(244,201,93,.28);border-radius:2px;box-shadow:0 0 0 1px rgba(244,201,93,.45)}.lavish-annotation-card{position:fixed;width:min(320px,calc(100vw - 24px));padding:12px;border-radius:var(--radius-xl);background:var(--bg-panel);color:var(--fg);border:1px solid var(--accent);box-shadow:var(--shadow-floating);font:14px/1.4 var(--font-sans)}.lavish-heading{font-weight:700;margin-bottom:6px}.lavish-annotation-card textarea{width:100%;min-height:86px;resize:vertical;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg);color:var(--fg);padding:9px;font:inherit;font-family:var(--font-sans)}.lavish-annotation-card textarea::placeholder{color:var(--fg-faint)}.lavish-annotation-card .lavish-hint{margin-top:6px;font-size:11px;color:var(--fg-faint)}.lavish-annotation-card .lavish-hint-alert{color:#ff9d7a;font-weight:700}.lavish-annotation-card .lavish-row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}.lavish-annotation-card button{border:0;border-radius:var(--radius-md);padding:8px 10px;font-family:var(--font-sans);font-size:13px;font-weight:700;cursor:pointer}.lavish-annotation-card button:active{opacity:.85}.lavish-annotation-card .lavish-send{background:var(--accent);color:var(--brass-ink)}.lavish-annotation-card .lavish-send:hover{background:var(--accent-hover)}.lavish-annotation-card .lavish-cancel{background:var(--steel-700);color:var(--fg)}.lavish-annotation-card.is-dropping{outline:2px dashed var(--accent);outline-offset:3px}.lavish-attachments{display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:176px;overflow-y:auto}.lavish-attachment-chip{display:flex;align-items:center;gap:8px;padding:6px;border-radius:var(--radius-md);background:var(--bg);border:1px solid var(--border)}.lavish-attachment-chip.is-error{border-color:#e0623d}.lavish-attachment-thumb{width:32px;height:32px;border-radius:6px;object-fit:cover;background:var(--ink-700);flex:0 0 auto}.lavish-attachment-thumb-empty{display:inline-block}.lavish-attachment-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto}.lavish-attachment-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lavish-attachment-status{font-size:11px;color:var(--fg-faint)}.lavish-attachment-status-error{color:#ff9d7a}.lavish-attachment-retry{flex:0 0 auto;padding:4px 8px;font-size:11px;font-weight:700;border-radius:8px;background:var(--steel-700);color:var(--fg);cursor:pointer;border:0}.lavish-attachment-remove{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0!important;border-radius:50%;background:transparent;color:rgba(255,255,255,.85);cursor:pointer;border:0}.lavish-attachment-remove:hover{background:rgba(255,255,255,.14);color:#fff}.lavish-attach-row{margin-top:8px}.lavish-attach{display:inline-flex;align-items:center;gap:6px;padding:6px 9px!important;background:var(--steel-700)!important;color:var(--fg)!important;font-size:12px!important}.lavish-attach:hover{background:var(--steel-600)!important}.lavish-reveal-marker{position:fixed;pointer-events:none;border:2px solid var(--accent);border-radius:4px;box-shadow:0 0 0 4px rgba(244,201,93,.22);animation:lavish-reveal-pulse 2.4s var(--ease,ease-out) forwards}@keyframes lavish-reveal-pulse{0%{opacity:0}12%{opacity:1}70%{opacity:1}100%{opacity:0}}`;
    shadow.appendChild(style);
    return shadow;
  }
  function closeCard() {
    const hadCard = activeCardContext !== null;
    activeCardContext = null;
    if (activeAttachments) {
      activeAttachments.destroy();
      activeAttachments = null;
    }
    if (shadow) {
      for (const el of [...shadow.querySelectorAll(".lavish-annotation-card")]) el.remove();
    }
    clearHighlight(hovered);
    clearHighlight(selected);
    hovered = null;
    clearTextHighlight();
    selected = null;
    if (hadCard) scheduleReviewStateReport();
  }
  function isApplePlatform() {
    return /Mac|iP(hone|ad|od)/.test(navigator.platform);
  }
  function showAnnotationCard(target, options2 = {}) {
    cancelPendingDraftRestore();
    const root = ensureShadow();
    closeCard();
    const c = options2.context || context(target, { table: true });
    activeCardContext = c;
    let anchor = target;
    if (options2.range) {
      highlightTextRange(options2.range);
    } else {
      anchor = annotationTargetEl(target);
      selected = anchor;
      highlightElement(selected);
    }
    const rect = options2.range ? options2.range.getBoundingClientRect() : anchor.getBoundingClientRect();
    const card = document.createElement("div");
    card.className = "lavish-annotation-card";
    const nodeLabel = c.tag === "mermaid-node" ? c.target?.label || c.text || "" : "";
    const isTableCell = c.target?.type === "table-cell";
    const isCellItself = isTableCell && (c.tag === "td" || c.tag === "th");
    const tableLabel = isTableCell ? [c.target?.rowLabel, c.target?.columnLabel].filter(Boolean).join(" \u2192 ") : "";
    const heading = c.tag === "text" ? "Annotate text" : tableLabel ? isCellItself ? "Annotate cell: " + escapeAnnotationText(tableLabel) : "Annotate &lt;" + c.tag + "&gt; in " + escapeAnnotationText(tableLabel) : c.tag === "mermaid-node" ? "Annotate node" + (nodeLabel ? ": " + escapeAnnotationText(nodeLabel) : "") : "Annotate &lt;" + c.tag + "&gt;";
    const placeholder = c.tag === "text" ? "Tell the agent what to change about this text..." : isCellItself ? "Tell the agent what to change about this table cell..." : c.tag === "mermaid-node" ? "Tell the agent what to change about this diagram node..." : "Tell the agent what to change about this element...";
    const sendNowHint = isApplePlatform() ? "\u2318" : "Ctrl";
    card.innerHTML = '<div class="lavish-heading">' + heading + '</div><textarea placeholder="' + placeholder + '"></textarea><div class="lavish-attachments" data-attachments hidden></div><div class="lavish-attach-row"><button class="lavish-attach" type="button"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Attach image</span></button><input class="lavish-attach-input" type="file" accept="' + ATTACHMENT_IMAGE_TYPES.accept + '" multiple hidden></div><div class="lavish-hint">Enter to queue &middot; ' + sendNowHint + '+Enter to send &middot; paste or drop an image</div><div class="lavish-row"><button class="lavish-cancel" type="button">Cancel</button><button class="lavish-send" type="button">Queue</button></div>';
    root.appendChild(card);
    function positionCard() {
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - card.offsetWidth - 12);
      const top = Math.min(Math.max(12, rect.bottom + 8), window.innerHeight - card.offsetHeight - 12);
      card.style.left = left + "px";
      card.style.top = top + "px";
    }
    positionCard();
    const textarea = (
      /** @type {HTMLTextAreaElement | null} */
      card.querySelector("textarea")
    );
    const cancelButton = (
      /** @type {HTMLButtonElement | null} */
      card.querySelector(".lavish-cancel")
    );
    const sendButton = (
      /** @type {HTMLButtonElement | null} */
      card.querySelector(".lavish-send")
    );
    const attachmentsList = (
      /** @type {HTMLDivElement | null} */
      card.querySelector("[data-attachments]")
    );
    const attachButton = (
      /** @type {HTMLButtonElement | null} */
      card.querySelector(".lavish-attach")
    );
    const attachInput = (
      /** @type {HTMLInputElement | null} */
      card.querySelector(".lavish-attach-input")
    );
    const attachNotice = (
      /** @type {HTMLDivElement | null} */
      card.querySelector(".lavish-hint")
    );
    if (!textarea || !cancelButton || !sendButton || !attachmentsList || !attachButton || !attachInput) return;
    const defaultHintHtml = attachNotice ? attachNotice.innerHTML : "";
    const notify = (message) => {
      if (!attachNotice) return;
      if (message) {
        attachNotice.textContent = message;
        attachNotice.classList.add("lavish-hint-alert");
      } else {
        attachNotice.innerHTML = defaultHintHtml;
        attachNotice.classList.remove("lavish-hint-alert");
      }
    };
    const attachments = makeAttachmentsController(attachmentsList, { notify, onLayout: positionCard });
    activeAttachments = attachments;
    attachButton.onclick = () => attachInput.click();
    attachInput.addEventListener("change", () => {
      attachments.addFiles(attachInput.files);
      attachInput.value = "";
    });
    textarea.addEventListener("paste", (event) => {
      const { images, keepTextPaste } = planClipboardPaste(event.clipboardData, ATTACHMENT_ACCEPTED_MIME);
      if (images.length && attachments.addFiles(images) && !keepTextPaste) event.preventDefault();
    });
    card.addEventListener("dragover", (event) => {
      if (dataTransferHasFiles(event.dataTransfer)) {
        event.preventDefault();
        card.classList.add("is-dropping");
      }
    });
    card.addEventListener("dragleave", (event) => {
      if (event.target === card) card.classList.remove("is-dropping");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-dropping");
      const { images, unsupported } = partitionDroppedFiles(event.dataTransfer, ATTACHMENT_ACCEPTED_MIME);
      if (images.length) attachments.addFiles(images);
      if (unsupported.length) attachments.rejectUnsupportedBatch(unsupported);
      if (!images.length && !unsupported.length && dataTransferHasFiles(event.dataTransfer)) {
        attachments.rejectUnsupported("file");
      }
    });
    function tryQueue() {
      if (attachments.hasPending()) {
        attachments.setQueueBlocked(true);
        return false;
      }
      if (attachments.hasErrors()) {
        attachments.setQueueBlocked(true);
        return false;
      }
      attachments.setQueueBlocked(false);
      const prompt = textarea.value.trim();
      const readyAttachments = attachments.collectReady();
      if (prompt || readyAttachments.length) {
        queuePrompt(prompt, { ...c, queueKey: "", attachments: readyAttachments });
      }
      closeCard();
      return true;
    }
    cancelButton.onclick = closeCard;
    sendButton.onclick = () => {
      tryQueue();
    };
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        const sendNow = (event.ctrlKey || event.metaKey) && (!!textarea.value.trim() || attachments.hasReady());
        const queued = tryQueue();
        if (queued && sendNow) sendQueuedPrompts();
      } else if (event.key === "Escape" && !event.isComposing && event.keyCode !== 229) {
        if (textarea.value.trim() || attachments.hasPending() || attachments.hasErrors() || attachments.hasReady())
          return;
        event.preventDefault();
        closeCard();
      }
    });
    textarea.addEventListener("input", scheduleReviewStateReport);
    if (typeof options2.restoreText === "string") {
      textarea.value = options2.restoreText;
      scheduleReviewStateReport();
    }
    setTimeout(() => textarea.focus(), 0);
  }
  function dataTransferHasFiles(dataTransfer) {
    if (!dataTransfer) return false;
    if ((dataTransfer.files || []).length) return true;
    for (const item of dataTransfer.items || []) {
      if (item.kind === "file") return true;
    }
    return (dataTransfer.types || []).includes?.("Files");
  }
  function setDocumentMeta(meta) {
    const payload = {};
    for (
      const field of
      /** @type {const} */
      ["title", "icon"]
    ) {
      const value = meta?.[field];
      if (typeof value === "string" || value === null) payload[field] = value;
    }
    postArtifactMessage("lavish:documentMeta", payload);
  }
  window.lavish = {
    queuePrompt,
    sendQueuedPrompts,
    endSession,
    getQueuedPrompts: () => [],
    setStatus: (message) => postArtifactMessage("lavish:status", { message: String(message) }),
    setDocumentMeta,
    snapshot
  };
  window.addEventListener("message", (event) => {
    if (event.source !== parent) return;
    const msg = event.data || {};
    if (msg.type === "lavish:setAnnotationMode") setAnnotationMode(msg.enabled);
    if (msg.type === "lavish:attachmentResult") {
      if (!isTrustedAttachmentResult(event, { parentWindow: parent, nonce: ATTACHMENT_NONCE })) return;
      activeAttachments?.handleResult(msg.localId, msg.ok, msg.id, msg.error);
    }
    if (msg.type === "lavish:requestSnapshot") {
      postArtifactMessage("lavish:snapshot", {
        snapshot: snapshot(),
        snapshot_request_id: typeof msg.snapshot_request_id === "string" ? msg.snapshot_request_id : ""
      });
    }
    if (msg.type === "lavish:restoreScroll") {
      window.scrollTo(Number(msg.x) || 0, Number(msg.y) || 0);
    }
    if (msg.type === "lavish:restoreReviewState") restoreReviewState(msg.state);
    if (msg.type === "lavish:revealElement") revealElement(msg.selector);
    if (msg.type === "lavish:queuedAnchors") {
      queuedAnchorSelectors = new Set(Array.isArray(msg.selectors) ? msg.selectors.map(String) : []);
    }
    if (msg.type === "lavish:annotateElement" && annotationMode) {
      const target = safeQuerySelector(msg.selector);
      if (target) showAnnotationCard(target);
    }
  });
  function revealElement(selector2) {
    const target = selector2 === "html" ? document.documentElement : safeQuerySelector(selector2);
    if (!(target instanceof Element)) return;
    target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    const root = ensureShadow();
    for (const el of [...root.querySelectorAll(".lavish-reveal-marker")]) el.remove();
    const rect = target.getBoundingClientRect();
    const marker = document.createElement("div");
    marker.className = "lavish-reveal-marker";
    marker.style.left = rect.left + "px";
    marker.style.top = rect.top + "px";
    marker.style.width = Math.max(rect.width, 4) + "px";
    marker.style.height = Math.max(rect.height, 4) + "px";
    root.appendChild(marker);
    window.setTimeout(() => marker.remove(), 2400);
  }
  document.addEventListener(
    "keydown",
    (event) => {
      if (!isModeToggleHotkeyEvent(event)) return;
      event.preventDefault();
      postArtifactMessage("lavish:toggleAnnotationMode");
    },
    true
  );
  let scrollFrame = 0;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        postArtifactMessage("lavish:scroll", { x: window.scrollX, y: window.scrollY });
      });
    },
    { passive: true }
  );
  document.addEventListener(
    "mouseover",
    (event) => {
      if (!annotationMode || isLavishUi(event.target) || isLavishAction(event.target) || isInteractiveControl(event.target))
        return;
      const target = annotationTargetEl(event.target);
      if (target === selected) return;
      if (hovered && hovered !== selected) clearHighlight(hovered);
      hovered = target;
      highlightElement(hovered);
    },
    true
  );
  document.addEventListener(
    "mouseout",
    () => {
      if (hovered && hovered !== selected) {
        clearHighlight(hovered);
        hovered = null;
      }
    },
    true
  );
  document.addEventListener(
    "mouseup",
    (event) => {
      if (!annotationMode || isLavishUi(event.target) || isLavishAction(event.target) || isInteractiveControl(event.target))
        return;
      const c = textSelectionContext(document.getSelection());
      if (!c) return;
      ignoreNextClick = true;
      showAnnotationCard(c.element, { context: c, range: c.range });
    },
    true
  );
  document.addEventListener(
    "click",
    (event) => {
      if (!annotationMode || isLavishUi(event.target) || isLavishAction(event.target) || isInteractiveControl(event.target))
        return;
      const followModifier = isApplePlatform() ? event.metaKey : event.ctrlKey;
      if (followModifier && /** @type {Element} */
      event.target?.closest?.("a[href]")) {
        ignoreNextClick = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (ignoreNextClick) {
        ignoreNextClick = false;
        return;
      }
      const clicked = queuedAnchorSelectors.size ? context(event.target) : null;
      const node = clicked?.target?.type === "mermaid-node" ? clicked.target.selector : "";
      const selector2 = [clicked?.selector, node].find((candidate) => candidate && queuedAnchorSelectors.has(candidate));
      if (selector2) {
        closeCard();
        postArtifactMessage("lavish:editQueuedAnchor", { selector: selector2 });
        return;
      }
      showAnnotationCard(event.target);
    },
    true
  );
  setAnnotationMode(annotationMode);
  postArtifactMessage("lavish:annotationMode", { enabled: initialAnnotationMode });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startLayoutAudit, { once: true });
  } else {
    startLayoutAudit();
  }
  enhanceMermaid();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceMermaid, { once: true });
  }
  const mermaidObserver = new MutationObserver(() => scheduleMermaidEnhance());
  mermaidObserver.observe(document.documentElement, { childList: true, subtree: true });
  function reportArtifactRevisions() {
    let payload = { revisions: [], marks: [] };
    try {
      payload = readArtifactRevisions(document);
    } catch {
    }
    postArtifactMessage("lavish:revisions", payload);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reportArtifactRevisions, { once: true });
  } else {
    reportArtifactRevisions();
  }
}

// src/layout-warnings.js
import crypto2 from "node:crypto";
var ACTIVE_LAYOUT_WARNING_STATUSES = ["open", "queued", "recurring", "unverified", "reopened"];
var DEFAULT_DIAGNOSTIC_VIEWPORT_CLASSES = ["mobile", "compact", "desktop"];
var MAX_HISTORY_ENTRIES = 20;
var MAX_SERIALIZED_HISTORY_ENTRIES = 10;
var MAX_STORED_WARNINGS = 200;
var MAX_QUEUED_WARNINGS_PER_PROMPT = 50;
function viewportClassFor(viewportWidth) {
  const width = finiteNumber(viewportWidth);
  if (width <= 640) return "mobile";
  if (width <= 1024) return "compact";
  return "desktop";
}
function viewportClassLabel(viewportClass) {
  if (viewportClass === "mobile") return "Mobile";
  if (viewportClass === "compact") return "Tablet / compact";
  return "Desktop";
}
function layoutWarningFingerprint({ rule, target, viewportClass }) {
  const payload = `${normalizeText(rule)}|${normalizeText(target)}|${normalizeText(viewportClass)}`;
  return crypto2.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
function componentIdentity(selector) {
  const last = normalizeText(selector).split(">").pop()?.trim() || "";
  if (!last) return "";
  const id = last.match(/#([A-Za-z0-9_-]+)/);
  if (id) return `#${id[1]}`;
  const className = last.match(/\.([A-Za-z0-9_-]+)/);
  if (className) return `.${className[1]}`;
  const tag = last.match(/^([A-Za-z][A-Za-z0-9-]*)/);
  return tag ? tag[1] : "";
}
var RULE_DESCRIPTIONS = {
  "page-horizontal-overflow": {
    title: "Page scrolls sideways",
    explain: (warning) => `The page is ${pxText(warning.overflowPx)} wider than the ${pxText(warning.viewportWidth)} viewport, so content sits off-screen.`
  },
  "clipped-text": {
    title: "Text cut off by its container",
    explain: (warning) => `Rendered text crosses its container's ${axisEdge(warning.axis)} edge by ${pxText(warning.overflowPx)} and is hidden.`
  },
  "clipped-control": {
    title: "Control cut off by its container",
    explain: (warning) => `A required control crosses its container's ${axisEdge(warning.axis)} edge by ${pxText(warning.overflowPx)}, so part of it cannot be used.`
  },
  "viewport-unreachable-control": {
    title: "Control outside the viewport",
    explain: (warning) => `A required control sits ${pxText(warning.overflowPx)} outside the ${axisEdge(warning.axis)} edge of the viewport and cannot be reached.`
  },
  "viewport-unreachable-content": {
    title: "Text outside the viewport",
    explain: (warning) => `Rendered text sits ${pxText(warning.overflowPx)} outside the ${axisEdge(warning.axis)} edge of the viewport and cannot be read.`
  },
  "overlapping-text": {
    title: "Text covered by another element",
    explain: () => "An opaque sibling covers nearly all of this text, so it cannot be read."
  }
};
function describeLayoutWarning(warning) {
  const normalized = {
    axis: warning?.axis,
    overflowPx: warning?.overflow_px ?? warning?.overflowPx,
    viewportWidth: warning?.viewport_width ?? warning?.viewportWidth
  };
  const description = RULE_DESCRIPTIONS[warning?.rule ?? warning?.kind];
  if (!description) {
    return {
      title: "Layout failure",
      explanation: `The browser proved a severe layout failure on this element${normalized.overflowPx ? ` (${pxText(normalized.overflowPx)})` : ""}.`
    };
  }
  return { title: description.title, explanation: description.explain(normalized) };
}
var STATUS_LABELS = {
  open: "Open",
  queued: "Queued for fix",
  recurring: "Still present",
  unverified: "Unverified",
  reopened: "Returned",
  resolved: "Resolved",
  dismissed: "Dismissed",
  obsolete: "Obsolete"
};
function layoutWarningStatusLabel(status) {
  return STATUS_LABELS[status] || "Open";
}
function isActiveLayoutWarning(warning) {
  return ACTIVE_LAYOUT_WARNING_STATUSES.includes(String(warning?.status || ""));
}
function activeLayoutWarnings(warnings) {
  return (Array.isArray(warnings) ? warnings : []).filter(isActiveLayoutWarning);
}
function activeLayoutWarningCount(warnings) {
  return activeLayoutWarnings(warnings).length;
}
function hasOutstandingRepairRequest(warning) {
  if (!warning) return false;
  if (warning.status === "queued") return true;
  return warning.status === "unverified" && Boolean(warning.queued_at);
}
function isSelectableLayoutWarning(warning) {
  return isActiveLayoutWarning(warning) && !hasOutstandingRepairRequest(warning);
}
function applyDiagnosticPass(warnings, pass) {
  const previous = normalizeStoredWarnings(warnings);
  const at = String(pass?.at || (/* @__PURE__ */ new Date()).toISOString());
  const revision = Math.max(0, Math.trunc(finiteNumber(pass?.revision)));
  const viewportWidth = finiteNumber(pass?.viewportWidth);
  const viewportClass = viewportClassFor(viewportWidth);
  const complete = pass?.complete !== false;
  const targetPresenceComplete = pass?.targetPresenceComplete === true;
  const observations = /* @__PURE__ */ new Map();
  for (const finding of normalizeFindings(pass?.findings, viewportWidth)) {
    const fingerprint = layoutWarningFingerprint({
      rule: finding.rule,
      target: finding.selector,
      viewportClass
    });
    if (!observations.has(fingerprint)) observations.set(fingerprint, finding);
  }
  const next = previous.map((warning) => {
    if (warning.viewport_class !== viewportClass) return warning;
    const observation = observations.get(warning.fingerprint);
    if (observation) {
      observations.delete(warning.fingerprint);
      return recordDetection(warning, observation, { at, revision, viewportWidth });
    }
    if (!complete || !targetPresenceComplete) return recordUnverified(warning, { at, revision });
    if (revision <= finiteNumber(warning.last_seen_revision)) return warning;
    if (!isActiveLayoutWarning(warning) && warning.status !== "dismissed") return warning;
    return recordResolved(warning, { at, revision });
  });
  for (const [fingerprint, observation] of observations) {
    next.push(createWarning(fingerprint, observation, { at, revision, viewportClass, viewportWidth }));
  }
  const pruned = pruneWarnings(next);
  return { warnings: pruned, changed: !sameWarnings(previous, pruned) };
}
function queueLayoutWarnings(warnings, ids, { revision = 0, at = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const wanted = new Set(
    (Array.isArray(ids) ? ids : []).slice(0, MAX_QUEUED_WARNINGS_PER_PROMPT).map((id) => String(id))
  );
  const previous = normalizeStoredWarnings(warnings);
  const queued = [];
  const next = previous.map((warning) => {
    if (!wanted.has(warning.id) || !isSelectableLayoutWarning(warning)) return warning;
    const updated = withHistory(
      {
        ...warning,
        status: "queued",
        queued_revision: Math.max(0, Math.trunc(finiteNumber(revision))),
        queued_at: at,
        queue_attempts: finiteNumber(warning.queue_attempts) + 1
      },
      { at, revision, event: "queued" }
    );
    queued.push(updated);
    return updated;
  });
  return { warnings: next, queued, changed: queued.length > 0 };
}
function dismissLayoutWarning(warnings, id, { revision = 0, at = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const target = String(id || "");
  let changed = false;
  const next = normalizeStoredWarnings(warnings).map((warning) => {
    if (warning.id !== target || !isSelectableLayoutWarning(warning)) return warning;
    changed = true;
    return withHistory(
      {
        ...warning,
        status: "dismissed",
        dismissed_revision: Math.max(0, Math.trunc(finiteNumber(revision))),
        dismissed_at: at
      },
      { at, revision, event: "dismissed", note: "dismissed for this artifact revision" }
    );
  });
  return { warnings: next, changed };
}
function markObsoleteViewportWarnings(warnings, viewportClasses = DEFAULT_DIAGNOSTIC_VIEWPORT_CLASSES, { at = (/* @__PURE__ */ new Date()).toISOString(), revision = 0 } = {}) {
  const configured = new Set(
    (Array.isArray(viewportClasses) ? viewportClasses : DEFAULT_DIAGNOSTIC_VIEWPORT_CLASSES).map(
      (value) => String(value)
    )
  );
  let changed = false;
  const next = normalizeStoredWarnings(warnings).map((warning) => {
    if (configured.has(warning.viewport_class) || !isActiveLayoutWarning(warning)) return warning;
    changed = true;
    const reason = `the ${warning.viewport_class} viewport is no longer in the configured diagnostic set, so this warning can no longer be re-checked`;
    return withHistory(
      { ...warning, status: "obsolete", obsolete_reason: reason, obsolete_at: at },
      { at, revision, event: "obsolete", note: reason }
    );
  });
  return { warnings: next, changed };
}
function serializeLayoutWarning(warning) {
  const { title, explanation } = describeLayoutWarning(warning);
  return {
    id: warning.id,
    fingerprint: warning.fingerprint,
    rule: warning.rule,
    severity: warning.severity,
    status: warning.status,
    status_label: layoutWarningStatusLabel(warning.status),
    title,
    explanation,
    selector: warning.selector,
    component: warning.component,
    axis: warning.axis,
    overflow_px: warning.overflow_px,
    viewport_class: warning.viewport_class,
    viewport_label: viewportClassLabel(warning.viewport_class),
    viewport_width: warning.viewport_width,
    first_seen_at: warning.first_seen_at,
    last_seen_at: warning.last_seen_at,
    last_seen_revision: warning.last_seen_revision,
    queued_at: warning.queued_at || "",
    queue_attempts: warning.queue_attempts || 0,
    active: isActiveLayoutWarning(warning),
    selectable: isSelectableLayoutWarning(warning),
    outstanding: hasOutstandingRepairRequest(warning),
    ...warning.obsolete_reason ? { obsolete_reason: warning.obsolete_reason } : {},
    history: (warning.history || []).slice(-MAX_SERIALIZED_HISTORY_ENTRIES)
  };
}
function serializeLayoutWarnings(warnings) {
  return normalizeStoredWarnings(warnings).map(serializeLayoutWarning);
}
function layoutWarningPromptPayload(warnings) {
  const selected = normalizeStoredWarnings(warnings).slice(0, MAX_QUEUED_WARNINGS_PER_PROMPT);
  const lines = selected.map((warning, index) => {
    const { title, explanation } = describeLayoutWarning(warning);
    return `${index + 1}. [${warning.id}] ${title} - ${explanation} Target: ${warning.selector || "(page)"}. Viewport: ${viewportClassLabel(warning.viewport_class)} (${pxText(warning.viewport_width)}). Status: ${layoutWarningStatusLabel(warning.status)}.`;
  });
  const count = selected.length;
  const prompt = `Fix ${count === 1 ? "this layout issue" : `these ${count} layout issues`} the browser detected in this artifact:
${lines.join("\n")}

Apply every listed fix in one pass before saving so the review refreshes once. A queued layout issue is a repair request, not a resolved issue: Lavish only marks it resolved after a newer artifact load and a complete diagnostic pass for the same viewport no longer detects it.`;
  const target = {
    type: "layout-warnings",
    artifact_revision: Math.max(0, Math.trunc(finiteNumber(selected[0]?.queued_revision))),
    warnings: selected.map((warning) => ({
      id: warning.id,
      rule: warning.rule,
      selector: warning.selector,
      component: warning.component,
      axis: warning.axis,
      overflow_px: warning.overflow_px,
      viewport_class: warning.viewport_class,
      viewport_width: warning.viewport_width,
      status: warning.status,
      last_seen_at: warning.last_seen_at
    }))
  };
  return {
    prompt,
    text: count === 1 ? "Layout issue: 1 selected" : `Layout issues: ${count} selected`,
    target
  };
}
function normalizeLayoutWarningsTarget(target) {
  const warnings = Array.isArray(target?.warnings) ? target.warnings : [];
  const normalized = {
    type: "layout-warnings",
    warnings: warnings.slice(0, MAX_QUEUED_WARNINGS_PER_PROMPT).map((warning) => ({
      id: normalizeText(warning?.id).slice(0, 64),
      rule: normalizeText(warning?.rule).slice(0, 64),
      selector: normalizeText(warning?.selector).slice(0, 300),
      component: normalizeText(warning?.component).slice(0, 120),
      axis: warning?.axis === "vertical" ? "vertical" : "horizontal",
      overflow_px: finiteNumber(warning?.overflow_px),
      viewport_class: normalizeText(warning?.viewport_class).slice(0, 16),
      viewport_width: finiteNumber(warning?.viewport_width),
      status: normalizeText(warning?.status).slice(0, 16),
      last_seen_at: normalizeText(warning?.last_seen_at).slice(0, 40)
    }))
  };
  if (Object.hasOwn(target || {}, "artifact_revision")) {
    normalized.artifact_revision = Math.max(0, Math.trunc(finiteNumber(target.artifact_revision)));
  }
  return normalized;
}
function resolveDiagnosticViewportClasses(env = process.env) {
  const raw = String(env.LAVISH_AXI_DIAGNOSTIC_VIEWPORTS || "").trim();
  if (!raw) return [...DEFAULT_DIAGNOSTIC_VIEWPORT_CLASSES];
  const configured = raw.split(",").map((value) => value.trim().toLowerCase()).filter((value) => DEFAULT_DIAGNOSTIC_VIEWPORT_CLASSES.includes(value));
  return configured.length ? [...new Set(configured)] : [...DEFAULT_DIAGNOSTIC_VIEWPORT_CLASSES];
}
function createWarning(fingerprint, observation, { at, revision, viewportClass, viewportWidth }) {
  return withHistory(
    {
      id: fingerprint,
      fingerprint,
      rule: observation.rule,
      severity: "error",
      status: "open",
      selector: observation.selector,
      component: componentIdentity(observation.selector),
      axis: observation.axis,
      overflow_px: observation.overflowPx,
      viewport_class: viewportClass,
      viewport_width: viewportWidth,
      first_seen_at: at,
      first_seen_revision: revision,
      last_seen_at: at,
      last_seen_revision: revision,
      observation_count: 1,
      queued_revision: 0,
      queued_at: "",
      queue_attempts: 0,
      dismissed_revision: 0,
      history: []
    },
    { at, revision, event: "detected" }
  );
}
function recordDetection(warning, observation, { at, revision, viewportWidth }) {
  const status = detectedStatus(warning, revision);
  const unchanged = status === warning.status && revision <= finiteNumber(warning.last_seen_revision) && warning.selector === observation.selector && warning.axis === observation.axis && finiteNumber(warning.overflow_px) === observation.overflowPx && finiteNumber(warning.viewport_width) === viewportWidth;
  if (unchanged) return warning;
  const updated = {
    ...warning,
    rule: observation.rule,
    selector: observation.selector,
    component: componentIdentity(observation.selector),
    axis: observation.axis,
    overflow_px: observation.overflowPx,
    viewport_width: viewportWidth,
    last_seen_at: at,
    last_seen_revision: Math.max(finiteNumber(warning.last_seen_revision), revision),
    observation_count: finiteNumber(warning.observation_count) + 1,
    status
  };
  if (status === warning.status) return updated;
  const note = status === "recurring" ? "still present after a newer artifact revision" : status === "reopened" ? "detected again after being resolved" : "";
  return withHistory(updated, { at, revision, event: status, note });
}
function detectedStatus(warning, revision) {
  if (warning.status === "dismissed" && revision <= finiteNumber(warning.dismissed_revision)) return "dismissed";
  if (warning.queued_at) {
    return revision > finiteNumber(warning.queued_revision) ? "recurring" : "queued";
  }
  if (warning.status === "resolved") return "reopened";
  if (warning.status === "reopened") return "reopened";
  return "open";
}
function recordUnverified(warning, { at, revision }) {
  if (!isActiveLayoutWarning(warning) || warning.status === "unverified") return warning;
  return withHistory(
    { ...warning, status: "unverified" },
    {
      at,
      revision,
      event: "unverified",
      note: "a diagnostic pass failed or was incomplete, so this warning was preserved rather than cleared"
    }
  );
}
function recordResolved(warning, { at, revision }) {
  return withHistory(
    {
      ...warning,
      status: "resolved",
      resolved_at: at,
      resolved_revision: revision,
      queued_revision: 0,
      queued_at: ""
    },
    { at, revision, event: "resolved", note: "absent from a complete pass on a newer artifact revision" }
  );
}
function withHistory(warning, entry) {
  const history = [
    ...Array.isArray(warning.history) ? warning.history : [],
    {
      at: String(entry.at),
      revision: Math.max(0, Math.trunc(finiteNumber(entry.revision))),
      event: String(entry.event),
      ...entry.note ? { note: String(entry.note).slice(0, 200) } : {}
    }
  ];
  return { ...warning, history: history.slice(-MAX_HISTORY_ENTRIES) };
}
function pruneWarnings(warnings) {
  if (warnings.length <= MAX_STORED_WARNINGS) return warnings;
  const active = warnings.filter(isActiveLayoutWarning);
  const closed = warnings.filter((warning) => !isActiveLayoutWarning(warning));
  const room = Math.max(0, MAX_STORED_WARNINGS - active.length);
  const keptClosed = new Set(closed.slice(-room));
  return warnings.filter((warning) => isActiveLayoutWarning(warning) || keptClosed.has(warning));
}
function normalizeFindings(findings, viewportWidth) {
  if (!Array.isArray(findings)) return [];
  return findings.filter(
    (finding) => finding && typeof finding === "object" && !Array.isArray(finding) && String(finding.severity || "").toLowerCase() === "error"
  ).slice(0, MAX_STORED_WARNINGS).map((finding) => ({
    rule: normalizeText(finding.kind || finding.rule || "layout-failure").slice(0, 64),
    selector: normalizeText(finding.selector).slice(0, 300),
    axis: finding.axis === "vertical" ? "vertical" : "horizontal",
    overflowPx: Math.round(finiteNumber(finding.overflowPx ?? finding.overflow_px)),
    viewportWidth: Math.round(finiteNumber(finding.viewportWidth ?? finding.viewport_width) || viewportWidth)
  }));
}
function normalizeStoredWarnings(warnings) {
  if (!Array.isArray(warnings)) return [];
  return warnings.filter((warning) => warning && typeof warning === "object" && !Array.isArray(warning) && warning.id);
}
function sameWarnings(previous, next) {
  return JSON.stringify(previous) === JSON.stringify(next);
}
function normalizeText(value) {
  return value === null || value === void 0 ? "" : String(value).replace(/\s+/g, " ").trim();
}
function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function pxText(value) {
  return `${Math.round(finiteNumber(value))}px`;
}
function axisEdge(axis) {
  return axis === "vertical" ? "bottom" : "right";
}

// src/mermaid-source.js
import crypto3 from "node:crypto";
import { parse } from "parse5";

// src/whiteboard-libraries.js
var LIBRARY_DIR_NAME = "excalidraw-libraries";
var LIBRARY_FILE_EXTENSION = ".excalidrawlib";
var LIBRARY_FILE_MAX_BYTES = 10 * 1024 * 1024;
var LIBRARY_TOTAL_MAX_BYTES = 25 * 1024 * 1024;
var LIBRARY_MAX_ITEMS = 5e3;
var ITEM_NAME_MAX_CHARS = 80;
var ICON_DIRECTIVE_RE = /^\s*%%\s*lavish-icon\s+(\S+)\s+(.+?)\s*$/;
var FLOWCHART_HEADER_RE = /^(flowchart|graph)\b/i;
function libraryIdFromFileName(fileName) {
  return String(fileName || "").replace(/\.excalidrawlib$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function collapseWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}
function normalizeLibraryRef(ref) {
  return collapseWhitespace(ref).toLowerCase();
}
function liveElements(elements) {
  return (Array.isArray(elements) ? elements : []).filter(
    (element) => element && typeof element === "object" && typeof element.type === "string" && !element.isDeleted
  );
}
function derivedItemName(item, elements, index) {
  const explicit = collapseWhitespace(item?.name);
  if (explicit) return explicit.slice(0, ITEM_NAME_MAX_CHARS);
  let title = null;
  for (const element of elements) {
    if (element.type !== "text") continue;
    const text = collapseWhitespace(element.text);
    if ((text.match(/[\p{L}\p{N}]/gu) || []).length < 2) continue;
    const fontSize = Number(element.fontSize) || 0;
    if (!title || fontSize > title.fontSize) title = { text, fontSize };
  }
  if (title) return title.text.slice(0, ITEM_NAME_MAX_CHARS);
  return `item-${index + 1}`;
}
function parseExcalidrawLibrary(text, { id }) {
  let data;
  try {
    data = JSON.parse(String(text));
  } catch {
    throw new Error("not valid JSON");
  }
  let rawItems;
  if (Array.isArray(data?.libraryItems)) rawItems = data.libraryItems;
  else if (Array.isArray(data?.library)) rawItems = data.library.map((elements) => ({ elements }));
  else throw new Error("no libraryItems or library array");
  const items = [];
  const taken = /* @__PURE__ */ new Set();
  rawItems.forEach((item, index) => {
    const elements = liveElements(item?.elements);
    if (elements.length === 0) return;
    const baseName = derivedItemName(item, elements, index);
    let name = baseName;
    for (let suffix = 2; taken.has(normalizeLibraryRef(name)); suffix += 1) name = `${baseName} #${suffix}`;
    taken.add(normalizeLibraryRef(name));
    items.push({ ref: `${id}/${name}`, name, elements });
  });
  if (items.length === 0) throw new Error("no usable items");
  return { id, items };
}
function findLibraryItem(libraries, ref) {
  const wanted = normalizeLibraryRef(ref);
  if (!wanted) return null;
  for (const library of Array.isArray(libraries) ? libraries : []) {
    for (const item of Array.isArray(library?.items) ? library.items : []) {
      if (normalizeLibraryRef(item.ref) === wanted) return item;
    }
  }
  return null;
}
function mermaidHeaderLine(source) {
  const lines = String(source || "").split(/\r?\n/);
  let inFrontmatter = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (index === 0 && line === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line === "---") inFrontmatter = false;
      continue;
    }
    if (!line || line.startsWith("%%")) continue;
    return line;
  }
  return "";
}
function parseLibraryIconDirectives(source) {
  if (!FLOWCHART_HEADER_RE.test(mermaidHeaderLine(source))) return [];
  const directives = [];
  for (const line of String(source || "").split(/\r?\n/)) {
    const match = ICON_DIRECTIVE_RE.exec(line);
    if (match && match[2].includes("/")) directives.push({ nodeId: match[1], ref: collapseWhitespace(match[2]) });
  }
  return directives;
}
function libraryIconSignature(source, libraries) {
  const directives = parseLibraryIconDirectives(source);
  if (directives.length === 0) return "";
  return JSON.stringify(
    directives.map(({ nodeId, ref }) => {
      const item = findLibraryItem(libraries, ref);
      return [nodeId, normalizeLibraryRef(ref), item ? JSON.stringify(item.elements) : null];
    })
  );
}

// src/mermaid-source.js
function hasMermaidClass(value) {
  return value.split(/[\t\n\f\r ]+/).includes("mermaid");
}
function elementHasMermaidClass(node) {
  const classAttribute = Array.isArray(node.attrs) ? node.attrs.find((attribute) => attribute.name.toLowerCase() === "class") : null;
  return Boolean(classAttribute && hasMermaidClass(classAttribute.value));
}
function textContent(node) {
  if (node.nodeName === "#text") return String(node.value || "");
  if (node.tagName === "br") return "<br/>";
  return Array.isArray(node.childNodes) ? node.childNodes.map(textContent).join("") : "";
}
function extractMermaidSources(html) {
  const sources = [];
  function visit(node) {
    if (!Array.isArray(node.childNodes)) return;
    for (const child of node.childNodes) {
      if (child.tagName && elementHasMermaidClass(child)) {
        sources.push({
          index: sources.length,
          source: normalizeMermaidSource(textContent(child))
        });
      }
      visit(child);
    }
  }
  visit(parse(String(html || "")));
  return sources;
}
function normalizeMermaidSource(source) {
  return String(source || "").replace(/^[ \t]*\r?\n/, "").trimEnd();
}
function mermaidSourceHash(source) {
  return crypto3.createHash("sha256").update(normalizeMermaidSource(source)).digest("hex").slice(0, 16);
}
function whiteboardSourceHash(source, libraries) {
  const signature = libraryIconSignature(source, libraries);
  if (!signature) return mermaidSourceHash(source);
  return crypto3.createHash("sha256").update(`${normalizeMermaidSource(source)}
${signature}`).digest("hex").slice(0, 16);
}

// src/whiteboard-library-store.js
import { createHash as createHash2 } from "node:crypto";
import { readdir, readFile as readFile2, stat as stat2 } from "node:fs/promises";
import path4 from "node:path";
function excalidrawLibrariesDir(stateRoot) {
  return path4.join(stateRoot, LIBRARY_DIR_NAME);
}
async function listLibraryFiles(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return [];
    throw error;
  }
  const files = [];
  for (const name of names.sort()) {
    if (!name.toLowerCase().endsWith(LIBRARY_FILE_EXTENSION)) continue;
    const file = path4.join(dir, name);
    try {
      const info = await stat2(file);
      files.push({ name, file, size: info.size, mtimeMs: info.mtimeMs, isFile: info.isFile() });
    } catch (error) {
      files.push({ name, file, size: 0, mtimeMs: 0, error: error?.code || String(error) });
    }
  }
  return files;
}
async function loadExcalidrawLibraries(dir) {
  const libraries = [];
  const skipped = [];
  const ids = /* @__PURE__ */ new Set();
  let totalBytes = 0;
  let totalItems = 0;
  for (const { name, file, size, isFile, error } of await listLibraryFiles(dir)) {
    if (error) {
      skipped.push({ file, reason: `could not read the file (${error})` });
      continue;
    }
    if (!isFile) {
      skipped.push({ file, reason: "not a file" });
      continue;
    }
    const id = libraryIdFromFileName(name);
    if (!id) {
      skipped.push({ file, reason: "file name has no letters or digits to use as a library id" });
      continue;
    }
    if (ids.has(id)) {
      skipped.push({ file, reason: `another file already uses the library id "${id}"` });
      continue;
    }
    if (size > LIBRARY_FILE_MAX_BYTES) {
      skipped.push({ file, reason: `larger than ${LIBRARY_FILE_MAX_BYTES / 1024 / 1024} MB` });
      continue;
    }
    if (totalBytes + size > LIBRARY_TOTAL_MAX_BYTES) {
      skipped.push({ file, reason: `libraries together exceed ${LIBRARY_TOTAL_MAX_BYTES / 1024 / 1024} MB` });
      continue;
    }
    let library;
    try {
      library = parseExcalidrawLibrary(await readFile2(file, "utf8"), { id });
    } catch (error2) {
      skipped.push({ file, reason: error2 instanceof Error ? error2.message : String(error2) });
      continue;
    }
    if (totalItems + library.items.length > LIBRARY_MAX_ITEMS) {
      skipped.push({ file, reason: `libraries together exceed ${LIBRARY_MAX_ITEMS} items` });
      continue;
    }
    ids.add(id);
    totalBytes += size;
    totalItems += library.items.length;
    libraries.push({ ...library, file });
  }
  return { dir, libraries, skipped };
}
function createExcalidrawLibraryCache() {
  let signature = "";
  let cached = null;
  return async (dir) => {
    const files = await listLibraryFiles(dir);
    const next = JSON.stringify([dir, files.map(({ name, size, mtimeMs }) => [name, size, mtimeMs])]);
    if (!cached || next !== signature) {
      signature = next;
      const version = createHash2("sha256").update(next).digest("hex").slice(0, 16);
      cached = loadExcalidrawLibraries(dir).then((result) => ({ ...result, version }));
      cached.catch(() => {
        signature = "";
      });
    }
    return cached;
  };
}

// src/whiteboard-store.js
import { mkdir as mkdir2, readFile as readFile3, rename, rm, writeFile } from "node:fs/promises";
import path5 from "node:path";

// src/whiteboard-core.js
var EXCALIDRAW_SCENE_TARGET_TYPE = "excalidraw-scene";
var STAT_KEYS = ["added", "removed", "moved", "relabeled", "drawn"];
function sanitizeWhiteboardAppState(appState) {
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) return {};
  const safeAppState = { ...appState };
  delete safeAppState.theme;
  delete safeAppState.viewBackgroundColor;
  return safeAppState;
}
function sanitizeWhiteboardScene(scene) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) return scene ?? null;
  if (!Object.hasOwn(scene, "appState")) return { ...scene };
  return { ...scene, appState: sanitizeWhiteboardAppState(scene.appState) };
}
function boundedInt(value, max = 1e4) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(Math.round(number), max);
}
function normalizeExcalidrawSceneTarget(target) {
  const stats = target.stats && typeof target.stats === "object" && !Array.isArray(target.stats) ? target.stats : {};
  return {
    type: EXCALIDRAW_SCENE_TARGET_TYPE,
    diagramIndex: boundedInt(target.diagramIndex, 999),
    diagramId: String(target.diagramId || ""),
    sourceHash: String(target.sourceHash || ""),
    scenePath: String(target.scenePath || ""),
    previewPath: String(target.previewPath || ""),
    imageFallback: Boolean(target.imageFallback),
    stats: Object.fromEntries(STAT_KEYS.map((key) => [key, boundedInt(stats[key])]))
  };
}

// src/whiteboard-store.js
var KEY_RE = /^[0-9a-f]{16}$/;
var writeTails = /* @__PURE__ */ new Map();
var temporaryFileId = 0;
function isValidWhiteboardKey(key) {
  return KEY_RE.test(String(key || ""));
}
function isValidDiagramIndex(index) {
  const number = Number(index);
  return Number.isInteger(number) && number >= 0 && number <= 999;
}
function assertValidRef(key, index) {
  if (!isValidWhiteboardKey(key)) throw new Error(`invalid whiteboard session key: ${key}`);
  if (!isValidDiagramIndex(index)) throw new Error(`invalid whiteboard diagram index: ${index}`);
}
function whiteboardDir(stateDir2, key) {
  return path5.join(stateDir2, "whiteboards", String(key));
}
function workingFile(stateDir2, key, index) {
  return path5.join(whiteboardDir(stateDir2, key), `${Number(index)}.json`);
}
function writeQueueKey(stateDir2, key, index) {
  return `${path5.resolve(stateDir2)}\0${key}\0${Number(index)}`;
}
function queueWhiteboardWrite(stateDir2, key, index, operation) {
  const queueKey = writeQueueKey(stateDir2, key, index);
  const prior = writeTails.get(queueKey) || Promise.resolve();
  const result = prior.catch(() => {
  }).then(operation);
  const tail = result.catch(() => {
  });
  writeTails.set(queueKey, tail);
  tail.finally(() => {
    if (writeTails.get(queueKey) === tail) writeTails.delete(queueKey);
  });
  return result;
}
async function writeFileAtomically(file, content) {
  const temporary = `${file}.${process.pid}.${++temporaryFileId}.tmp`;
  try {
    await writeFile(temporary, content);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {
    });
    throw error;
  }
}
function whiteboardFeedbackPaths(stateDir2, key, index) {
  assertValidRef(key, index);
  const dir = whiteboardDir(stateDir2, key);
  return {
    scenePath: path5.join(dir, `${Number(index)}.excalidraw`),
    previewPath: path5.join(dir, `${Number(index)}.png`)
  };
}
async function saveWhiteboard(stateDir2, key, index, { sourceHash, textMetricsVersion = 0, scene, baseline = null }) {
  assertValidRef(key, index);
  const record = {
    source_hash: String(sourceHash || ""),
    text_metrics_version: Math.max(0, Math.floor(Number(textMetricsVersion) || 0)),
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    scene: sanitizeWhiteboardScene(scene),
    baseline: baseline ?? null
  };
  return queueWhiteboardWrite(stateDir2, key, index, async () => {
    await mkdir2(whiteboardDir(stateDir2, key), { recursive: true });
    await writeFileAtomically(workingFile(stateDir2, key, index), `${JSON.stringify(record)}
`);
    return record;
  });
}
async function loadWhiteboard(stateDir2, key, index) {
  assertValidRef(key, index);
  try {
    const raw = await readFile3(workingFile(stateDir2, key, index), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      source_hash: String(parsed.source_hash || ""),
      text_metrics_version: Math.max(0, Math.floor(Number(parsed.text_metrics_version) || 0)),
      updated_at: String(parsed.updated_at || ""),
      scene: parsed.scene ?? null,
      baseline: parsed.baseline ?? null
    };
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}
async function writeWhiteboardFeedbackFiles(stateDir2, key, index, { scene, pngDataUrl = "" }) {
  assertValidRef(key, index);
  const { scenePath, previewPath } = whiteboardFeedbackPaths(stateDir2, key, index);
  const sanitizedScene = sanitizeWhiteboardScene(scene);
  const sceneJson = {
    type: "excalidraw",
    version: 2,
    source: "lavish-axi",
    elements: Array.isArray(sanitizedScene?.elements) ? sanitizedScene.elements : [],
    appState: sanitizedScene?.appState || {},
    files: sanitizedScene?.files && typeof sanitizedScene.files === "object" ? sanitizedScene.files : {}
  };
  const png = decodePngDataUrl(pngDataUrl);
  return queueWhiteboardWrite(stateDir2, key, index, async () => {
    await mkdir2(whiteboardDir(stateDir2, key), { recursive: true });
    await writeFileAtomically(scenePath, `${JSON.stringify(sceneJson, null, 2)}
`);
    if (png) {
      await writeFileAtomically(previewPath, png);
      return { scenePath, previewPath };
    }
    return { scenePath, previewPath: "" };
  });
}
function decodePngDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

// src/chat-messages.js
var EXCERPT_MAX = 120;
var SELECTOR_MAX = 512;
var LABEL_MAX = 40;
var PROMPT_ID_MAX = 128;
var PROMPT_ID_RE = /^[A-Za-z0-9_-]+$/;
var MAX_CHAT_STORED_BYTES = 5242880;
function normalizePromptId(value) {
  if (typeof value !== "string") return "";
  const id = value.trim();
  if (!id || id.length > PROMPT_ID_MAX || !PROMPT_ID_RE.test(id)) return "";
  return id;
}
var LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
var BLOCK_START = /^(?:```|~~~|#{1,6}\s|\s*(?:[-*+]|\d+[.)])\s+)/;
var FENCE_OPEN = /^(```|~~~)/;
var HEADING = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/;
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function renderEmphasis(text) {
  return text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>").replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");
}
var MAX_INLINE_DESTINATION_LENGTH = 2048;
function createDestinationScanner(text) {
  const closers = new Int32Array(text.length);
  closers.fill(-1);
  const stack = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") stack.push(i);
    else if (text[i] === ")" && stack.length) closers[stack.pop()] = i;
  }
  return { closers };
}
function destinationEnd(text, start, scanner) {
  const limit = Math.min(text.length, start + MAX_INLINE_DESTINATION_LENGTH);
  let i = start;
  while (i < limit && !/[\s<)]/.test(text[i])) {
    if (text[i] !== "(") {
      i += 1;
      continue;
    }
    const close = scanner.closers[i];
    if (close === -1 || close >= limit) {
      while (i < limit && !/[\s<]/.test(text[i])) i += 1;
      return { end: i, balanced: false, withinLimit: i < limit || limit === text.length };
    }
    let boundary = i + 1;
    while (boundary < close && !/[\s<]/.test(text[boundary])) boundary += 1;
    if (boundary < close) return { end: boundary, balanced: false, withinLimit: true };
    i = close + 1;
  }
  return {
    end: i,
    balanced: true,
    withinLimit: i < limit || limit === text.length || /[\s<)]/.test(text[limit])
  };
}
function forwardFinder(text, needle) {
  let found = -1;
  let exhausted = false;
  return (after) => {
    if (found >= after) return found;
    if (exhausted) return -1;
    found = text.indexOf(needle, after);
    exhausted = found === -1;
    return found;
  };
}
function createImageScanner(text) {
  const nextBracket = forwardFinder(text, "]");
  const nextNewline = forwardFinder(text, "\n");
  const suffixEnds = /* @__PURE__ */ new Map();
  return { nextBracket, nextNewline, suffixEnds, destinationScanner: null };
}
function scannedDestinationEnd(text, start, scanner) {
  scanner.destinationScanner ||= createDestinationScanner(text);
  return destinationEnd(text, start, scanner.destinationScanner);
}
function boundedIndexOf(text, needle, start) {
  const found = text.indexOf(needle, start);
  return found !== -1 && found - start <= MAX_INLINE_DESTINATION_LENGTH ? found : -1;
}
function imageSuffixEnd(text, labelEnd, scanner) {
  if (text[labelEnd + 1] === "[") {
    const referenceEnd = boundedIndexOf(text, "]", labelEnd + 2);
    if (referenceEnd === -1 || text.slice(labelEnd + 2, referenceEnd).includes("\n")) return -1;
    return referenceEnd + 1;
  }
  if (text[labelEnd + 1] !== "(") return labelEnd + 1;
  const destinationStart = labelEnd + 2;
  let destination;
  if (text[destinationStart] === "<") {
    const close2 = boundedIndexOf(text, ">", destinationStart + 1);
    if (close2 === -1 || text.slice(destinationStart + 1, close2).includes("\n")) return -1;
    destination = { end: close2 + 1, balanced: true, withinLimit: true };
  } else {
    destination = scannedDestinationEnd(text, destinationStart, scanner);
  }
  if (!destination.balanced || !destination.withinLimit) return -1;
  if (text[destination.end] === ")") return destination.end + 1;
  let titleStart = destination.end;
  while (text[titleStart] === " " || text[titleStart] === "	") titleStart += 1;
  if (text[titleStart] === ")") return titleStart + 1;
  const quote = text[titleStart];
  let titleEnd;
  if (quote === '"' || quote === "'") {
    titleEnd = boundedIndexOf(text, quote, titleStart + 1);
    if (titleEnd === -1 || text.slice(titleStart + 1, titleEnd).includes("\n")) return -1;
    titleEnd += 1;
  } else if (quote === "(") {
    let depth = 1;
    titleEnd = titleStart + 1;
    while (titleEnd < text.length && depth > 0 && text[titleEnd] !== "\n") {
      if (titleEnd - titleStart > MAX_INLINE_DESTINATION_LENGTH) return -1;
      if (text[titleEnd] === "(") depth += 1;
      if (text[titleEnd] === ")") depth -= 1;
      titleEnd += 1;
    }
    if (depth !== 0) return -1;
  } else {
    return -1;
  }
  let close = titleEnd;
  while (text[close] === " " || text[close] === "	") close += 1;
  return text[close] === ")" ? close + 1 : -1;
}
function imageEnd(text, start, scanner) {
  if (!text.startsWith("![", start)) return -1;
  const labelEnd = scanner.nextBracket(start + 2);
  const newline = scanner.nextNewline(start + 2);
  if (labelEnd === -1 || newline !== -1 && newline < labelEnd) return -1;
  if (!scanner.suffixEnds.has(labelEnd)) scanner.suffixEnds.set(labelEnd, imageSuffixEnd(text, labelEnd, scanner));
  return scanner.suffixEnds.get(labelEnd);
}
function createLinkScanner(text) {
  return {
    nextLabelEnd: forwardFinder(text, "]("),
    nextNewline: forwardFinder(text, "\n"),
    destinations: /* @__PURE__ */ new Map(),
    blockedBareUrls: /* @__PURE__ */ new Set(),
    destinationScanner: null
  };
}
function markdownLinkAt(text, start, scanner) {
  if (text[start] !== "[") return null;
  const labelEnd = scanner.nextLabelEnd(start + 1);
  const newline = scanner.nextNewline(start + 1);
  if (labelEnd === -1 || newline !== -1 && newline < labelEnd) return null;
  if (!scanner.destinations.has(labelEnd)) {
    const destinationStart = labelEnd + 2;
    if (!text.startsWith("http://", destinationStart) && !text.startsWith("https://", destinationStart)) {
      scanner.destinations.set(labelEnd, null);
    } else {
      const destination2 = scannedDestinationEnd(text, destinationStart, scanner);
      if (!destination2.balanced || !destination2.withinLimit || text[destination2.end] !== ")") {
        scanner.destinations.set(labelEnd, null);
        scanner.blockedBareUrls.add(destinationStart);
      } else {
        scanner.destinations.set(labelEnd, {
          end: destination2.end + 1,
          url: text.slice(destinationStart, destination2.end)
        });
      }
    }
  }
  const destination = scanner.destinations.get(labelEnd);
  return destination ? { ...destination, label: text.slice(start + 1, labelEnd) } : null;
}
function bareUrlEnd(text, start, scanner) {
  const destination = scannedDestinationEnd(text, start, scanner);
  if (!destination.withinLimit) return -1;
  let end = destination.end;
  while (end > start) {
    if (text.slice(start, end).endsWith("&quot;")) {
      end -= "&quot;".length;
    } else if (/&(?:amp|lt|gt);$/.test(text.slice(start, end))) {
      break;
    } else if (/[.,;:!?'”’]/.test(text[end - 1])) {
      end -= 1;
    } else {
      break;
    }
  }
  return end;
}
function renderLinksAndEmphasis(text) {
  let html = "";
  let offset = 0;
  let i = 0;
  const linkScanner = createLinkScanner(text);
  while (i < text.length) {
    const markdownLink = markdownLinkAt(text, i, linkScanner);
    const bareUrl = !linkScanner.blockedBareUrls.has(i) && (i === 0 || /[\s(]/.test(text[i - 1])) && (text.startsWith("http://", i) || text.startsWith("https://", i));
    if (!markdownLink && !bareUrl) {
      i += 1;
      continue;
    }
    const bareEnd = bareUrl ? bareUrlEnd(text, i, linkScanner) : -1;
    if (!markdownLink && bareEnd === -1) {
      i += 1;
      continue;
    }
    html += renderEmphasis(text.slice(offset, i));
    if (markdownLink) {
      html += '<a href="' + markdownLink.url + '" target="_blank" rel="noopener noreferrer">' + markdownLink.label + "</a>";
      i = markdownLink.end;
    } else {
      const url = text.slice(i, bareEnd);
      html += '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>";
      i = bareEnd;
    }
    offset = i;
  }
  return html + renderEmphasis(text.slice(offset));
}
function renderInline(text) {
  let html = "";
  let offset = 0;
  let i = 0;
  const imageScanner = createImageScanner(text);
  while (i < text.length) {
    let end = -1;
    let code = false;
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close !== -1 && !text.slice(i + 1, close).includes("\n")) {
        end = close + 1;
        code = true;
      }
    } else {
      end = imageEnd(text, i, imageScanner);
    }
    if (end === -1) {
      i += 1;
      continue;
    }
    html += renderLinksAndEmphasis(escapeHtml(text.slice(offset, i)));
    html += code ? "<code>" + escapeHtml(text.slice(i + 1, end - 1)) + "</code>" : escapeHtml(text.slice(i, end));
    i = end;
    offset = end;
  }
  return html + renderLinksAndEmphasis(escapeHtml(text.slice(offset)));
}
function renderListItems(items) {
  const root = { children: [] };
  const stack = [{ node: root, indent: -1 }];
  for (const item of items) {
    const node = { ...item, children: [] };
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent: item.indent });
  }
  const render = (nodes) => {
    let html = "";
    let i = 0;
    while (i < nodes.length) {
      const ordered = nodes[i].ordered;
      const tag = ordered ? "ol" : "ul";
      const start = ordered && nodes[i].start !== "1" ? ' start="' + nodes[i].start + '"' : "";
      let inner = "";
      while (i < nodes.length && nodes[i].ordered === ordered) {
        inner += "<li>" + renderInline(nodes[i].text) + render(nodes[i].children) + "</li>";
        i += 1;
      }
      html += "<" + tag + start + ">" + inner + "</" + tag + ">";
    }
    return html;
  };
  return render(root.children);
}
function renderChatMarkdown(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const buffer2 = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith(fence[1])) {
        buffer2.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push("<pre><code>" + escapeHtml(buffer2.join("\n")) + "</code></pre>");
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push('<p class="chat-h">' + renderInline(heading[2]) + "</p>");
      i += 1;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const items = [];
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        const item = LIST_ITEM.exec(lines[i]);
        const ordered = /\d/.test(item[2]);
        const start = ordered ? item[2].replace(/[.)]$/, "").replace(/^0+(?=\d)/, "") : "";
        items.push({ indent: item[1].length, ordered, start, text: item[3] });
        i += 1;
        while (i < lines.length && lines[i].trim() && /^\s{2,}/.test(lines[i]) && !LIST_ITEM.test(lines[i])) {
          items[items.length - 1].text += " " + lines[i].trim();
          i += 1;
        }
      }
      out.push(renderListItems(items));
      continue;
    }
    const buffer = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) {
      buffer.push(lines[i]);
      i += 1;
    }
    out.push("<p>" + buffer.map((entry) => renderInline(entry.trim())).join("<br>") + "</p>");
  }
  return out.join("");
}
function bound(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}
function withSelector(anchor, selector) {
  if (selector) anchor.selector = selector;
  return anchor;
}
function promptAnchor(prompt, kind) {
  if (kind === "message") return null;
  const target = prompt.target && typeof prompt.target === "object" ? prompt.target : null;
  const selector = bound(prompt.selector, SELECTOR_MAX);
  if (kind === "whiteboard") {
    const index = Number(target?.diagramIndex);
    const excerpt = Number.isInteger(index) && index >= 0 ? "Diagram " + (index + 1) : prompt.text;
    return { kind: "whiteboard", label: "whiteboard", excerpt: bound(excerpt, EXCERPT_MAX) };
  }
  if (kind === "layout-warnings") {
    const count = Array.isArray(target?.warnings) ? target.warnings.length : 0;
    const excerpt = count > 0 ? count + (count === 1 ? " issue" : " issues") : prompt.text;
    return { kind: "layout", label: "layout", excerpt: bound(excerpt, EXCERPT_MAX) };
  }
  const type = String(target?.type || "");
  if (type === "text-range") {
    return withSelector(
      { kind: "text", label: "text", excerpt: bound(target.text || prompt.text, EXCERPT_MAX) },
      selector
    );
  }
  if (type === "table-cell") {
    const semantic = [target.rowLabel, target.columnLabel].map((value) => String(value || "").trim()).filter(Boolean).join(" \u2192 ");
    if (semantic) return withSelector({ kind: "cell", label: "cell", excerpt: bound(semantic, EXCERPT_MAX) }, selector);
  }
  if (type === "mermaid-node") {
    return withSelector(
      { kind: "node", label: "node", excerpt: bound(target.label || prompt.text, EXCERPT_MAX) },
      selector
    );
  }
  const tag = String(prompt.tag || "").trim();
  if (!tag) return null;
  return withSelector(
    { kind: "element", label: bound("<" + tag + ">", LABEL_MAX), excerpt: bound(prompt.text, EXCERPT_MAX) },
    selector
  );
}
function chatEntryForPrompt(prompt, at) {
  if (!prompt || typeof prompt !== "object") return null;
  const text = String(prompt.prompt || "");
  const attachments = Array.isArray(prompt.attachments) ? prompt.attachments.filter((attachment) => attachment && typeof attachment === "object" && attachment.id).map(
    (attachment) => attachment.name ? { id: String(attachment.id), name: String(attachment.name) } : { id: String(attachment.id) }
  ) : [];
  const tag = String(prompt.tag || "");
  const kind = tag === "message" ? "message" : tag === "whiteboard" ? "whiteboard" : tag === "layout-warnings" ? "layout-warnings" : "annotation";
  const promptId = normalizePromptId(prompt.prompt_id);
  const anchor = promptAnchor(prompt, kind);
  if (!text && attachments.length === 0 && !promptId && !anchor) return null;
  const entry = { role: "user", kind, text, at: String(at || (/* @__PURE__ */ new Date()).toISOString()) };
  if (promptId) entry.prompt_id = promptId;
  if (anchor) entry.anchor = anchor;
  if (attachments.length) entry.attachments = attachments;
  return entry;
}
function serializeChat(chat) {
  if (!Array.isArray(chat)) return [];
  const serialized = [];
  for (const item of chat) {
    if (!item || typeof item !== "object") continue;
    const text = String(item.text || "");
    if (item.role === "agent") {
      serialized.push({ ...item, role: "agent", text, html: renderChatMarkdown(text) });
      continue;
    }
    const entry = {
      ...item,
      role: "user",
      text,
      kind: typeof item.kind === "string" && item.kind ? item.kind : "message"
    };
    delete entry.html;
    serialized.push(entry);
  }
  return serialized;
}
function boundStoredChat(chat, maxBytes = MAX_CHAT_STORED_BYTES) {
  const entries = Array.isArray(chat) ? chat.filter((entry) => entry && typeof entry === "object") : [];
  if (entries.length === 0) return { chat: [], evicted: [] };
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : MAX_CHAT_STORED_BYTES;
  let storedBytes = 2;
  let cut = entries.length;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const serialized = JSON.stringify(entries[index]);
    const entryBytes = Buffer.byteLength(serialized === void 0 ? "null" : serialized, "utf8");
    const nextBytes = storedBytes + entryBytes + (cut < entries.length ? 1 : 0);
    if (nextBytes > limit) break;
    storedBytes = nextBytes;
    cut = index;
  }
  return { chat: entries.slice(cut), evicted: entries.slice(0, cut) };
}
function serializeChatAckIds(ids) {
  const ackIds = [];
  const seen = /* @__PURE__ */ new Set();
  for (const value of Array.isArray(ids) ? ids : []) {
    const id = normalizePromptId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ackIds.push(id);
  }
  return ackIds;
}
function collectChatAckIds(evicted, existing = []) {
  const ackIds = serializeChatAckIds(existing);
  const seen = new Set(ackIds);
  for (const entry of Array.isArray(evicted) ? evicted : []) {
    const id = normalizePromptId(entry?.prompt_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ackIds.push(id);
  }
  return ackIds;
}
function serializeChatSync(session) {
  const revision = Number(session?.chat_revision);
  return {
    chat: serializeChat(session?.chat || []),
    ack_ids: serializeChatAckIds(session?.chat_ack_ids),
    chat_revision: Number.isSafeInteger(revision) && revision >= 0 ? revision : 0
  };
}
var RECEIPT_NONE = "none";
function isUserEntry(entry) {
  return Boolean(entry) && typeof entry === "object" && entry.role === "user" && entry.receipt !== RECEIPT_NONE;
}
function markPreReceipt(chat) {
  let changed = false;
  for (const entry of Array.isArray(chat) ? chat : []) {
    if (!entry || typeof entry !== "object" || entry.role !== "user" || entry.receipt === RECEIPT_NONE) continue;
    entry.receipt = RECEIPT_NONE;
    changed = true;
  }
  return changed;
}
function stampDelivered(chat, seq, at) {
  let changed = false;
  for (const entry of Array.isArray(chat) ? chat : []) {
    if (!isUserEntry(entry) || entry.delivered_at) continue;
    entry.delivered_at = String(at);
    entry.delivered_seq = seq;
    changed = true;
  }
  return changed;
}
function unstampDelivery(chat, seq) {
  let changed = false;
  for (const entry of Array.isArray(chat) ? chat : []) {
    if (!isUserEntry(entry) || entry.delivered_seq !== seq) continue;
    delete entry.delivered_at;
    delete entry.delivered_seq;
    delete entry.working_at;
    delete entry.done_at;
    changed = true;
  }
  return changed;
}
function isOpenDelivery(entry, closedSeq) {
  return isUserEntry(entry) && Boolean(entry.delivered_at) && !entry.done_at && entry.delivered_seq > closedSeq;
}
function stampWorking(chat, at, closedSeq = 0) {
  let changed = false;
  for (const entry of Array.isArray(chat) ? chat : []) {
    if (!isOpenDelivery(entry, closedSeq) || entry.working_at) continue;
    entry.working_at = String(at);
    changed = true;
  }
  return changed;
}
function stampDone(chat, at, closedSeq = 0) {
  let changed = false;
  for (const entry of Array.isArray(chat) ? chat : []) {
    if (!isOpenDelivery(entry, closedSeq)) continue;
    entry.done_at = String(at);
    changed = true;
  }
  return changed;
}

// src/server-log.js
function formatServerLogLine(line, now = /* @__PURE__ */ new Date()) {
  return `${now.toISOString()} ${line}`;
}
var STDIO_STAMPED = /* @__PURE__ */ Symbol.for("lavish-axi.stdio-timestamped");
function serverStdioIsTimestamped() {
  return Boolean(globalThis[STDIO_STAMPED]);
}

// src/html-transform.js
import { parse as parse2 } from "parse5";
function findBodyElement(node) {
  if (node.tagName === "body") return node;
  if (!Array.isArray(node.childNodes)) return null;
  for (const child of node.childNodes) {
    const found = findBodyElement(child);
    if (found) return found;
  }
  return null;
}
function bodyCloseIndex(html) {
  const body = findBodyElement(parse2(html, { sourceCodeLocationInfo: true }));
  const endTag = body && body.sourceCodeLocation && body.sourceCodeLocation.endTag;
  return endTag ? endTag.startOffset : -1;
}
function injectLavishSdk(html, key, artifactRevision, artifactLoadToken = "") {
  const revisionNumber = Number(artifactRevision);
  const revision = Number.isFinite(revisionNumber) && revisionNumber >= 0 ? Math.trunc(revisionNumber) : null;
  const revisionQuery = revision === null ? "" : `&artifact_revision=${revision}`;
  const token = String(artifactLoadToken || "").slice(0, 200);
  const tokenQuery = token ? `&artifact_load_token=${encodeURIComponent(token)}` : "";
  const script = `<script src="/sdk.js?key=${encodeURIComponent(key)}${revisionQuery}${tokenQuery}"></script>`;
  const index = bodyCloseIndex(html);
  if (index !== -1) {
    return `${html.slice(0, index)}${script}${html.slice(index)}`;
  }
  return `${html}
${script}`;
}

// src/tailscale.js
import { execFile } from "node:child_process";
import { access, stat as stat3 } from "node:fs/promises";
import { constants } from "node:fs";
import { isIP as isIP2 } from "node:net";
import path6 from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
function tailscaleCommandCandidates(platform = process.platform, env = process.env) {
  const candidates = ["tailscale"];
  if (platform === "darwin") {
    candidates.push(
      "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
      "/Applications/Tailscale.app/Contents/MacOS/tailscale",
      "/opt/homebrew/bin/tailscale",
      "/usr/local/bin/tailscale"
    );
  } else if (platform === "win32") {
    const programFiles = env.ProgramFiles || "C:\\Program Files";
    candidates.push(`${programFiles}\\Tailscale\\tailscale.exe`);
  } else {
    candidates.push("/usr/bin/tailscale", "/usr/local/bin/tailscale");
  }
  return [...new Set(candidates)];
}
function parseTailscaleStatus(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const state = String(data.BackendState || "");
  if (state !== "Running") return null;
  const ips = [];
  const selfIps = data.Self && Array.isArray(data.Self.TailscaleIPs) ? data.Self.TailscaleIPs : [];
  const topIps = Array.isArray(data.TailscaleIPs) ? data.TailscaleIPs : [];
  for (const ip of [...selfIps, ...topIps]) {
    if (typeof ip === "string") ips.push(ip.trim());
  }
  const ipv4 = ips.find((ip) => isIP2(ip) === 4);
  if (!ipv4) return null;
  const dnsRaw = typeof data.Self?.DNSName === "string" ? data.Self.DNSName.trim() : "";
  const magicDnsName = dnsRaw.replace(/\.$/, "").toLowerCase();
  const labels = magicDnsName.split(".");
  if (magicDnsName.length > 253 || labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    return null;
  }
  return { ipv4, magicDnsName };
}
async function resolveTailscaleCommand(command, env) {
  const candidates = path6.isAbsolute(command) ? [command] : (env.PATH ?? (process.platform === "win32" ? "" : "/usr/bin:/bin")).split(path6.delimiter).flatMap((directory) => {
    const candidate = path6.resolve(directory, command);
    return process.platform === "win32" ? [candidate, `${candidate}.exe`] : [candidate];
  });
  for (const candidate of candidates) {
    try {
      if (!(await stat3(candidate)).isFile()) continue;
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
    }
  }
  return null;
}
async function detectTailscale({
  execFile: execFile2 = execFileAsync,
  timeoutMs = 2e3,
  commands = tailscaleCommandCandidates(),
  now = Date.now,
  env = process.env,
  resolveCommand = resolveTailscaleCommand
} = {}) {
  const deadline = now() + timeoutMs;
  let incompleteRunningStatus = false;
  for (const command of commands) {
    if (deadline - now() <= 0) break;
    try {
      const resolvedCommand = await resolveCommand(command, env);
      if (!resolvedCommand) continue;
      const remainingMs = deadline - now();
      if (remainingMs <= 0) break;
      const { stdout } = await execFile2(resolvedCommand, ["status", "--json"], {
        timeout: remainingMs,
        maxBuffer: 2e6,
        encoding: "utf8"
      });
      const raw = String(stdout || "");
      const status = parseTailscaleStatus(raw);
      if (status) return status;
      incompleteRunningStatus ||= isIncompleteRunningTailscaleStatus(raw);
    } catch {
      continue;
    }
  }
  if (incompleteRunningStatus) {
    return {
      ipv4: null,
      magicDnsName: null,
      warning: "Tailscale is running but MagicDNS is unavailable; there is no phone access. Lavish remains available on loopback."
    };
  }
  return null;
}
function isIncompleteRunningTailscaleStatus(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!data || typeof data !== "object" || String(data.BackendState || "") !== "Running") return false;
  const addresses = [
    ...Array.isArray(data.Self?.TailscaleIPs) ? data.Self.TailscaleIPs : [],
    ...Array.isArray(data.TailscaleIPs) ? data.TailscaleIPs : []
  ];
  return addresses.some((address) => typeof address === "string" && isIP2(address.trim()) === 4);
}

// src/artifact-path.js
import { realpath as realpath2, stat as stat4 } from "node:fs/promises";
import path7 from "node:path";
var ARTIFACT_HTML_ERROR = "Lavish Editor expects an HTML file";
function isHtmlPath(file) {
  const lower = String(file || "").toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
}
function artifactTreeRoot(file) {
  return path7.dirname(file);
}
var ArtifactPathError = class extends Error {
  /** @type {"VALIDATION_ERROR"} */
  code = "VALIDATION_ERROR";
  /** @type {400} */
  statusCode = 400;
  /**
   * @param {string} [message]
   */
  constructor(message = ARTIFACT_HTML_ERROR) {
    super(message);
    this.name = "ArtifactPathError";
  }
};
function isArtifactPathError(error) {
  return error instanceof Error && error.name === "ArtifactPathError";
}
async function resolveAllowedArtifactFile(file) {
  const requested = typeof file === "string" ? file : "";
  if (!isHtmlPath(requested)) {
    throw new ArtifactPathError();
  }
  const canonical = await realpath2(path7.resolve(requested));
  if (!isHtmlPath(canonical)) {
    throw new ArtifactPathError();
  }
  const info = await stat4(canonical);
  if (!info.isFile()) {
    throw new ArtifactPathError();
  }
  return canonical;
}

// src/session-store.js
import crypto4 from "node:crypto";
import { readFile as readFile4, realpath as realpath3, writeFile as writeFile2 } from "node:fs/promises";
import path8 from "node:path";

// src/async-mutex.js
var AsyncMutex = class {
  constructor() {
    this._tail = Promise.resolve();
  }
  runExclusive(fn) {
    const run2 = this._tail.then(() => fn());
    this._tail = run2.then(
      () => {
      },
      () => {
      }
    );
    return run2;
  }
};

// src/session-store.js
var LAYOUT_WARNINGS_TARGET_TYPE = "layout-warnings";
var MAX_ARTIFACT_FAILURES = 20;
var ATTACHMENT_DELIVERY_GRACE_MS = 60 * 60 * 1e3;
var MAX_REQUEST_ATTACHMENT_REFS = 256;
var MAX_DELIVERED_ATTACHMENTS = 256;
var SessionStore = class {
  constructor(file) {
    this.file = file;
    this.lock = new AsyncMutex();
    this.artifactLoads = /* @__PURE__ */ new Map();
    this.chromeLoadContexts = /* @__PURE__ */ new Map();
  }
  // The one reader of the active load. It exists because the load outlives the process that
  // issued it: an upgrade restart replaces the server under a reviewer who never asked for it,
  // and a load this store merely forgot is not a load that ended. Whether a token is still
  // current is decided by `beginArtifactLoad` alone - nothing else may retire one.
  #activeArtifactLoad(session) {
    const cached = this.artifactLoads.get(session.key);
    if (cached) return cached;
    const restored = restoreArtifactLoad(session.artifact_load);
    if (!restored) return void 0;
    this.artifactLoads.set(session.key, restored);
    if (!this.chromeLoadContexts.has(session.key)) {
      this.chromeLoadContexts.set(session.key, restored.handoffToken);
    }
    return restored;
  }
  async listSessions() {
    return this.runExclusive(async () => {
      const state = await this.readState();
      return Object.values(state.sessions).sort((a, b) => a.file.localeCompare(b.file));
    });
  }
  async findByFile(file) {
    const absolute = await canonicalFile(file);
    return this.runExclusive(async () => {
      const state = await this.readState();
      return state.sessions[sessionKey(absolute)] || null;
    });
  }
  async findByKey(key) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      return state.sessions[key] || null;
    });
  }
  async upsertSession(file, url) {
    const absolute = await canonicalFile(file);
    return this.lock.runExclusive(() => this.#upsertSessionLocked(absolute, url));
  }
  async #upsertSessionLocked(absolute, url) {
    const key = sessionKey(absolute);
    const state = await this.readState();
    const existing = state.sessions[key] || {};
    const existingPrompts = existing.prompts || [];
    const existingStatus = existing.status === "ended" ? "open" : existing.status || "open";
    const session = {
      key,
      file: absolute,
      url,
      status: existingStatus === "feedback" && existingPrompts.length === 0 ? "open" : existingStatus,
      pending_prompts: existing.pending_prompts || 0,
      prompts: existingPrompts,
      // The warning inbox is durable review state, not deliverable feedback: reopening a session
      // must never silently drop unresolved warnings the user has not triaged yet.
      layout_warnings: normalizeStoredWarnings(existing.layout_warnings),
      artifact_revision: normalizeRevision(existing.artifact_revision),
      // The reviewer's open tab is holding this token, so reopening the artifact must not retire
      // it: only a newer `beginArtifactLoad` retires a load.
      artifact_load: normalizeStoredArtifactLoad(existing.artifact_load),
      artifact_failures: Array.isArray(existing.artifact_failures) ? existing.artifact_failures : [],
      // Carried across a reopen on purpose: this list is what keeps a just-delivered
      // attachment out of the sweeper's reach, and re-opening the artifact during the
      // grace window would otherwise erase that protection while the agent is still
      // reading the path. Every field this constructor omits is silently dropped, so
      // any new session field must be added here too.
      delivered_attachments: Array.isArray(existing.delivered_attachments) ? existing.delivered_attachments : [],
      dom_snapshot: existing.dom_snapshot || "",
      chat: existing.chat || [],
      chat_revision: normalizeRevision(existing.chat_revision),
      // Compact prompt_id acks for bubbles evicted by the stored-chat byte bound. Reopening
      // must keep them: they are the settlement/dedup source once the visible entry is gone.
      chat_ack_ids: Array.isArray(existing.chat_ack_ids) ? existing.chat_ack_ids : [],
      // Counts the takes that stamped Seen on chat entries (docs/delivery-acks.md). Reset on reopen
      // and a later restore could un-stamp an older take's entries, so it is carried like chat.
      delivery_seq: normalizeRevision(existing.delivery_seq),
      // The last take of the rounds that have ended. Reopening starts a new round: a note an ended
      // round left at Seen stays Seen, because a later round's edit or reply is not about it.
      closed_delivery_seq: normalizeRevision(
        existing.status === "ended" ? existing.delivery_seq : existing.closed_delivery_seq
      ),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    state.sessions[key] = session;
    await this.writeState(state);
    return session;
  }
  // `options.resolveAttachment(key, id) => Promise<metadata|null>` is the trust
  // boundary for image attachments: a prompt only ever carries the client's
  // claimed `id` (and display `name`); every authoritative field (absolute path,
  // mime, byte size, dimensions) is re-derived from disk here, so a crafted
  // `/prompts` POST cannot point an attachment at an arbitrary file. Without a
  // resolver, unresolved attachments are dropped rather than trusted.
  async queuePrompts(key, payload, options = {}) {
    return this.lock.runExclusive(() => this.#queuePromptsLocked(key, payload, options));
  }
  async #queuePromptsLocked(key, payload, options) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return null;
    }
    const prompts = Array.isArray(payload.prompts) ? payload.prompts : [];
    const shouldEndSession = Boolean(payload.endSession || payload.end_session);
    const restoring = options.restore === true;
    const alreadyEnded = session.status === "ended";
    if (alreadyEnded && !restoring) {
      return { ended: true, ended_by: session.ended_by };
    }
    let normalized = prompts.map(normalizePrompt);
    if (!restoring) {
      const acknowledgedIds = new Set(
        [
          ...(session.chat || []).map((entry) => normalizePromptId(entry?.prompt_id)),
          ...(session.chat_ack_ids || []).map((id) => normalizePromptId(id))
        ].filter(Boolean)
      );
      normalized = normalized.filter(({ prompt }) => {
        const promptId = normalizePromptId(prompt.prompt_id);
        if (!promptId) return true;
        if (acknowledgedIds.has(promptId)) return false;
        acknowledgedIds.add(promptId);
        return true;
      });
    }
    const normalizedPrompts = normalized.map((entry) => entry.prompt);
    const rejected = boundAttachmentRefs(normalized, options);
    if (!rejected.length) {
      for (const prompt of normalizedPrompts) {
        const { resolved, rejected: promptRejected } = await resolvePromptAttachments(prompt.attachments, key, options);
        if (promptRejected.length) rejected.push(...promptRejected);
        if (resolved.length > 0) prompt.attachments = resolved;
        else delete prompt.attachments;
      }
    }
    const deliverySeq = restoring ? normalizeRevision(payload.delivery_seq) : 0;
    const unstamped = deliverySeq > 0 && unstampDelivery(session.chat, deliverySeq);
    if (unstamped) session.chat_revision = normalizeRevision(session.chat_revision) + 1;
    if (rejected.length) {
      if (unstamped) await this.writeState(state);
      return {
        rejected: rejected.slice(0, MAX_REPORTED_ATTACHMENT_REJECTIONS),
        caps: {
          maxPerPrompt: Number.isFinite(options.maxPerPrompt) ? options.maxPerPrompt : null,
          maxPromptBytes: Number.isFinite(options.maxPromptBytes) ? options.maxPromptBytes : null
        }
      };
    }
    const revision = normalizeRevision(session.artifact_revision);
    const at = (/* @__PURE__ */ new Date()).toISOString();
    let warnings = normalizeStoredWarnings(session.layout_warnings);
    let acceptedPrompts;
    if (restoring) {
      acceptedPrompts = normalizedPrompts;
    } else {
      const layoutPlans = [];
      const conflicts = /* @__PURE__ */ new Set();
      for (const prompt of normalizedPrompts) {
        const warningIds = layoutWarningPromptIds(prompt);
        if (warningIds === null) {
          layoutPlans.push({
            prompt,
            warningIds: null,
            expectedRevision: null,
            conflicts: [],
            queueIds: [],
            hadKnownWarning: false
          });
          continue;
        }
        const plan = planLayoutWarningPrompt(warnings, prompt, revision);
        for (const id of plan.conflicts) conflicts.add(id);
        layoutPlans.push({ prompt, ...plan });
      }
      if (conflicts.size > 0) {
        return {
          conflict: true,
          session,
          warning_ids: [...conflicts],
          warnings: serializeLayoutWarnings(warnings)
        };
      }
      acceptedPrompts = [];
      for (const plan of layoutPlans) {
        if (plan.warningIds === null) {
          acceptedPrompts.push(plan.prompt);
          continue;
        }
        const result = queueLayoutWarnings(warnings, plan.queueIds, { revision, at });
        warnings = result.warnings;
        if (result.queued.length > 0 || !plan.hadKnownWarning) acceptedPrompts.push(plan.prompt);
      }
    }
    session.layout_warnings = warnings;
    const userMessages = restoring ? [] : acceptedPrompts.map((prompt) => chatEntryForPrompt(prompt, at)).filter(Boolean);
    const existingPrompts = Array.isArray(session.prompts) ? session.prompts : [];
    const storedPrompts = restoring ? acceptedPrompts : acceptedPrompts.map(agentFacingPrompt);
    session.prompts = restoring ? [...storedPrompts, ...existingPrompts] : [...existingPrompts, ...storedPrompts];
    session.chat = [...session.chat || [], ...userMessages];
    applyTranscriptBound(session);
    if (userMessages.length > 0) session.chat_revision = normalizeRevision(session.chat_revision) + 1;
    if (restoring) {
      const restoredFailures = Array.isArray(payload.artifact_failures) ? JSON.parse(JSON.stringify(payload.artifact_failures)) : [];
      const existingFailures = Array.isArray(session.artifact_failures) ? session.artifact_failures : [];
      session.artifact_failures = mergeArtifactFailures(restoredFailures, existingFailures).failures;
    }
    session.pending_prompts = session.prompts.length;
    const restoredSnapshot = String(payload.domSnapshot || payload.dom_snapshot || "");
    if (!restoring || existingPrompts.length === 0 && !session.dom_snapshot) {
      session.dom_snapshot = restoredSnapshot;
    }
    session.status = shouldEndSession || alreadyEnded ? "ended" : session.prompts.length > 0 || restoring && Array.isArray(session.artifact_failures) && session.artifact_failures.length > 0 ? "feedback" : "open";
    if (shouldEndSession) session.ended_by = "user";
    session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await this.writeState(state);
    return { ...session, fresh_feedback: !restoring && acceptedPrompts.length > 0 };
  }
  async issueReviewerHandoff(key) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      const chromeLoadToken = crypto4.randomBytes(24).toString("base64url");
      this.chromeLoadContexts.set(key, chromeLoadToken);
      const activeLoad = this.#activeArtifactLoad(session);
      return {
        session,
        chrome_load_token: chromeLoadToken,
        artifact_revision: activeLoad?.artifactRevision ?? normalizeRevision(session.artifact_revision),
        artifact_load_token: activeLoad?.artifactLoadToken || "",
        artifact_load_sequence: activeLoad?.requestSequence || 0
      };
    });
  }
  /** @returns {Promise<any>} */
  async beginArtifactLoad(key, { requestId = "", requestSequence = 0, handoffToken = "" } = {}) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      const normalizedRequestId = String(requestId || "");
      const parsedRequestSequence = Number(requestSequence);
      const normalizedRequestSequence = Number.isSafeInteger(parsedRequestSequence) && parsedRequestSequence > 0 ? parsedRequestSequence : 0;
      const normalizedHandoffToken = String(handoffToken || "");
      const activeLoad = this.#activeArtifactLoad(session);
      const activeHandoffToken = this.chromeLoadContexts.get(key) || "";
      const staleResult = (status) => ({
        session,
        stale: status,
        artifact_revision: activeLoad?.artifactRevision ?? normalizeRevision(session.artifact_revision),
        artifact_load_token: activeLoad?.artifactLoadToken || ""
      });
      if (!activeHandoffToken || !normalizedHandoffToken) {
        return staleResult("no-handoff");
      }
      if (normalizedHandoffToken !== activeHandoffToken) {
        return staleResult("superseded");
      }
      if (normalizedRequestId && activeLoad?.requestId === normalizedRequestId && activeLoad.handoffToken === normalizedHandoffToken) {
        return {
          session,
          artifact_revision: activeLoad.artifactRevision,
          artifact_load_token: activeLoad.artifactLoadToken
        };
      }
      if (normalizedRequestSequence > 0 && activeLoad?.handoffToken === normalizedHandoffToken && activeLoad.requestSequence > normalizedRequestSequence) {
        return staleResult("out-of-order");
      }
      const artifactRevision = normalizeRevision(session.artifact_revision) + 1;
      const artifactLoadToken = crypto4.randomBytes(24).toString("base64url");
      const load = {
        artifactRevision,
        artifactLoadToken,
        lastPassSequence: 0,
        requestId: normalizedRequestId,
        requestSequence: normalizedRequestSequence,
        handoffToken: normalizedHandoffToken
      };
      this.artifactLoads.set(key, load);
      session.artifact_load = serializeArtifactLoad(load);
      session.artifact_revision = artifactRevision;
      session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await this.writeState(state);
      return { session, artifact_revision: artifactRevision, artifact_load_token: artifactLoadToken };
    });
  }
  async verifyArtifactLoad(key, artifactLoadToken, artifactRevision) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      const load = this.#activeArtifactLoad(session);
      const revision = parseRevisionValue(artifactRevision);
      const valid = Boolean(
        load && String(artifactLoadToken || "") && String(artifactLoadToken) === load.artifactLoadToken && revision === load.artifactRevision
      );
      return {
        session,
        valid,
        artifact_revision: load?.artifactRevision ?? normalizeRevision(session.artifact_revision),
        artifact_load_token: load?.artifactLoadToken || ""
      };
    });
  }
  // Fold one browser diagnostic pass into the passive warning inbox. This deliberately does NOT
  // touch session status or queue feedback: detection alone must never wake an agent.
  /**
   * @param {{ viewportClasses?: string[] }} [options]
   */
  async recordLayoutDiagnostics(key, payload, options = {}) {
    return this.runExclusive(async () => {
      const viewportClasses = options.viewportClasses;
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      const revision = normalizeRevision(session.artifact_revision);
      const load = this.#activeArtifactLoad(session);
      const artifactLoadToken = String(payload?.artifact_load_token || payload?.artifactLoadToken || "");
      const reportedRevision = parseDiagnosticRevision(payload);
      const passSequence = parsePassSequence(payload);
      if (!load || artifactLoadToken !== load.artifactLoadToken || !reportedRevision.present || reportedRevision.value !== load.artifactRevision || !passSequence.present || passSequence.value <= load.lastPassSequence) {
        return {
          session,
          changed: false,
          stale: true,
          warnings: serializeLayoutWarnings(session.layout_warnings)
        };
      }
      load.lastPassSequence = passSequence.value;
      const at = (/* @__PURE__ */ new Date()).toISOString();
      const pass = applyDiagnosticPass(session.layout_warnings, {
        complete: payload.complete !== false,
        targetPresenceComplete: payload.target_presence_complete === true || payload.targetPresenceComplete === true,
        viewportWidth: payload.viewport_width ?? payload.viewportWidth,
        findings: payload.findings || payload.layout_warnings || payload.layoutWarnings || [],
        revision,
        at
      });
      let warnings = pass.warnings;
      let changed = pass.changed;
      if (viewportClasses) {
        const obsolete = markObsoleteViewportWarnings(warnings, viewportClasses, { at, revision });
        warnings = obsolete.warnings;
        changed = changed || obsolete.changed;
      }
      if (!changed) {
        return { session, changed: false, warnings: serializeLayoutWarnings(warnings) };
      }
      session.layout_warnings = warnings;
      session.artifact_load = serializeArtifactLoad(load);
      session.updated_at = at;
      await this.writeState(state);
      return { session, changed: true, warnings: serializeLayoutWarnings(warnings) };
    });
  }
  // Prepare the user's explicit triage action. The ordinary prompt queue commits it when sent.
  async prepareLayoutWarningFixes(key, ids) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      const revision = normalizeRevision(session.artifact_revision);
      const at = (/* @__PURE__ */ new Date()).toISOString();
      const result = queueLayoutWarnings(session.layout_warnings, ids, { revision, at });
      if (!result.queued.length) {
        return { session, queued: [], prompt: null, warnings: serializeLayoutWarnings(session.layout_warnings) };
      }
      return {
        session,
        queued: result.queued,
        prompt: layoutWarningPromptPayload(result.queued),
        warnings: serializeLayoutWarnings(session.layout_warnings)
      };
    });
  }
  async dismissLayoutWarning(key, id) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      const revision = normalizeRevision(session.artifact_revision);
      const result = dismissLayoutWarning(session.layout_warnings, id, { revision });
      if (!result.changed) {
        return { session, changed: false, warnings: serializeLayoutWarnings(session.layout_warnings) };
      }
      session.layout_warnings = result.warnings;
      session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await this.writeState(state);
      return { session, changed: true, warnings: serializeLayoutWarnings(result.warnings) };
    });
  }
  // The narrow fatal path: failures that make the review itself unusable (the artifact cannot be
  // served, or one of its own local assets cannot be loaded). These are NOT layout findings and
  // do not enter the passive inbox - they still reach the agent immediately, because there is no
  // usable review for the user to triage from.
  async recordArtifactFailures(key, payload) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      const load = this.#activeArtifactLoad(session);
      const artifactLoadToken = String(payload?.artifact_load_token || payload?.artifactLoadToken || "");
      const reportedRevision = parseDiagnosticRevision(payload);
      if (!load || artifactLoadToken !== load.artifactLoadToken || !reportedRevision.present || reportedRevision.value !== load.artifactRevision) {
        return { session, changed: false, stale: true };
      }
      const normalized = normalizeArtifactFailures(payload?.failures);
      const previous = Array.isArray(session.artifact_failures) ? session.artifact_failures : [];
      const { failures, changed } = mergeArtifactFailures(previous, normalized);
      if (!changed) {
        return { session, changed: false };
      }
      session.artifact_failures = failures;
      if (session.status !== "ended") session.status = "feedback";
      session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await this.writeState(state);
      return { session, changed: true };
    });
  }
  async listLayoutWarnings(key) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) return null;
      return {
        warnings: serializeLayoutWarnings(session.layout_warnings),
        revision: normalizeRevision(session.artifact_revision)
      };
    });
  }
  async hasOutstandingLayoutRepairs(key) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) return false;
      return normalizeStoredWarnings(session.layout_warnings).some(hasOutstandingRepairRequest);
    });
  }
  /** @returns {Promise<any>} */
  async takeFeedback(key) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return { status: "missing" };
      }
      const prompts = session.prompts || [];
      const artifactFailures = Array.isArray(session.artifact_failures) ? session.artifact_failures : [];
      const alreadyEnded = session.status === "ended";
      if (prompts.length === 0 && artifactFailures.length === 0) {
        return alreadyEnded ? { status: "ended", ended_by: session.ended_by } : { status: "waiting" };
      }
      const deliverySeq = normalizeRevision(session.delivery_seq) + 1;
      const result = {
        status: "feedback",
        dom_snapshot: session.dom_snapshot || "",
        prompts,
        ...artifactFailures.length > 0 ? { artifact_failures: artifactFailures } : {},
        ...alreadyEnded ? { session_ended: true, ended_by: session.ended_by } : {},
        ...prompts.length > 0 ? { delivery_seq: deliverySeq } : {}
      };
      const deliveredNow = Date.now();
      const deliveredIds = /* @__PURE__ */ new Set();
      for (const prompt of prompts) {
        for (const attachment of prompt.attachments || []) {
          if (attachment?.id) deliveredIds.add(attachment.id);
        }
      }
      const carried = (session.delivered_attachments || []).filter(
        (entry) => entry && entry.id && !deliveredIds.has(entry.id) && deliveredNow - Number(entry.at) <= ATTACHMENT_DELIVERY_GRACE_MS
      ).map((entry) => ({ id: entry.id, at: Number(entry.at) })).sort((a, b) => a.at - b.at);
      const current = [...deliveredIds].map((id) => ({ id, at: deliveredNow }));
      const historyRoom = Math.max(0, MAX_DELIVERED_ATTACHMENTS - current.length);
      session.delivered_attachments = [...carried.slice(-historyRoom), ...current];
      if (prompts.length > 0) {
        session.delivery_seq = deliverySeq;
        if (stampDelivered(session.chat, deliverySeq, new Date(deliveredNow).toISOString())) {
          session.chat_revision = normalizeRevision(session.chat_revision) + 1;
        }
      }
      session.prompts = [];
      session.artifact_failures = [];
      session.pending_prompts = 0;
      session.dom_snapshot = "";
      if (!alreadyEnded) {
        session.status = "open";
      }
      session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await this.writeState(state);
      return result;
    });
  }
  // `endedBy` distinguishes a human ending review from the browser chrome ("user") from an
  // agent explicitly closing the loop via `lavish-axi end` ("agent"). Only a user-initiated end
  // blocks a plain reopen - see `SessionStore` callers in server.js.
  async endSession(key, endedBy = "agent") {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      const existingEndedBy = session.status === "ended" ? session.ended_by : void 0;
      const nextEndedBy = endedBy === "user" || existingEndedBy === "user" ? "user" : "agent";
      session.status = "ended";
      session.ended_by = nextEndedBy;
      session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await this.writeState(state);
      return session;
    });
  }
  async addAgentReply(key, text, { requireOpen = false } = {}) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) {
        return null;
      }
      if (requireOpen && session.status === "ended") return session;
      const at = (/* @__PURE__ */ new Date()).toISOString();
      stampDone(session.chat, at, normalizeRevision(session.closed_delivery_seq));
      session.chat = [...session.chat || [], { role: "agent", text: String(text || ""), at }];
      applyTranscriptBound(session);
      session.chat_revision = normalizeRevision(session.chat_revision) + 1;
      session.updated_at = at;
      await this.writeState(state);
      return session;
    });
  }
  // Working (docs/delivery-acks.md): the artifact changed after a delivery, so the agent is acting on
  // what it was handed. Returns the session when a stamp landed and null when there was nothing to
  // stamp, in which case state.json is not rewritten - the watcher fires on every save.
  async markWorking(key) {
    return this.runExclusive(async () => {
      const state = await this.readState();
      const session = state.sessions[key];
      if (!session) return null;
      const at = (/* @__PURE__ */ new Date()).toISOString();
      if (!stampWorking(session.chat, at, normalizeRevision(session.closed_delivery_seq))) return null;
      session.chat_revision = normalizeRevision(session.chat_revision) + 1;
      session.updated_at = at;
      await this.writeState(state);
      return session;
    });
  }
  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @returns {Promise<T>}
   */
  runExclusive(operation) {
    return this.lock.runExclusive(operation);
  }
  // `key/id` strings for every attachment still referenced by a pending prompt,
  // across all sessions. The attachment sweeper and delete use this so they never
  // reap a file that belongs to a queued-but-undelivered prompt. Delivered prompts
  // are cleared from `prompts` by takeFeedback, so their attachments become
  // sweep-eligible. This is a pure read and must NOT take `this.lock`: the server
  // calls it from inside `runExclusive`, so self-locking would deadlock; running it
  // there keeps its snapshot atomic with the subsequent disk delete.
  // Every attachment the sweeper must not touch: those still queued on a pending
  // prompt, plus those handed to the agent within the delivery grace window.
  async referencedAttachmentIds({ now = Date.now() } = {}) {
    const state = await this.readState();
    const referenced = /* @__PURE__ */ new Set();
    for (const session of Object.values(state.sessions)) {
      for (const prompt of session.prompts || []) {
        for (const attachment of prompt.attachments || []) {
          if (attachment && attachment.id) referenced.add(`${session.key}/${attachment.id}`);
        }
      }
      for (const delivered of session.delivered_attachments || []) {
        if (!delivered || !delivered.id) continue;
        if (now - Number(delivered.at) <= ATTACHMENT_DELIVERY_GRACE_MS) {
          referenced.add(`${session.key}/${delivered.id}`);
        }
      }
    }
    return referenced;
  }
  async readState() {
    try {
      const raw = await readFile4(this.file, "utf8");
      const parsed = JSON.parse(raw);
      const state = { sessions: parsed.sessions || {} };
      let changed = false;
      for (const session of Object.values(state.sessions)) {
        if (!session || typeof session !== "object") continue;
        if (!("delivery_seq" in session)) {
          session.delivery_seq = 0;
          markPreReceipt(session.chat);
          changed = true;
        }
        if (!applyTranscriptBound(session)) continue;
        session.chat_revision = normalizeRevision(session.chat_revision) + 1;
        changed = true;
      }
      if (changed) await this.writeState(state);
      return state;
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { sessions: {} };
      }
      throw error;
    }
  }
  async writeState(state) {
    await writeFile2(this.file, `${JSON.stringify(state, null, 2)}
`);
  }
};
async function canonicalFile(file) {
  const absolute = path8.resolve(file);
  return realpath3(absolute);
}
function sessionKey(file) {
  return crypto4.createHash("sha256").update(file).digest("hex").slice(0, 16);
}
function applyTranscriptBound(session) {
  const originalChat = Array.isArray(session.chat) ? session.chat : [];
  const { chat, evicted } = boundStoredChat(session.chat);
  const chatChanged = !Array.isArray(session.chat) || chat.length !== originalChat.length || chat.some((entry, index) => entry !== originalChat[index]);
  session.chat = chat;
  if (evicted.length === 0) return chatChanged;
  const existingAckCount = Array.isArray(session.chat_ack_ids) ? session.chat_ack_ids.length : 0;
  session.chat_ack_ids = collectChatAckIds(evicted, session.chat_ack_ids);
  return chatChanged || session.chat_ack_ids.length !== existingAckCount;
}
function normalizePrompt(prompt) {
  const normalized = {
    uid: String(prompt.uid || ""),
    prompt: String(prompt.prompt || ""),
    selector: String(prompt.selector || ""),
    tag: String(prompt.tag || ""),
    text: String(prompt.text || "")
  };
  const promptId = normalizePromptId(prompt.prompt_id);
  if (promptId) normalized.prompt_id = promptId;
  const target = normalizeTarget(prompt.target);
  if (target) normalized.target = target;
  const { refs, malformed } = normalizeAttachmentRefs(prompt.attachments);
  if (refs.length > 0) normalized.attachments = refs;
  return { prompt: normalized, malformed };
}
function agentFacingPrompt(prompt) {
  if (!prompt || typeof prompt !== "object" || prompt.prompt_id === void 0) return prompt;
  const rest = { ...prompt };
  delete rest.prompt_id;
  return rest;
}
function layoutWarningPromptIds(prompt) {
  if (prompt?.tag !== "layout-warnings" || prompt.target?.type !== LAYOUT_WARNINGS_TARGET_TYPE) return null;
  return Array.isArray(prompt.target.warnings) ? prompt.target.warnings.map((warning) => String(warning?.id || "")).filter(Boolean) : [];
}
function normalizeAttachmentRefs(value) {
  if (value === void 0) return { refs: [], malformed: [] };
  if (!Array.isArray(value)) return { refs: [], malformed: [{ id: "", name: "", reason: "malformed" }] };
  const refs = [];
  const malformed = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      malformed.push({ id: "", name: "", reason: "malformed" });
      continue;
    }
    const name = item.name === void 0 || item.name === null ? "" : String(item.name).slice(0, 200);
    const id = String(item.id || "");
    if (!id) {
      malformed.push({ id: "", name, reason: "malformed" });
      continue;
    }
    refs.push(name ? { id, name } : { id });
  }
  return { refs, malformed };
}
var MAX_REPORTED_ATTACHMENT_REJECTIONS = 4;
function boundAttachmentRefs(normalized, options) {
  const maxPerPrompt = Number.isFinite(options.maxPerPrompt) ? options.maxPerPrompt : Infinity;
  const malformed = normalized.flatMap((entry) => entry.malformed);
  if (malformed.length) return malformed;
  const rejected = [];
  for (const { prompt } of normalized) {
    const refs = prompt.attachments || [];
    if (refs.length > maxPerPrompt) {
      rejected.push({ id: refs[0]?.id || "", name: refs[0]?.name || "", reason: "too-many" });
    }
  }
  if (rejected.length) return rejected;
  if (options.restore !== true) {
    let requestRefs = 0;
    for (const { prompt } of normalized) requestRefs += prompt.attachments?.length || 0;
    if (requestRefs > MAX_REQUEST_ATTACHMENT_REFS) {
      return [{ id: "", name: "", reason: "too-many-in-request" }];
    }
  }
  return rejected;
}
async function resolvePromptAttachments(refs, key, options = {}) {
  const { resolveAttachment: resolveAttachment2, maxPerPrompt = Infinity, maxPromptBytes = Infinity } = options;
  if (!Array.isArray(refs) || refs.length === 0 || typeof resolveAttachment2 !== "function") {
    return { resolved: [], rejected: [] };
  }
  const resolved = [];
  const rejected = [];
  let totalBytes = 0;
  for (const ref of refs) {
    if (resolved.length >= maxPerPrompt) {
      rejected.push({ id: ref.id, name: ref.name || "", reason: "too-many" });
      continue;
    }
    const metadata = await resolveAttachment2(key, ref.id);
    if (!metadata) {
      rejected.push({ id: ref.id, name: ref.name || "", reason: "not-found" });
      continue;
    }
    const bytes = Number(metadata.bytes) || 0;
    if (totalBytes + bytes > maxPromptBytes) {
      rejected.push({ id: ref.id, name: ref.name || "", reason: "prompt-bytes-exceeded" });
      continue;
    }
    totalBytes += bytes;
    resolved.push(ref.name ? { ...metadata, name: ref.name } : metadata);
  }
  return { resolved, rejected };
}
function planLayoutWarningPrompt(warnings, prompt, revision) {
  const warningIds = layoutWarningPromptIds(prompt);
  const hasRevision = Object.hasOwn(prompt.target || {}, "artifact_revision");
  const expectedRevision = hasRevision ? parseRevisionValue(prompt.target.artifact_revision) : null;
  const conflicts = [];
  const queueIds = [];
  let hadKnownWarning = false;
  for (const id of warningIds) {
    const warning = warnings.find((candidate) => candidate.id === id);
    if (!warning) continue;
    hadKnownWarning = true;
    const duplicate = warning.status === "queued" && Boolean(warning.queued_at) && expectedRevision !== null && warning.queued_revision === expectedRevision;
    if (duplicate) continue;
    if (hasRevision && (expectedRevision === null || expectedRevision !== revision)) {
      conflicts.push(id);
      continue;
    }
    if (isSelectableLayoutWarning(warning)) queueIds.push(id);
    else if (hasRevision) conflicts.push(id);
  }
  return { warningIds, expectedRevision, conflicts, queueIds, hadKnownWarning };
}
function serializeArtifactLoad(load) {
  return {
    artifact_load_token: load.artifactLoadToken,
    artifact_revision: load.artifactRevision,
    last_pass_sequence: load.lastPassSequence,
    request_id: load.requestId,
    request_sequence: load.requestSequence,
    handoff_token: load.handoffToken
  };
}
var STORED_ARTIFACT_LOAD_FIELDS = [
  "artifact_load_token",
  "artifact_revision",
  "last_pass_sequence",
  "request_id",
  "request_sequence",
  "handoff_token"
];
function restoreArtifactLoad(stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  if (STORED_ARTIFACT_LOAD_FIELDS.some((field) => !Object.hasOwn(stored, field))) return null;
  const artifactLoadToken = stored.artifact_load_token;
  const handoffToken = stored.handoff_token;
  const requestId = stored.request_id;
  if (typeof artifactLoadToken !== "string" || !artifactLoadToken) return null;
  if (typeof handoffToken !== "string" || !handoffToken) return null;
  if (typeof requestId !== "string") return null;
  const artifactRevision = parseSequenceValue(stored.artifact_revision);
  if (artifactRevision === 0) return null;
  const lastPassSequence = parseSequenceValue(stored.last_pass_sequence);
  const requestSequence = parseSequenceValue(stored.request_sequence);
  if (artifactRevision === null || lastPassSequence === null || requestSequence === null) return null;
  return { artifactRevision, artifactLoadToken, lastPassSequence, requestId, requestSequence, handoffToken };
}
function normalizeStoredArtifactLoad(stored) {
  const restored = restoreArtifactLoad(stored);
  return restored ? serializeArtifactLoad(restored) : null;
}
function parseSequenceValue(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function normalizeRevision(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}
function parseRevisionValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null;
}
function parseDiagnosticRevision(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const present = Object.hasOwn(source, "artifact_revision") || Object.hasOwn(source, "artifactRevision");
  if (!present) return { present: false, value: null };
  return { present: true, value: parseRevisionValue(source.artifact_revision ?? source.artifactRevision) };
}
function parsePassSequence(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const present = Object.hasOwn(source, "artifact_pass_sequence") || Object.hasOwn(source, "artifactPassSequence");
  const value = Number(source.artifact_pass_sequence ?? source.artifactPassSequence);
  return { present, value: Number.isSafeInteger(value) && value > 0 ? value : null };
}
var ARTIFACT_FAILURE_KINDS = /* @__PURE__ */ new Set(["artifact-unavailable", "artifact-asset-unavailable"]);
function mergeArtifactFailures(earlier, later) {
  const merged = Array.isArray(earlier) ? [...earlier] : [];
  let changed = false;
  for (const failure of Array.isArray(later) ? later : []) {
    if (merged.some((item) => item.kind === failure.kind && item.detail === failure.detail)) continue;
    merged.push(failure);
    changed = true;
  }
  return { failures: merged.slice(-MAX_ARTIFACT_FAILURES), changed };
}
function normalizeArtifactFailures(failures) {
  if (!Array.isArray(failures)) return [];
  return failures.filter((failure) => failure && typeof failure === "object" && !Array.isArray(failure)).map((failure) => ({
    kind: String(failure.kind || ""),
    detail: String(failure.detail || "").slice(0, 300),
    severity: "fatal"
  })).filter((failure) => ARTIFACT_FAILURE_KINDS.has(failure.kind)).slice(0, MAX_ARTIFACT_FAILURES);
}
function normalizeTarget(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return null;
  if (target.type === "mermaid-node") return normalizeMermaidNodeTarget(target);
  if (target.type === EXCALIDRAW_SCENE_TARGET_TYPE) return normalizeExcalidrawSceneTarget(target);
  if (target.type === LAYOUT_WARNINGS_TARGET_TYPE) return normalizeLayoutWarningsTarget(target);
  return JSON.parse(JSON.stringify(target));
}

// src/share-password.js
import { randomInt } from "node:crypto";
var SHARE_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
var GROUPS = 3;
var GROUP_LENGTH = 4;
function generateSharePassword() {
  const groups = [];
  for (let group = 0; group < GROUPS; group += 1) {
    let chunk = "";
    for (let i = 0; i < GROUP_LENGTH; i += 1) {
      chunk += SHARE_PASSWORD_ALPHABET[randomInt(SHARE_PASSWORD_ALPHABET.length)];
    }
    groups.push(chunk);
  }
  return groups.join("-");
}

// src/attachment-store.js
import crypto5 from "node:crypto";
import { chmod, mkdir as mkdir3, readdir as readdir2, readFile as readFile5, rename as rename2, rm as rm2, stat as stat5, utimes, writeFile as writeFile3 } from "node:fs/promises";
import path9 from "node:path";
var KEY_RE2 = /^[0-9a-f]{16}$/;
var ID_RE = /^[0-9a-f]{64}\.(png|jpg|webp)$/;
var MIME_BY_EXT = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
var DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
var DEFAULT_MAX_ATTACHMENTS_PER_PROMPT = 4;
var DEFAULT_MAX_PROMPT_ATTACHMENT_BYTES = 25 * 1024 * 1024;
var DEFAULT_ATTACHMENT_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var DEFAULT_MAX_ATTACHMENT_DISK_BYTES = 512 * 1024 * 1024;
var ATTACHMENT_EVICTION_GRACE_MS = 60 * 60 * 1e3;
var ATTACHMENT_FILE_MODE = 384;
var ATTACHMENT_DIR_MODE = 448;
var ATTACHMENT_ALLOC_BLOCK_BYTES = 4096;
function allocatedBytes(logicalBytes) {
  const n = Math.max(0, Number(logicalBytes) || 0);
  return Math.max(1, Math.ceil(n / ATTACHMENT_ALLOC_BLOCK_BYTES)) * ATTACHMENT_ALLOC_BLOCK_BYTES;
}
var TEMP_FILE_RE = /\.\d+\.\d+\.tmp$/;
var ATTACHMENT_TEMP_GRACE_MS = 5 * 60 * 1e3;
var SIDECAR_ORPHAN_RE = /^([0-9a-f]{64}\.(?:png|jpg|webp))\.meta$/;
var temporaryFileId2 = 0;
function isValidAttachmentKey(key) {
  return KEY_RE2.test(String(key || ""));
}
function isValidAttachmentId(id) {
  return ID_RE.test(String(id || ""));
}
function attachmentsDir(stateDir2, key) {
  return path9.join(stateDir2, "attachments", String(key));
}
function attachmentFile(stateDir2, key, id) {
  return path9.join(attachmentsDir(stateDir2, key), id);
}
function resolveAttachmentConfig(env = process.env) {
  const maxDiskBytes = diskCapEnv(env.LAVISH_AXI_MAX_ATTACHMENT_DISK_MB);
  return {
    maxBytes: positiveIntEnv(env.LAVISH_AXI_MAX_ATTACHMENT_BYTES, DEFAULT_MAX_ATTACHMENT_BYTES),
    maxPerPrompt: positiveIntEnv(env.LAVISH_AXI_MAX_ATTACHMENTS_PER_PROMPT, DEFAULT_MAX_ATTACHMENTS_PER_PROMPT),
    maxPromptBytes: positiveIntEnv(env.LAVISH_AXI_MAX_PROMPT_ATTACHMENT_BYTES, DEFAULT_MAX_PROMPT_ATTACHMENT_BYTES),
    ttlMs: durationEnv(env.LAVISH_AXI_ATTACHMENT_TTL_MS, DEFAULT_ATTACHMENT_TTL_MS),
    maxDiskBytes,
    // DERIVED from the disk budget, never a separate knob: the most stored objects
    // the byte cap could ever admit is the budget divided by the minimum per-object
    // charge (an image block + a sidecar block). Deriving it means the object bound
    // can only agree with the byte cap, never contradict it - avoiding a second
    // hand-picked constant that could drift out of sync.
    maxObjects: maxDiskBytes == null ? null : Math.floor(maxDiskBytes / (2 * ATTACHMENT_ALLOC_BLOCK_BYTES)),
    // Fixed safety window (not env-tunable), so the server's periodic sweep and the
    // upload admission both refuse to cap-evict a just-written ready card.
    evictionGraceMs: ATTACHMENT_EVICTION_GRACE_MS
  };
}
function positiveIntEnv(raw, fallback) {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return fallback;
  const value = Math.floor(Number(trimmed));
  return Number.isFinite(value) && value >= 1 ? value : fallback;
}
function durationEnv(raw, fallback) {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return fallback;
  if (trimmed === "0" || trimmed.toLowerCase() === "off") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function diskCapEnv(raw, fallback = DEFAULT_MAX_ATTACHMENT_DISK_BYTES) {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return fallback;
  if (trimmed === "0" || trimmed.toLowerCase() === "off") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  const bytes = Math.floor(value * 1024 * 1024);
  return bytes >= 1 ? bytes : fallback;
}
var ACCEPTED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"];
function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10) {
    return { mime: "image/png", ext: "png" };
  }
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
function imageDimensions(buffer, mime) {
  if (!Buffer.isBuffer(buffer)) return null;
  try {
    if (mime === "image/png") return pngDimensions(buffer);
    if (mime === "image/jpeg") return jpegDimensions(buffer);
    if (mime === "image/webp") return webpDimensions(buffer);
  } catch {
    return null;
  }
  return null;
}
function pngDimensions(b) {
  if (b.length < 24 || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
function jpegDimensions(b) {
  const len = b.length;
  let offset = 2;
  while (offset + 1 < len) {
    if (b[offset] !== 255) {
      offset += 1;
      continue;
    }
    let marker = b[offset + 1];
    while (marker === 255 && offset + 2 < len) {
      offset += 1;
      marker = b[offset + 1];
    }
    offset += 2;
    if (marker === 1 || marker === 216 || marker === 217 || marker >= 208 && marker <= 215) continue;
    if (offset + 1 >= len) break;
    const segmentLength = b.readUInt16BE(offset);
    const isFrameHeader = marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204;
    if (isFrameHeader) {
      if (offset + 7 >= len) break;
      return { height: b.readUInt16BE(offset + 3), width: b.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}
function webpDimensions(b) {
  if (b.length < 25) return null;
  const fourcc = b.toString("ascii", 12, 16);
  if (fourcc === "VP8 " && b.length >= 30) {
    return { width: b.readUInt16LE(26) & 16383, height: b.readUInt16LE(28) & 16383 };
  }
  if (fourcc === "VP8L") {
    const b0 = b[21];
    const b1 = b[22];
    const b2 = b[23];
    const b3 = b[24];
    return {
      width: 1 + ((b1 & 63) << 8 | b0),
      height: 1 + ((b3 & 15) << 10 | b2 << 2 | (b1 & 192) >> 6)
    };
  }
  if (fourcc === "VP8X" && b.length >= 30) {
    return {
      width: 1 + (b[24] | b[25] << 8 | b[26] << 16),
      height: 1 + (b[27] | b[28] << 8 | b[29] << 16)
    };
  }
  return null;
}
function buildMetadata(id, file, mime, bytes, dims) {
  return {
    id,
    type: "image",
    path: file,
    mime,
    bytes,
    width: dims?.width || 0,
    height: dims?.height || 0
  };
}
async function pathExists(file) {
  try {
    await stat5(file);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}
function sidecarPath(file) {
  return `${file}.meta`;
}
async function writeSidecar(file, serializedMeta) {
  try {
    await writeFileAtomically2(sidecarPath(file), serializedMeta);
  } catch {
  }
}
async function readSidecarDims(file) {
  try {
    const parsed = JSON.parse(await readFile5(sidecarPath(file), "utf8"));
    const width = Number(parsed?.width);
    const height = Number(parsed?.height);
    if (Number.isFinite(width) && Number.isFinite(height) && (width > 0 || height > 0)) {
      return { width, height };
    }
  } catch {
  }
  return null;
}
async function writeFileAtomically2(file, content) {
  const temporary = `${file}.${process.pid}.${++temporaryFileId2}.tmp`;
  try {
    await writeFile3(temporary, content, { mode: ATTACHMENT_FILE_MODE });
    await rename2(temporary, file);
  } catch (error) {
    await rm2(temporary, { force: true }).catch(() => {
    });
    throw error;
  }
}
async function ensureAttachmentDir(stateDir2, key) {
  const root = path9.join(stateDir2, "attachments");
  const dir = attachmentsDir(stateDir2, key);
  await mkdir3(dir, { recursive: true, mode: ATTACHMENT_DIR_MODE });
  for (const target of [root, dir]) {
    await chmod(target, ATTACHMENT_DIR_MODE).catch(() => {
    });
  }
  return dir;
}
function statusError(message, statusCode) {
  const error = Object.assign(new Error(message), { statusCode });
  return error;
}
async function admitAttachmentCharge(stateDir2, newCharge, { ttlMs, maxDiskBytes, maxObjects, referenced, evictionGraceMs }) {
  if (maxDiskBytes == null || newCharge <= 0) return true;
  await sweepAttachments(stateDir2, {
    ttlMs,
    maxDiskBytes: Math.max(0, maxDiskBytes - newCharge),
    maxObjects,
    referenced,
    evictionGraceMs
  });
  const committed = await committedChargedBytes(stateDir2);
  return committed + newCharge <= maxDiskBytes;
}
async function writeAttachment(stateDir2, key, buffer, {
  maxBytes = DEFAULT_MAX_ATTACHMENT_BYTES,
  touchFile = utimes,
  maxDiskBytes = null,
  maxObjects = null,
  ttlMs = null,
  referenced = /* @__PURE__ */ new Set(),
  evictionGraceMs = 0
} = {}) {
  if (!isValidAttachmentKey(key)) throw statusError(`invalid attachment session key: ${key}`, 400);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw statusError("empty attachment upload", 400);
  if (buffer.length > maxBytes) throw statusError(`attachment exceeds the ${maxBytes} byte limit`, 413);
  const type = detectImageType(buffer);
  if (!type) throw statusError("unsupported image type (expected PNG, JPEG, or WebP)", 415);
  const id = `${crypto5.createHash("sha256").update(buffer).digest("hex")}.${type.ext}`;
  const file = attachmentFile(stateDir2, key, id);
  const dims = imageDimensions(buffer, type.mime);
  const sidecarContent = JSON.stringify({
    v: 1,
    mime: type.mime,
    bytes: buffer.length,
    width: dims?.width || 0,
    height: dims?.height || 0
  });
  const protectedRefs = new Set(referenced);
  protectedRefs.add(`${key}/${id}`);
  const admission = { ttlMs, maxDiskBytes, maxObjects, referenced: protectedRefs, evictionGraceMs };
  const isNew = !await pathExists(file);
  if (isNew) {
    const newCharge = allocatedBytes(buffer.length) + allocatedBytes(sidecarContent.length);
    if (!await admitAttachmentCharge(stateDir2, newCharge, admission)) {
      throw statusError("attachment storage is full", 507);
    }
    await ensureAttachmentDir(stateDir2, key);
    await writeFileAtomically2(file, buffer);
    await writeSidecar(file, sidecarContent);
  } else {
    const now = /* @__PURE__ */ new Date();
    try {
      await touchFile(file, now, now);
    } catch {
      await writeFileAtomically2(file, buffer);
    }
    if (!await pathExists(sidecarPath(file))) {
      if (await admitAttachmentCharge(stateDir2, allocatedBytes(sidecarContent.length), admission)) {
        await writeSidecar(file, sidecarContent);
      }
    }
  }
  return buildMetadata(id, file, type.mime, buffer.length, dims);
}
async function resolveAttachment(stateDir2, key, id) {
  if (!isValidAttachmentKey(key) || !isValidAttachmentId(id)) return null;
  const file = attachmentFile(stateDir2, key, id);
  let info;
  try {
    info = await stat5(file);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
  if (!info.isFile()) return null;
  const mime = MIME_BY_EXT[id.slice(id.lastIndexOf(".") + 1)];
  const dims = await readSidecarDims(file) ?? await readDimensions(file, mime);
  return buildMetadata(id, file, mime, info.size, dims);
}
async function statAttachmentForServe(stateDir2, key, id) {
  if (!isValidAttachmentKey(key) || !isValidAttachmentId(id)) return null;
  const file = attachmentFile(stateDir2, key, id);
  try {
    const info = await stat5(file);
    if (!info.isFile()) return null;
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
  return { file, mime: MIME_BY_EXT[id.slice(id.lastIndexOf(".") + 1)] };
}
async function readDimensions(file, mime) {
  try {
    return imageDimensions(await readFile5(file), mime);
  } catch {
    return null;
  }
}
async function removeAttachment(stateDir2, key, id) {
  if (!isValidAttachmentKey(key) || !isValidAttachmentId(id)) return false;
  const file = attachmentFile(stateDir2, key, id);
  await rm2(sidecarPath(file), { force: true }).catch(() => {
  });
  try {
    await rm2(file);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}
async function listAttachments(stateDir2) {
  const root = path9.join(stateDir2, "attachments");
  const sessionDirs = await readdirSafe(root);
  const files = [];
  for (const dirent of sessionDirs) {
    if (!dirent.isDirectory() || !isValidAttachmentKey(dirent.name)) continue;
    const dir = path9.join(root, dirent.name);
    for (const entry of await readdirSafe(dir)) {
      if (!entry.isFile() || !isValidAttachmentId(entry.name)) continue;
      const filePath = path9.join(dir, entry.name);
      try {
        const info = await stat5(filePath);
        let sidecarBytes = 0;
        try {
          sidecarBytes = (await stat5(sidecarPath(filePath))).size;
        } catch {
        }
        files.push({
          key: dirent.name,
          id: entry.name,
          path: filePath,
          bytes: info.size,
          chargedBytes: allocatedBytes(info.size) + (sidecarBytes > 0 ? allocatedBytes(sidecarBytes) : 0),
          mtimeMs: info.mtimeMs
        });
      } catch {
      }
    }
  }
  return files;
}
async function sweepAttachments(stateDir2, options = {}) {
  const {
    ttlMs = DEFAULT_ATTACHMENT_TTL_MS,
    maxDiskBytes = null,
    maxObjects = null,
    referenced = /* @__PURE__ */ new Set(),
    now = Date.now(),
    // A freshly written attachment may be a "ready card" the user dropped into the
    // composer but has not queued on a prompt yet, so it is unreferenced. Cap eviction
    // otherwise deletes it out from under the imminent Send (unrecoverable not-found).
    // Files younger than this grace are never cap-evicted; 0 disables the grace so the
    // pure mechanism (and its tests) evict oldest-unreferenced regardless of age.
    evictionGraceMs = 0
  } = options;
  const files = await listAttachments(stateDir2);
  let deleted = 0;
  let freedBytes = 0;
  const survivors = [];
  for (const file of files) {
    const isReferenced = referenced.has(`${file.key}/${file.id}`);
    const expired = ttlMs != null && now - file.mtimeMs > ttlMs;
    if (!isReferenced && expired) {
      if (await removeFile(file.path)) {
        deleted += 1;
        freedBytes += file.bytes;
      } else {
        survivors.push({ ...file, referenced: false });
      }
    } else {
      survivors.push({ ...file, referenced: isReferenced });
    }
  }
  let chargedTotal = survivors.reduce((sum, file) => sum + file.chargedBytes, 0);
  let objectCount = survivors.length;
  const evictOldestUnreferenced = async (overBudget) => {
    const evictable = survivors.filter((file) => {
      if (file.evicted || file.referenced) return false;
      if (evictionGraceMs > 0 && now - file.mtimeMs < evictionGraceMs) return false;
      return true;
    }).sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const file of evictable) {
      if (!overBudget()) break;
      if (await removeFile(file.path)) {
        file.evicted = true;
        deleted += 1;
        freedBytes += file.bytes;
        chargedTotal -= file.chargedBytes;
        objectCount -= 1;
      }
    }
  };
  if (maxDiskBytes != null) {
    await evictOldestUnreferenced(() => chargedTotal > maxDiskBytes);
  }
  if (maxObjects != null) {
    await evictOldestUnreferenced(() => objectCount > maxObjects);
  }
  const orphans = await reapOrphanFiles(stateDir2, now);
  deleted += orphans.deleted;
  freedBytes += orphans.freedBytes;
  await pruneEmptyDirs(path9.join(stateDir2, "attachments"));
  return { deleted, freedBytes };
}
async function committedChargedBytes(stateDir2) {
  const root = path9.join(stateDir2, "attachments");
  let total = 0;
  for (const dirent of await readdirSafe(root)) {
    if (!dirent.isDirectory() || !isValidAttachmentKey(dirent.name)) continue;
    const dir = path9.join(root, dirent.name);
    for (const entry of await readdirSafe(dir)) {
      if (!entry.isFile()) continue;
      try {
        total += allocatedBytes((await stat5(path9.join(dir, entry.name))).size);
      } catch {
      }
    }
  }
  return total;
}
async function reapOrphanFiles(stateDir2, now) {
  const root = path9.join(stateDir2, "attachments");
  let deleted = 0;
  let freedBytes = 0;
  for (const dirent of await readdirSafe(root)) {
    if (!dirent.isDirectory() || !isValidAttachmentKey(dirent.name)) continue;
    const dir = path9.join(root, dirent.name);
    const entries = await readdirSafe(dir);
    const present = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path9.join(dir, entry.name);
      const sidecarMatch = SIDECAR_ORPHAN_RE.exec(entry.name);
      try {
        if (TEMP_FILE_RE.test(entry.name)) {
          const info = await stat5(filePath);
          if (now - info.mtimeMs <= ATTACHMENT_TEMP_GRACE_MS) continue;
          if (await removeFile(filePath)) {
            deleted += 1;
            freedBytes += info.size;
          }
        } else if (sidecarMatch && !present.has(sidecarMatch[1])) {
          const info = await stat5(filePath);
          if (await removeFile(filePath)) {
            deleted += 1;
            freedBytes += info.size;
          }
        }
      } catch {
      }
    }
  }
  return { deleted, freedBytes };
}
async function readdirSafe(dir) {
  try {
    return await readdir2(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}
async function removeFile(file) {
  await rm2(sidecarPath(file), { force: true }).catch(() => {
  });
  try {
    await rm2(file, { force: true });
    return true;
  } catch {
    return false;
  }
}
async function pruneEmptyDirs(root) {
  for (const dirent of await readdirSafe(root)) {
    if (!dirent.isDirectory()) continue;
    const dir = path9.join(root, dirent.name);
    try {
      if ((await readdir2(dir)).length === 0) await rm2(dir, { recursive: true, force: true });
    } catch {
    }
  }
}

// src/server.js
var chromeClientUrl = new URL("./chrome-client.js", import.meta.url);
var chromeCssUrl = new URL("./chrome.css", import.meta.url);
var designAssetUrls = {
  "daisyui.css": {
    packaged: new URL("./design/daisyui.css", import.meta.url),
    source: new URL("../node_modules/daisyui/daisyui.css", import.meta.url),
    type: "text/css"
  },
  "daisyui-themes.css": {
    packaged: new URL("./design/daisyui-themes.css", import.meta.url),
    source: new URL("../node_modules/daisyui/themes.css", import.meta.url),
    type: "text/css"
  },
  "tailwindcss-browser.js": {
    packaged: new URL("./design/tailwindcss-browser.js", import.meta.url),
    source: new URL("../node_modules/@tailwindcss/browser/dist/index.global.js", import.meta.url),
    type: "application/javascript"
  }
};
var DEFAULT_IDLE_TIMEOUT_MS = 30 * 6e4;
var WHITEBOARD_CHANNEL_TOKEN_TTL_MS = 5 * 6e4;
var NETWORK_RECONCILE_CACHE_MS = 1e3;
var BIND_RETRY_DELAYS_MS = [100, 250, 500];
var BIND_RECOVERY_DELAYS_MS = [1e3, 2e3, 5e3, 1e4, 3e4];
var LOOPBACK_OWNER_PROBE_TIMEOUT_MS = 500;
var WEBSOCKET_CLOSE_GRACE_MS = 250;
var LIVE_EVENT_HEARTBEAT_MS = 3e4;
var DEFAULT_BROWSER_DISCONNECT_GRACE_MS = 1e4;
var ARTIFACT_CONTENT_SECURITY_POLICY = "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads";
var ATTACHMENT_SWEEP_INTERVAL_MS = 60 * 6e4;
var SHUTDOWN_REASONS = /* @__PURE__ */ new Set(["upgrade", "local-build", "stop"]);
var AGENT_LISTENER_LABEL = "agent-listener";
var RELOAD_DEBOUNCE_MS = 100;
var BATCH_RELOAD_DEBOUNCE_MS = 900;
function defaultWhiteboardAssetsDir() {
  const packaged = fileURLToPath3(new URL("./whiteboard", import.meta.url));
  if (existsSync2(packaged)) return packaged;
  return fileURLToPath3(new URL("../dist/whiteboard", import.meta.url));
}
function isWhiteboardWriteApiPath(pathname) {
  return /^\/api\/[0-9a-f]{16}\/whiteboard\/\d{1,3}(\/feedback-files)?$/.test(String(pathname || ""));
}
function isAttachmentUploadApiPath(pathname) {
  return /^\/api\/[0-9a-f]{16}\/attachments$/.test(String(pathname || ""));
}
function readAttachmentUploadBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let overCap = false;
    let settled = false;
    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      req.off("close", onClose);
    };
    const onData = (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        overCap = true;
        chunks.length = 0;
      } else {
        chunks.push(chunk);
      }
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(overCap ? { tooLarge: true, buffer: null } : { tooLarge: false, buffer: Buffer.concat(chunks) });
    };
    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAborted = () => onError(new Error("attachment upload aborted"));
    const onClose = () => {
      if (!settled) onError(new Error("attachment upload connection closed"));
    };
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
    req.on("close", onClose);
  });
}
function whiteboardChannelPayload(issuedAt, nonce, sessionKey2) {
  return `${issuedAt}.${nonce}.${sessionKey2}`;
}
function createWhiteboardChannelToken(secret, sessionKey2, now = Date.now()) {
  const nonce = crypto6.randomBytes(24).toString("base64url");
  const signature = crypto6.createHmac("sha256", secret).update(whiteboardChannelPayload(now, nonce, String(sessionKey2 || ""))).digest("base64url");
  return `${now}.${nonce}.${signature}`;
}
function isValidWhiteboardChannelToken(token, secret, sessionKey2, now = Date.now()) {
  if (!isValidWhiteboardKey(sessionKey2)) return false;
  const [issuedAtText, nonce, signature, extra] = String(token || "").split(".");
  if (extra !== void 0 || !/^\d{13}$/.test(issuedAtText) || !/^[A-Za-z0-9_-]{32}$/.test(nonce)) return false;
  const issuedAt = Number(issuedAtText);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt > WHITEBOARD_CHANNEL_TOKEN_TTL_MS)
    return false;
  const expected = crypto6.createHmac("sha256", secret).update(whiteboardChannelPayload(issuedAtText, nonce, String(sessionKey2))).digest("base64url");
  const actualBuffer = Buffer.from(signature || "", "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && crypto6.timingSafeEqual(actualBuffer, expectedBuffer);
}
function resolveIdleTimeoutMs(env = process.env) {
  const raw = env.LAVISH_AXI_IDLE_TIMEOUT_MS?.trim();
  if (raw === void 0 || raw === "") return DEFAULT_IDLE_TIMEOUT_MS;
  if (raw === "0" || raw.toLowerCase() === "off") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_IDLE_TIMEOUT_MS;
  return Math.min(value, 2147483647);
}
function resolveBrowserDisconnectGraceMs(env = process.env) {
  const raw = env.LAVISH_AXI_DISCONNECT_GRACE_MS?.trim();
  if (raw === void 0 || raw === "") return DEFAULT_BROWSER_DISCONNECT_GRACE_MS;
  if (raw === "0" || raw.toLowerCase() === "off") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_BROWSER_DISCONNECT_GRACE_MS;
  return Math.min(value, 2147483647);
}
async function serve({
  env = process.env,
  port,
  stateFile: stateFile2,
  version = "",
  debug = false,
  log = null,
  pollHeartbeatMs = 15e3,
  liveEventHeartbeatMs = LIVE_EVENT_HEARTBEAT_MS,
  browserDisconnectGraceMs = resolveBrowserDisconnectGraceMs(env),
  idleTimeoutMs = resolveIdleTimeoutMs(),
  host = bindHost(env),
  hosts,
  linkHost: linkHostName,
  allowedHosts,
  detectTailscale: detectTailscaleFn,
  lookupHost,
  extraListenHosts = [],
  bindRecoveryDelaysMs = BIND_RECOVERY_DELAYS_MS,
  whiteboardAssetsDir = defaultWhiteboardAssetsDir()
} = {}) {
  const { WebSocket, WebSocketServer } = await import("ws");
  const extraHosts = allowedHosts ?? extraAllowedHosts(env);
  const envHost = env.LAVISH_AXI_HOST?.trim();
  const autoTailscale = !envHost;
  const detect = detectTailscaleFn === void 0 ? detectTailscale : detectTailscaleFn;
  const tailscale = !hosts?.length && autoTailscale && typeof detect === "function" ? await detect() : null;
  const requestedListenHosts = sanitizeListenHosts(
    hosts?.length ? [...hosts, ...extraListenHosts] : resolveListenHosts({ host, env, tailscale, extraHosts: extraListenHosts })
  );
  const lookupOptions = lookupHost ? { lookup: lookupHost } : {};
  const listenHosts = await resolveConcreteListenHosts(requestedListenHosts, {
    ...lookupOptions,
    keepUnresolved: true
  });
  const activeTailscaleNetwork = tailscaleNetworkKey(tailscale);
  const serverStateId = stateId(stateFile2);
  let tailscalePhoneReady = false;
  let tailscaleDetectionWarning = typeof tailscale?.warning === "string" ? tailscale.warning : "";
  const pendingBinds = /* @__PURE__ */ new Map();
  let resolvedLinkHost = linkHostName ?? resolveLinkHost({ env, tailscale, fallbackHost: host });
  let idleTimer = null;
  let attachmentSweepTimer = null;
  let bindRecoveryTimer = null;
  const app = express();
  const store = new SessionStore(stateFile2);
  const events = new EventEmitter();
  const watchers = /* @__PURE__ */ new Map();
  const activePolls = /* @__PURE__ */ new Map();
  const deliveredFeedback = /* @__PURE__ */ new Set();
  const pollOwnershipLock = new AsyncMutex();
  const liveEventClients = /* @__PURE__ */ new Map();
  const browserDisconnectTimers = /* @__PURE__ */ new Map();
  const browserDisconnectPending = /* @__PURE__ */ new Set();
  const whiteboardChannelSecret = crypto6.randomBytes(32);
  const outstandingRepairBatches = /* @__PURE__ */ new Set();
  const diagnosticViewportClasses = resolveDiagnosticViewportClasses();
  const verbose = debug || env.LAVISH_AXI_DEBUG === "1";
  const writeLog = typeof log === "function" ? log : (line) => process.stderr.write(`${serverStdioIsTimestamped() ? line : formatServerLogLine(line)}
`);
  const logEvent = verbose ? (line) => writeLog(`[lavish] ${line}`) : null;
  if (tailscaleDetectionWarning) writeLog(`[lavish] WARNING: ${tailscaleDetectionWarning}`);
  let publicPort = port;
  let serverReady = false;
  let networkReconcileCheckedAt = 0;
  let cachedNetworkStale = false;
  let shuttingDown = false;
  let networkReconcilePromise = null;
  function broadcastLiveEvent(type, key, data = {}) {
    for (const [client, clientKey] of liveEventClients) {
      if (clientKey === key) client.sendEvent(type, data);
    }
  }
  events.on("reload", (key) => {
    broadcastLiveEvent("reload", key);
    store.markWorking(key).then((session) => {
      if (session) events.emit("chat-sync", key, session);
    }).catch((error) => writeLog(`[lavish] working stamp after reload failed: ${error?.message || error}`));
  });
  events.on("agent-reply", (key, entry) => broadcastLiveEvent("agent-reply", key, entry));
  events.on("chat-sync", (key, session) => broadcastLiveEvent("chat-sync", key, serializeChatSync(session)));
  events.on(
    "agent-presence",
    (key, state) => broadcastLiveEvent("agent-presence", key, presenceEventData(key, state, activePolls, deliveredFeedback))
  );
  events.on("layout-warnings", (key, warnings) => broadcastLiveEvent("layout-warnings", key, { warnings }));
  events.on("ended", (key, endedBy) => broadcastLiveEvent("ended", key, { ended_by: endedBy || null }));
  function hasLiveEventClient(key) {
    for (const clientKey of liveEventClients.values()) {
      if (clientKey === key) return true;
    }
    return false;
  }
  function clearBrowserDisconnectTimer(key) {
    const timer = browserDisconnectTimers.get(key);
    if (!timer) return;
    clearTimeout(timer);
    browserDisconnectTimers.delete(key);
  }
  function scheduleBrowserDisconnect(key) {
    clearBrowserDisconnectTimer(key);
    if (browserDisconnectGraceMs === null) return;
    if (shuttingDown || hasLiveEventClient(key) || !activePolls.has(key)) return;
    const timer = setTimeout(() => {
      browserDisconnectTimers.delete(key);
      if (!hasLiveEventClient(key) && activePolls.has(key)) {
        browserDisconnectPending.add(key);
        events.emit("browser-disconnected", key);
      }
    }, browserDisconnectGraceMs);
    timer.unref?.();
    browserDisconnectTimers.set(key, timer);
  }
  function attachLiveEventClient(client, key, onClose) {
    clearBrowserDisconnectTimer(key);
    browserDisconnectPending.delete(key);
    liveEventClients.set(client, key);
    refreshIdleTimer();
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      liveEventClients.delete(client);
      scheduleBrowserDisconnect(key);
      refreshIdleTimer();
    };
    onClose(cleanup);
    return cleanup;
  }
  async function sendInitialLiveEventState(client, key, cleanup) {
    const session = await store.findByKey(key);
    if (client.isClosed()) {
      cleanup();
      return;
    }
    client.sendEvent("chat-sync", serializeChatSync(session));
    const presence = computePresence(key, activePolls, deliveredFeedback);
    client.sendEvent("agent-presence", presenceEventData(key, presence, activePolls, deliveredFeedback));
    if (session?.status === "ended") client.sendEvent("ended", { ended_by: session.ended_by || null });
  }
  function networkWarningField() {
    const networkWarning = currentNetworkWarning();
    return networkWarning ? { network_warning: networkWarning } : {};
  }
  function describeBindFailure(listenHost, error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const why = code === "EADDRINUSE" ? "EADDRINUSE: another process is already listening there" : code === "EADDRNOTAVAIL" ? "EADDRNOTAVAIL: that address is not on this machine right now" : code === "ENOTFOUND" || code === "EAI_AGAIN" ? `${code}: that name does not resolve right now` : code || (error instanceof Error ? error.message : String(error));
    const address = `${hostForUrl(listenHost)}:${publicPort || port}`;
    const reachable = `Lavish remains available on ${boundHosts.map((bound2) => hostForUrl(bound2)).join(", ") || "loopback"}`;
    if (listenHost === tailscale?.ipv4) {
      return `Tailscale binding failed for ${address} (${why}); there is no phone access and tailnet review links do not load. ${reachable} and keeps retrying the tailnet address in the background.`;
    }
    const fellBack = boundHosts.length > 0 && boundHosts.every((bound2) => bound2 === LOOPBACK_HOST);
    return `Could not bind ${address} (${why}); ${fellBack ? "Lavish fell back to loopback and is" : "Lavish is"} not reachable at that address. ${reachable} and keeps retrying ${hostForUrl(listenHost)} in the background.`;
  }
  function currentNetworkWarning() {
    return [
      tailscaleDetectionWarning,
      ...[...pendingBinds].map(([listenHost, error]) => describeBindFailure(listenHost, error))
    ].filter(Boolean).join(" ");
  }
  async function reconcileNetwork() {
    await retryPendingBinds();
    if (!(autoTailscale && typeof detect === "function")) return false;
    return reconcileTailscaleNetwork();
  }
  async function reconcileTailscaleNetwork() {
    if (Date.now() - networkReconcileCheckedAt < NETWORK_RECONCILE_CACHE_MS) return cachedNetworkStale;
    if (networkReconcilePromise) return networkReconcilePromise;
    networkReconcilePromise = (async () => {
      try {
        const detectedTailscale = await detect();
        const detectedNetwork = tailscaleNetworkKey(detectedTailscale);
        const stale = detectedNetwork !== activeTailscaleNetwork;
        if (stale) {
          tailscaleDetectionWarning = typeof detectedTailscale?.warning === "string" ? detectedTailscale.warning : "";
        }
        return stale;
      } catch {
        return false;
      }
    })();
    try {
      cachedNetworkStale = await networkReconcilePromise;
      networkReconcileCheckedAt = Date.now();
      return cachedNetworkStale;
    } finally {
      networkReconcilePromise = null;
    }
  }
  function finishFeedbackDelivery(key, result) {
    if (result.status !== "feedback") return;
    markFeedbackDelivered(key, activePolls, deliveredFeedback, events);
    void publishChatSync(key);
  }
  async function publishChatSync(key) {
    try {
      const session = await store.findByKey(key);
      if (session) events.emit("chat-sync", key, session);
    } catch (error) {
      writeLog(`[lavish] chat-sync after delivery failed: ${error?.message || error}`);
    }
  }
  function agentFacingFeedback(result) {
    if (!result || result.status !== "feedback" || !("delivery_seq" in result)) return result;
    const rest = { ...result };
    delete rest.delivery_seq;
    return rest;
  }
  async function restoreClosedFeedback(key, result) {
    if (result.status !== "feedback") return;
    const prompts = Array.isArray(result.prompts) ? result.prompts : [];
    let session = null;
    let restoreError = null;
    try {
      session = await store.queuePrompts(
        key,
        {
          dom_snapshot: result.dom_snapshot || "",
          prompts,
          ...Array.isArray(result.artifact_failures) ? { artifact_failures: result.artifact_failures } : {},
          // Lets the store take this take's Seen stamps off again (docs/delivery-acks.md).
          ...Number.isInteger(result.delivery_seq) ? { delivery_seq: result.delivery_seq } : {}
        },
        {
          restore: true,
          resolveAttachment: (sessionKeyValue, id) => resolveAttachment(attachmentStateRoot, sessionKeyValue, id),
          maxPerPrompt: attachmentConfig.maxPerPrompt,
          maxPromptBytes: attachmentConfig.maxPromptBytes
        }
      );
    } catch (error) {
      restoreError = error;
    }
    const restoredPrompts = prompts.length === 0 ? [] : session && !session.rejected && !session.conflict && Array.isArray(session.prompts) ? session.prompts.slice(0, prompts.length) : null;
    const restoredFailures = session && Array.isArray(session.artifact_failures) ? session.artifact_failures : null;
    const failuresRestored = !Array.isArray(result.artifact_failures) || Array.isArray(restoredFailures) && result.artifact_failures.every(
      (failure) => restoredFailures.some((restoredFailure) => JSON.stringify(restoredFailure) === JSON.stringify(failure))
    );
    const persistedNothing = !session || Boolean(session.rejected) || Boolean(session.conflict);
    if (restoreError) {
      writeLog(
        `[lavish] closed poll feedback restore failed; the batch was lost: ${restoreError?.message || restoreError}`
      );
    } else if (persistedNothing) {
      writeLog("[lavish] closed poll feedback restore was refused; nothing was re-queued and the batch was lost");
    } else if (!restoredPrompts || JSON.stringify(restoredPrompts) !== JSON.stringify(prompts) || !failuresRestored) {
      writeLog("[lavish] closed poll feedback restore was incomplete; delivery was not marked");
    }
    const pendingAfterRestore = Array.isArray(restoredPrompts) && restoredPrompts.length > 0 || Array.isArray(restoredFailures) && restoredFailures.length > 0;
    if (pendingAfterRestore) events.emit("feedback", key);
    await publishChatSync(key);
  }
  const whiteboardStateRoot = path10.dirname(stateFile2);
  const loadExcalidrawLibraries2 = createExcalidrawLibraryCache();
  const libraryDir = excalidrawLibrariesDir(whiteboardStateRoot);
  const allowedHostnames = buildAllowedHostnames({
    host: requestedListenHosts[0],
    hosts: [...requestedListenHosts, ...listenHosts],
    linkHost: resolvedLinkHost,
    allowedHosts: extraHosts
  });
  const allowAnyHostname = allowsAllHosts(extraHosts);
  function workingUrlFor(req, { includeSessionPath = true } = {}) {
    const origin = `http://${hostForUrl(resolvedLinkHost)}:${publicPort}`;
    if (includeSessionPath && typeof req.path === "string" && req.path.startsWith("/session/")) {
      return `${origin}${req.path}`;
    }
    return `${origin}/`;
  }
  function sendDenied(req, res, { status, error, title, message, workingUrl = void 0 }) {
    const resolvedWorkingUrl = workingUrl || workingUrlFor(req);
    if (wantsHtml(req)) {
      res.status(status).type("html").send(createDeniedHtml({ title, message, workingUrl: resolvedWorkingUrl }));
      return;
    }
    res.status(status).json({ error });
  }
  function sendSessionNotFound(req, res) {
    sendDenied(req, res, {
      status: 404,
      error: "session not found",
      title: "Session not found",
      message: "This review session does not exist. Return to your agent and open the session URL it printed.",
      workingUrl: workingUrlFor(req, { includeSessionPath: false })
    });
  }
  function refuseNonHtmlArtifact(session, res) {
    if (isHtmlPath(session.file)) return false;
    res.status(403).send("Forbidden");
    return true;
  }
  if (!allowAnyHostname) {
    app.use((req, res, next) => {
      const requestHost = { host: req.headers.host, forwardedHost: req.headers["x-forwarded-host"] };
      if (isAllowedRequestHost(requestHost, allowedHostnames)) {
        next();
        return;
      }
      logEvent?.(
        `rejected request with disallowed host host=${req.headers.host ?? ""} x-forwarded-host=${req.headers["x-forwarded-host"] ?? ""} path=${req.path}`
      );
      sendDenied(req, res, {
        status: 403,
        error: "forbidden host",
        title: "Wrong address",
        message: tailscalePhoneReady ? "This Lavish review server does not accept that host. Open the working URL below on this computer or your phone through Tailscale." : "This Lavish review server does not accept that host. Open the working URL below on this computer. Phone access is unavailable."
      });
    });
  }
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      next();
      return;
    }
    if (hasPresentOriginOrReferer(req) && !isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
      res.status(403).json({ error: "cross-origin request rejected" });
      return;
    }
    next();
  });
  const attachmentConfig = resolveAttachmentConfig();
  const attachmentStateRoot = path10.dirname(stateFile2);
  const defaultJsonParser = express.json({ limit: "2mb" });
  const whiteboardJsonParser = express.json({ limit: "20mb" });
  app.use((req, res, next) => {
    if (req.method === "POST" && isAttachmentUploadApiPath(req.path)) return next();
    if (isWhiteboardWriteApiPath(req.path)) return whiteboardJsonParser(req, res, next);
    return defaultJsonParser(req, res, next);
  });
  app.get("/", (_req, res) => {
    res.type("html").send(createLandingHtml());
  });
  app.get("/health", async (req, res) => {
    if (!serverReady) {
      res.status(503).json({ ok: false, app: "lavish-axi", version });
      return;
    }
    const networkStale = req.query.reconcile_network === "1" ? await reconcileNetwork() : false;
    const networkWarning = currentNetworkWarning();
    res.json({
      ok: true,
      app: "lavish-axi",
      version,
      state_id: serverStateId,
      state_dir: path10.dirname(stateFile2),
      // Where this process is listening and every address it was asked to serve (bound or still
      // retrying). The CLI uses both to find one daemon per port whatever host it was configured
      // with, and to tell a same-port daemon at another address apart from this one.
      hosts: [...boundHosts],
      // Configured names sit beside the addresses they resolved to, so a CLI that resolves the same
      // name finds it served whichever form it compares.
      requested_hosts: [.../* @__PURE__ */ new Set([...listenHosts, ...requestedListenHosts])],
      ...networkStale ? { network_stale: true } : {},
      ...networkWarning ? { network_warning: networkWarning } : {},
      listeners: [...activePolls].map(([key, holder]) => ({
        key,
        label: listenerLabel(holder)
      }))
    });
  });
  let shutdownResolve;
  const done = new Promise((resolve) => {
    shutdownResolve = resolve;
  });
  app.post("/shutdown", (req, res) => {
    const reloadKey = String(req.body?.reload_key || "");
    const reason = SHUTDOWN_REASONS.has(String(req.body?.reason || "")) ? String(req.body.reason) : "";
    res.json({ status: "shutting-down" });
    setImmediate(() => shutdown(reloadKey, reason, "shutdown-request"));
  });
  app.post("/api/sessions", async (req, res, next) => {
    try {
      const file = await resolveAllowedArtifactFile(req.body?.file);
      const key = sessionKey(file);
      const reopen = Boolean(req.body.reopen);
      const existing = await store.findByKey(key);
      const sessionUrl = `http://${hostForUrl(resolvedLinkHost)}:${publicPort}/session/${key}`;
      if (existing?.status === "ended" && existing.ended_by === "user" && !reopen) {
        logEvent?.(`session open blocked (user-ended) key=${key} file=${file}`);
        res.json({
          key,
          file,
          url: sessionUrl,
          status: "user-ended",
          ...networkWarningField()
        });
        return;
      }
      const url = shouldDisableLayoutGateOpen(req.body || {}) ? appendNoGateParam(sessionUrl) : sessionUrl;
      const session = await store.upsertSession(file, sessionUrl);
      if (existing?.status === "ended") {
        clearFeedbackDelivery(key, activePolls, deliveredFeedback, events);
      }
      logEvent?.(`session opened key=${key} file=${file}`);
      await syncOutstandingRepairs(key);
      await watchSession(session, watchers, events, logEvent, reloadDebounceMs);
      res.json({
        key,
        file,
        url,
        status: "opened",
        ...networkWarningField()
      });
    } catch (error) {
      if (isArtifactPathError(error)) {
        res.status(error.statusCode).json({
          status: "error",
          code: error.code,
          error: error.message
        });
        return;
      }
      next(error);
    }
  });
  async function publishAgentReply(key, text, { requireOpen = false } = {}) {
    const session = await store.addAgentReply(key, text, { requireOpen });
    if (!session || requireOpen && session.status === "ended") return session;
    const lastEntry = session.chat?.at(-1);
    const entry = serializeChat([
      lastEntry?.role === "agent" ? lastEntry : { role: "agent", text, at: session.updated_at }
    ])[0];
    events.emit("agent-reply", key, entry);
    events.emit("chat-sync", key, session);
    clearFeedbackDelivery(key, activePolls, deliveredFeedback, events);
    return session;
  }
  const handlePoll = async (req, res, next) => {
    const takeover = req.query.takeover === "1";
    const agentReply = req.method === "POST" && req.body?.agent_reply !== void 0 ? String(req.body.agent_reply) : null;
    if (takeover && req.method !== "POST") {
      res.status(405).json({ error: "poll takeover requires POST" });
      return;
    }
    if (req.method === "POST" && (agentReply === null ? !takeover : !agentReply.trim())) {
      res.status(405).json({ error: "POST /api/poll requires agent_reply or takeover=1" });
      return;
    }
    let requestClosed = Boolean(req.aborted || req.method !== "POST" && req.destroyed);
    let cleanupPoll = null;
    let claimedHolder = null;
    const onRequestClose = () => {
      if (req.method === "POST" && !req.aborted) return;
      requestClosed = true;
      cleanupPoll?.();
    };
    const onResponseClose = () => {
      if (req.method === "POST" && !res.writableEnded) {
        requestClosed = true;
        cleanupPoll?.();
      }
    };
    res.on("close", onResponseClose);
    const detachRequestClose = () => req.off("close", onRequestClose);
    req.on("close", onRequestClose);
    try {
      let handleRespondError = function(error) {
        if (streamHeartbeat) {
          cleanup();
          if (!res.writableEnded) res.destroy(error);
          return;
        }
        next(error);
      };
      const file = await canonicalFile(String(req.query.file || ""));
      const key = sessionKey(file);
      const ownerValue = typeof req.query.owner === "string" ? req.query.owner.trim() : "";
      if (ownerValue.toLowerCase() === "none" || ownerValue.startsWith("-")) {
        detachRequestClose();
        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          error: "--owner none is reserved; pass a different listener label"
        });
        return;
      }
      const owner = ownerValue || null;
      if (hasPresentOriginOrReferer(req) && !isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        detachRequestClose();
        res.status(403).json({ error: "cross-origin poll takeover rejected" });
        return;
      }
      const { holder, previousPresence, conflict, missing } = await pollOwnershipLock.runExclusive(async () => {
        const currentHolder = activePolls.get(key);
        if (currentHolder && !takeover) return { conflict: listenerConflict(currentHolder, "LISTENER_ACTIVE") };
        const nextHolder = { key, owner, startedAt: Date.now(), replaced: false, replace: null };
        claimedHolder = nextHolder;
        const priorPresence = presenceSignature(key, activePolls, deliveredFeedback);
        if (currentHolder) {
          currentHolder.replaced = true;
          activePolls.set(key, nextHolder);
          currentHolder.replace?.();
        } else {
          activePolls.set(key, nextHolder);
        }
        deliveredFeedback.delete(key);
        if (agentReply !== null) {
          const session = await publishAgentReply(key, agentReply);
          if (!session) {
            activePolls.delete(key);
            return { missing: true };
          }
        }
        return { holder: nextHolder, previousPresence: priorPresence };
      });
      if (conflict) {
        detachRequestClose();
        res.status(409).json(conflict);
        return;
      }
      if (missing) {
        detachRequestClose();
        res.status(404).json({ error: "session not found" });
        return;
      }
      const timeoutMs = req.query.timeoutMs === void 0 ? null : Math.max(0, Math.min(Number(req.query.timeoutMs || 0), 2147483647));
      const immediate = await store.takeFeedback(key);
      if (immediate.status !== "waiting") {
        if (holder.replaced) {
          await restoreClosedFeedback(key, immediate);
          detachRequestClose();
          res.json(listenerConflict(holder, "LISTENER_REPLACED"));
          releasePollListener(holder, activePolls, deliveredFeedback, events);
          return;
        }
        if (requestClosed || res.writableEnded) {
          await restoreClosedFeedback(key, immediate);
          releasePollListener(holder, activePolls, deliveredFeedback, events);
          detachRequestClose();
          return;
        }
        finishFeedbackDelivery(key, immediate);
        releasePollListener(holder, activePolls, deliveredFeedback, events);
        if (immediate.session_ended) clearFeedbackDelivery(key, activePolls, deliveredFeedback, events);
        detachRequestClose();
        res.json(agentFacingFeedback(immediate));
        return;
      }
      if (holder.replaced) {
        detachRequestClose();
        res.json(listenerConflict(holder, "LISTENER_REPLACED"));
        releasePollListener(holder, activePolls, deliveredFeedback, events);
        return;
      }
      if (requestClosed || res.writableEnded) {
        releasePollListener(holder, activePolls, deliveredFeedback, events);
        detachRequestClose();
        return;
      }
      const streamHeartbeat = timeoutMs === null;
      let heartbeat = null;
      if (streamHeartbeat) {
        res.status(200).type("application/json").set("Lavish-Poll-State", "listening");
        res.write(" ");
        heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(" ");
        }, pollHeartbeatMs);
        heartbeat.unref?.();
      }
      refreshIdleTimer();
      let timer = null;
      let cleaned = false;
      let responding = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (timer) clearTimeout(timer);
        if (heartbeat) clearInterval(heartbeat);
        events.off("feedback", onFeedback);
        events.off("ended", onFeedback);
        events.off("browser-disconnected", onBrowserDisconnected);
        releasePollListener(holder, activePolls, deliveredFeedback, events);
        if (!activePolls.has(key)) {
          clearBrowserDisconnectTimer(key);
          browserDisconnectPending.delete(key);
        }
        refreshIdleTimer();
        cleanupPoll = null;
        detachRequestClose();
        res.off("close", onResponseClose);
      };
      const respondReplacement = () => {
        if (responding || res.writableEnded) return;
        responding = true;
        try {
          const replacement = listenerConflict(holder, "LISTENER_REPLACED");
          if (streamHeartbeat) res.end(JSON.stringify(replacement));
          else res.json(replacement);
        } finally {
          cleanup();
        }
      };
      holder.replace = respondReplacement;
      const respond = async (forcedResult = null) => {
        if (responding || res.writableEnded) return;
        responding = true;
        let finalSessionEnded = false;
        try {
          const result = await store.takeFeedback(key);
          const responseResult = forcedResult && result.status === "waiting" ? forcedResult : result;
          finalSessionEnded = responseResult?.session_ended === true;
          if (holder.replaced) {
            if (responseResult.status !== "waiting") await restoreClosedFeedback(key, responseResult);
            if (!requestClosed && !res.writableEnded) {
              if (streamHeartbeat) res.end(JSON.stringify(listenerConflict(holder, "LISTENER_REPLACED")));
              else res.json(listenerConflict(holder, "LISTENER_REPLACED"));
            }
            return;
          }
          if (requestClosed || res.writableEnded) {
            await restoreClosedFeedback(key, responseResult);
            return;
          }
          finishFeedbackDelivery(key, responseResult);
          const agentResponse = agentFacingFeedback(responseResult);
          if (streamHeartbeat) {
            res.end(JSON.stringify(agentResponse));
          } else {
            res.json(agentResponse);
          }
        } finally {
          cleanup();
          if (finalSessionEnded) clearFeedbackDelivery(key, activePolls, deliveredFeedback, events);
        }
      };
      const onFeedback = (changedKey) => {
        if (changedKey !== key || res.writableEnded) {
          return;
        }
        respond().catch(handleRespondError);
      };
      const onBrowserDisconnected = (changedKey) => {
        if (changedKey !== key || res.writableEnded) return;
        respond({ status: "browser_disconnected" }).catch(handleRespondError);
      };
      events.on("feedback", onFeedback);
      events.on("ended", onFeedback);
      events.on("browser-disconnected", onBrowserDisconnected);
      cleanupPoll = cleanup;
      if (holder.replaced) {
        respondReplacement();
        return;
      }
      if (requestClosed || res.writableEnded) {
        cleanup();
        return;
      }
      if (browserDisconnectPending.has(key)) {
        browserDisconnectPending.delete(key);
        onBrowserDisconnected(key);
        return;
      }
      const nextPresence = presenceSignature(key, activePolls, deliveredFeedback);
      if (nextPresence !== previousPresence) {
        events.emit("agent-presence", key, computePresence(key, activePolls, deliveredFeedback));
      }
      timer = timeoutMs === null ? null : setTimeout(() => respond().catch(handleRespondError), timeoutMs);
    } catch (error) {
      cleanupPoll?.();
      if (claimedHolder) releasePollListener(claimedHolder, activePolls, deliveredFeedback, events);
      detachRequestClose();
      next(error);
    }
  };
  app.get("/api/poll", handlePoll);
  app.post("/api/poll", handlePoll);
  app.post("/api/:key/prompts", async (req, res, next) => {
    try {
      if (!isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin prompt submission rejected" });
        return;
      }
      const shouldEndSession = Boolean(req.body?.endSession || req.body?.end_session);
      const hasLayoutWarningPrompt = Array.isArray(req.body?.prompts) ? req.body.prompts.some((prompt) => prompt?.tag === "layout-warnings") : false;
      const result = await store.queuePrompts(req.params.key, req.body || {}, {
        resolveAttachment: (sessionKeyValue, id) => resolveAttachment(attachmentStateRoot, sessionKeyValue, id),
        maxPerPrompt: attachmentConfig.maxPerPrompt,
        maxPromptBytes: attachmentConfig.maxPromptBytes
      });
      if (!result) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (result.ended) {
        res.status(409).json({ status: "ended", error: "session already ended", ended_by: result.ended_by });
        return;
      }
      if (result.rejected) {
        res.status(400).json({
          error: "some attachments could not be delivered",
          rejected: result.rejected,
          caps: result.caps
        });
        return;
      }
      const session = result;
      if (session.conflict) {
        res.status(409).json({
          status: "conflict",
          error: "a layout warning changed before it was sent; review the warning again",
          warning_ids: session.warning_ids,
          warnings: session.warnings
        });
        return;
      }
      const freshFeedback = session.fresh_feedback === true;
      if (shouldEndSession) clearFeedbackDelivery(req.params.key, activePolls, deliveredFeedback, events);
      let publishedSession = session;
      if (hasLayoutWarningPrompt) {
        await syncOutstandingRepairs(req.params.key);
        publishedSession = await store.findByKey(req.params.key) || session;
        events.emit("layout-warnings", req.params.key, serializeLayoutWarnings(publishedSession.layout_warnings));
      }
      if (shouldEndSession) events.emit("ended", req.params.key, publishedSession.ended_by);
      else if (freshFeedback) events.emit("feedback", req.params.key, publishedSession.ended_by);
      events.emit("chat-sync", req.params.key, publishedSession);
      res.json({
        status: "queued",
        pending_prompts: publishedSession.pending_prompts,
        ...serializeChatSync(publishedSession)
      });
      if (shouldEndSession) await shutdownIfNoLiveSessions();
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/layout-diagnostics", async (req, res, next) => {
    try {
      const result = await store.recordLayoutDiagnostics(req.params.key, req.body || {}, {
        viewportClasses: diagnosticViewportClasses
      });
      if (!result) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      const activeCount = activeLayoutWarningCount(result.session.layout_warnings);
      if (!result.stale) {
        await syncOutstandingRepairs(req.params.key);
        if (result.changed) events.emit("layout-warnings", req.params.key, result.warnings);
      }
      res.json({ status: result.stale ? "stale" : "recorded", active_count: activeCount, warnings: result.warnings });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/:key/layout-warnings", async (req, res, next) => {
    try {
      const result = await store.listLayoutWarnings(req.params.key);
      if (!result) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      res.json({ warnings: result.warnings, revision: result.revision });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/layout-warnings/queue", async (req, res, next) => {
    try {
      const result = await store.prepareLayoutWarningFixes(req.params.key, req.body?.ids);
      if (!result) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      res.json({
        status: result.queued.length > 0 ? "prepared" : "unchanged",
        queued_count: result.queued.length,
        prompt: result.prompt,
        warnings: result.warnings
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/layout-warnings/dismiss", async (req, res, next) => {
    try {
      const result = await store.dismissLayoutWarning(req.params.key, req.body?.id);
      if (!result) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (result.changed) events.emit("layout-warnings", req.params.key, result.warnings);
      res.json({ status: result.changed ? "dismissed" : "unchanged", warnings: result.warnings });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/artifact-failures", async (req, res, next) => {
    try {
      const result = await store.recordArtifactFailures(req.params.key, req.body || {});
      if (!result) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (result.stale) {
        res.status(409).json({ status: "stale" });
        return;
      }
      if (result.changed) events.emit("feedback", req.params.key);
      res.json({ status: "recorded" });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/end", async (req, res, next) => {
    try {
      const session = await store.endSession(req.params.key, "user");
      clearFeedbackDelivery(req.params.key, activePolls, deliveredFeedback, events);
      events.emit("ended", req.params.key, session?.ended_by);
      res.json({ status: "ended" });
      await shutdownIfNoLiveSessions();
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/agent-reply", async (req, res, next) => {
    try {
      const session = await publishAgentReply(req.params.key, String(req.body?.text || ""), {
        requireOpen: true
      });
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (session.status === "ended") {
        res.status(409).json({ status: "ended", ended_by: session.ended_by });
        return;
      }
      res.json({ status: "sent" });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/:key/export", async (req, res, next) => {
    try {
      const session = await store.findByKey(req.params.key);
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (refuseNonHtmlArtifact(session, res)) return;
      const source = await readFile6(session.file, "utf8");
      const root = path10.dirname(session.file);
      const { html, warnings } = await buildSelfContainedHtml(source, {
        baseDir: root,
        confineDir: root,
        resolveAbsolute: resolveDesignAssetPath
      });
      const { unresolved, notices } = splitExportWarnings(warnings);
      res.setHeader("content-security-policy", ARTIFACT_CONTENT_SECURITY_POLICY);
      res.setHeader("content-disposition", exportContentDisposition(session.file));
      res.setHeader("x-lavish-export-warning-count", String(unresolved.length));
      res.setHeader("x-lavish-export-notice-count", String(notices.length));
      res.type("html").send(html);
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/share", async (req, res, next) => {
    try {
      if (!isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin share request rejected" });
        return;
      }
      const session = await store.findByKey(req.params.key);
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (refuseNonHtmlArtifact(session, res)) return;
      const body = req.body || {};
      const generatePassword = body.generate_password === true;
      const password = generatePassword ? generateSharePassword() : optionalBodyString(body.password);
      const source = await readFile6(session.file, "utf8");
      const root = path10.dirname(session.file);
      const { html, warnings } = await buildSelfContainedHtml(source, {
        baseDir: root,
        confineDir: root,
        resolveAbsolute: resolveDesignAssetPath
      });
      let site;
      try {
        site = await publishToHtmlApp(html, { password });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const landed = publishedDespiteError(error);
        if (landed) {
          res.status(502).json({
            error: message,
            outcome: "published-incomplete",
            public: !password,
            ...landed.url ? { url: landed.url } : {},
            ...landed.siteId ? { site_id: landed.siteId } : {},
            ...landed.updateKey ? { update_key: landed.updateKey } : {},
            ...generatePassword ? { password } : {}
          });
          return;
        }
        const rejected = hostRejectedShareWrite(error);
        res.status(502).json({
          error: message,
          outcome: rejected ? "rejected" : "indeterminate",
          ...rejected ? {} : {
            public: !password,
            // A rejection gates nothing, so it must never carry the password.
            ...generatePassword ? { password } : {}
          }
        });
        return;
      }
      const { unresolved, notices } = splitExportWarnings(warnings);
      res.json({
        ...site,
        // Only a password Lavish minted goes back to the browser; one the user typed is already
        // theirs, and echoing it would put it in a field they did not ask to have filled.
        ...generatePassword ? { password } : {},
        ...warnings.length ? { warnings: exportWarningSummaries(warnings) } : {},
        ...unresolved.length ? { unresolved_local_assets: exportWarningSummaries(unresolved) } : {},
        ...notices.length ? { notices: exportWarningSummaries(notices) } : {}
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/end", async (req, res, next) => {
    try {
      const file = await canonicalFile(req.body.file);
      const key = sessionKey(file);
      const session = await store.endSession(key, "agent");
      clearFeedbackDelivery(key, activePolls, deliveredFeedback, events);
      events.emit("ended", key, session?.ended_by);
      res.json({ status: "ended" });
      await shutdownIfNoLiveSessions();
    } catch (error) {
      next(error);
    }
  });
  app.get("/session/:key", async (req, res, next) => {
    try {
      const chromeLoad = await store.issueReviewerHandoff(req.params.key);
      if (!chromeLoad) {
        sendSessionNotFound(req, res);
        return;
      }
      const session = chromeLoad.session;
      if (refuseNonHtmlArtifact(session, res)) return;
      await watchSession(session, watchers, events, logEvent, reloadDebounceMs);
      const artifactHtml = await readFile6(session.file, "utf8").catch(() => "");
      const { faviconTag, title } = extractArtifactHead(artifactHtml);
      res.setHeader("x-frame-options", "DENY");
      res.setHeader("content-security-policy", "frame-ancestors 'none'");
      res.type("html").send(
        createChromeHtml(session, {
          layoutGateEnabled: shouldEnableLayoutGate(req.query || {}),
          faviconTag,
          title: title ? `${title} \xB7 Lavish` : "Lavish Editor",
          artifactRevision: chromeLoad.artifact_revision,
          artifactLoadToken: chromeLoad.artifact_load_token,
          artifactLoadSequence: chromeLoad.artifact_load_sequence,
          chromeLoadToken: chromeLoad.chrome_load_token,
          attachmentMaxBytes: attachmentConfig.maxBytes,
          attachmentMaxCount: attachmentConfig.maxPerPrompt
        })
      );
    } catch (error) {
      next(error);
    }
  });
  app.get("/artifact/:key", (req, res) => {
    res.redirect(`/artifact/${req.params.key}/index.html`);
  });
  app.post("/api/:key/chrome-loads/begin", async (req, res, next) => {
    try {
      if (!isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin chrome handoff rejected" });
        return;
      }
      const handoff = await store.issueReviewerHandoff(req.params.key);
      if (!handoff) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      res.json({
        chrome_load_token: handoff.chrome_load_token,
        artifact_revision: handoff.artifact_revision,
        artifact_load_token: handoff.artifact_load_token,
        artifact_load_sequence: handoff.artifact_load_sequence
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/artifact-loads/begin", async (req, res, next) => {
    try {
      const result = await store.beginArtifactLoad(req.params.key, {
        requestId: req.body?.request_id,
        requestSequence: req.body?.request_sequence,
        handoffToken: req.body?.chrome_load_token
      });
      if (!result) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (result.stale) {
        res.status(409).json({ status: result.stale });
        return;
      }
      res.json({ artifact_revision: result.artifact_revision, artifact_load_token: result.artifact_load_token });
    } catch (error) {
      next(error);
    }
  });
  app.get(/^\/artifact\/([^/]+)\/index\.html$/, async (req, res, next) => {
    try {
      res.setHeader("content-security-policy", ARTIFACT_CONTENT_SECURITY_POLICY);
      const key = req.params[0];
      const token = String(req.query.artifact_load_token || "");
      const revision = req.query.artifact_revision;
      const beforeRead = await store.verifyArtifactLoad(key, token, revision);
      if (!beforeRead) {
        sendSessionNotFound(req, res);
        return;
      }
      if (refuseNonHtmlArtifact(beforeRead.session, res)) return;
      if (!beforeRead.valid) {
        res.status(409).type("html").send(
          "<!doctype html><title>Artifact load expired</title><p>This artifact load is no longer current. Reload Lavish to continue.</p>"
        );
        return;
      }
      const html = await readFile6(beforeRead.session.file, "utf8");
      const verified = await store.verifyArtifactLoad(key, token, revision);
      if (!verified?.valid) {
        res.status(409).type("html").send(
          "<!doctype html><title>Artifact load expired</title><p>This artifact load is no longer current. Reload Lavish to continue.</p>"
        );
        return;
      }
      res.type("html").send(injectLavishSdk(html, key, verified.artifact_revision, verified.artifact_load_token));
    } catch (error) {
      next(error);
    }
  });
  app.get(/^\/artifact\/([^/]+)\/(.+)$/, async (req, res, next) => {
    try {
      res.setHeader("content-security-policy", ARTIFACT_CONTENT_SECURITY_POLICY);
      const key = req.params[0];
      const assetPath = req.params[1];
      const session = await store.findByKey(key);
      if (!session) {
        sendSessionNotFound(req, res);
        return;
      }
      if (refuseNonHtmlArtifact(session, res)) return;
      const root = artifactTreeRoot(session.file);
      const file = await resolveArtifactAsset(root, assetPath);
      if (!file) {
        res.status(403).send("Forbidden");
        return;
      }
      res.sendFile(file, { dotfiles: "allow" });
    } catch (error) {
      next(error);
    }
  });
  app.get("/events/:key", (_req, res) => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "close"
    });
    res.end(`event: chrome-reload
data: ${JSON.stringify({ reason: "server-restarted" })}

`);
  });
  app.get("/chrome-client.js", async (req, res, next) => {
    try {
      res.type("application/javascript").send(await readFile6(chromeClientUrl, "utf8"));
    } catch (error) {
      next(error);
    }
  });
  app.get("/chrome.css", async (req, res, next) => {
    try {
      res.type("text/css").send(await readFile6(chromeCssUrl, "utf8"));
    } catch (error) {
      next(error);
    }
  });
  app.get("/design/:asset", async (req, res, next) => {
    try {
      const asset = designAssetUrls[req.params.asset];
      if (!asset) {
        res.status(404).send("Not found");
        return;
      }
      res.type(asset.type).send(await readDesignAsset(asset));
    } catch (error) {
      next(error);
    }
  });
  app.get("/sdk.js", async (req, res, next) => {
    try {
      const verified = await store.verifyArtifactLoad(
        String(req.query.key || ""),
        req.query.artifact_load_token,
        req.query.artifact_revision
      );
      if (!verified) {
        sendSessionNotFound(req, res);
        return;
      }
      if (!verified.valid) {
        res.status(409).json({ status: "stale" });
        return;
      }
      res.type("application/javascript").send(
        createSdkJs(String(req.query.key || ""), verified.artifact_revision, verified.artifact_load_token, {
          maxAttachmentCount: attachmentConfig.maxPerPrompt,
          maxAttachmentBytes: attachmentConfig.maxBytes
        })
      );
    } catch (error) {
      next(error);
    }
  });
  app.get("/whiteboard-frame", (req, res) => {
    res.setHeader("cache-control", "no-store");
    const sessionKey2 = String(req.query.key || "");
    if (!isValidWhiteboardKey(sessionKey2)) {
      res.status(400).type("text/plain").send("Missing session key");
      return;
    }
    res.type("html").send(createWhiteboardFrameHtml(createWhiteboardChannelToken(whiteboardChannelSecret, sessionKey2)));
  });
  app.get(/^\/whiteboard-assets\/(.+)$/, async (req, res, next) => {
    try {
      const file = await resolveArtifactAsset(whiteboardAssetsDir, req.params[0]);
      if (!file) {
        res.status(403).send("Forbidden");
        return;
      }
      if (!existsSync2(file)) {
        res.status(404).send(existsSync2(whiteboardAssetsDir) ? "Not found" : "Whiteboard bundle missing - run `pnpm run build`");
        return;
      }
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("cache-control", "no-cache");
      res.sendFile(file, { dotfiles: "allow" });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/:key/mermaid-sources", async (req, res, next) => {
    try {
      const session = await store.findByKey(req.params.key);
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (refuseNonHtmlArtifact(session, res)) return;
      const html = await readFile6(session.file, "utf8").catch(() => "");
      const extracted = extractMermaidSources(html);
      const usesLibraries = extracted.some(({ source }) => parseLibraryIconDirectives(source).length > 0);
      const snapshot = usesLibraries ? await loadExcalidrawLibraries2(libraryDir) : null;
      const libraries = snapshot ? snapshot.libraries : [];
      const sources = extracted.map(({ index, source }) => ({
        index,
        source,
        hash: whiteboardSourceHash(source, libraries)
      }));
      res.json(snapshot ? { sources, libraries_version: snapshot.version } : { sources });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/whiteboard-libraries", async (req, res, next) => {
    try {
      if (hasPresentOriginOrReferer(req) && !isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin whiteboard library request rejected" });
        return;
      }
      const { libraries, version: version2 } = await loadExcalidrawLibraries2(libraryDir);
      res.setHeader("cache-control", "no-store");
      res.json({ libraries: libraries.map(({ id, items }) => ({ id, items })), version: version2 });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/:key/whiteboard/:index", async (req, res, next) => {
    try {
      const session = await store.findByKey(req.params.key);
      if (!session || !isValidDiagramIndex(req.params.index)) {
        res.status(404).json({ error: "whiteboard not found" });
        return;
      }
      const whiteboard = await loadWhiteboard(whiteboardStateRoot, req.params.key, Number(req.params.index));
      res.json({ whiteboard });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/whiteboard-channel", async (req, res, next) => {
    try {
      if (!isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin whiteboard channel request rejected" });
        return;
      }
      const session = await store.findByKey(req.params.key);
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      if (!isValidWhiteboardChannelToken(req.body?.token, whiteboardChannelSecret, req.params.key)) {
        res.status(403).json({ error: "invalid whiteboard channel" });
        return;
      }
      res.json({ status: "authenticated" });
    } catch (error) {
      next(error);
    }
  });
  app.put("/api/:key/whiteboard/:index", async (req, res, next) => {
    try {
      if (!isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin whiteboard write rejected" });
        return;
      }
      const session = await store.findByKey(req.params.key);
      if (!session || !isValidWhiteboardKey(req.params.key) || !isValidDiagramIndex(req.params.index)) {
        res.status(404).json({ error: "whiteboard not found" });
        return;
      }
      const body = req.body || {};
      await saveWhiteboard(whiteboardStateRoot, req.params.key, Number(req.params.index), {
        sourceHash: String(body.source_hash || body.sourceHash || ""),
        textMetricsVersion: Number(body.text_metrics_version || body.textMetricsVersion) || 0,
        scene: body.scene ?? null,
        baseline: body.baseline ?? null
      });
      res.json({ status: "saved" });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/whiteboard/:index/feedback-files", async (req, res, next) => {
    try {
      if (!isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin whiteboard write rejected" });
        return;
      }
      const session = await store.findByKey(req.params.key);
      if (!session || !isValidWhiteboardKey(req.params.key) || !isValidDiagramIndex(req.params.index)) {
        res.status(404).json({ error: "whiteboard not found" });
        return;
      }
      const body = req.body || {};
      const { scenePath, previewPath } = await writeWhiteboardFeedbackFiles(
        whiteboardStateRoot,
        req.params.key,
        Number(req.params.index),
        { scene: body.scene ?? null, pngDataUrl: String(body.pngDataUrl || body.png_data_url || "") }
      );
      res.json({ scene_path: scenePath, preview_path: previewPath });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/attachments", async (req, res, next) => {
    try {
      if (!isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin attachment upload rejected" });
        return;
      }
      if (!isValidAttachmentKey(req.params.key) || !await store.findByKey(req.params.key)) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      const { tooLarge, buffer } = await readAttachmentUploadBody(req, attachmentConfig.maxBytes);
      if (tooLarge) {
        res.status(413).json({ error: `attachment exceeds the ${attachmentConfig.maxBytes} byte limit` });
        return;
      }
      const attachment = await store.runExclusive(async () => {
        const referenced = await store.referencedAttachmentIds();
        return writeAttachment(attachmentStateRoot, req.params.key, buffer, {
          maxBytes: attachmentConfig.maxBytes,
          maxDiskBytes: attachmentConfig.maxDiskBytes,
          maxObjects: attachmentConfig.maxObjects,
          ttlMs: attachmentConfig.ttlMs,
          referenced,
          evictionGraceMs: attachmentConfig.evictionGraceMs
        });
      });
      res.json({ status: "stored", attachment });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/:key/attachments/:id", async (req, res, next) => {
    try {
      const serve2 = await statAttachmentForServe(attachmentStateRoot, req.params.key, req.params.id);
      if (!serve2) {
        res.status(404).json({ error: "attachment not found" });
        return;
      }
      res.setHeader("cache-control", "private, max-age=300");
      res.type(serve2.mime);
      res.sendFile(serve2.file, { dotfiles: "allow" });
    } catch (error) {
      next(error);
    }
  });
  app.delete("/api/:key/attachments/:id", async (req, res, next) => {
    try {
      if (!isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
        res.status(403).json({ error: "cross-origin attachment delete rejected" });
        return;
      }
      const status = await store.runExclusive(async () => {
        const referenced = await store.referencedAttachmentIds();
        if (referenced.has(`${req.params.key}/${req.params.id}`)) return "referenced";
        return await removeAttachment(attachmentStateRoot, req.params.key, req.params.id) ? "removed" : "absent";
      });
      res.json({ status });
    } catch (error) {
      next(error);
    }
  });
  app.use((error, req, res, _next) => {
    const status = Number(error?.statusCode || error?.status) || 500;
    res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
  });
  const eventWebSocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  function rejectEventUpgrade(socket, status, message) {
    const body = `${message}
`;
    socket.end(
      `HTTP/1.1 ${status} ${message}\r
Connection: close\r
Content-Type: text/plain; charset=utf-8\r
Content-Length: ${Buffer.byteLength(body)}\r
\r
${body}`
    );
  }
  function handleEventUpgrade(req, socket, head) {
    let pathname;
    try {
      pathname = new URL(String(req.url || ""), "http://lavish.local").pathname;
    } catch {
      rejectEventUpgrade(socket, 400, "Bad Request");
      return;
    }
    const match = pathname.match(/^\/events\/([^/]+)$/);
    if (!match) {
      rejectEventUpgrade(socket, 404, "Not Found");
      return;
    }
    const hostAllowed = allowAnyHostname ? parseHostAuthority(req.headers.host) !== null : isAllowedRequestHost(
      { host: req.headers.host, forwardedHost: req.headers["x-forwarded-host"] },
      allowedHostnames
    );
    if (!hostAllowed || !req.headers.origin || !isSameOriginRequest(req, allowedHostnames, allowAnyHostname)) {
      rejectEventUpgrade(socket, 403, "Forbidden");
      return;
    }
    let key;
    try {
      key = decodeURIComponent(match[1]);
    } catch {
      rejectEventUpgrade(socket, 400, "Bad Request");
      return;
    }
    eventWebSocketServer.handleUpgrade(req, socket, head, (webSocket) => {
      const client = {
        sendEvent(type, data) {
          if (webSocket.readyState === WebSocket.OPEN) webSocket.send(JSON.stringify({ type, data }));
        },
        close(code = 1001, reason = "Lavish server shutdown") {
          webSocket.close(code, reason);
          const terminateTimer = setTimeout(() => {
            if (webSocket.readyState !== WebSocket.CLOSED) webSocket.terminate();
          }, WEBSOCKET_CLOSE_GRACE_MS);
          terminateTimer.unref?.();
          webSocket.once("close", () => clearTimeout(terminateTimer));
        },
        isClosed() {
          return webSocket.readyState === WebSocket.CLOSING || webSocket.readyState === WebSocket.CLOSED;
        }
      };
      webSocket.on("error", () => {
      });
      if (liveEventHeartbeatMs != null && liveEventHeartbeatMs > 0) {
        let awaitingPong = false;
        const heartbeat = setInterval(() => {
          if (awaitingPong) {
            logEvent?.(`event WebSocket heartbeat missed session=${key}, terminating`);
            webSocket.terminate();
            return;
          }
          awaitingPong = true;
          try {
            webSocket.ping();
          } catch {
            webSocket.terminate();
          }
        }, liveEventHeartbeatMs);
        heartbeat.unref?.();
        webSocket.on("pong", () => {
          awaitingPong = false;
        });
        webSocket.once("close", () => clearInterval(heartbeat));
      }
      const cleanup = attachLiveEventClient(client, key, (remove) => webSocket.once("close", remove));
      sendInitialLiveEventState(client, key, cleanup).catch((error) => {
        client.close(1011, "Failed to initialize live events");
        cleanup();
        logEvent?.(`event WebSocket initialization failed session=${key}: ${error?.message || error}`);
      });
    });
  }
  const httpServers = [];
  const boundHosts = [];
  let boundPort = port;
  let lastBindError = null;
  async function listenOnce(listenHost) {
    const address = isIP3(listenHost) ? listenHost : (await resolveConcreteListenHosts([listenHost], lookupOptions))[0];
    if (address !== listenHost) {
      if (!listenHosts.includes(address)) listenHosts.push(address);
      if (boundHosts.includes(address)) {
        boundHosts.push(listenHost);
        return;
      }
    }
    const httpServer = await listenHttp(app, boundPort, address, (error) => {
      writeLog(`[lavish] HTTP server error: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (shuttingDown) {
      httpServer.close();
      throw new Error("Lavish server is shutting down");
    }
    httpServer.on("upgrade", handleEventUpgrade);
    if (boundPort === 0) boundPort = httpServer.address().port;
    if (!publicPort) publicPort = boundPort;
    httpServers.push(httpServer);
    boundHosts.push(listenHost);
    if (address !== listenHost) boundHosts.push(address);
  }
  async function bindListener(listenHost) {
    let retryIndex = 0;
    while (true) {
      try {
        await listenOnce(listenHost);
        return null;
      } catch (error) {
        if (!shuttingDown && retryIndex < BIND_RETRY_DELAYS_MS.length) {
          await new Promise((resolve) => setTimeout(resolve, BIND_RETRY_DELAYS_MS[retryIndex]));
          retryIndex += 1;
          continue;
        }
        return error instanceof Error ? error : new Error(String(error));
      }
    }
  }
  function applyNetworkState() {
    tailscalePhoneReady = Boolean(tailscale?.ipv4 && boundHosts.includes(tailscale.ipv4));
    if (linkHostName != null) {
      resolvedLinkHost = linkHostName;
    } else if (tailscalePhoneReady) {
      resolvedLinkHost = resolveLinkHost({ env, tailscale, fallbackHost: host });
    } else if (boundHosts.includes(listenHosts[0])) {
      resolvedLinkHost = resolveLinkHost({ env, tailscale: null, fallbackHost: host });
    } else {
      resolvedLinkHost = resolveLinkHost({ env, tailscale: null, fallbackHost: LOOPBACK_HOST });
    }
    const servesHost = (candidate) => candidate !== tailscale?.ipv4 || tailscalePhoneReady;
    const nextAllowedHostnames = buildAllowedHostnames({
      host: requestedListenHosts[0],
      hosts: [...requestedListenHosts.filter(servesHost), ...listenHosts.filter(servesHost), ...boundHosts],
      linkHost: resolvedLinkHost,
      allowedHosts: extraHosts
    });
    allowedHostnames.clear();
    for (const allowedHostname of nextAllowedHostnames) allowedHostnames.add(allowedHostname);
  }
  let bindRecoveryInFlight = null;
  async function retryPendingBinds() {
    if (pendingBinds.size === 0 || shuttingDown) return;
    if (!bindRecoveryInFlight) {
      bindRecoveryInFlight = (async () => {
        let bound2 = false;
        for (const listenHost of [...pendingBinds.keys()]) {
          if (shuttingDown) return;
          try {
            await listenOnce(listenHost);
            pendingBinds.delete(listenHost);
            bound2 = true;
            writeLog(`[lavish] now listening on ${hostForUrl(listenHost)}:${boundPort} after an earlier bind failure.`);
          } catch (error) {
            if (!shuttingDown) pendingBinds.set(listenHost, error instanceof Error ? error : new Error(String(error)));
          }
        }
        if (bound2) applyNetworkState();
      })().finally(() => {
        bindRecoveryInFlight = null;
      });
    }
    await bindRecoveryInFlight;
  }
  let bindRecoveryAttempt = 0;
  function scheduleBindRecovery() {
    if (shuttingDown || pendingBinds.size === 0 || bindRecoveryTimer || !bindRecoveryDelaysMs.length) return;
    const delay2 = bindRecoveryDelaysMs[Math.min(bindRecoveryAttempt, bindRecoveryDelaysMs.length - 1)];
    bindRecoveryAttempt += 1;
    bindRecoveryTimer = setTimeout(() => {
      bindRecoveryTimer = null;
      retryPendingBinds().catch(() => {
      }).finally(() => scheduleBindRecovery());
    }, delay2);
    bindRecoveryTimer.unref?.();
  }
  const bindOrder = listenHosts.includes(LOOPBACK_HOST) ? [LOOPBACK_HOST, ...listenHosts.filter((listenHost) => listenHost !== LOOPBACK_HOST)] : listenHosts;
  for (const listenHost of bindOrder) {
    const error = await bindListener(listenHost);
    if (!error) continue;
    lastBindError = error;
    if (listenHost === LOOPBACK_HOST && isAddressInUseBindError(error)) {
      const owner = await probeLavishHealth(LOOPBACK_HOST, boundPort);
      throw new Error(
        owner ? `Another Lavish server (version ${owner.version || "unknown"}) already owns port ${boundPort} on ${LOOPBACK_HOST}; not starting a second one.` : `Loopback ${LOOPBACK_HOST}:${boundPort} is already in use; not starting a Lavish server on another address.`,
        { cause: error }
      );
    }
    pendingBinds.set(listenHost, error);
  }
  if (httpServers.length === 0 && !listenHosts.includes(LOOPBACK_HOST)) {
    const error = await bindListener(LOOPBACK_HOST);
    if (error) lastBindError = error;
  }
  if (httpServers.length === 0) {
    throw new Error(
      `Lavish server failed to bind any address${lastBindError ? `: ${lastBindError.message}` : ""}`,
      lastBindError ? { cause: lastBindError } : void 0
    );
  }
  if (!boundHosts.includes(LOOPBACK_HOST) && !boundHosts.includes(listenHosts[0])) {
    const error = new Error(
      `Lavish server failed to bind a control-channel address${lastBindError ? `: ${lastBindError.message}` : ""}`,
      lastBindError ? { cause: lastBindError } : void 0
    );
    await Promise.all(
      httpServers.splice(0).map(
        (httpServer) => new Promise((resolve) => {
          httpServer.close(() => resolve(void 0));
        })
      )
    );
    boundHosts.length = 0;
    throw error;
  }
  applyNetworkState();
  publicPort = httpServers[0].address().port;
  for (const [listenHost, error] of pendingBinds) {
    writeLog(`[lavish] WARNING: ${describeBindFailure(listenHost, error)}`);
  }
  serverReady = true;
  scheduleBindRecovery();
  function shutdown(reloadKey = "", reason = "", cause = "requested") {
    if (shuttingDown) return;
    shuttingDown = true;
    writeLog(`[lavish] shutting down: ${cause}${reason ? ` (reason=${reason})` : ""}`);
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (attachmentSweepTimer) {
      clearInterval(attachmentSweepTimer);
      attachmentSweepTimer = null;
    }
    if (bindRecoveryTimer) {
      clearTimeout(bindRecoveryTimer);
      bindRecoveryTimer = null;
    }
    const shutdownData = { reason };
    for (const [client, clientKey] of liveEventClients) {
      try {
        if (reloadKey && clientKey === reloadKey) {
          client.sendEvent("chrome-reload", shutdownData);
        } else {
          client.sendEvent("chrome-outdated", shutdownData);
        }
        client.close();
      } catch {
      }
    }
    liveEventClients.clear();
    for (const timer of browserDisconnectTimers.values()) clearTimeout(timer);
    browserDisconnectTimers.clear();
    for (const w of watchers.values()) {
      w.close().catch(() => {
      });
    }
    watchers.clear();
    let remaining = httpServers.length;
    const closed = () => {
      remaining -= 1;
      if (remaining === 0) shutdownResolve();
    };
    for (const httpServer of httpServers) {
      httpServer.close(closed);
      if (typeof httpServer.closeAllConnections === "function") {
        httpServer.closeAllConnections();
      }
    }
  }
  function refreshIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (shuttingDown || idleTimeoutMs == null) return;
    if (liveEventClients.size > 0 || activePolls.size > 0) return;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (!shuttingDown && liveEventClients.size === 0 && activePolls.size === 0) {
        shutdown("", "", `idle-timeout after ${idleTimeoutMs}ms with no connections`);
      }
    }, idleTimeoutMs);
    idleTimer.unref?.();
  }
  async function shutdownIfNoLiveSessions() {
    if (liveEventClients.size > 0 || activePolls.size > 0) return;
    try {
      const sessions = await store.listSessions();
      if (sessions.every((session) => session.status === "ended")) {
        setImmediate(() => shutdown("", "", "last open session ended with no live connections"));
      }
    } catch {
    }
  }
  async function syncOutstandingRepairs(key) {
    try {
      if (await store.hasOutstandingLayoutRepairs(key)) {
        outstandingRepairBatches.add(key);
      } else {
        outstandingRepairBatches.delete(key);
      }
    } catch {
    }
  }
  function reloadDebounceMs(key) {
    return outstandingRepairBatches.has(key) ? BATCH_RELOAD_DEBOUNCE_MS : RELOAD_DEBOUNCE_MS;
  }
  const attachmentSweepEnabled = attachmentConfig.ttlMs != null || attachmentConfig.maxDiskBytes != null;
  async function sweepAttachmentsNow() {
    try {
      const result = await store.runExclusive(async () => {
        const referenced = await store.referencedAttachmentIds();
        return sweepAttachments(attachmentStateRoot, {
          ttlMs: attachmentConfig.ttlMs,
          maxDiskBytes: attachmentConfig.maxDiskBytes,
          maxObjects: attachmentConfig.maxObjects,
          referenced,
          evictionGraceMs: attachmentConfig.evictionGraceMs
        });
      });
      if (result.deleted > 0) {
        logEvent?.(`attachment sweep removed ${result.deleted} file(s), freed ${result.freedBytes} bytes`);
      }
    } catch (error) {
      logEvent?.(`attachment sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (attachmentSweepEnabled) {
    sweepAttachmentsNow();
    attachmentSweepTimer = setInterval(() => {
      sweepAttachmentsNow();
    }, ATTACHMENT_SWEEP_INTERVAL_MS);
    attachmentSweepTimer.unref?.();
  }
  refreshIdleTimer();
  return {
    port: publicPort,
    hosts: boundHosts,
    addresses: httpServers.map((server) => server.address()),
    close: async () => {
      shutdown("", "", "close() called");
      await done;
    },
    done
  };
}
function listenHttp(app, port, host, onRuntimeError) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    let listening = false;
    const onError = (error) => {
      if (!listening) {
        server.off("listening", onListening);
        reject(error);
        return;
      }
      onRuntimeError?.(error);
    };
    const onListening = () => {
      listening = true;
      const address = server.address();
      if (address && typeof address === "object" && isWildcardHost(address.address)) {
        server.close(() => reject(new Error(`Refusing all-interfaces listener at ${address.address}`)));
        return;
      }
      resolve(server);
    };
    server.on("error", onError);
    server.once("listening", onListening);
    server.listen({ port, host });
  });
}
function tailscaleNetworkKey(tailscale) {
  if (!tailscale) return "down";
  if (tailscale.warning) return "incomplete";
  if (!tailscale.ipv4 || !tailscale.magicDnsName) return "incomplete";
  return `up
${tailscale.ipv4}
${tailscale.magicDnsName}`;
}
function isAddressInUseBindError(error) {
  return error instanceof Error && "code" in error && error.code === "EADDRINUSE";
}
function probeLavishHealth(host, port) {
  return new Promise((resolve) => {
    const request = httpGet({ host, port, path: "/health", agent: false }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) request.destroy();
      });
      response.on("end", () => {
        request.destroy();
        try {
          const parsed = JSON.parse(body);
          resolve(parsed && typeof parsed === "object" && parsed.app === "lavish-axi" ? parsed : null);
        } catch {
          resolve(null);
        }
      });
      response.on("error", () => resolve(null));
    });
    request.setTimeout(LOOPBACK_OWNER_PROBE_TIMEOUT_MS, () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
    request.on("close", () => resolve(null));
  });
}
function wantsHtml(req) {
  const accept = String(req.get("accept") || "");
  return accept.toLowerCase().includes("text/html");
}
function createLandingHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lavish Editor</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f4ef;color:#25221f;font:16px/1.5 system-ui,sans-serif}.card{width:min(560px,calc(100% - 40px));padding:32px;border:1px solid #d9d0c5;border-radius:16px;background:#fffdf9;box-shadow:0 12px 40px #25221f18}h1{margin:0 0 12px;font-size:26px}p{margin:0}</style></head><body><main class="card"><h1>Lavish Editor is running</h1><p>Open the review session URL printed by your agent.</p></main></body></html>`;
}
function createDeniedHtml({ title, message, workingUrl }) {
  const safeTitle = escapeHtml2(title);
  const safeMessage = escapeHtml2(message);
  const safeUrl = escapeHtml2(workingUrl);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} - Lavish Editor</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f4ef;color:#25221f;font:16px/1.5 system-ui,sans-serif}.card{width:min(560px,calc(100% - 40px));padding:32px;border:1px solid #d9d0c5;border-radius:16px;background:#fffdf9;box-shadow:0 12px 40px #25221f18}h1{margin:0 0 12px;font-size:26px}p{margin:0 0 18px}.url{display:block;padding:12px 14px;border-radius:10px;background:#f0ebe4;color:#25221f;overflow-wrap:anywhere}a{color:inherit;font-weight:700}</style></head><body><main class="card"><h1>${safeTitle}</h1><p>${safeMessage}</p><p>Open this working URL:</p><a class="url" href="${safeUrl}">${safeUrl}</a></main></body></html>`;
}
async function readDesignAsset(asset) {
  try {
    return await readFile6(asset.packaged, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
    return readFile6(asset.source, "utf8");
  }
}
function resolveDesignAssetPath(refPath) {
  const match = /^\/design\/([^/?#]+)(?:[?#].*)?$/.exec(refPath);
  if (!match) return null;
  const asset = designAssetUrls[match[1]];
  if (!asset) return null;
  const packaged = fileURLToPath3(asset.packaged);
  if (existsSync2(packaged)) return packaged;
  const source = fileURLToPath3(asset.source);
  return existsSync2(source) ? source : null;
}
function exportContentDisposition(file) {
  const filename = exportFileName(file);
  return `attachment; filename="${sanitizeDispositionFilename(filename)}"; filename*=UTF-8''${encodeRfc5987Value(filename)}`;
}
function sanitizeDispositionFilename(filename) {
  const fallback = Array.from(String(filename || ""), (char) => {
    const codePoint = char.codePointAt(0) || 0;
    if (codePoint < 32 || codePoint > 126 || char === '"' || char === "\\") return "_";
    return char;
  }).join("");
  return fallback || "artifact.export.html";
}
function encodeRfc5987Value(value) {
  return encodeURIComponent(String(value)).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
function buildAllowedHostnames({ host, hosts = [], linkHost: linkHostName, allowedHosts = [] }) {
  return new Set(
    [LOOPBACK_HOST, IPV6_LOOPBACK_HOST, "localhost", host, ...hosts, linkHostName, ...allowedHosts].map(
      (value) => String(value || "").trim().toLowerCase()
    ).filter((value) => value && value !== "*" && !isWildcardHost(value))
  );
}
function allowsAllHosts(allowedHosts = []) {
  return allowedHosts.some((value) => String(value).trim() === "*");
}
function parseHostAuthority(value) {
  const raw = String(value).trim();
  if (!raw || /[@/\\?#\s]/.test(raw)) return null;
  let hostname;
  let port;
  let bracketed = false;
  if (raw.startsWith("[")) {
    const match = /^\[([0-9A-Fa-f:.]+)\](?::(\d+))?$/.exec(raw);
    if (!match || isIP3(match[1]) !== 6) return null;
    [, hostname, port = ""] = match;
    bracketed = true;
  } else {
    const match = /^([A-Za-z0-9._-]+)(?::(\d+))?$/.exec(raw);
    if (!match) return null;
    [, hostname, port = ""] = match;
  }
  if (port && Number(port) > 65535) return null;
  hostname = hostname.toLowerCase();
  const authority = `${bracketed ? `[${hostname}]` : hostname}${port ? `:${port}` : ""}`;
  try {
    const parsed = new URL(`http://${authority}`);
    if (!parsed.origin || parsed.origin === "null") return null;
  } catch {
    return null;
  }
  return { hostname, port, authority };
}
function isAllowedHostHeader(hostHeader, allowedHostnames) {
  if (hostHeader === void 0 || hostHeader === null) return false;
  const authority = parseHostAuthority(hostHeader);
  return authority !== null && allowedHostnames.has(authority.hostname);
}
function isAllowedRequestHost({ host, forwardedHost }, allowedHostnames) {
  if (!isAllowedHostHeader(host, allowedHostnames)) return false;
  const forwarded = forwardedHost === void 0 || forwardedHost === null ? "" : String(forwardedHost).trim();
  if (forwarded === "") return true;
  return isAllowedHostHeader(forwarded.split(",").pop(), allowedHostnames);
}
function hasPresentOriginOrReferer(req) {
  return Boolean(req.get("origin") || req.get("referer"));
}
function isSameOriginRequest(req, allowedHostnames, allowAnyHostname = false) {
  const host = parseHostAuthority(req.headers.host);
  if (!host) return false;
  let protocol = req.protocol || "http";
  let authority = host;
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",").pop().trim();
  if (forwardedHost) {
    const forwardedAuthority = parseHostAuthority(forwardedHost);
    if (!forwardedAuthority || !allowAnyHostname && (!allowedHostnames.has(host.hostname) || !allowedHostnames.has(forwardedAuthority.hostname)))
      return false;
    protocol = String(req.headers["x-forwarded-proto"] || protocol).split(",").pop().trim().toLowerCase();
    if (protocol !== "http" && protocol !== "https") return false;
    authority = forwardedAuthority;
  }
  const expectedOrigin = normalizeOrigin(`${protocol}://${authority.authority}`);
  if (!expectedOrigin) return false;
  const origin = req.headers.origin;
  if (origin) {
    return normalizeOrigin(origin) === expectedOrigin;
  }
  const referer = req.headers.referer;
  return Boolean(referer) && normalizeOrigin(referer) === expectedOrigin;
}
function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
function optionalBodyString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || void 0;
}
async function resolveArtifactAsset(root, assetPath) {
  const file = path10.resolve(root, assetPath);
  const relative = path10.relative(root, file);
  if (relative.startsWith("..") || path10.isAbsolute(relative)) {
    return null;
  }
  let real;
  try {
    real = await realpath4(file);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return file;
    }
    throw error;
  }
  let realRoot;
  try {
    realRoot = await realpath4(root);
  } catch {
    realRoot = path10.resolve(root);
  }
  const relativeReal = path10.relative(realRoot, real);
  if (relativeReal === ".." || relativeReal.startsWith(`..${path10.sep}`) || path10.isAbsolute(relativeReal)) {
    return null;
  }
  return real;
}
async function watchSession(session, watchers, events, logEvent, reloadDebounceMs = () => RELOAD_DEBOUNCE_MS) {
  if (watchers.has(session.key)) {
    return;
  }
  const target = await resolveWatchTarget(session);
  if (watchers.has(session.key)) {
    return;
  }
  logEvent?.(`watch session=${session.key} scope=${target.scope} path=${target.path}`);
  const watcher = chokidar.watch(target.path, target.options);
  let timer = null;
  watcher.on("all", (event, file) => {
    logEvent?.(`watch event=${event} session=${session.key} file=${file ?? ""}`);
    clearTimeout(timer);
    timer = setTimeout(() => events.emit("reload", session.key), reloadDebounceMs(session.key));
  });
  watcher.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    logEvent?.(`watch error session=${session.key} message=${message}`);
  });
  watchers.set(session.key, watcher);
}
async function resolveWatchTarget(session) {
  const baseOptions = {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
  };
  try {
    const html = await readFile6(session.file, "utf8");
    if (hasLiveReloadRootOptIn(html)) {
      return {
        path: path10.dirname(session.file),
        scope: "directory",
        options: {
          ...baseOptions,
          ignored: /(^|[/\\])(\.git|node_modules|dist|build|\.lavish-axi)([/\\]|$)/
        }
      };
    }
  } catch {
  }
  return { path: session.file, scope: "file", options: baseOptions };
}
function hasLiveReloadRootOptIn(html) {
  if (typeof html !== "string") return false;
  const searchableHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  if (/<html\b[^>]*\sdata-lavish-live-reload-root(?:[\s=>/]|$)[^>]*>/i.test(searchableHtml)) return true;
  return /<meta\b(?=[^>]*name=["']lavish-live-reload["'])(?=[^>]*content=["']root["'])[^>]*>/i.test(searchableHtml);
}
function releasePollListener(holder, activePolls, deliveredFeedback, events) {
  if (activePolls.get(holder.key) !== holder) return;
  const previousPresence = computePresence(holder.key, activePolls, deliveredFeedback);
  activePolls.delete(holder.key);
  const nextPresence = computePresence(holder.key, activePolls, deliveredFeedback);
  if (nextPresence !== previousPresence) events.emit("agent-presence", holder.key, nextPresence);
}
function listenerLabel(holder) {
  return holder.owner || AGENT_LISTENER_LABEL;
}
function listenerConflict(holder, code) {
  return {
    status: "error",
    code,
    error: code === "LISTENER_ACTIVE" ? "Lavish Editor already has an active poll listener" : "Lavish Editor poll listener was replaced",
    holder: { label: listenerLabel(holder), age_ms: Math.max(0, Date.now() - holder.startedAt) }
  };
}
function markFeedbackDelivered(key, activePolls, deliveredFeedback, events) {
  const previousPresence = computePresence(key, activePolls, deliveredFeedback);
  deliveredFeedback.add(key);
  const nextPresence = computePresence(key, activePolls, deliveredFeedback);
  if (nextPresence !== previousPresence) {
    events.emit("agent-presence", key, nextPresence);
  }
}
function clearFeedbackDelivery(key, activePolls, deliveredFeedback, events) {
  const previousPresence = computePresence(key, activePolls, deliveredFeedback);
  deliveredFeedback.delete(key);
  const nextPresence = computePresence(key, activePolls, deliveredFeedback);
  if (nextPresence !== previousPresence) {
    events.emit("agent-presence", key, nextPresence);
  }
}
function computePresence(key, activePolls, deliveredFeedback) {
  if (deliveredFeedback.has(key)) return "working";
  return activePolls.has(key) ? "listening" : "waiting";
}
function presenceSignature(key, activePolls, deliveredFeedback) {
  return `${computePresence(key, activePolls, deliveredFeedback)}:${presenceMode(key, activePolls, deliveredFeedback)}`;
}
function presenceMode(key, activePolls, deliveredFeedback) {
  if (deliveredFeedback.has(key)) return "agent-busy";
  const holder = activePolls.get(key);
  if (!holder) return "waiting-on-captain";
  return holder.owner ? "external-listener" : "agent-listener";
}
function presenceEventData(key, state, activePolls, deliveredFeedback) {
  const mode = presenceMode(key, activePolls, deliveredFeedback);
  return mode === "waiting-on-captain" ? { state } : { state, mode };
}
function chromeIcon(paths, size = 16, strokeWidth = 1.7) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
var chromeIcons = {
  more: chromeIcon(
    '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>'
  ),
  file: chromeIcon(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    13
  ),
  copy: chromeIcon(
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    12
  ),
  check: chromeIcon('<polyline points="20 6 9 17 4 12"/>', 12),
  refresh: chromeIcon(
    '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    15
  ),
  camera: chromeIcon(
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    15
  ),
  download: chromeIcon(
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    15
  ),
  globe: chromeIcon(
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14.5 14.5 0 0 1 0 18a14.5 14.5 0 0 1 0-18z"/>',
    15
  ),
  exit: chromeIcon(
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    15
  ),
  warning: chromeIcon(
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    16
  ),
  reveal: chromeIcon('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>', 13),
  dismiss: chromeIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 13),
  // The desktop conversation-panel toggle: a window with its right-hand column marked off.
  sidebar: chromeIcon('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="15" y1="4" x2="15" y2="20"/>'),
  // The mobile conversation sheet's only chevron: CSS rotates it when the sheet is open.
  chevronUp: chromeIcon('<polyline points="6 15 12 9 18 15"/>', 18, 2)
};
function displayPathParts(file, home = homedir()) {
  const normalizedFile = file.replaceAll("\\", "/");
  const normalizedHome = home.replaceAll("\\", "/");
  const display = normalizedHome && normalizedFile.startsWith(`${normalizedHome}/`) ? `~/${normalizedFile.slice(normalizedHome.length + 1)}` : normalizedFile;
  const tailStart = display.lastIndexOf("/") + 1;
  return { head: display.slice(0, tailStart), tail: display.slice(tailStart) };
}
function shouldEnableLayoutGate(query = {}) {
  const noGate = query["no-gate"] ?? query.noGate ?? query.no_gate;
  if (isTruthyFlag(noGate)) return false;
  const gate = query.gate ?? query.layoutGate ?? query.layout_gate;
  if (isFalseyFlag(gate)) return false;
  return true;
}
function shouldDisableLayoutGateOpen(body = {}) {
  const noGate = body["no-gate"] ?? body.noGate ?? body.no_gate;
  if (isTruthyFlag(noGate)) return true;
  const gate = body.gate ?? body.layoutGate ?? body.layout_gate;
  return isFalseyFlag(gate);
}
function appendNoGateParam(url) {
  const parsed = new URL(url);
  parsed.searchParams.set("no-gate", "1");
  return parsed.toString();
}
function isTruthyFlag(value) {
  const normalized = normalizeFlagValue(value);
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
function isFalseyFlag(value) {
  const normalized = normalizeFlagValue(value);
  return normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off";
}
function normalizeFlagValue(value) {
  if (Array.isArray(value)) return normalizeFlagValue(value[0]);
  return value === void 0 || value === null ? "" : String(value).trim().toLowerCase();
}
var LAVISH_DEFAULT_FAVICON = `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F48E}</text></svg>">`;
function readTagAttr(tag, name) {
  const attrRe = /([a-z][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  const target = name.toLowerCase();
  let match;
  while ((match = attrRe.exec(tag)) !== null) {
    if (match[1].toLowerCase() === target) {
      return (match[3] ?? match[4] ?? match[5] ?? "").trim();
    }
  }
  return "";
}
function extractArtifactHead(html) {
  const head = String(html || "").slice(0, 1e4);
  let faviconTag = LAVISH_DEFAULT_FAVICON;
  const linkTags = head.match(/<link\b(?:"[^"]*"|'[^']*'|[^"'>])*>/gi) || [];
  const iconTag = linkTags.find((tag) => /(^|\s)icon(\s|$)/i.test(readTagAttr(tag, "rel")));
  const iconHref = iconTag ? readTagAttr(iconTag, "href") : "";
  if (iconHref && /^(data:|https?:|\/\/)/i.test(iconHref)) {
    const safeHref = iconHref.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    faviconTag = `<link rel="icon" href="${safeHref}">`;
  }
  let title = "";
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = titleMatch[1].replace(/\s+/g, " ").trim();
  return { faviconTag, title };
}
var CHROME_BOOT_FAILSAFE_MS = 15e3;
var CHROME_LAYOUT_GATE_MAX_HOLD_MS = 12e3;
var CHROME_BOOT_FAILSAFE_PROBE_TIMEOUT_MS = 4e3;
var CHROME_BOOT_FAILSAFE_JS = `(function(){
var t=setTimeout(fail,${CHROME_BOOT_FAILSAFE_MS});
var o=document.getElementById("layoutGateOverlay"),h,c,a,b,gt=0,manual=false,ended=false;
try{ended=JSON.parse(document.getElementById("lavish-session").textContent).initialEnded===true;}catch(e){}
function cancelGate(){if(gt)clearTimeout(gt);gt=0;}
function reveal(){cancelGate();if(o)o.hidden=true;if(document.body)document.body.classList.remove("layout-gate-active");}
function manualReveal(){if(ended)return false;manual=true;reveal();return true;}
function armGate(ms,onTimeout){cancelGate();if(!ended)gt=setTimeout(function(){if(ended)return;if(onTimeout)onTimeout();else reveal();},ms);}
function showBypass(){b=document.getElementById("layoutGateBypass");if(b){b.hidden=false;b.onclick=manualReveal;}}
window.__lavishLayoutGateEscape={arm:armGate,cancel:cancelGate,reveal:reveal,manualReveal:manualReveal,showBypass:showBypass,end:function(){ended=true;cancelGate();},isEnded:function(){return ended;},isManuallyBypassed:function(){return manual;}};
a=document.getElementById("layoutGateAction");
if(ended){reveal();b=document.getElementById("endedOverlay");if(b)b.hidden=false;}
if(a&&!ended)a.onclick=manualReveal;
if(o&&!o.hidden&&!ended)armGate(${CHROME_LAYOUT_GATE_MAX_HOLD_MS});
window.__lavishCancelChromeBootFailsafe=function(){clearTimeout(t);};
window.__lavishChromeBootFailed=function(){clearTimeout(t);fail();};
function fail(){
if(window.__lavishChromeReady||ended)return;
h=document.getElementById("layoutGateTitle");
c=document.getElementById("layoutGateCopy");
a=document.getElementById("layoutGateAction");
if(h)h.textContent="Lavish could not finish loading.";
if(c)c.textContent="The Lavish editor script did not load. The server usually restarted while this page was opening. Check and reload to reconnect.";
if(a){a.textContent="Check and reload";a.disabled=false;a.onclick=check;}
showBypass();
if(o)o.hidden=false;
if(document.body)document.body.classList.add("layout-gate-active");
armGate(${CHROME_LAYOUT_GATE_MAX_HOLD_MS});
}
function check(){
if(a)a.disabled=true;
var ctl=new AbortController();
var pt=setTimeout(function(){ctl.abort();},${CHROME_BOOT_FAILSAFE_PROBE_TIMEOUT_MS});
fetch("/health",{cache:"no-store",signal:ctl.signal}).then(function(r){return r&&r.ok?"running":"not-running";},function(){return ctl.signal.aborted?"no-answer":"not-running";}).then(function(outcome){
clearTimeout(pt);
if(outcome==="running"){location.reload();return;}
if(a)a.disabled=false;
if(c)c.textContent=outcome==="no-answer"?"Lavish did not answer the check, so this page cannot tell whether it is running. Try again in a moment.":"Lavish is still not running. Start it again with your agent, then use Check and reload.";
});
}
})();`;
function createChromeHtml(session, {
  layoutGateEnabled = true,
  faviconTag = LAVISH_DEFAULT_FAVICON,
  title = "Lavish Editor",
  artifactRevision = 0,
  artifactLoadToken = "",
  artifactLoadSequence = 0,
  chromeLoadToken = "",
  attachmentMaxBytes = 0,
  attachmentMaxCount = 0,
  attachmentAcceptedMime = ACCEPTED_IMAGE_MIME
} = {}) {
  const acceptedMime = attachmentAcceptedMime.map(String);
  const sessionJson = jsonScript({
    key: session.key,
    file: session.file,
    // A page loaded (or reloaded) after the session already ended has no future live `ended`
    // event to wait for - it must start read-only instead of looking live until the user tries
    // to send and gets refused (#171).
    initialEnded: session.status === "ended",
    initialEndedBy: session.ended_by || null,
    initialChat: serializeChat(session.chat || []),
    initialChatAckIds: serializeChatAckIds(session.chat_ack_ids),
    initialChatRevision: Number.isSafeInteger(session.chat_revision) && session.chat_revision >= 0 ? session.chat_revision : 0,
    // Bootstrapping the inbox from the server is what makes it survive a browser refresh or a
    // reconnect: the chrome never owns warning state, it only renders it.
    initialLayoutWarnings: serializeLayoutWarnings(session.layout_warnings),
    initialArtifactRevision: artifactRevision,
    initialArtifactLoadToken: artifactLoadToken,
    initialArtifactLoadSequence: artifactLoadSequence,
    chromeLoadToken,
    layoutGateEnabled,
    modeToggleHotkeyKey: MODE_TOGGLE_HOTKEY_KEY,
    attachmentMaxBytes,
    attachmentMaxCount,
    attachmentAcceptedMime: acceptedMime,
    // The legend's swatches are server-owned, not artifact-owned. The chrome
    // derives every swatch from this palette by registry position, so an
    // artifact cannot hand all its revisions the same colour and pattern and
    // collapse the one signal that tells the rounds apart.
    revisionPalette: revisionPalette()
  });
  const { head: pathHead, tail: pathTail } = displayPathParts(session.file);
  const bodyClass = layoutGateEnabled ? "lavish layout-gate-active" : "lavish";
  const layoutGateHidden = layoutGateEnabled ? "" : " hidden";
  const modeHotkeyUpper = MODE_TOGGLE_HOTKEY_KEY.toUpperCase();
  const modeToggleHint = `Toggle annotate/explore mode (\u2318${modeHotkeyUpper} / Ctrl+${modeHotkeyUpper})`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<title>${escapeHtml2(title)}</title>
${faviconTag}
<link rel="stylesheet" href="/chrome.css">
</head>
<body class="${bodyClass}">
<div class="bar"><div class="brand"><span class="brand-mark">Lavish</span><span class="brand-support">Editor</span></div><div class="spacer" aria-hidden="true"></div><div class="warnings-wrap" id="warningsWrap" hidden><button class="warnings-button" id="warningsButton" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="warningsDrawer">${chromeIcons.warning}<span class="warnings-count" id="warningsCount">0</span></button><div class="menu warnings-drawer" id="warningsDrawer" role="dialog" aria-labelledby="warningsTitle" aria-describedby="warningsSummary" hidden><div class="warnings-head"><h2 class="warnings-title" id="warningsTitle">Layout issues</h2><p class="warnings-summary" id="warningsSummary"></p></div><div class="warnings-toolbar"><label class="warnings-selectall"><input type="checkbox" id="warningsSelectAll"><span>Select all</span></label><span class="warnings-selected" id="warningsSelected" role="status" aria-live="polite"></span></div><div class="warnings-list" id="warningsList"></div><div class="warnings-foot"><p class="warnings-note">Queueing sends a repair request with your next feedback. An issue is marked resolved only after a newer artifact load and a complete check at the same viewport no longer finds it.</p><button class="button" id="warningsQueueButton" type="button" disabled>Queue selected fixes</button></div></div></div><div class="revisions-wrap" id="revisionsWrap" hidden><button class="revisions-button" id="revisionsButton" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="revisionsDrawer"><span class="revisions-button-text">Revisions</span><span class="revisions-count" id="revisionsCount">0</span></button><div class="menu revisions-drawer" id="revisionsDrawer" role="dialog" aria-labelledby="revisionsTitle" aria-describedby="revisionsSummary" hidden><div class="revisions-head"><h2 class="revisions-title" id="revisionsTitle">Revisions</h2><p class="revisions-summary" id="revisionsSummary"></p></div><div class="revisions-list" id="revisionsList"></div><div class="revisions-foot"><p class="revisions-note">The agent declares these in the artifact itself. Reveal flashes the next block it marked for that revision; nothing about the page is restyled, so the saved file still looks the way it does here.</p></div></div></div><button class="annotate-switch" id="annotation" type="button" aria-pressed="true" title="${escapeHtml2(modeToggleHint)}"><span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span><span>Annotate</span></button><button class="sidebar-toggle" id="sidebarToggle" type="button" aria-controls="panel" aria-expanded="true" aria-label="Hide conversation" title="Hide conversation">${chromeIcons.sidebar}<span class="sidebar-toggle-count" id="sidebarToggleCount" aria-hidden="true" hidden></span></button><div class="more-wrap" id="moreWrap"><button class="more-button" id="moreButton" type="button" title="More" aria-haspopup="menu" aria-expanded="false">${chromeIcons.more}</button><div class="menu more-menu" id="moreMenu" hidden><div class="menu-head"><div class="menu-label">Editing</div><button class="menu-file" id="copyPath" type="button" title="Copy path \xB7 ${escapeHtml2(session.file)}">${chromeIcons.file}<span class="menu-file-text"><span class="path-head">${escapeHtml2(pathHead)}</span><span class="path-tail">${escapeHtml2(pathTail)}</span></span><span class="copy-hint" id="copyHint"><span class="icon-copy">${chromeIcons.copy}</span><span class="icon-check">${chromeIcons.check}</span><span id="copyHintText">Copy</span></span></button></div><div class="menu-rule"></div><button class="menu-item" id="reloadArtifact" type="button">${chromeIcons.refresh}<span>Reload artifact</span></button><button class="menu-item" id="copySnapshot" type="button">${chromeIcons.camera}<span>Copy DOM snapshot</span></button><button class="menu-item" id="exportArtifact" type="button">${chromeIcons.download}<span>Export standalone HTML</span></button><button class="menu-item" id="shareArtifact" type="button">${chromeIcons.globe}<span>Publish link</span></button><div class="menu-rule"></div><button class="menu-item danger" id="end" type="button">${chromeIcons.exit}<span>End session</span></button></div></div></div>
<div class="layout"><div class="frame"><iframe id="artifact" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" data-artifact-src="/artifact/${session.key}/index.html"></iframe></div><div class="panel-scrim" id="panelScrim"></div><aside class="panel" id="panel"><div class="panel-head" id="panelHead"><span class="panel-handle" aria-hidden="true"></span><div class="panel-head-row"><h2>Conversation</h2><span class="panel-summary" id="panelSummary" role="status" aria-live="polite"></span><button class="panel-toggle" id="panelToggle" type="button" aria-expanded="false" aria-controls="panel" aria-label="Show conversation">${chromeIcons.chevronUp}</button></div></div><div class="panel-scroll" id="panelScroll"><div class="chat" id="chatLog"></div><div class="chat chat-queued" id="queuedLog"></div></div><div class="composer" id="chatComposer"><div class="presence-banner handoff-banner" id="handoffBanner" hidden><span>This review is open in another Lavish tab. Unsent answers stay in the tab or window where you entered them; taking over in another window does not bring them along.</span><button class="handoff-takeover" id="handoffTakeover" type="button">Take over here</button></div><div class="presence-banner handoff-banner" id="outdatedBanner" hidden><span id="outdatedText">The Lavish server this page was connected to is no longer running. Reloading will work once it is running again.</span><span class="outdated-actions"><button class="handoff-takeover" id="outdatedReload" type="button">Check and reload</button><button class="handoff-takeover" id="outdatedDismiss" type="button">Dismiss</button></span></div><div class="presence-banner" id="presenceBanner" hidden>Your agent is not listening. If this persists, ask your agent to poll for updates from Lavish.</div><textarea id="chatInput" placeholder="Write a message for the agent..."></textarea><div class="chat-attachments" id="chatAttachments"></div><div class="chat-attachment-toolbar"><button class="chat-attach" id="chatAttach" type="button">Attach images</button><input id="chatAttachInput" type="file" accept="${escapeHtml2(acceptedMime.join(","))}" multiple hidden><span class="chat-attachment-notice" id="chatAttachmentNotice" role="status"></span></div><div class="send-hint" id="sendHint" hidden>Nothing queued in this tab. Unsent answers stay in the tab or window where you entered them; taking over in another window does not bring them along.</div><div class="actions" id="sendActions"><button class="button button-danger" id="sendAndEnd" type="button">${chromeIcons.exit}<span>Send &amp; End</span></button><button class="button" id="send">Send to Agent</button></div></div></aside></div>
<div class="share-overlay" id="shareDialog" role="dialog" aria-modal="true" aria-labelledby="shareTitleText" hidden><form class="share-card" id="shareForm"><div class="share-head"><div><div class="share-kicker">Publish to <a class="share-link" href="https://ht-ml.app" target="_blank" rel="noopener noreferrer">ht-ml.app</a></div><h2 id="shareTitleText">Publish artifact</h2></div><button class="share-close" id="shareClose" type="button" aria-label="Close publish dialog"><svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true" focusable="false"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div><p class="share-note">ht-ml.app is a separate, third-party hosting service, not part of Lavish. Publishing sends this artifact to its servers.</p><p class="share-copy">This uploads this artifact to ht-ml.app with local assets inlined. Without a password, the page is PUBLIC and anyone with the link can open it. With a password, the page is PRIVATE and viewers must supply the password to view.</p><p class="share-note">Do not publish secrets. The Lavish annotation SDK is not included.</p><div class="share-grid"><label class="share-check"><input id="shareGenerate" type="checkbox"><span>Generate a password (makes this page private)</span></label><label>Password (optional)<input id="sharePassword" name="password" type="password" autocomplete="new-password" placeholder="Leave blank for a public page"></label></div><div class="share-status" id="shareStatus" role="status"></div><div class="share-result" id="shareResult" hidden><label id="shareUrlResult">Share URL<div class="share-copy-row"><input id="shareUrl" readonly><button class="share-copy-btn" id="copyShareUrl" type="button">Copy URL</button></div></label><label id="sharePasswordResult" hidden>Password (shared secret)<div class="share-copy-row"><input id="sharePasswordOut" readonly><button class="share-copy-btn" id="copySharePassword" type="button">Copy password</button></div></label><label id="shareSiteIdResult" hidden>Site ID<div class="share-copy-row"><input id="shareSiteId" readonly><button class="share-copy-btn" id="copyShareSiteId" type="button">Copy site ID</button></div></label><label id="shareUpdateKeyResult">Update key (secret)<div class="share-copy-row"><input id="shareUpdateKey" readonly><button class="share-copy-btn" id="copyUpdateKey" type="button">Copy key</button></div></label><p class="share-note" id="shareUpdateKeyNote">Keep the update key private. ht-ml.app returns it once and it is the only way to update this page later; the service has no delete. Republish this page&#39;s HTML with <code>lavish-axi share &lt;file&gt; --site &lt;site id&gt; --update-key &lt;key&gt;</code>, and add <code>--private</code> to also lock it behind a new generated password.</p></div><div class="share-actions"><button class="share-cancel" id="shareCancel" type="button">Cancel</button><button class="button" id="sharePublish" type="submit">Publish</button></div></form></div>
<div class="ended-overlay layout-gate-overlay" id="layoutGateOverlay"${layoutGateHidden}><div class="ended-card"><div class="ended-title" id="layoutGateTitle">Checking layout.<br>One moment.</div><p class="ended-copy" id="layoutGateCopy">Lavish is waiting for fonts and final geometry before revealing this artifact.</p><button class="button ended-action" id="layoutGateAction" type="button">Show anyway</button><button class="button ended-action layout-gate-bypass" id="layoutGateBypass" type="button" hidden>Show anyway</button></div></div>
<div class="ended-overlay" id="endedOverlay" hidden><div class="ended-card"><div class="ended-title">Session ended.<br>Return to your agent to continue.</div><p class="ended-copy">${escapeHtml2(session.file)}</p></div></div>
<div class="whiteboard-overlay" id="whiteboardOverlay" hidden><div class="whiteboard-shell"><div class="whiteboard-error" id="whiteboardError" hidden></div><button class="whiteboard-close" id="whiteboardClose" type="button" aria-label="Close whiteboard"><svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true" focusable="false"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button><iframe id="whiteboardFrame" title="Excalidraw whiteboard" sandbox="allow-scripts allow-popups"></iframe></div></div>
<script id="lavish-session" type="application/json">${sessionJson}</script>
<script>${CHROME_BOOT_FAILSAFE_JS}</script>
<script src="/chrome-client.js" onerror="window.__lavishChromeBootFailed()"></script>
</body>
</html>`;
}
function createWhiteboardFrameHtml(channelToken = "") {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lavish Whiteboard</title>
<link rel="stylesheet" href="/whiteboard-assets/whiteboard.css">
</head>
<body>
<script>window.__lavishWhiteboardChannelToken=${JSON.stringify(channelToken)};</script>
<script src="/whiteboard-assets/whiteboard.js"></script>
</body>
</html>`;
}
function serializeModuleHelpers(module) {
  const entries = Object.entries(module);
  const unsupported = entries.filter(([, value]) => typeof value !== "function").map(([name]) => name);
  if (unsupported.length > 0) {
    throw new TypeError(
      `Cannot serialize non-function SDK helper export(s) into the artifact bundle: ${unsupported.join(", ")}`
    );
  }
  return {
    declarations: entries.map(([name, fn]) => `const ${name}=${fn.toString()};`).join("\n"),
    names: entries.map(([name]) => name)
  };
}
function createSdkJs(key, artifactRevision = 0, artifactLoadToken = "", { maxAttachmentCount, maxAttachmentBytes, acceptedImageMime = ACCEPTED_IMAGE_MIME } = {}) {
  const mermaidHelperSource = serializeModuleHelpers(mermaid_node_exports);
  const tableHelperSource = serializeModuleHelpers(table_cell_exports);
  const revisionHelperSource = serializeModuleHelpers(artifact_revisions_exports);
  const revisionNumber = Number(artifactRevision);
  const revision = Number.isFinite(revisionNumber) && revisionNumber >= 0 ? Math.trunc(revisionNumber) : 0;
  const loadToken = String(artifactLoadToken || "").slice(0, 200);
  const sdkOptions = {
    maxAttachmentCount: Number.isFinite(maxAttachmentCount) ? maxAttachmentCount : void 0,
    maxAttachmentBytes: Number.isFinite(maxAttachmentBytes) ? maxAttachmentBytes : void 0,
    acceptedImageMime: acceptedImageMime.map(String)
  };
  return `(() => {
const key=${JSON.stringify(key)};
const artifactRevision=${revision};
const artifactLoadToken=${JSON.stringify(loadToken)};
const deriveQueueKey=${deriveLavishQueueKey.toString()};
const isNativeInteractiveControl=${isNativeInteractiveControl.toString()};
const MODE_TOGGLE_HOTKEY_KEY=${JSON.stringify(MODE_TOGGLE_HOTKEY_KEY)};
const isModeToggleHotkeyEvent=${isModeToggleHotkeyEvent.toString()};
const classifySevereTextOverflow=${classifySevereTextOverflow.toString()};
const classifyMaterialRectEscape=${classifyMaterialRectEscape.toString()};
const isMaterialPageOverflow=${isMaterialPageOverflow.toString()};
const findStableLayoutFindings=${findStableLayoutFindings.toString()};
const isNearTotalOcclusion=${isNearTotalOcclusion.toString()};
const attachmentSizeError=${attachmentSizeError.toString()};
const classifyAttachmentBatch=${classifyAttachmentBatch.toString()};
const partitionDroppedFiles=${partitionDroppedFiles.toString()};
const planClipboardPaste=${planClipboardPaste.toString()};
const acceptedImageTypes=${acceptedImageTypes.toString()};
const isTrustedAttachmentResult=${isTrustedAttachmentResult.toString()};
const deriveAttachmentNoticeState=${deriveAttachmentNoticeState.toString()};
${mermaidHelperSource.declarations}
const mermaidHelpers={ ${mermaidHelperSource.names.join(", ")} };
${tableHelperSource.declarations}
${revisionHelperSource.declarations}
(${createArtifactSdk.toString()})(deriveQueueKey, isNativeInteractiveControl, mermaidHelpers, artifactRevision, artifactLoadToken, key, ${JSON.stringify(sdkOptions)});
})();`;
}
function escapeHtml2(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}
function jsonScript(value) {
  return JSON.stringify(value).replace(/&/g, "\\u0026").replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// src/telemetry.js
var HARDCODED_FALLBACK_HOST = "https://a.kunchenguid.com";
var UMAMI_PATH = "/api/send";
var DEFAULT_HOSTNAME = "cli";
var DEFAULT_TITLE = "Lavish Editor CLI";
var DEFAULT_REQUEST_TIMEOUT_MS = 1e3;
function resolveTelemetryConfig(input) {
  const optOut = String(input.env.LAVISH_AXI_TELEMETRY || "").trim().toLowerCase();
  if (optOut === "0" || optOut === "false" || optOut === "off") {
    return { enabled: false, host: "", websiteID: "" };
  }
  const websiteID = String(input.env.LAVISH_AXI_UMAMI_WEBSITE_ID || "").trim() || input.buildWebsiteID.trim();
  if (!websiteID) {
    return { enabled: false, host: "", websiteID: "" };
  }
  const host = String(input.env.LAVISH_AXI_UMAMI_HOST || "").trim() || input.buildHost.trim() || HARDCODED_FALLBACK_HOST;
  return { enabled: true, host, websiteID };
}
function getBuildTimeUmamiHost() {
  return "https://a.kunchenguid.com";
}
function getBuildTimeUmamiWebsiteID() {
  return "ec110e22-c6db-4987-947c-3de184766708";
}
function createTelemetryClient(config) {
  if (!config.enabled || !config.websiteID) {
    return new NoopTelemetryClient();
  }
  const endpoint = normalizeEndpoint(config.host);
  if (!endpoint) {
    return new NoopTelemetryClient();
  }
  return new HttpTelemetryClient(endpoint, config);
}
var defaultClient = null;
function initDefaultTelemetry(init) {
  const resolved = resolveTelemetryConfig({
    env: init.env || process.env,
    buildHost: getBuildTimeUmamiHost(),
    buildWebsiteID: getBuildTimeUmamiWebsiteID()
  });
  defaultClient = createTelemetryClient({
    enabled: resolved.enabled,
    host: resolved.host,
    websiteID: resolved.websiteID,
    app: init.app,
    version: init.version,
    platform: init.platform,
    arch: init.arch
  });
  return defaultClient;
}
var NoopTelemetryClient = class {
  track() {
  }
  pageview() {
  }
  async close() {
  }
};
var HttpTelemetryClient = class {
  constructor(endpoint, config) {
    this.endpoint = endpoint;
    this.websiteID = config.websiteID;
    this.app = config.app;
    this.version = config.version;
    this.platform = config.platform || "";
    this.arch = config.arch || "";
    this.fetchImpl = config.fetch || fetch;
    this.timeoutMs = config.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
    this.userAgent = `${config.app}/${config.version} telemetry`;
    this.inFlight = /* @__PURE__ */ new Set();
    this.closed = false;
  }
  track(name, fields = {}) {
    if (this.closed) return;
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    this.send(trimmed, eventURL(this.app, trimmed), fields);
  }
  pageview(path12, fields = {}) {
    if (this.closed) return;
    this.send("", normalizePagePath(path12), fields);
  }
  async close(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    this.closed = true;
    if (this.inFlight.size === 0 || timeoutMs <= 0) return;
    const drained = Promise.allSettled(Array.from(this.inFlight)).then(() => void 0);
    await Promise.race([
      drained,
      new Promise((resolve) => {
        setTimeout(resolve, timeoutMs);
      })
    ]);
  }
  send(name, url, fields) {
    const data = { ...fields };
    if (this.platform && data.platform === void 0) data.platform = this.platform;
    if (this.arch && data.arch === void 0) data.arch = this.arch;
    if (data.version === void 0) data.version = this.version;
    const payload = {
      type: "event",
      payload: {
        website: this.websiteID,
        hostname: DEFAULT_HOSTNAME,
        title: DEFAULT_TITLE,
        url,
        name,
        data,
        timestamp: Math.floor(Date.now() / 1e3)
      }
    };
    let body;
    try {
      body = JSON.stringify(payload);
    } catch {
      return;
    }
    const request = this.fire(body);
    this.inFlight.add(request);
    request.finally(() => this.inFlight.delete(request));
  }
  async fire(body) {
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": this.userAgent
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      try {
        await response.body?.cancel?.();
      } catch {
      }
    } catch {
    }
  }
};
function normalizeEndpoint(host) {
  let url;
  try {
    url = new URL(String(host || "").trim());
  } catch {
    return null;
  }
  if (!url.protocol || !url.host) return null;
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname.endsWith(UMAMI_PATH) ? pathname : pathname + UMAMI_PATH;
  return url.toString();
}
function eventURL(app, name) {
  if (!name) return `app://${app}`;
  return `app://${app}/${name.replace(/\./g, "/")}`;
}
function normalizePagePath(path12) {
  const trimmed = String(path12 || "").trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

// src/cli.js
var SHARE_VALUE_FLAGS = ["--password", "--token", "--site", "--update-key"];
var COMMANDS = /* @__PURE__ */ new Set([
  "open",
  "poll",
  "reply",
  "end",
  "stop",
  "server",
  "playbook",
  "design",
  "setup",
  "export",
  "share",
  "libraries"
]);
var RESERVED = new Set(RESERVED_COMMANDS);
var DESCRIPTION = "Lavish Editor helps agents turn rich HTML artifacts into collaborative human review surfaces. Whenever you are about to give user a complex response that will be easier to understand via a rich / interactive page, consider using Lavish Editor. First generate an interactive HTML artifact according to user request, then run `lavish-axi <html-file>` so the user can visually review it, annotate elements or selected text, queue prompts, and send feedback back through `lavish-axi poll`.";
var POLL_WAKE_PATH_RULES = Object.freeze([
  "Keep the poll in the foreground by default and let it return the feedback directly to the agent.",
  "A background poll is allowed only through a harness-native tracked background-job facility whose completion result is guaranteed to resume or notify the same agent.",
  "Never use `nohup`, shell `&`, `disown`, redirected fire-and-forget processes, or a detached terminal without an explicit verified callback merely to keep polling alive.",
  "If the harness has no completion-aware background facility, use the foreground poll or first wire a verified wake callback into the surrounding supervisor.",
  "Do not tell the user the artifact is being monitored until that wake path is live.",
  "If the poll gets killed or times out before feedback arrives, re-run it - feedback remains queued until delivery. Poll delivery consumes the response, so read it completely.",
  "If it returns browser_disconnected, the review window stayed disconnected past its reconnect grace period but the session remains resumable; ask the user whether to reopen or end it, and do neither uninvited."
]);
var POLL_SEND_AND_END_RULE = "`Send & End` ends the session. Its final feedback is still delivered once. After that response, polling stops, and the agent must not reopen the session uninvited.";
var POLL_AGENT_REPLY_RULE = "Keep the reply concise. Only when a longer reply is genuinely necessary, use Markdown structure - blank-line paragraphs, `- ` / `1. ` lists, `## ` headings - so it renders scannably instead of a wall of text, and pass that body with `--agent-reply-file <path>` (`-` reads stdin) so newlines survive quoting.";
var POLL_AGENT_REPLY_HELP_POINTER = "The Conversation panel's Markdown subset is in README's Feedback controls bullet.";
var POLL_AGENT_REPLY_NEXT_POINTER = "The Conversation panel's Markdown subset is in `lavish-axi poll --help` and README.";
var POLL_VALUE_FLAGS = ["--agent-reply", "--agent-reply-file", "--timeout-ms", "--owner"];
var AGENT_REPLY_JSON_LIMIT_BYTES = 2 * 1024 * 1024;
var AGENT_REPLY_JSON_ENVELOPE_BYTES = Buffer.byteLength(JSON.stringify({ agent_reply: "" }));
var AGENT_REPLY_INPUT_LIMIT_BYTES = AGENT_REPLY_JSON_LIMIT_BYTES - AGENT_REPLY_JSON_ENVELOPE_BYTES;
var AGENT_REPLY_LIMIT_LABEL = "2 MB JSON request limit";
var POLL_STATE_HEADER = "lavish-poll-state";
var CODEX_POLL_WAKE_PATH_GUIDANCE = "Codex detected: completed background tasks may not resume Codex automatically, so keep the poll attached to the active turn.";
var VERSION = "0.1.96";
function detectInvokingAgent(env = process.env) {
  return ["CODEX_SANDBOX", "CODEX_THREAD_ID"].some((key) => Object.hasOwn(env, key)) ? "codex" : "generic";
}
function shouldNarratePollWaitTicks({ isTTY }) {
  return Boolean(isTTY);
}
function herdrPollChimeEnabled(env = process.env) {
  return env.HERDR_ENV === "1" && env.LAVISH_AXI_HERDR_CHIME === "1";
}
function notifyHerdrPollReady({ env = process.env, runner = spawn } = {}) {
  if (!herdrPollChimeEnabled(env)) return false;
  try {
    const child = runner(
      "herdr",
      [
        "notification",
        "show",
        "Lavish review ready",
        "--body",
        "The artifact is open and Lavish is polling for your feedback.",
        "--sound",
        "request"
      ],
      { stdio: "ignore" }
    );
    const kill = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        return;
      }
    };
    const timer = setTimeout(kill, 2e3);
    timer.unref();
    const cleanup = () => {
      clearTimeout(timer);
      process.off("exit", kill);
    };
    child.on("error", () => {
    });
    child.once("close", cleanup);
    process.once("exit", kill);
    child.unref();
    return true;
  } catch {
    return false;
  }
}
function pollExecutionGuidance({ agent = "generic" } = {}) {
  const sharedGuidance = POLL_WAKE_PATH_RULES.join(" ");
  const agentGuidance = agent === "codex" ? ` ${CODEX_POLL_WAKE_PATH_GUIDANCE}` : "";
  return `${sharedGuidance}${agentGuidance}`;
}
function isVersionOnlyArgv(argv) {
  return argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v" || argv[0] === "-V");
}
async function run(argv) {
  if (isVersionOnlyArgv(argv)) {
    process.stdout.write(`${VERSION}
`);
    return;
  }
  await ensureStateDir();
  const normalizedArgv = normalizeArgv(argv);
  const agent = detectInvokingAgent(process.env);
  const isTopLevelHelp = argv.length === 1 && argv[0] === "--help";
  const command = telemetryCommandName(argv);
  const telemetry = initDefaultTelemetry({
    app: "lavish-axi",
    version: VERSION,
    platform: process.platform,
    arch: process.arch
  });
  telemetry.pageview(`/${command}`, { command });
  try {
    await runAxiCli({
      description: DESCRIPTION,
      version: VERSION,
      argv: isTopLevelHelp ? [] : normalizedArgv,
      topLevelHelp: createTopLevelHelp({ agent }),
      home: async () => createHomeOutput({
        bin: process.argv[1] || "lavish-axi",
        sessions: isTopLevelHelp ? [] : await visibleSessions(),
        includeSessions: !isTopLevelHelp,
        agent
      }),
      commands: {
        open: openCommand,
        poll: pollCommand,
        reply: replyCommand,
        end: endCommand,
        stop: stopCommand,
        playbook: playbookCommand,
        design: designCommand,
        setup: setupCommand,
        server: serverCommand,
        export: exportCommand,
        share: shareCommand,
        libraries: librariesCommand
      },
      getCommandHelp: (command2) => getCommandHelp(command2, { agent })
    });
    telemetry.track("command", { command, status: "success" });
  } catch (error) {
    telemetry.track("command", { command, status: "error" });
    throw error;
  } finally {
    await telemetry.close(1e3);
  }
}
function collapseHomeDirectory(file, home) {
  const normalizedFile = file.replaceAll("\\", "/");
  const normalizedHome = home.replaceAll("\\", "/");
  if (normalizedFile === normalizedHome) {
    return "~";
  }
  if (normalizedFile.startsWith(`${normalizedHome}/`)) {
    return `~/${normalizedFile.slice(normalizedHome.length + 1)}`;
  }
  return file;
}
function normalizeArgv(argv) {
  const first = argv[0];
  if (!first || COMMANDS.has(first) || RESERVED.has(first)) {
    return argv;
  }
  if (first.startsWith("-")) {
    return argv.some((arg) => isHtmlPath(arg)) ? ["open", ...argv] : argv;
  }
  return ["open", ...argv];
}
function telemetryCommandName(argv) {
  const normalized = normalizeArgv(argv);
  return normalized[0] && !normalized[0].startsWith("-") ? normalized[0] : "home";
}
function createHomeOutput({ bin, sessions, includeSessions = true, agent = "generic" }) {
  return {
    bin: collapseHomeDirectory(bin, os4.homedir()),
    description: DESCRIPTION,
    ...includeSessions ? {
      sessions: sessions.map((session) => ({
        file: session.file,
        status: session.status,
        url: session.url,
        pending_prompts: session.pending_prompts || 0,
        listener: session.listener || "none"
      }))
    } : {},
    visual_guidance: [
      "Use visual hierarchy to make the most important decisions, risks, tradeoffs, and next actions obvious at a glance",
      "Show, don't tell: explain concepts, flows, relationships, and comparisons with labeled illustrations - hand-authored inline SVG, per the diagram playbook - and show existing UI or state with screenshots of the real pages (run the app read-only if needed); reserve prose for what cannot be shown, such as rationale, trade-offs, and open questions",
      "Structure the prose that remains with sections, cards, tables, annotated snippets, and side-by-side comparisons instead of long paragraphs",
      "Choose typography, spacing, color, and layout deliberately so the artifact has a clear point of view",
      "Prevent horizontal overflow at every nesting level: nested grid/flex children also need minmax(0, 1fr) tracks and min-width: 0, especially when badges, labels, or status text use wide pixel or monospace fonts; wrap, truncate, or contain long unbreakable text deliberately"
    ],
    playbooks: listPlaybooks(),
    help: [
      "Run `lavish-axi <html-file>` to open or resume a Lavish Editor session. If the user explicitly ended the session from the browser, this refuses to reopen it and explains why instead of reopening uninvited - pass `--reopen` only when the user asks for further review or something important needs their visual attention",
      "Unless the user specifies another location, create HTML artifacts in the current working directory under `.lavish/`",
      "Lavish serves the html file through a local express.js server. If your html needs to reference other filesystem assets such as images, CSS, fonts, and local scripts, copy them into the same directory as the HTML file, then reference them with relative paths from that directory. Never prepend `/` to those asset paths - root paths won't work",
      `Run \`lavish-axi poll <html-file>\` to wait for user feedback. It long-polls and stays silent until the user sends feedback, ends the session, or leaves every review window disconnected past the reconnect grace period, so leave it running - never kill it. Detected layout issues never return this poll: the browser files them in the user's Layout issues inbox in the Lavish top bar, and they arrive as an ordinary tag "layout-warnings" prompt only when the user selects them and queues the fixes. Never edit the artifact to chase a layout issue the user has not queued. The only exception is a fatal artifact_failures response, which means the review surface itself could not be used. ${pollExecutionGuidance({ agent })} ${POLL_SEND_AND_END_RULE}`,
      'Run `lavish-axi reply <html-file> --agent-reply "<message>"` to show a concise reply and exit once Lavish Editor accepts it, when you are handing a result back and are not about to long-poll. The board stops showing Working only after this command exits 0. Use `lavish-axi poll <html-file> --agent-reply "<message>"` when that reply should be followed by another wait for feedback. A longer reply uses `--agent-reply-file <path>` (`-` reads stdin) on either command. Run `lavish-axi reply --help` for the receipt contract',
      'Mermaid is the whiteboard opt-in, not the diagram default: only when the user asks for an editable whiteboard, author that diagram as Mermaid in a `.mermaid` container. Rendered Mermaid diagrams there become embedded, editable Excalidraw whiteboards in the browser (click a diagram to unlock editing; a Fullscreen action opens it over the whole viewport) - flowchart, sequence, class, ER, and state diagrams convert to editable shapes; other types embed as an image to draw on. Scenes autosave locally; an unmodified autosave silently re-converts when a reload changes the Mermaid source. If the reviewer edited the scene, they choose to re-convert and discard saved edits or keep editing the saved scene. Standalone and exported copies still render plain Mermaid. Queue feedback adds a prompt to the Conversation panel; when the user sends it, poll returns a tag "whiteboard" prompt carrying a bounded edit summary plus local scenePath (.excalidraw JSON) and previewPath (PNG) files - read the summary first, open the files only when needed, then apply the edits by updating the Mermaid source in the artifact (never try to write the scene back)',
      "Run `lavish-axi end <html-file>` to end a session as the agent - ending it this way still allows a plain reopen later. When the user ends it from the browser instead, a later `lavish-axi <html-file>` refuses to reopen it without `--reopen`",
      "Run `lavish-axi export <html-file> [--out <path>]` to write a portable copy of the artifact - one HTML file with its LOCAL assets inlined - so it opens with no Lavish server and no sibling files. Remote CDN/font references are left as links, so it needs network to render those. Users can also export from the browser chrome's overflow menu",
      "Run `lavish-axi share <html-file> [--private | --password <pw>]` to publish the artifact on ht-ml.app (https://ht-ml.app), a third-party hosting service not part of Lavish, and get back a visitable URL. Shares are PUBLIC by default, so anyone with the link can open them. Pass --private to publish a PRIVATE page behind a password Lavish generates and returns - hand the user that password with the URL and say it is a shared secret anyone they give it to can use; --password <pw> uses one you were already given instead. Local assets are inlined; remote refs load over the network. It also returns a secret update_key that can republish or lock the same URL later - run `lavish-axi share --help` before using it. Users can also publish from the browser chrome's overflow menu",
      "A request under a hostname Lavish does not answer to (a reverse-proxy name, a LAN IP) gets 403 `forbidden host`. Set `LAVISH_AXI_ALLOWED_HOSTS` in the environment that starts the server, running `lavish-axi stop` first if one is already up. See README's Allowed hosts section for the rules",
      "Run `lavish-axi stop` to shut down the background server (it also self-stops when idle or after the last session ends with nothing connected)",
      `Run \`lavish-axi playbook <playbook_id>\` for focused artifact guidance. ${PLAYBOOK_ROUTER_HELP}`,
      DESIGN_SYSTEM_HINT,
      "Use lavish-axi when the user asks for a visual artifact, HTML explainer, interactive prototype, review surface, product or technical plan, comparison, report, or browser-based feedback loop"
    ]
  };
}
function createPlaybookOutput(args) {
  const id = args[0];
  if (!id) {
    return {
      playbooks: listPlaybooks(),
      help: ["Run `lavish-axi playbook <playbook_id>` for focused artifact guidance", PLAYBOOK_ROUTER_HELP]
    };
  }
  const playbook = findPlaybook(id);
  if (!playbook) {
    throw new AxiError(`Unknown playbook: ${id}`, "VALIDATION_ERROR", [
      `Run \`lavish-axi playbook\` to list known IDs: ${playbookIds().join(", ")}`
    ]);
  }
  return { playbook };
}
function createOpenOutput({
  file,
  url,
  status,
  agent = "generic",
  selfPaintWarning = void 0,
  networkWarning = void 0
}) {
  const selfPaintPrefix = selfPaintWarning ? `First fix the unpainted page surface flagged in self_paint_warning and save - Lavish live-reloads the artifact automatically, so you do not need to re-run \`lavish-axi ${file}\`. ` : "";
  const networkPrefix = networkWarning ? "Lavish could not serve every address it was asked to (see network_warning): when you next message the user, tell them, because review links at that address will not load until it clears. " : "";
  return {
    session: { file, url, status },
    ...networkWarning ? { network_warning: networkWarning } : {},
    ...selfPaintWarning ? { self_paint_warning: selfPaintWarning } : {},
    next_step: `${networkPrefix}${selfPaintPrefix}Do not respond to the user just yet. Now you must run \`lavish-axi poll ${file}\`. This command long-polls until the user sends feedback, ends the session, or leaves every review window disconnected past the reconnect grace period, and it stays silent the whole time - that is normal, never kill it. Layout issues the browser detects do not return this poll; they wait in the user's Layout issues inbox until the user queues them, then arrive as an ordinary tag "layout-warnings" prompt. Do not pass --timeout-ms during normal agent use. ${pollExecutionGuidance({ agent })} After applying feedback, run \`lavish-axi poll ${file} --agent-reply "<message for the user>"\` without --timeout-ms to show a concise response in Lavish Editor and keep waiting for more feedback. If instead you are handing back a result without starting another long-poll, run \`lavish-axi reply ${file} --agent-reply "<message for the user>"\` to get an acceptance receipt. ${POLL_AGENT_REPLY_RULE} ${POLL_AGENT_REPLY_NEXT_POINTER} If the user ends the session, stop polling and do not reopen it by re-running \`lavish-axi ${file}\` unless the user asks for further review or something genuinely important needs their visual attention - deliver routine updates directly in this conversation instead. When reopening is warranted, run \`lavish-axi ${file} --reopen\`.`
  };
}
function createUserEndedOpenOutput({ file, url, networkWarning = void 0 }) {
  return {
    session: { file, url, status: "user-ended" },
    ...networkWarning ? { network_warning: networkWarning } : {},
    next_step: `The user explicitly ended this Lavish Editor session from the browser, so \`lavish-axi ${file}\` did not reopen it. Do not reopen unless the user asks for further review or something genuinely important needs their visual attention - deliver routine updates directly in this conversation instead. When reopening is warranted, run \`lavish-axi ${file} --reopen\`.`
  };
}
async function openCommand(args) {
  const file = firstPositionalArg(args);
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", ["Run `lavish-axi <html-file>`"]);
  }
  await assertHtmlFile(file);
  const absolute = await canonicalFile(file);
  const selfPaintWarning = await selfPaintWarningForFile(absolute);
  const noGate = args.includes("--no-gate");
  const reopen = args.includes("--reopen");
  const baseUrl = await ensureServer({
    forceRestart: shouldForceRestartForLocalBuild(process.argv[1] || ""),
    reloadKey: sessionKey(absolute)
  });
  const response = await postJson(`${baseUrl}/api/sessions`, { file: absolute, noGate, reopen });
  if (response.status === "user-ended") {
    return createUserEndedOpenOutput({
      file: absolute,
      url: response.url,
      networkWarning: response.network_warning
    });
  }
  if (shouldOpenBrowser(args, process.env)) {
    try {
      const open = (await import("open")).default;
      await open(response.url);
    } catch {
      response.status = "ready";
    }
  }
  return createOpenOutput({
    file: absolute,
    url: response.url,
    status: response.status || "opened",
    agent: detectInvokingAgent(process.env),
    selfPaintWarning,
    networkWarning: response.network_warning
  });
}
async function selfPaintWarningForFile(absolute) {
  try {
    return analyzeSelfPaint(await readFile7(absolute, "utf8")).painted ? void 0 : SELF_PAINT_WARNING;
  } catch {
    return void 0;
  }
}
function shouldOpenBrowser(args, env) {
  return !args.includes("--no-open") && env.LAVISH_AXI_NO_OPEN !== "1";
}
async function pollCommand(args) {
  const file = firstPositionalArg(args, POLL_VALUE_FLAGS);
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", ["Run `lavish-axi poll <html-file>`"]);
  }
  const ownerFlag = inspectValueFlag(args, "--owner");
  const owner = ownerFlag.present ? String(ownerFlag.value || "").trim() : null;
  if (ownerFlag.present && (!owner || owner.startsWith("-") || owner.toLowerCase() === "none")) {
    throw new AxiError(
      owner?.toLowerCase() === "none" ? "--owner none is reserved" : "--owner requires a non-empty label",
      "VALIDATION_ERROR",
      ["Pass `--owner <label>` to identify the process listening for feedback"]
    );
  }
  const takeover = args.includes("--takeover");
  const agentReply = await resolveAgentReply(args);
  const absolute = await canonicalFile(file);
  const baseUrl = await ensureServer();
  const timeoutMs = flagValue(args, "--timeout-ms");
  const query = new URLSearchParams({ file: absolute });
  if (timeoutMs) query.set("timeoutMs", timeoutMs);
  if (owner) query.set("owner", owner);
  if (takeover) query.set("takeover", "1");
  const onPollSignal = (signal) => {
    process.stderr.write(`
${pollInterruptedText(absolute)}
`);
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  if (!timeoutMs) {
    process.on("SIGINT", onPollSignal);
    process.on("SIGTERM", onPollSignal);
  }
  const waitReporter = timeoutMs ? null : startPollWaitReporter({
    file: absolute,
    narrateTicks: shouldNarratePollWaitTicks({ isTTY: process.stderr.isTTY })
  });
  try {
    const request = agentReply || takeover ? {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(agentReply ? { agent_reply: agentReply } : {})
    } : {};
    const response = await fetchJson(`${baseUrl}/api/poll?${query}`, {
      ...request,
      // Poll ownership is claimed before the response is available. Retrying a transport failure
      // can leave the first claim alive and make the retry reject itself as LISTENER_ACTIVE.
      retries: 0,
      onResponse: (pollResponse) => {
        if (pollResponse.headers.get(POLL_STATE_HEADER) === "listening") notifyHerdrPollReady();
      }
    });
    if (response.code === "LISTENER_REPLACED") {
      throw new AxiError("Lavish Editor poll listener was replaced by a takeover", "LISTENER_REPLACED", [
        `Re-run lavish-axi poll ${absolute} only if you intend to take over listening`
      ]);
    }
    return createPollOutput({ file: absolute, response, agent: detectInvokingAgent(process.env) });
  } finally {
    waitReporter?.stop();
    if (!timeoutMs) {
      process.off("SIGINT", onPollSignal);
      process.off("SIGTERM", onPollSignal);
    }
  }
}
var REPLY_VALUE_FLAGS = ["--agent-reply", "--agent-reply-file"];
var REPLY_TOO_LARGE_HELP = "Shorten the reply, then retry `lavish-axi reply <html-file>`";
async function replyCommand(args) {
  const file = firstPositionalArg(args, REPLY_VALUE_FLAGS);
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", [
      'Run `lavish-axi reply <html-file> --agent-reply "<message>"`'
    ]);
  }
  const inline = inspectValueFlag(args, "--agent-reply");
  const fromFile = inspectValueFlag(args, "--agent-reply-file");
  if (!inline.present && !fromFile.present) {
    throw new AxiError("An agent reply is required", "VALIDATION_ERROR", [
      'Pass exactly one of --agent-reply "<message>" or --agent-reply-file <path> (`-` reads stdin)',
      "Use `lavish-axi poll <html-file> --agent-reply` when the reply should be followed by a wait for feedback"
    ]);
  }
  const text = await resolveAgentReply(args, { tooLargeHelp: REPLY_TOO_LARGE_HELP });
  if (!String(text || "").trim()) {
    throw new AxiError("Agent reply text was empty", "VALIDATION_ERROR", [
      'Pass --agent-reply "<message>" or --agent-reply-file <path> with a non-empty body'
    ]);
  }
  await assertHtmlFile(file);
  const absolute = await canonicalFile(file);
  const baseUrl = await ensureServer();
  await postAgentReply(`${baseUrl}/api/${sessionKey(absolute)}/agent-reply`, text, absolute);
  return createReplyOutput(absolute);
}
function createReplyOutput(file) {
  return {
    reply: { file, status: "sent" },
    next_step: `Lavish Editor accepted the reply for ${file} and is no longer showing Working. Run \`lavish-axi poll ${file}\` when you are ready to wait for more feedback.`
  };
}
function pollWaitBannerText(file) {
  return `[lavish-axi] Long-polling for user feedback on ${file}. This stays silent until the user sends feedback, ends the session, or leaves every review window disconnected past the reconnect grace period - leave it running. Detected layout issues do NOT return this poll: they wait in the user's Layout issues inbox until the user queues them as ordinary feedback. If it gets killed or times out before feedback arrives, re-run \`lavish-axi poll ${file}\` - feedback remains queued until delivery. Poll delivery consumes the response, so read it completely.`;
}
function pollWaitTickText(elapsedMs) {
  const minutes = Math.round(elapsedMs / 6e4);
  return `[lavish-axi] Still waiting for user feedback (${minutes}m). Leave this running until the user sends feedback, ends the session, or leaves every review window disconnected.`;
}
function pollInterruptedText(file) {
  return `[lavish-axi] Poll interrupted before user feedback arrived. The user may still be reviewing - re-run \`lavish-axi poll ${file}\` to keep waiting; feedback remains queued until delivery. Poll delivery consumes the response, so read it completely.`;
}
function startPollWaitReporter({
  file,
  write = (line) => {
    process.stderr.write(line);
  },
  intervalMs = 6e4,
  narrateTicks = true
}) {
  write(`${pollWaitBannerText(file)}
`);
  if (!narrateTicks) return { stop: () => {
  } };
  let elapsedMs = 0;
  const timer = setInterval(() => {
    elapsedMs += intervalMs;
    write(`${pollWaitTickText(elapsedMs)}
`);
  }, intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
function createPollOutput({ file, response, agent = "generic" }) {
  if (response.status === "missing") {
    throw new AxiError("No active Lavish Editor session for this file", "NOT_FOUND", [
      `Run \`lavish-axi ${file}\` first`
    ]);
  }
  if (response.status === "feedback") {
    const artifactFailures = Array.isArray(response.artifact_failures) ? response.artifact_failures : [];
    const sessionEnded = Boolean(response.session_ended);
    const endedBy = typeof response.ended_by === "string" ? response.ended_by : void 0;
    return {
      session: {
        file,
        status: "feedback",
        ...sessionEnded ? { session_ended: true, ...endedBy ? { ended_by: endedBy } : {} } : {}
      },
      prompts: response.prompts || [],
      ...artifactFailures.length > 0 ? { artifact_failures: artifactFailures } : {},
      next_step: createFeedbackNextStep(file, artifactFailures, sessionEnded, endedBy, response.prompts || [], agent),
      dom_snapshot: response.dom_snapshot || ""
    };
  }
  if (response.status === "ended") {
    return {
      session: { file, status: "ended", ...response.ended_by ? { ended_by: response.ended_by } : {} },
      next_step: createEndedNextStep(file, response.ended_by)
    };
  }
  if (response.status === "browser_disconnected") {
    return {
      session: { file, status: "browser_disconnected" },
      next_step: "The Lavish review window was closed or disconnected. The session remains open and resumable; ask the user whether they want to reopen it or end the session. Do not reopen or end it without their direction."
    };
  }
  return {
    session: { file, status: response.status || "waiting" },
    next_step: `No user feedback arrived before the optional timeout. Run \`lavish-axi poll ${file}\` without --timeout-ms to wait indefinitely - feedback remains queued until delivery, so re-running the poll is safe while waiting. Poll delivery consumes the response, so read it completely.`
  };
}
function createFeedbackNextStep(file, artifactFailures, sessionEnded, endedBy, prompts = [], agent = "generic") {
  const count = artifactFailures.length;
  const whiteboardNote = prompts.some((prompt) => prompt && prompt.tag === "whiteboard") ? `This feedback includes whiteboard edits (tag "whiteboard"): read the edit summary in the prompt text first, and only when it is not enough, open the target's scenePath (.excalidraw scene JSON) or previewPath (PNG) local files for detail. The artifact's Mermaid source stays authoritative - apply the edits by updating the Mermaid text in ${file} (Lavish live-reloads it); never try to write the .excalidraw scene back. ` : "";
  const layoutNote = prompts.some((prompt) => prompt && prompt.tag === "layout-warnings") ? `This feedback includes layout issues the user selected from the Lavish Layout issues inbox (tag "layout-warnings"): the target lists the exact warning ids and targets. Apply every listed fix in one pass before saving so the user's review refreshes once. Queueing is a repair request, not a resolution - Lavish only marks a warning resolved after a newer artifact load and a complete check at the same viewport no longer detects it. ` : "";
  const attachmentNote = prompts.some((prompt) => Array.isArray(prompt?.attachments) && prompt.attachments.length) ? `Some prompts carry image attachments the user added: each is an object in the prompt's \`attachments\` array with an absolute local \`path\` (plus id, mime, and dimensions). Open those image files to see what the user is referring to. ` : "";
  if (sessionEnded) {
    const failureNote = count > 0 ? endedBy === "user" ? `${count} fatal artifact failure${count === 1 ? "" : "s"} arrived alongside this final feedback - the review surface itself could not be used. Repair ${file}, then open it directly and confirm it renders without reopening this ended Lavish session. ` : `${count} fatal artifact failure${count === 1 ? "" : "s"} arrived alongside this final feedback - the review surface itself could not be used. Repair ${file}, then run \`lavish-axi ${file}\` to open a fresh session. ` : "";
    if (endedBy === "user") {
      const reopenNote = count > 0 ? "" : ` Only run \`lavish-axi ${file} --reopen\` if the user explicitly asks for further review or something genuinely important needs their visual attention.`;
      return `${failureNote}${layoutNote}${whiteboardNote}${attachmentNote}This was the last feedback before the user ended the session. Stop polling ${file} and do not reopen it - deliver any remaining updates directly in this conversation instead.${reopenNote}`;
    }
    return `${failureNote}${layoutNote}${whiteboardNote}${attachmentNote}This was the last feedback before the Lavish Editor session ended. Stop polling ${file}. Deliver any remaining updates directly in this conversation, or run \`lavish-axi ${file}\` to open a fresh session if the user needs further visual review.`;
  }
  const prefix = count > 0 ? artifactFailuresPrefix(file, artifactFailures) : `Apply the requested changes to ${file}. `;
  return `${prefix}${layoutNote}${whiteboardNote}${attachmentNote}Do not respond to the user just yet. If you are continuing to wait for feedback, run \`lavish-axi poll ${file} --agent-reply "<message for the user>"\` without --timeout-ms to reply and keep polling. If instead you are handing back a result without starting another long-poll, run \`lavish-axi reply ${file} --agent-reply "<message for the user>"\` to post it and receive an acceptance receipt. ${POLL_AGENT_REPLY_RULE} ${POLL_AGENT_REPLY_NEXT_POINTER} The poll waits silently until the user sends more feedback, ends the session, or leaves every review window disconnected past the reconnect grace period - never kill it. ${pollExecutionGuidance({ agent })}`;
}
function artifactFailuresPrefix(file, artifactFailures) {
  const count = artifactFailures.length;
  const plural = count === 1 ? "" : "s";
  const details = artifactFailures.map((failure) => `${failure.kind}: ${failure.detail}`).slice(0, 5).join("; ");
  return `${count} fatal artifact failure${plural} detected - the review surface could not be used (${details}). Repair ${file} so it renders with all of its local assets, then re-check in the browser. Lavish live-reloads the artifact automatically after you save, so you do not need to re-run \`lavish-axi ${file}\` for this. `;
}
function createEndedNextStep(file, endedBy) {
  if (endedBy === "user") {
    return `The user ended this Lavish Editor session. Stop polling ${file} - do not run \`lavish-axi ${file}\` to reopen it. Deliver any remaining updates directly in this conversation instead. Only reopen with \`lavish-axi ${file} --reopen\` if the user explicitly asks for further review or something genuinely important needs their visual attention.`;
  }
  return `This Lavish Editor session for ${file} has ended. Stop polling. Deliver any remaining updates directly in this conversation, or run \`lavish-axi ${file}\` to open a fresh session if the user needs further visual review.`;
}
async function endCommand(args) {
  const file = firstPositionalArg(args);
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", ["Run `lavish-axi end <html-file>`"]);
  }
  const absolute = await canonicalFile(file);
  const baseUrl = await ensureServer();
  const response = await postJson(`${baseUrl}/api/end`, { file: absolute });
  return { session: { file: absolute, status: response.status || "ended" } };
}
async function exportCommand(args) {
  const file = firstPositionalArg(args, ["--out"]);
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", ["Run `lavish-axi export <html-file>`"]);
  }
  await assertHtmlFile(file);
  const absolute = await canonicalFile(file);
  const root = path11.dirname(absolute);
  const output = path11.resolve(flagValue(args, "--out") || path11.join(root, exportFileName(absolute)));
  const source = await readFile7(absolute, "utf8");
  const { html, warnings } = await buildSelfContainedHtml(source, {
    baseDir: root,
    confineDir: root,
    resolveAbsolute: resolveDesignAssetPath
  });
  await writeFile4(output, html);
  return createExportOutput({
    source: absolute,
    output,
    html,
    warnings,
    selfPaintWarning: analyzeSelfPaint(source).painted ? void 0 : SELF_PAINT_WARNING
  });
}
function createExportOutput({ source, output, html, warnings, selfPaintWarning = void 0 }) {
  const allWarnings = Array.isArray(warnings) ? warnings : [];
  const { unresolved, notices } = splitExportWarnings(allWarnings);
  const result = {
    export: {
      source,
      output,
      bytes: Buffer.byteLength(html),
      unresolved_local_assets: unresolved.length,
      notices: notices.length
    }
  };
  if (allWarnings.length) result.warnings = exportWarningSummaries(allWarnings);
  if (unresolved.length) result.unresolved_local_assets = exportWarningSummaries(unresolved);
  if (notices.length) result.notices = exportWarningSummaries(notices);
  if (unresolved.length) {
    result.next_step = "Some LOCAL assets could not be inlined and were left as references (see unresolved_local_assets); they will break once the file is moved. Remote CDN/font references are intentionally left as links and render where there is network access.";
  } else if (notices.length) {
    result.next_step = `Wrote ${output} with export notices (see notices). Open it directly or host it anywhere - it needs no Lavish server. Local assets are inlined; remote CDN/font references are left as links, so it needs network to render those.`;
  } else {
    result.next_step = `Wrote ${output}. Open it directly or host it anywhere - it needs no Lavish server. Local assets are inlined; remote CDN/font references are left as links, so it needs network to render those.`;
  }
  if (selfPaintWarning) {
    result.self_paint_warning = selfPaintWarning;
    result.next_step = `Fix the unpainted page surface flagged in self_paint_warning and re-run the export before sharing the file - an exported page renders over whatever surface hosts it. ${result.next_step}`;
  }
  return result;
}
function assetWarningSummaries(warnings) {
  return exportWarningSummaries(warnings);
}
async function shareCommand(args) {
  const request = resolveShareRequest(args);
  if (request.mode === "unpublish") {
    const site2 = await unpublishShareSite(request);
    return createShareUnpublishOutput({ site: site2, siteId: request.siteId });
  }
  await assertHtmlFile(request.file);
  const absolute = await canonicalFile(request.file);
  const root = path11.dirname(absolute);
  const source = await readFile7(absolute, "utf8");
  const { html, warnings } = await buildSelfContainedHtml(source, {
    baseDir: root,
    confineDir: root,
    resolveAbsolute: resolveDesignAssetPath
  });
  const selfPaintWarning = analyzeSelfPaint(source).painted ? void 0 : SELF_PAINT_WARNING;
  if (request.mode === "update") {
    const site2 = await updateShareSite(request, html);
    return createShareUpdateOutput({
      source: absolute,
      site: site2,
      warnings,
      password: request.generatedPassword ? request.password : void 0,
      passwordProtected: Boolean(request.password),
      selfPaintWarning
    });
  }
  const site = await createShareSite(request, html);
  return createShareOutput({
    source: absolute,
    site,
    warnings,
    passwordProtected: Boolean(request.password),
    password: request.generatedPassword ? request.password : void 0,
    selfPaintWarning
  });
}
function republishCommand(siteId, { privatePage = false } = {}) {
  return `lavish-axi share <html-file> --site ${siteId} --update-key <key>${privatePage ? " --private" : ""}`;
}
function republishPrivateCommand(siteId) {
  return republishCommand(siteId, { privatePage: true });
}
function unpublishCommand(siteId) {
  return `lavish-axi share --unpublish --site ${siteId} --update-key <key>`;
}
function incompletePublishError(request, message, received) {
  const url = String(received.url || "").trim();
  const updateKey = String(received.updateKey || "").trim();
  const siteId = String(received.siteId || "").trim();
  const visibility = request.password ? `behind the password this run sent` : `PUBLICLY, readable by anyone who has the link`;
  const suggestions = [
    `ht-ml.app accepted this publish - the page IS live, hosted ${visibility} - but its response was malformed, so Lavish could not read the whole result back. Do not report this as a failed publish.`,
    url ? `Its address is ${url} - give the user that URL.` : `The response carried no url, so Lavish cannot name the page's address.`
  ];
  if (updateKey) {
    suggestions.push(
      `Its update_key is ${updateKey}${siteId ? ` and its site_id is ${siteId}` : ""} - keep it, because ht-ml.app issues one only once and it is the only credential for changing or unpublishing the page.`
    );
  } else {
    suggestions.push(
      `No update_key reached Lavish, and ht-ml.app issues one only once and has no delete endpoint, so this page can never be republished or unpublished. There is no recovery for it.`
    );
  }
  suggestions.push(`Re-running this command publishes a SECOND page at a new URL; it does not replace the first.`);
  if (request.generatedPassword && request.password) {
    suggestions.push(`That page requires the password Lavish generated for it: ${request.password}`);
  }
  return new AxiError(message, "UNKNOWN", suggestions);
}
async function createShareSite(request, html) {
  try {
    return await publishToHtmlApp(html, { password: request.password, token: request.token });
  } catch (error) {
    if (hostRejectedShareWrite(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const landed = publishedDespiteError(error);
    if (landed) throw incompletePublishError(request, message, landed);
    const hosting = request.password ? `the artifact is now hosted on ht-ml.app behind the password this run sent` : `the artifact is now hosted PUBLICLY on ht-ml.app, readable by anyone who has the link`;
    const suggestions = [
      `ht-ml.app may or may not have published this page, so treat the outcome as unknown.`,
      `If it landed, ${hosting}, and the response carrying its url, site_id, and update_key was lost.`,
      `An update_key is issued once and ht-ml.app has no delete endpoint, so such a page can never be republished or unpublished - there is no recovery for it. Tell the user rather than implying the publish simply failed.`,
      `Re-running this command publishes a SECOND page at a new URL; it does not replace or reclaim the first.`
    ];
    if (request.generatedPassword && request.password) {
      suggestions.push(`If it landed, that page requires the password Lavish generated for it: ${request.password}`);
    }
    throw new AxiError(message, "UNKNOWN", suggestions);
  }
}
async function updateShareSite(request, html) {
  try {
    return await updateHtmlApp(request.siteId, html, {
      updateKey: request.updateKey,
      password: request.password
    });
  } catch (error) {
    if (hostRejectedShareWrite(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const generated = Boolean(request.generatedPassword && request.password);
    const retry = generated ? republishPrivateCommand(request.siteId) : republishCommand(request.siteId);
    const samePassword = !generated && request.password ? `, passing the same --password value you supplied` : "";
    const suggestions = [
      `ht-ml.app may or may not have applied this republish, so treat the outcome as unknown: the hosted page may already show the new content.`,
      `Re-running \`${retry}\`${samePassword} is safe and converges on the same result either way.`
    ];
    if (generated) {
      suggestions.push(
        `If it landed, the page now requires the password Lavish generated for it: ${request.password} - the re-run above rotates it to a fresh one Lavish reports on success.`
      );
    }
    throw new AxiError(message, "UNKNOWN", suggestions);
  }
}
async function unpublishShareSite(request) {
  try {
    return await updateHtmlApp(request.siteId, createUnpublishedPageHtml(), {
      updateKey: request.updateKey,
      password: generateSharePassword()
    });
  } catch (error) {
    if (hostRejectedShareWrite(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new AxiError(message, "UNKNOWN", [
      `ht-ml.app may or may not have applied this unpublish, so treat the outcome as unknown: the page may already be the locked placeholder.`,
      `Re-running \`${unpublishCommand(request.siteId)}\` is safe and converges on the same result either way.`,
      `The update_key still works, so \`${republishPrivateCommand(request.siteId)}\` brings the page back behind a password you can see.`
    ]);
  }
}
function resolveShareRequest(args) {
  const unpublish = args.includes("--unpublish");
  const generate = args.includes("--private");
  const explicitPassword = shareFlagValue(args, "--password");
  const siteId = shareFlagValue(args, "--site");
  const updateKey = shareFlagValue(args, "--update-key");
  const token = shareFlagValue(args, "--token");
  const file = firstPositionalArg(args, SHARE_VALUE_FLAGS);
  if (generate && explicitPassword) {
    throw new AxiError("--private generates a password, so it cannot be combined with --password", "VALIDATION_ERROR", [
      "Pass --private to have Lavish mint one, or --password <pw> to choose it yourself"
    ]);
  }
  if (token && (unpublish || siteId || updateKey)) {
    throw new AxiError(
      "--token only applies when creating a page: a republish authenticates with the update_key, which is what the Authorization header carries",
      "VALIDATION_ERROR",
      ["Drop --token and keep --site <site_id> --update-key <key>"]
    );
  }
  if (unpublish) {
    if (file) {
      throw new AxiError("--unpublish replaces a published page and takes no HTML file", "VALIDATION_ERROR", [
        "Run `lavish-axi share --unpublish --site <site_id> --update-key <key>`"
      ]);
    }
    if (generate || explicitPassword) {
      throw new AxiError(
        "--unpublish locks the page with its own password and takes no password flag",
        "VALIDATION_ERROR",
        ["Run `lavish-axi share --unpublish --site <site_id> --update-key <key>`"]
      );
    }
    assertSiteCredential(siteId, updateKey);
    return {
      mode: "unpublish",
      file: null,
      siteId: assertShareSiteId(siteId),
      updateKey,
      password: void 0,
      generatedPassword: false,
      token
    };
  }
  if (siteId || updateKey) {
    assertSiteCredential(siteId, updateKey);
    assertShareFile(file);
    return {
      mode: "update",
      file,
      siteId: assertShareSiteId(siteId),
      updateKey,
      ...resolveSharePassword({ generate, explicitPassword }),
      token
    };
  }
  assertShareFile(file);
  return {
    mode: "create",
    file,
    siteId: null,
    updateKey: null,
    ...resolveSharePassword({ generate, explicitPassword }),
    token
  };
}
function resolveSharePassword({ generate, explicitPassword }) {
  if (generate) return { password: generateSharePassword(), generatedPassword: true };
  if (explicitPassword) return { password: explicitPassword, generatedPassword: false };
  return { password: void 0, generatedPassword: false };
}
function assertSiteCredential(siteId, updateKey) {
  if (!siteId) {
    throw new AxiError("--site <site_id> is required to change a published page", "VALIDATION_ERROR", [
      "The site_id is in the share output from when the page was published"
    ]);
  }
  if (!updateKey) {
    throw new AxiError("--update-key <key> is required to change a published page", "VALIDATION_ERROR", [
      "The update_key was returned once when the page was published; there is no way to recover it"
    ]);
  }
}
function shareFlagValue(args, flag) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") break;
    if (arg === flag) return checkedShareFlagValue(flag, args[i + 1], { swallows: true });
    if (arg.startsWith(`${flag}=`)) return checkedShareFlagValue(flag, arg.slice(flag.length + 1), {});
  }
  return void 0;
}
function checkedShareFlagValue(flag, value, { swallows = false }) {
  const hint = flag === "--password" ? `Quote the value as ${flag} "<pw>" - an unquoted shell variable that is unset expands to nothing - or pass --private to have Lavish generate one` : `Quote the value as ${flag} "<value>"`;
  if (swallows && typeof value === "string" && value.startsWith("--")) {
    throw new AxiError(
      `${flag} was given no value: the next argument ${value} is another flag, so it would have been used as the value`,
      "VALIDATION_ERROR",
      [hint, `Use ${flag}=<value> if the value itself starts with --`]
    );
  }
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    const consequence = flag === "--password" ? ", and publishing a PUBLIC page while you believed it was gated is the worse failure" : "";
    throw new AxiError(`${flag} was given an empty value${consequence}`, "VALIDATION_ERROR", [hint]);
  }
  return trimmed;
}
function assertShareSiteId(siteId) {
  try {
    return normalizeSiteId(siteId);
  } catch (error) {
    throw new AxiError(error instanceof Error ? error.message : String(error), "VALIDATION_ERROR", [
      "The site_id is in the share output from when the page was published, and in the browser publish dialog's Site ID row"
    ]);
  }
}
function assertShareFile(file) {
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", ["Run `lavish-axi share <html-file>`"]);
  }
}
function createShareOutput({
  source,
  site,
  warnings,
  passwordProtected = false,
  password = void 0,
  selfPaintWarning = void 0
}) {
  const allWarnings = Array.isArray(warnings) ? warnings : [];
  const { unresolved, notices } = splitExportWarnings(allWarnings);
  const isPasswordProtected = Boolean(passwordProtected);
  const republishableSiteId = String(site.site_id ?? "").trim();
  const result = {
    share: {
      source,
      url: site.url,
      ...republishableSiteId ? { site_id: republishableSiteId } : {},
      update_key: site.update_key,
      status: site.status || "active",
      public: !isPasswordProtected,
      visibility: isPasswordProtected ? "private" : "public",
      password_protected: isPasswordProtected,
      ...password ? { password } : {},
      unresolved_local_assets: unresolved.length,
      notices: notices.length
    }
  };
  const passwordNote = isPasswordProtected ? " This page is PASSWORD-PROTECTED; viewers also need the password." : "";
  if (allWarnings.length) result.warnings = exportWarningSummaries(allWarnings);
  if (unresolved.length) result.unresolved_local_assets = assetWarningSummaries(unresolved);
  if (notices.length) result.notices = assetWarningSummaries(notices);
  const noticeNote = notices.length ? " Export notices are available in notices." : "";
  const hostNote = "ht-ml.app (https://ht-ml.app), a third-party host not part of Lavish, hosts the page, so it needs no Lavish server.";
  const updateKeyNote = republishableSiteId ? "The update_key is a secret shown only once; keep it to republish the page later with --site and --update-key (there is no recovery, and ht-ml.app has no delete). " : "The host did not return a site_id Lavish can use, and --site is half the republish credential, so this page can NEVER be republished or unpublished even though its update_key is in hand. Tell the user that now rather than letting them discover it later. ";
  if (unresolved.length) {
    result.next_step = `Published ${isPasswordProtected ? "a PASSWORD-PROTECTED page at " : ""}${site.url}, but some LOCAL assets could not be inlined and were left as references (see unresolved_local_assets); inspect the hosted page and fix missing local assets before sharing it.${passwordNote}${noticeNote} Remote CDN/font references are intentionally left as links and render where there is network access. ` + updateKeyNote + hostNote;
  } else if (isPasswordProtected) {
    result.next_step = `Published a PASSWORD-PROTECTED page: ${site.url} - share this URL with the user and provide the password separately; viewers also need the password. ${noticeNote ? `${noticeNote} ` : ""}` + updateKeyNote + hostNote;
  } else {
    result.next_step = `Published a PUBLIC page that anyone with the link can view: ${site.url} - share this URL with the user. ${noticeNote ? `${noticeNote} ` : ""}` + updateKeyNote + hostNote;
  }
  if (password) result.next_step = `${generatedPasswordNote(password)} ${result.next_step}`;
  if (selfPaintWarning) {
    result.self_paint_warning = selfPaintWarning;
    result.next_step = `Fix the unpainted page surface flagged in self_paint_warning, then re-run the share command and share only its replacement URL - the hosted page renders over ht-ml.app's own surface. ${result.next_step}`;
  }
  return result;
}
function createShareUpdateOutput({
  source,
  site,
  warnings,
  password = void 0,
  passwordProtected = false,
  selfPaintWarning = void 0
}) {
  const allWarnings = Array.isArray(warnings) ? warnings : [];
  const { unresolved, notices } = splitExportWarnings(allWarnings);
  const visibility = passwordProtected ? "private" : "unchanged";
  const url = String(site.url ?? "").trim();
  const result = {
    share: {
      source,
      url,
      site_id: site.site_id,
      status: site.status || "active",
      updated: true,
      visibility,
      ...password ? { password } : {},
      unresolved_local_assets: unresolved.length,
      notices: notices.length
    }
  };
  if (allWarnings.length) result.warnings = exportWarningSummaries(allWarnings);
  if (unresolved.length) result.unresolved_local_assets = assetWarningSummaries(unresolved);
  if (notices.length) result.notices = assetWarningSummaries(notices);
  const noticeNote = notices.length ? " Export notices are available in notices." : "";
  const unresolvedNote = unresolved.length ? " Some LOCAL assets could not be inlined and were left as references (see unresolved_local_assets); inspect the hosted page." : "";
  const visibilityNote = visibility === "private" ? " It is PASSWORD-PROTECTED; viewers also need the password. That gate is NOT instant: if the page had been public, it was observed still answering uncredentialed requests from ht-ml.app's CDN cache for minutes afterwards, so do not tell the user it is gated right away; a page that was already private has no such cached copy and leaks nothing." : " This republish did not touch the page's password, so whatever it had when it was last published still applies. Lavish stores nothing about a published page, so this output cannot tell you whether that is a password or none - and a page published without one stays readable by anyone who has the link.";
  result.next_step = url ? `Republished ${source} to the same URL: ${url} - viewers see the new version immediately and no new link is needed.${visibilityNote}${unresolvedNote}${noticeNote} Keep the same update_key; it is still the only credential for this page.` : `Republished ${source} in place as site_id ${site.site_id} - viewers see the new version immediately and no new link is needed, but the host did not report a URL for the page, so use the one from when it was published rather than guessing.${visibilityNote}${unresolvedNote}${noticeNote} Keep the same update_key; it is still the only credential for this page.`;
  if (password) result.next_step = `${generatedPasswordNote(password)} ${result.next_step}`;
  if (selfPaintWarning) {
    result.self_paint_warning = selfPaintWarning;
    result.next_step = `Fix the unpainted page surface flagged in self_paint_warning, then republish - the hosted page renders over ht-ml.app's own surface. ${result.next_step}`;
  }
  return result;
}
function createShareUnpublishOutput({ site, siteId = void 0 }) {
  const url = String(site.url ?? "").trim();
  const commandSiteId = siteId || site.site_id;
  const target = url ? `Replaced the page at ${url} with an "unpublished" placeholder` : `Replaced the page published as site_id ${site.site_id} with an "unpublished" placeholder (the host did not report a URL for it, so use the one from when it was published rather than guessing)`;
  return {
    share: {
      url,
      site_id: site.site_id,
      status: site.status || "active",
      unpublished: true,
      visibility: "private"
    },
    next_step: `${target} and locked it behind a fresh random password that was discarded. The replacement itself is immediate: the previous content is gone from that URL, not merely hidden. The LOCK is what is not instant for a page that was public - its CDN copy was observed serving the new placeholder to uncredentialed requests for minutes afterwards - so the placeholder may be readable without the password until the edge cache turns over. Do not tell the user the URL is unreachable right away. ht-ml.app has NO delete endpoint: the page is not deleted, the URL still resolves, and the host still holds whatever was published. Tell the user that rather than saying it was deleted. The update_key is still the only credential for this page - republish with \`${republishPrivateCommand(commandSiteId)}\` to bring it back, then give the user the new password it returns. ht-ml.app cannot remove a page's password once it has one, so a republished page stays private.`
  };
}
function generatedPasswordNote(password) {
  return `The password is ${password} - Lavish generated it and does not store it anywhere. Give it to the user with the URL and tell them it is a SHARED SECRET: anyone they pass it to can read the page.`;
}
async function stopCommand(args) {
  const port = Number(flagValue(args, "--port") || defaultPort());
  const { baseUrl, duplicates, foreign } = await findRunningServer(port);
  if (foreign) throw otherInstallationError(port, foreign);
  await stopDuplicateServers(duplicates, { reason: "stop" });
  return shutdownServerOnPort(port, { baseUrl, currentVersion: VERSION });
}
async function shutdownServerOnPort(port, {
  baseUrl = `http://${hostForUrl(clientHost())}:${port}`,
  currentVersion = VERSION,
  fetchHealth: healthFetcher = fetchHealth,
  requestShutdown: shutdownRequester = requestShutdown,
  waitForPortFree: portFreeWaiter = waitForPortFree,
  killServerProcess = killLavishListener,
  processMatchesLavish = listenerMatchesLavish
} = {}) {
  const health = await healthFetcher(baseUrl);
  if (!health) {
    return { server: { status: "not-running", port } };
  }
  if (!await canControlServerOnPort(baseUrl, health, processMatchesLavish)) {
    return { server: { status: "not-lavish", port } };
  }
  await shutdownRequester(baseUrl, { reason: "stop" });
  let freed = await portFreeWaiter(baseUrl, 3e3);
  if (!freed && shouldKillProcessOnPort(currentVersion, health)) {
    if (!killServerProcess(baseUrl)) throw unidentifiedListenerError(baseUrl);
    freed = await portFreeWaiter(baseUrl, 3e3);
  }
  return { server: { status: freed ? "stopped" : "stopping", port } };
}
var LIBRARY_ITEM_LIST_LIMIT = 50;
async function librariesCommand(args) {
  const dir = excalidrawLibrariesDir(path11.dirname(stateFile()));
  const { libraries, skipped } = await loadExcalidrawLibraries(dir);
  return createLibrariesOutput({
    dir: collapseHomeDirectory(dir, os4.homedir()),
    libraries,
    skipped,
    search: flagValue(args, "--search") || "",
    library: flagValue(args, "--library") || ""
  });
}
function createLibrariesOutput({ dir, libraries, skipped, search = "", library = "" }) {
  const output = {
    dir,
    libraries: libraries.map((entry) => ({ id: entry.id, items: entry.items.length }))
  };
  if (skipped.length > 0) {
    output.skipped = skipped.map((entry) => ({ file: path11.basename(entry.file), reason: entry.reason }));
  }
  if (libraries.length === 0) {
    output.help = [
      `Copy Excalidraw library files (.excalidrawlib, for example from https://libraries.excalidraw.com) into ${dir}; every whiteboard's library panel then lists their items`
    ];
    return output;
  }
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length > 0 || library) {
    const matches = libraries.filter((entry) => !library || entry.id === library.toLowerCase()).flatMap((entry) => entry.items).filter((item) => terms.every((term) => item.ref.toLowerCase().includes(term)));
    output.items = matches.slice(0, LIBRARY_ITEM_LIST_LIMIT).map((item) => ({ ref: item.ref }));
    if (matches.length > LIBRARY_ITEM_LIST_LIMIT) output.more_items = matches.length - LIBRARY_ITEM_LIST_LIMIT;
  }
  output.help = [
    output.more_items ? "Narrow the list with `lavish-axi libraries --search <text>`" : "Run `lavish-axi libraries --search <text>` or `--library <id>` to list item refs",
    "To show an item as a node icon in a whiteboard flowchart, see `whiteboard_tooling.library_icons` in `lavish-axi design`"
  ];
  return output;
}
async function playbookCommand(args) {
  return createPlaybookOutput(args);
}
async function designCommand() {
  return createDesignOutput();
}
async function setupCommand(args) {
  if (args.length !== 1 || args[0] !== "hooks" && args[0] !== "plugin") {
    throw new AxiError("Unknown setup action", "VALIDATION_ERROR", [
      "Run `lavish-axi setup hooks`",
      "Run `lavish-axi setup plugin`"
    ]);
  }
  if (args[0] === "plugin") return setupPluginCommand();
  const errors = [];
  installSessionStartHooks({
    marker: "lavish-axi",
    binaryNames: ["lavish-axi"],
    distEntrypoints: ["dist/cli.mjs", "bin/lavish-axi.js"],
    homeDir: resolveHookHomeDir(),
    onError: (message) => errors.push(message)
  });
  installCopilotCliSessionStartHook({
    hookDir: resolveCopilotHookDir(process.env, resolveHookHomeDir()),
    onError: (message) => errors.push(message)
  });
  if (errors.length > 0) {
    throw new AxiError("Failed to install lavish-axi agent hooks", "SERVER_ERROR", errors);
  }
  return {
    hooks: { status: "installed", integrations: "Claude Code, Codex, OpenCode, GitHub Copilot CLI" },
    help: [
      "Restart your agent session to receive lavish-axi ambient context",
      "Run `lavish-axi setup plugin` to also register the Agent Plugin in VS Code, Cursor, and GitHub Copilot CLI"
    ]
  };
}
async function setupPluginCommand() {
  const pluginRoot = resolvePluginRoot();
  const manifest = readPluginManifest(pluginRoot);
  if (!manifest) {
    throw new AxiError("No plugin.json found in the lavish-axi package", "SERVER_ERROR", [
      `Expected a manifest at ${path11.join(pluginRoot, "plugin.json")}`,
      "Reinstall lavish-axi, or run `npm run build:plugin` when working from a source checkout"
    ]);
  }
  const clients = [
    registerVsCodePlugin(pluginRoot, manifest.name),
    registerCursorPlugin(pluginRoot, manifest.name),
    registerCopilotPlugin(pluginRoot, manifest.name)
  ];
  const help = ["Restart or reload each client so it discovers the plugin"];
  if (clients.some((client) => client.status === "absent")) {
    help.push("Absent clients are skipped; re-run `lavish-axi setup plugin` after installing one");
  }
  if (clients.some((client) => client.status === "manual")) {
    help.push(`Register the plugin root manually where noted: ${pluginRoot}`);
  }
  return { plugin: { name: manifest.name, root: collapseHome(pluginRoot) }, clients, help };
}
function collapseHome(target) {
  const home = resolveHookHomeDir();
  return home && target.startsWith(home) ? `~${target.slice(home.length)}` : target;
}
function registerVsCodePlugin(pluginRoot, pluginName) {
  const settingsFile = resolveVsCodeSettingsFile(process.env, resolveHookHomeDir());
  const settingsDir = path11.dirname(settingsFile);
  const hasSettingsFile = existsSync3(settingsFile);
  if (!hasSettingsFile && !existsSync3(settingsDir)) {
    return { client: "vscode", status: "absent", detail: "no VS Code user configuration found" };
  }
  let settings = {};
  if (hasSettingsFile) {
    try {
      settings = JSON.parse(readFileSync2(settingsFile, "utf8"));
    } catch {
      return {
        client: "vscode",
        status: "manual",
        detail: `add "chat.pluginLocations": {"${pluginRoot}": true} to ${collapseHome(settingsFile)}`
      };
    }
  }
  const [updated, changed] = computeVsCodePluginLocationsUpdate(settings, pluginRoot, pluginName);
  if (!changed) return { client: "vscode", status: "current", detail: collapseHome(settingsFile) };
  try {
    const writeTarget = hasSettingsFile ? realpathSync2(settingsFile) : settingsFile;
    writeTextFileAtomically(writeTarget, `${JSON.stringify(updated, null, 2)}
`);
  } catch (error) {
    return { client: "vscode", status: "failed", detail: String(error instanceof Error ? error.message : error) };
  }
  return { client: "vscode", status: "registered", detail: collapseHome(settingsFile) };
}
function registerCursorPlugin(pluginRoot, pluginName) {
  const cursorDir = path11.join(resolveHookHomeDir(), ".cursor");
  if (!existsSync3(cursorDir)) {
    return { client: "cursor", status: "absent", detail: "no ~/.cursor directory found" };
  }
  try {
    const { status, target, reason } = linkCursorLocalPlugin(
      resolveCursorLocalPluginsDir(resolveHookHomeDir()),
      pluginRoot,
      pluginName
    );
    if (status === "occupied") {
      return { client: "cursor", status: "manual", detail: `${collapseHome(target)} exists and is not a symlink` };
    }
    if (status === "unsupported") {
      return {
        client: "cursor",
        status: "manual",
        detail: `cannot link ${collapseHome(target)} (${reason}); link it to ${pluginRoot} manually, or enable Developer Mode on Windows`
      };
    }
    return {
      client: "cursor",
      status: status === "current" ? "current" : "registered",
      detail: collapseHome(target)
    };
  } catch (error) {
    return { client: "cursor", status: "failed", detail: String(error instanceof Error ? error.message : error) };
  }
}
function registerCopilotPlugin(pluginRoot, pluginName) {
  const listed = spawnPluginClientSync("copilot", ["plugins", "list", "--scope", "user", "--kind", "plugin", "--json"]);
  if (listed.error) {
    return { client: "copilot", status: "absent", detail: "copilot CLI not found on PATH" };
  }
  if (listed.status !== 0) {
    const detail = String(listed.stderr || listed.stdout || `exit ${listed.status}`).trim();
    return {
      client: "copilot",
      status: "manual",
      detail: `could not verify installed plugins: ${detail.split("\n")[0]}`
    };
  }
  const records = parseCopilotPluginRecords(listed.stdout);
  if (!records) {
    return { client: "copilot", status: "manual", detail: "could not parse installed plugin records" };
  }
  const existing = records.find((record) => record.name === pluginName && (!record.kind || record.kind === "plugin"));
  if (existing) {
    const source = copilotPluginSourcePath(existing) || installedCopilotPluginSourcePath(pluginName);
    if (!source) {
      return { client: "copilot", status: "manual", detail: "could not verify the installed plugin source" };
    }
    if (sameResolvedPath(source, pluginRoot)) {
      return { client: "copilot", status: "current", detail: collapseHome(pluginRoot) };
    }
  }
  const installed = spawnPluginClientSync("copilot", ["plugin", "install", pluginRoot]);
  if (installed.status !== 0) {
    const detail = String(installed.stderr || installed.stdout || `exit ${installed.status}`).trim();
    return { client: "copilot", status: "failed", detail: detail.split("\n")[0] };
  }
  return { client: "copilot", status: "registered", detail: "copilot plugin install" };
}
function parseCopilotPluginRecords(output) {
  try {
    const parsed = JSON.parse(String(output));
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.plugins) ? parsed.plugins : parsed?.items;
    return Array.isArray(records) && records.every((record) => record && typeof record === "object") ? records : null;
  } catch {
    return null;
  }
}
function installedCopilotPluginSourcePath(pluginName) {
  const configDir = process.env.COPILOT_HOME || path11.join(resolveHookHomeDir(), ".copilot");
  try {
    const config = JSON.parse(readFileSync2(path11.join(configDir, "config.json"), "utf8"));
    const record = Array.isArray(config.installedPlugins) ? config.installedPlugins.find((candidate) => candidate?.name === pluginName) : null;
    return record ? copilotPluginSourcePath(record) : null;
  } catch {
    return null;
  }
}
function copilotPluginSourcePath(record) {
  const candidates = [
    record.sourcePath,
    record.source_path,
    record.pluginRoot,
    record.plugin_root,
    record.path,
    record.source?.path
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    if (candidate.startsWith("file:")) {
      try {
        return fileURLToPath4(candidate);
      } catch {
        continue;
      }
    }
    if (path11.isAbsolute(candidate)) return candidate;
  }
  return null;
}
function sameResolvedPath(left, right) {
  try {
    return realpathSync2(left) === realpathSync2(right);
  } catch {
    return path11.resolve(left) === path11.resolve(right);
  }
}
function resolveHookHomeDir(env = process.env, fallback = os4.homedir()) {
  return env.HOME || fallback;
}
function resolveCopilotHookDir(env = process.env, homeDir = resolveHookHomeDir(env)) {
  return path11.join(env.COPILOT_HOME || path11.join(homeDir, ".copilot"), "hooks");
}
function createCopilotCliAmbientContextScript(command = "lavish-axi") {
  return [
    'const { spawnSync } = require("node:child_process");',
    `const command = ${JSON.stringify(command)};`,
    'const result = spawnSync(command, [], { encoding: "utf8", shell: true });',
    'const detail = result.error ? result.error.message : (result.stderr || result.stdout || "exit " + (result.status ?? "unknown"));',
    "const text = String(result.status === 0 ? result.stdout : detail).trim();",
    'if (!text) { console.log("{}"); process.exit(0); }',
    'const prefix = result.status === 0 ? "## AXI ambient context: lavish-axi\\n" : "## AXI ambient context: lavish-axi\\nerror: lavish-axi ambient context failed: ";',
    "console.log(JSON.stringify({ additionalContext: prefix + text }));"
  ].join(" ");
}
function createCopilotCliSessionStartHook(command = "lavish-axi", timeoutSec = 10) {
  const script = createCopilotCliAmbientContextScript(command);
  return {
    type: "command",
    bash: `node -e ${quoteForPosixShell(script)}`,
    powershell: `node -e ${quoteForPowerShell(script)}`,
    timeoutSec
  };
}
function computeCopilotCliHookUpdate(settings, hook = createCopilotCliSessionStartHook()) {
  const updated = structuredClone(settings && typeof settings === "object" ? settings : {});
  let changed = false;
  if (updated.version !== 1) {
    updated.version = 1;
    changed = true;
  }
  if (!updated.hooks || typeof updated.hooks !== "object" || Array.isArray(updated.hooks)) {
    updated.hooks = {};
    changed = true;
  }
  const current = Array.isArray(updated.hooks.sessionStart) ? updated.hooks.sessionStart : [];
  const unmanaged = current.filter((entry) => !isManagedCopilotCliHook(entry));
  const next = [...unmanaged, hook];
  if (!deepEqual(current, next)) {
    updated.hooks.sessionStart = next;
    changed = true;
  }
  return [changed ? updated : settings, changed];
}
function installCopilotCliSessionStartHook({
  hookDir = resolveCopilotHookDir(),
  command = "lavish-axi",
  timeoutSec = 10,
  onError = void 0
} = {}) {
  const target = path11.join(hookDir, "lavish-axi.json");
  try {
    mkdirSync2(path11.dirname(target), { recursive: true });
    const current = existsSync3(target) ? JSON.parse(readFileSync2(target, "utf8")) : {};
    const [updated, changed] = computeCopilotCliHookUpdate(
      current,
      createCopilotCliSessionStartHook(command, timeoutSec)
    );
    if (changed) {
      writeFileSync2(target, `${JSON.stringify(updated, null, 2)}
`, "utf8");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onError?.(`${target}: ${message}`);
  }
}
function isManagedCopilotCliHook(entry) {
  return entry && typeof entry === "object" && (typeof entry.bash === "string" || typeof entry.powershell === "string" || typeof entry.command === "string") && [entry.bash, entry.powershell, entry.command].some(
    (value) => typeof value === "string" && value.includes("lavish-axi")
  );
}
function quoteForPosixShell(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
function quoteForPowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
async function serverCommand(args) {
  const port = Number(flagValue(args, "--port") || defaultPort());
  const debug = args.includes("--verbose") || process.env.LAVISH_AXI_DEBUG === "1";
  const server = await serve({
    port,
    stateFile: stateFile(),
    version: VERSION,
    debug,
    extraListenHosts: flagValues(args, "--also-listen")
  });
  await server.done;
  return "";
}
async function visibleSessions() {
  const store = new SessionStore(stateFile());
  const sessions = (await store.listSessions()).filter((session) => session.status !== "ended");
  const { health } = await findRunningServer(defaultPort());
  const listeners = new Map(
    Array.isArray(health?.listeners) ? health.listeners.filter((listener) => listener && typeof listener.key === "string").map((listener) => [listener.key, listener.label || "agent-listener"]) : []
  );
  return sessions.map((session) => ({ ...session, listener: listeners.get(session.key) || "none" }));
}
async function assertHtmlFile(file) {
  if (!isHtmlPath(file)) {
    throw new AxiError("Lavish Editor expects an HTML file", "VALIDATION_ERROR", ["Run `lavish-axi <html-file>`"]);
  }
  try {
    await access2(file);
  } catch {
    throw new AxiError(`File not found: ${file}`, "NOT_FOUND", [
      "Create the HTML artifact first, then run `lavish-axi <html-file>`"
    ]);
  }
}
var HEALTH_PROBE_TIMEOUT_MS = 500;
var DEFAULT_HEALTH_TIMEOUT_MS = 2e3;
var MAX_HEALTH_BODY_BYTES = 256 * 1024;
var HEALTH_RECONCILE_TIMEOUT_MS = 3e3;
function serverCandidateHosts() {
  const hosts = [clientHost(), LOOPBACK_HOST];
  for (const address of localInterfaceAddresses()) {
    if (!hosts.includes(address)) hosts.push(address);
  }
  return hosts;
}
function serverBaseUrl(host, port) {
  return `http://${hostForUrl(host)}:${port}`;
}
function isOwnedServer(entry, controlHosts) {
  if (entry.health.app !== "lavish-axi") return false;
  if (typeof entry.health.state_id === "string") return entry.health.state_id === stateId();
  return controlHosts.has(entry.host);
}
function otherInstallationError(port, foreign) {
  const dir = typeof foreign.health.state_dir === "string" ? foreign.health.state_dir : "an unknown state directory";
  return new AxiError(
    `Port ${port} is served by another Lavish installation at ${foreign.host} (state directory ${dir})`,
    "SERVER_ERROR",
    [`Set LAVISH_AXI_PORT to another port, or set LAVISH_AXI_STATE_DIR to ${dir} to use that installation`]
  );
}
async function findRunningServer(port, { reconcileNetwork = false } = {}) {
  const controlHosts = /* @__PURE__ */ new Set([clientHost(), LOOPBACK_HOST]);
  const probed = await Promise.all(
    serverCandidateHosts().map(async (host) => {
      const baseUrl = serverBaseUrl(host, port);
      const health2 = await probeHealth(baseUrl, { reconcileNetwork: false, timeoutMs: HEALTH_PROBE_TIMEOUT_MS });
      return health2 ? { host, baseUrl, health: health2 } : null;
    })
  );
  const found = probed.filter((entry) => entry !== null);
  const owned = found.filter((entry) => isOwnedServer(entry, controlHosts));
  const foreign = found.find(
    (entry) => controlHosts.has(entry.host) && entry.health.app === "lavish-axi" && !isOwnedServer(entry, controlHosts)
  ) ?? null;
  const chosen = owned[0];
  if (!chosen) {
    const other = found.find((entry) => controlHosts.has(entry.host));
    return other ? { baseUrl: other.baseUrl, health: other.health, duplicates: [], foreign } : { baseUrl: serverBaseUrl(clientHost(), port), health: null, duplicates: [], foreign };
  }
  let health = chosen.health;
  if (reconcileNetwork) {
    health = await probeHealth(chosen.baseUrl, { reconcileNetwork: true, timeoutMs: HEALTH_RECONCILE_TIMEOUT_MS }) ?? health;
  }
  return { baseUrl: chosen.baseUrl, health, duplicates: ownedDuplicates(owned, chosen), foreign };
}
function ownedDuplicates(owned, chosen) {
  const covered = /* @__PURE__ */ new Set([chosen.host, ...Array.isArray(chosen.health.hosts) ? chosen.health.hosts : []]);
  const duplicates = [];
  for (const entry of owned) {
    if (entry === chosen || covered.has(entry.host)) continue;
    duplicates.push(entry);
    for (const host of Array.isArray(entry.health.hosts) ? entry.health.hosts : [entry.host]) covered.add(host);
  }
  return duplicates;
}
async function stopDuplicateServers(duplicates, { reloadKey = "", reason = "" } = {}) {
  for (const duplicate of duplicates) {
    await requestShutdown(duplicate.baseUrl, {
      reloadKey,
      reason: reason || serverReplacementReason(VERSION, duplicate.health)
    });
    await waitForPortFree(duplicate.baseUrl, 3e3);
  }
}
async function adoptServer(baseUrl, duplicates, reloadKey) {
  if (duplicates.length === 0) return baseUrl;
  await stopDuplicateServers(duplicates, { reloadKey });
  await probeHealth(baseUrl, { reconcileNetwork: true, timeoutMs: HEALTH_RECONCILE_TIMEOUT_MS });
  return baseUrl;
}
async function requiredServerHosts(env = process.env) {
  const envHost = env.LAVISH_AXI_HOST?.trim();
  if (!envHost || isWildcardHost(envHost)) return [];
  return resolveConcreteListenHosts([clientHost(env)], { keepUnresolved: true });
}
function missingServerHosts(healthBody, requiredHosts) {
  if (!healthBody || !Array.isArray(healthBody.requested_hosts)) return [];
  return requiredHosts.filter((host) => !healthBody.requested_hosts.includes(host));
}
function inheritedListenHosts(healthBodies, requiredHosts, inherited = [], localAddresses = localInterfaceAddresses()) {
  const hosts = [...inherited];
  for (const health of healthBodies) {
    if (!health || !Array.isArray(health.requested_hosts)) continue;
    for (const host of health.requested_hosts) {
      if (host === LOOPBACK_HOST || requiredHosts.includes(host)) continue;
      if (isIP4(host) && !localAddresses.includes(host)) continue;
      if (!hosts.includes(host)) hosts.push(host);
    }
  }
  return hosts;
}
function hostsToServe(requiredHosts, duplicates) {
  return inheritedListenHosts(
    duplicates.map((duplicate) => duplicate.health),
    [],
    requiredHosts
  );
}
async function probeHealth(baseUrl, { reconcileNetwork, timeoutMs }) {
  const health = await fetchHealth(baseUrl, { reconcileNetwork, timeoutMs });
  return health && typeof health === "object" ? health : null;
}
async function ensureServer({ forceRestart = false, reloadKey = "" } = {}) {
  const port = defaultPort();
  const requiredHosts = await requiredServerHosts();
  const { baseUrl, health: existing, duplicates, foreign } = await findRunningServer(port, { reconcileNetwork: true });
  if (foreign) throw otherInstallationError(port, foreign);
  const missingHosts = existing?.app === "lavish-axi" ? missingServerHosts(existing, hostsToServe(requiredHosts, duplicates)) : [];
  if (existing && !shouldRestartServer(VERSION, existing, forceRestart) && missingHosts.length === 0) {
    return adoptServer(baseUrl, duplicates, reloadKey);
  }
  let alsoListen = inheritedListenHosts([existing, ...duplicates.map((duplicate) => duplicate.health)], requiredHosts);
  let unidentified = "";
  if (existing) {
    if (!await canControlServerOnPort(baseUrl, existing, listenerMatchesLavish)) {
      throw new AxiError(`Port ${port} is occupied by a non-Lavish server`, "SERVER_ERROR", [
        `Stop the process using port ${port}, or set LAVISH_AXI_PORT to another port`
      ]);
    }
    await stopDuplicateServers(duplicates, { reloadKey });
    await requestShutdown(baseUrl, { reloadKey, reason: serverReplacementReason(VERSION, existing, forceRestart) });
    const freed = await waitForPortFree(baseUrl, 2e3);
    if (!freed) {
      if (shouldKillProcessOnPort(VERSION, existing)) {
        if (killLavishListener(baseUrl)) await waitForPortFree(baseUrl, 3e3);
        else unidentified = baseUrl;
      }
    }
  }
  await startServer(port, { alsoListen });
  const replacedForNetwork = Boolean(existing) && existing.app === "lavish-axi" && existing.network_stale === true && !forceRestart && typeof existing.version === "string" && !isServerOlderThanCli(VERSION, existing.version);
  let networkRestarted = replacedForNetwork;
  let raceRestarted = false;
  let deadline = Date.now() + 5e3;
  while (Date.now() < deadline) {
    const {
      baseUrl: liveUrl,
      health,
      duplicates: liveDuplicates,
      foreign: liveForeign
    } = await findRunningServer(port, { reconcileNetwork: true });
    if (liveForeign) throw otherInstallationError(port, liveForeign);
    const liveMissing = health?.app === "lavish-axi" ? missingServerHosts(health, hostsToServe(requiredHosts, liveDuplicates)) : [];
    if (health && !shouldRestartServer(VERSION, health)) {
      if (liveMissing.length === 0) return adoptServer(liveUrl, liveDuplicates, reloadKey);
      if (raceRestarted) throw missingHostsError(port, liveMissing);
    }
    if (health?.app === "lavish-axi" && health.network_stale !== true && !raceRestarted) {
      raceRestarted = true;
      alsoListen = inheritedListenHosts(
        [health, ...liveDuplicates.map((duplicate) => duplicate.health)],
        requiredHosts,
        alsoListen
      );
      await stopDuplicateServers(liveDuplicates, { reloadKey });
      await requestShutdown(liveUrl, { reloadKey, reason: serverReplacementReason(VERSION, health) });
      if (!await waitForPortFree(liveUrl, 3e3)) break;
      await startServer(port, { alsoListen });
      deadline = Date.now() + 5e3;
      continue;
    }
    if (health?.network_stale === true && health.app === "lavish-axi") {
      if (networkRestarted) {
        if (liveMissing.length > 0) throw missingHostsError(port, liveMissing);
        return adoptServer(liveUrl, liveDuplicates, reloadKey);
      }
      alsoListen = inheritedListenHosts([health], requiredHosts, alsoListen);
      await requestShutdown(liveUrl, { reloadKey, reason: "" });
      if (!await waitForPortFree(liveUrl, 3e3)) break;
      await startServer(port, { alsoListen });
      networkRestarted = true;
      deadline = Date.now() + 5e3;
      continue;
    }
    await delay(100);
  }
  if (unidentified) throw unidentifiedListenerError(unidentified);
  throw new AxiError("Lavish Editor server did not start", "SERVER_ERROR", [
    `Run \`lavish-axi server --port ${port}\` to inspect server startup`
  ]);
}
function missingHostsError(port, missingHosts) {
  return new AxiError(
    `The Lavish server on port ${port} does not serve ${missingHosts.join(", ")}, and replacing it did not stick`,
    "SERVER_ERROR",
    ["Run `lavish-axi stop`, then retry"]
  );
}
function shouldRestartServer(currentVersion, healthBody, forceRestart = false) {
  if (!healthBody || typeof healthBody !== "object") return false;
  if (forceRestart && healthBody.app === "lavish-axi") return true;
  if (healthBody.network_stale === true && healthBody.app === "lavish-axi") return true;
  if (typeof healthBody.version !== "string" || healthBody.version === "") return true;
  return isServerOlderThanCli(currentVersion, healthBody.version);
}
function isServerOlderThanCli(currentVersion, runningVersion) {
  if (runningVersion === currentVersion) return false;
  const current = parseReleaseVersion(currentVersion);
  const running = parseReleaseVersion(runningVersion);
  if (!current || !running) return true;
  for (let index = 0; index < 3; index += 1) {
    if (running[index] !== current[index]) return running[index] < current[index];
  }
  return false;
}
function parseReleaseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}
function serverReplacementReason(currentVersion, healthBody, forceRestart = false) {
  if (!shouldRestartServer(currentVersion, healthBody, forceRestart)) return "";
  const runningVersion = healthBody.version;
  if (typeof runningVersion !== "string" || runningVersion === "" || isServerOlderThanCli(currentVersion, runningVersion)) {
    return "upgrade";
  }
  return forceRestart ? "local-build" : "";
}
function shouldForceRestartForLocalBuild(executablePath, sourceServerExists = localSourceServerExists()) {
  const localBuildEntry = fileURLToPath4(new URL("../dist/cli.mjs", import.meta.url));
  return sourceServerExists && path11.resolve(executablePath) === path11.resolve(localBuildEntry);
}
function localSourceServerExists() {
  return existsSync3(fileURLToPath4(new URL("../src/server.js", import.meta.url)));
}
function shouldKillProcessOnPort(currentVersion, healthBody) {
  if (!healthBody || typeof healthBody !== "object") return false;
  if (typeof healthBody.version !== "string" || healthBody.version === "") return true;
  if (healthBody.app !== "lavish-axi") return false;
  return isServerOlderThanCli(currentVersion, healthBody.version);
}
async function canControlServerOnPort(baseUrl, healthBody, processMatchesLavish) {
  if (!healthBody || typeof healthBody !== "object") return false;
  if (healthBody.app === "lavish-axi") return true;
  if (typeof healthBody.version === "string" && healthBody.version !== "") return false;
  return processMatchesLavish(baseUrl);
}
function fetchHealth(baseUrl, { reconcileNetwork = false, timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let request = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request?.destroy();
      resolve(value);
    };
    const abort = () => finish(null);
    const timer = setTimeout(abort, timeoutMs);
    try {
      const url = new URL(`${baseUrl}/health${reconcileNetwork ? "?reconcile_network=1" : ""}`);
      request = httpGet2(url, { agent: false }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > MAX_HEALTH_BODY_BYTES) finish(null);
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            finish(null);
            return;
          }
          try {
            finish(JSON.parse(body));
          } catch {
            finish(null);
          }
        });
        response.on("error", abort);
      });
      request.on("error", abort);
    } catch {
      abort();
    }
  });
}
async function requestShutdown(baseUrl, { reloadKey = "", reason = "" } = {}) {
  const body = {};
  if (reloadKey) body.reload_key = reloadKey;
  if (reason) body.reason = reason;
  try {
    await fetch(`${baseUrl}/shutdown`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
  }
}
async function waitForPortFree(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!await fetchHealth(baseUrl)) return true;
    await delay(100);
  }
  return false;
}
function lavishListenerPids(baseUrl) {
  const { hostname, port } = new URL(baseUrl);
  try {
    const listing = spawnSync("lsof", ["-t", `-iTCP@${hostname}:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    if (listing.status !== 0) return [];
    const pids = [];
    for (const line of listing.stdout.split("\n")) {
      const pid = Number(line.trim());
      if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue;
      const command = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
      if (command.status === 0 && /lavish-axi/.test(command.stdout)) pids.push(pid);
    }
    return pids;
  } catch {
    return [];
  }
}
function listenerMatchesLavish(baseUrl) {
  return lavishListenerPids(baseUrl).length > 0;
}
function killLavishListener(baseUrl) {
  const pids = lavishListenerPids(baseUrl);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
    }
  }
  return pids.length > 0;
}
function unidentifiedListenerError(baseUrl) {
  const { host } = new URL(baseUrl);
  return new AxiError(
    `The server at ${host} did not shut down, and no Lavish process listening there could be identified`,
    "SERVER_ERROR",
    [`Stop the process listening on ${host} yourself, or set LAVISH_AXI_PORT to another port`]
  );
}
async function startServer(port, { alsoListen = [] } = {}) {
  await ensureStateDir();
  const entry = resolveServerEntry();
  let logFd = null;
  try {
    logFd = openSync(serverLogFile(), "a");
  } catch {
  }
  try {
    const args = [entry, "server", "--port", String(port)];
    for (const host of alsoListen) args.push("--also-listen", host);
    const child = spawn(process.execPath, args, createServerSpawnOptions(logFd));
    child.unref();
  } finally {
    if (logFd !== null) closeSync(logFd);
  }
}
function resolveServerEntry() {
  const sourceEntry = fileURLToPath4(new URL("../bin/lavish-axi-server.js", import.meta.url));
  if (existsSync3(sourceEntry)) return sourceEntry;
  return fileURLToPath4(new URL("./server.mjs", import.meta.url));
}
function createServerSpawnOptions(logFd = null) {
  const stdio = (
    /** @type {import("node:child_process").StdioOptions} */
    logFd === null ? "ignore" : ["ignore", logFd, logFd]
  );
  return {
    detached: true,
    stdio,
    env: { ...process.env, LAVISH_AXI_NO_OPEN: "1" }
  };
}
async function fetchJson(url, { retries = 0, retryDelayMs = 250, onResponse = null, method = "GET", headers, body } = {}) {
  let response;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await fetch(url, {
        method,
        ...headers ? { headers } : {},
        ...body === void 0 ? {} : { body }
      });
      break;
    } catch (error) {
      if (error instanceof AxiError) throw error;
      if (attempt >= retries) throw serverConnectionError();
      await delay(retryDelayMs);
    }
  }
  if (!response) throw serverConnectionError();
  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
    }
    if (payload?.code) {
      const holder = payload.code.startsWith("LISTENER_") && payload.holder;
      const holderDetail = holder && typeof holder.label === "string" && Number.isFinite(holder.age_ms) ? ` (current listener: ${holder.label}; active for ${Math.max(0, holder.age_ms)}ms)` : "";
      const error = new AxiError(
        `${payload.error || `Lavish Editor request failed: ${response.status}`}${holderDetail}`,
        payload.code,
        ["Use --takeover only when you intend to displace the current listener"]
      );
      if (holder) Object.assign(error, { holder });
      throw error;
    }
    throw new AxiError(`Lavish Editor request failed: ${response.status}`, "SERVER_ERROR");
  }
  onResponse?.(response);
  try {
    return await response.json();
  } catch {
    throw pollResponseInterruptedError();
  }
}
async function postJson(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw serverConnectionError();
  }
  if (!response.ok) {
    throw new AxiError(`Lavish Editor request failed: ${response.status}`, "SERVER_ERROR");
  }
  return response.json();
}
var AGENT_REPLY_RECEIPT_TIMEOUT_MS = 1e4;
async function postAgentReply(url, text, file, { timeoutMs = AGENT_REPLY_RECEIPT_TIMEOUT_MS } = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal
    });
  } catch {
    if (signal.aborted) throw agentReplyReceiptTimeoutError(file, timeoutMs);
    throw new AxiError("Lavish Editor server connection failed", "SERVER_ERROR", [
      "Run `lavish-axi server --verbose` or inspect `~/.lavish-axi/server.log` (`LAVISH_AXI_STATE_DIR/server.log` when set) for server startup or crash diagnostics",
      `Re-run \`lavish-axi reply ${file} --agent-reply "<message>"\` after the server is reachable`
    ]);
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    if (signal.aborted) throw agentReplyReceiptTimeoutError(file, timeoutMs);
  }
  if (response.status === 404) {
    throw new AxiError("No active Lavish Editor session for this file", "NOT_FOUND", [
      `Run \`lavish-axi ${file}\` first`
    ]);
  }
  if (response.status === 409 && payload?.status === "ended") {
    throw new AxiError("Lavish Editor session has ended; reply was not sent", "SESSION_ENDED", [
      createEndedNextStep(file, payload.ended_by)
    ]);
  }
  if (!response.ok || payload?.status !== "sent") {
    throw new AxiError(`Lavish Editor did not accept the agent reply (${response.status})`, "SERVER_ERROR", [
      `Confirm the session is open with \`lavish-axi ${file}\`, then re-run \`lavish-axi reply ${file}\``
    ]);
  }
  return payload;
}
function agentReplyReceiptTimeoutError(file, timeoutMs) {
  return new AxiError(
    `Lavish Editor did not confirm the agent reply within ${timeoutMs}ms, so acceptance is unknown`,
    "SERVER_ERROR",
    [
      "Run `lavish-axi server --verbose` or inspect `~/.lavish-axi/server.log` (`LAVISH_AXI_STATE_DIR/server.log` when set) for server diagnostics",
      `Check the Lavish Editor conversation for the reply before re-running \`lavish-axi reply ${file}\`, so it is not posted twice`
    ]
  );
}
function serverConnectionError() {
  return new AxiError("Lavish Editor server connection failed", "SERVER_ERROR", [
    "Run `lavish-axi server --verbose` or inspect `~/.lavish-axi/server.log` (`LAVISH_AXI_STATE_DIR/server.log` when set) for server startup or crash diagnostics",
    "Re-run the last `lavish-axi poll <html-file>` command after the server is healthy"
  ]);
}
function pollResponseInterruptedError() {
  return new AxiError("Lavish Editor poll response was interrupted", "SERVER_ERROR", [
    "Run `lavish-axi server --verbose` or inspect `~/.lavish-axi/server.log` (`LAVISH_AXI_STATE_DIR/server.log` when set) for server startup or crash diagnostics",
    "Re-run the last `lavish-axi poll <html-file>` command after the server is healthy"
  ]);
}
function firstPositionalArg(args, valueFlags = []) {
  const flags = new Set(valueFlags);
  let positionalMode = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!positionalMode && arg === "--") {
      positionalMode = true;
      continue;
    }
    if (!positionalMode && isValueFlagToken(arg, flags)) {
      if (!arg.includes("=")) i += 1;
      continue;
    }
    if (!positionalMode && arg.startsWith("-")) {
      continue;
    }
    return arg;
  }
  return null;
}
function flagValue(args, flag) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") return null;
    if (arg === flag) return args[i + 1] || null;
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1) || null;
  }
  return null;
}
function flagValues(args, flag) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") break;
    if (arg === flag && args[i + 1]) {
      values.push(args[i + 1]);
      i += 1;
    } else if (arg.startsWith(`${flag}=`) && arg.length > flag.length + 1) {
      values.push(arg.slice(flag.length + 1));
    }
  }
  return values;
}
function inspectValueFlag(args, flag) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") return { present: false };
    if (arg === flag) {
      return { present: true, value: i + 1 < args.length ? args[i + 1] : null, swallows: true };
    }
    if (arg.startsWith(`${flag}=`)) {
      return { present: true, value: arg.slice(flag.length + 1), swallows: false };
    }
  }
  return { present: false };
}
var AGENT_REPLY_FILE_HINT = "Pass --agent-reply-file <path>, or --agent-reply-file - to read stdin";
function agentReplyTooLargeError(suggestion) {
  return new AxiError(`Agent reply exceeds the ${AGENT_REPLY_LIMIT_LABEL}`, "VALIDATION_ERROR", [
    suggestion || "Shorten the reply, then retry the same poll command"
  ]);
}
async function readAgentReplyStream(stream, tooLargeHelp) {
  const chunks = [];
  let bytes = 0;
  for await (const value of stream) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    bytes += chunk.length;
    if (bytes > AGENT_REPLY_INPUT_LIMIT_BYTES) {
      stream.destroy();
      throw agentReplyTooLargeError(tooLargeHelp);
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks, bytes).toString("utf8");
  if (Buffer.byteLength(JSON.stringify({ agent_reply: text })) > AGENT_REPLY_JSON_LIMIT_BYTES) {
    throw agentReplyTooLargeError(tooLargeHelp);
  }
  return text;
}
async function resolveAgentReply(args, {
  createReadStreamFn = createReadStream,
  stdin = process.stdin,
  stdinIsTTY = process.stdin.isTTY === true,
  tooLargeHelp = void 0
} = {}) {
  const inline = inspectValueFlag(args, "--agent-reply");
  const fromFile = inspectValueFlag(args, "--agent-reply-file");
  if (inline.present && fromFile.present) {
    throw new AxiError("--agent-reply and --agent-reply-file cannot be combined", "VALIDATION_ERROR", [
      "Pass --agent-reply for a concise quoted reply, or --agent-reply-file <path> (`-` for stdin) when a longer Markdown body is necessary"
    ]);
  }
  if (fromFile.present) {
    return readAgentReplyFile(fromFile, { createReadStreamFn, stdin, stdinIsTTY, tooLargeHelp });
  }
  if (!inline.present) return null;
  return inline.value || null;
}
async function readAgentReplyFile(fromFile, { createReadStreamFn, stdin, stdinIsTTY, tooLargeHelp }) {
  if (fromFile.swallows && typeof fromFile.value === "string" && fromFile.value.startsWith("--")) {
    throw new AxiError(
      `--agent-reply-file was given no value: the next argument ${fromFile.value} is another flag, so it would have been used as the path`,
      "VALIDATION_ERROR",
      [AGENT_REPLY_FILE_HINT, "Use --agent-reply-file=<path> if the path itself starts with --"]
    );
  }
  const spec = fromFile.value;
  if (spec == null || !String(spec).trim()) {
    throw new AxiError("--agent-reply-file was given an empty value", "VALIDATION_ERROR", [AGENT_REPLY_FILE_HINT]);
  }
  let text;
  if (spec === "-") {
    if (stdinIsTTY) {
      throw new AxiError("--agent-reply-file - cannot read stdin from a terminal", "VALIDATION_ERROR", [
        "Pipe a Markdown body into stdin, or pass --agent-reply-file <path>"
      ]);
    }
    try {
      text = await readAgentReplyStream(stdin, tooLargeHelp);
    } catch (error) {
      if (error instanceof AxiError) throw error;
      const detail = error instanceof Error ? error.message : String(error);
      throw new AxiError(`Cannot read --agent-reply-file stdin: ${detail}`, "VALIDATION_ERROR", [
        "Pipe a Markdown body into stdin, or pass --agent-reply-file <path>"
      ]);
    }
  } else {
    try {
      text = await readAgentReplyStream(createReadStreamFn(spec), tooLargeHelp);
    } catch (error) {
      if (error instanceof AxiError) throw error;
      const detail = error instanceof Error ? error.message : String(error);
      throw new AxiError(`Cannot read --agent-reply-file ${spec}: ${detail}`, "VALIDATION_ERROR", [
        "Pass a UTF-8 Markdown file, or `-` to read stdin"
      ]);
    }
  }
  if (!String(text || "").trim()) {
    throw new AxiError("--agent-reply-file was empty", "VALIDATION_ERROR", [
      'Write Markdown into the file, or pass --agent-reply "<message>" for a concise reply'
    ]);
  }
  return String(text);
}
function isValueFlagToken(arg, flags) {
  for (const flag of flags) {
    if (arg === flag || arg.startsWith(`${flag}=`)) return true;
  }
  return false;
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getCommandHelp(command, { agent = "generic" } = {}) {
  return createCommandHelp({ agent })[command] || null;
}
function createTopLevelHelp({ agent = "generic" } = {}) {
  return `lavish-axi - Lavish Editor AXI

Usage:
  lavish-axi
  lavish-axi <html-file> [--no-open] [--no-gate] [--reopen]
  lavish-axi poll <html-file> [--owner <label>] [--takeover] [--agent-reply "..."] [--agent-reply-file <path>]
  lavish-axi reply <html-file> (--agent-reply "..." | --agent-reply-file <path>)
  lavish-axi end <html-file>
  lavish-axi export <html-file> [--out <path>]
  lavish-axi share <html-file> [--private | --password <pw>] [--token <t>]
  lavish-axi share <html-file> --site <site_id> --update-key <key> [--private | --password <pw>]
  lavish-axi share --unpublish --site <site_id> --update-key <key>
  lavish-axi stop
  lavish-axi playbook [playbook_id]
  lavish-axi design
  lavish-axi libraries [--search <text>] [--library <id>]
  lavish-axi setup hooks
  lavish-axi setup plugin

${DESIGN_SYSTEM_HINT}

Note: poll long-polls until the user sends feedback, ends the session, or leaves every review window disconnected past the reconnect grace period, staying silent while it waits - never kill it. Layout issues the browser detects are passive: they collect in the user's Layout issues inbox in the Lavish top bar and reach the agent only when the user selects them and queues the fixes, as an ordinary tag "layout-warnings" prompt. Do not pass --timeout-ms during normal agent use; it is for tests and debugging only. ${pollExecutionGuidance({ agent })} ${POLL_SEND_AND_END_RULE} Use \`lavish-axi reply\` when handing a result back without waiting for more feedback: it exits 0 only after the server accepts the reply, so the board stops showing Working. \`poll --agent-reply\` posts a reply and then keeps waiting.

`;
}
function createCommandHelp({ agent = "generic" } = {}) {
  return {
    open: `Usage: lavish-axi <html-file> [--no-open] [--no-gate] [--reopen]

Open or resume a Lavish Editor review session for an HTML artifact. Use --no-open when you need to ensure the server/session exists without opening another browser window. Use --no-gate to skip the open-time layout curtain for this browser open. If the user explicitly ended the session from the browser, this refuses to reopen it and returns guidance instead - pass --reopen to force it open when the user asks for further review or something important needs their visual attention. Sessions ended by the agent (\`lavish-axi end\`) reopen normally without the flag.
`,
    poll: `Usage: lavish-axi poll <html-file> [--owner <label>] [--takeover] [--agent-reply "..."] [--agent-reply-file <path>]

This command exclusively long-polls for queued user prompts. Pass --owner <label> to make the active listener visible in session listings; --takeover displaces an existing listener, which receives LISTENER_REPLACED. A second poll without --takeover fails with LISTENER_ACTIVE instead of silently returning waiting.

This command long-polls indefinitely for queued user prompts. It stays silent while it waits - that is normal, never kill it. Browser-detected layout issues do NOT return this poll: they are filed passively in the user's Layout issues inbox and arrive as an ordinary tag "layout-warnings" prompt only after the user selects them and queues the fixes. Warning lifecycle: an issue stays unresolved and counted while queued, becomes recurring if a newer artifact revision still shows it, and is resolved only after a newer artifact load plus a complete diagnostic pass at the same viewport no longer detects it. A failed or incomplete pass preserves it as unverified rather than clearing it. The only response that arrives without user action is artifact_failures - a fatal failure that made the review surface itself unusable. Do not pass --timeout-ms during normal agent use; it is for tests and debugging only. In a Herdr-managed pane, set LAVISH_AXI_HERDR_CHIME=1 to request attention when the poll has entered its waiting state; unset it or use any other value to keep the current silent behavior. Notification failures never interrupt the poll. ${pollExecutionGuidance({ agent })} Use --agent-reply after applying prior feedback to display a concise response in Lavish Editor before waiting again. When you are handing a result back and are not about to long-poll, run \`lavish-axi reply <html-file> --agent-reply "..."\` instead: that command exits 0 only after the server accepts the reply, so the board stops showing Working without this poll staying open. ${POLL_AGENT_REPLY_RULE} ${POLL_AGENT_REPLY_HELP_POINTER} Do not combine --agent-reply with --agent-reply-file.

Examples:
  lavish-axi poll report.html --agent-reply "Renamed the payment step."
  lavish-axi poll report.html --agent-reply-file reply.md
  lavish-axi poll report.html --agent-reply-file -

${POLL_SEND_AND_END_RULE}
`,
    reply: `Usage: lavish-axi reply <html-file> (--agent-reply "..." | --agent-reply-file <path>)

Post an agent reply to the open Lavish Editor session and exit once the server confirms it was accepted. Exit 0 only when the server answers that the reply was sent, which is when the board stops showing Working. If that answer does not arrive within ${AGENT_REPLY_RECEIPT_TIMEOUT_MS / 1e3} seconds, exit non-zero with a timeout error. Use this when you are handing a result back and are not about to wait for more feedback. A reply also marks every note the poll delivered to you as Done in the reviewer's panel, so reply once you have handled them.

Use \`lavish-axi poll <html-file> --agent-reply "..."\` instead when the reply should be followed by a long-poll. That command posts the reply and then keeps waiting, so it does not exit when the reply is accepted.

Pass exactly one of --agent-reply or --agent-reply-file. ${POLL_AGENT_REPLY_RULE} ${POLL_AGENT_REPLY_HELP_POINTER} Do not combine the two flags. An empty reply is refused.

Examples:
  lavish-axi reply report.html --agent-reply "Renamed the payment step."
  lavish-axi reply report.html --agent-reply-file reply.md
  lavish-axi reply report.html --agent-reply-file -
`,
    end: `Usage: lavish-axi end <html-file>

End a Lavish Editor session as the agent. A session ended this way still reopens normally on the next \`lavish-axi <html-file>\`, unlike a user ending it from the browser, which requires --reopen.
`,
    export: `Usage: lavish-axi export <html-file> [--out <path>]

Write a portable copy of an artifact: one HTML file with its LOCAL assets inlined (relative-path stylesheets, scripts, images, and fonts become inline <style>/<script> blocks and data URIs). Remote CDN/font references (https URLs) are left as links for the browser to load, so the file needs network to render those. Lavish makes no outbound requests - it only reads local files, confined to the artifact's directory. Defaults to writing <name>.export.html next to the source; pass --out to choose a path. The Lavish annotation SDK is never included in an export.
`,
    share: `Usage:
  lavish-axi share <html-file> [--private | --password <pw>] [--token <t>]
  lavish-axi share <html-file> --site <site_id> --update-key <key> [--private | --password <pw>]
  lavish-axi share --unpublish --site <site_id> --update-key <key>

Publish the artifact on ht-ml.app (https://ht-ml.app), a third-party hosting service not part of Lavish, and print a visitable URL. Shares are PUBLIC by default: anyone with the link can open the page, and it may be indexed or scraped. Pass --private to publish a PRIVATE page behind a generated password, returned once in the output - give it to the user with the URL and tell them it is a shared secret. Pass --password <pw> instead when the user chose the password; it is never echoed back. Builds the same local-inlined HTML as 'export' (local assets inlined; remote CDN/font URLs left as links and are not blocked by CSP on ht-ml.app, but still load over the viewer's network), then POSTs it to ht-ml.app's /v1 API. Creating a site needs no account or API key. The response includes the url plus a secret update_key (shown once) for changing the page later.

--site <site_id> with --update-key <key> republishes an existing page in place: same URL, new HTML. On a republish the password is left alone unless you pass --private (rotate to a new generated one) or --password <pw> (set one). There is no way to make a private page public again: ht-ml.app accepts a request to clear a password and silently ignores it, so Lavish does not offer one rather than reporting a page as public while it is still gated. Locking a page that was PUBLIC is also not instant at ht-ml.app's CDN: it was observed still answering uncredentialed requests for minutes after the password was set, so do not tell the user a newly gated page is unreachable right away (a page that was already private has no such cached copy).

--unpublish takes the same credentials and no file. ht-ml.app has NO delete endpoint, so this replaces the page with a short placeholder and locks it behind a random password that is immediately discarded; the URL still resolves and the host still holds what was published. Say that to the user rather than calling it deleted. The update_key still works, so republishing with --private brings the page back behind a new password.

A value flag given an empty or whitespace-only value is REFUSED rather than acted on: an unquoted shell variable that is unset makes \`--password $PW\` an empty password, which the host treats as none and would publish a PUBLIC page while you believed it was gated. Quote the value, or pass --private to have Lavish generate one.

Set LAVISH_AXI_HTML_APP_TOKEN (or pass --token) to attach an optional bearer token when CREATING a page; it is never required. A republish (--site/--update-key) or --unpublish rejects --token, because the update_key is what the Authorization header carries there. The annotation SDK is never included.
`,
    stop: `Usage: lavish-axi stop [--port <port>]

Shut down the background Lavish Editor server. The server also stops itself when no browser or poll has been connected for a while (LAVISH_AXI_IDLE_TIMEOUT_MS, default 30m) and immediately when the last session ends with nothing connected.
`,
    playbook: `Usage: lavish-axi playbook [playbook_id]

List focused artifact guidance playbooks, or show one playbook by ID. Known IDs: diagram, table, comparison, plan, code, input, explanation, slides.

${PLAYBOOK_ROUTER_HELP}

Examples:
  lavish-axi playbook
  lavish-axi playbook diagram
  lavish-axi playbook input
`,
    libraries: `Usage: lavish-axi libraries [--search <text>] [--library <id>]

List the Excalidraw libraries (.excalidrawlib files) the user copied into ~/.lavish-axi/excalidraw-libraries, or LAVISH_AXI_STATE_DIR/excalidraw-libraries when set. Their items appear in every whiteboard's library panel. --search lists item refs whose ref contains every search word; --library lists one library's item refs. Lavish only reads this directory and never downloads libraries.

Examples:
  lavish-axi libraries
  lavish-axi libraries --search lambda
  lavish-axi libraries --library aws-architecture-icons
`,
    design: `Usage: lavish-axi design

Show a copy-pasteable CDN snippet for Tailwind CSS browser runtime v4 + DaisyUI v5 + themes, the whiteboard (Mermaid) opt-in snippet, a content-to-playbook router, an optional layout safety CSS snippet, plus technical reference for DaisyUI components. ${PLAYBOOK_ROUTER_HELP} Lavish artifacts stay portable HTML. This CDN snippet is the design fallback, not the default: inspect the subject project before falling back, and paste the layout safety CSS only when useful for dense nested grid/flex layouts, badges, wide fonts, or local media. ${DESIGN_PRIORITY_RULE}
`,
    setup: `Usage: lavish-axi setup hooks
       lavish-axi setup plugin

hooks: install or repair agent SessionStart hooks for lavish-axi ambient context in Claude Code, Codex, OpenCode, and GitHub Copilot CLI. Restart your agent session afterward to receive the context. This is the primary integration - it carries live session state.

plugin: register the installed lavish-axi package as an Agent Plugin (agent-plugins.org) in VS Code, Cursor, and GitHub Copilot CLI. The installed package directory is itself the plugin root, so nothing is downloaded and no marketplace is involved. Reload each client afterward. Codex users should use \`setup hooks\` instead.

Both actions are explicit opt-in, idempotent, and repair a stale path after a reinstall.
`,
    server: `Usage: lavish-axi server [--port 4387] [--verbose] [--also-listen <host>...]

Run the local Lavish Editor server. Pass --verbose (or set LAVISH_AXI_DEBUG=1) to log session and watcher events to stderr. Detached server output is appended to ~/.lavish-axi/server.log, or LAVISH_AXI_STATE_DIR/server.log when set, for startup and crash diagnostics.

By default Lavish binds to 127.0.0.1 and, when Tailscale is running, this machine's Tailscale IPv4. Any explicit LAVISH_AXI_HOST overrides automatic Tailscale binding; wildcard values such as 0.0.0.0 or :: are restricted to loopback. An explicit non-wildcard LAVISH_AXI_HOST sets the bind address, and the server also listens on 127.0.0.1 so every local CLI finds it; --also-listen adds further concrete addresses (the CLI passes it when it replaces a server, to keep every address the old one served). An address that cannot be bound is retried in the background and reported as network_warning. Binding beyond loopback exposes an unauthenticated server that can read and serve arbitrary local files to anything that can reach it, so only do so on a trusted network. With automatic binding enabled, a successfully bound Tailscale listener uses its MagicDNS name in generated session links; otherwise LAVISH_AXI_LINK_HOST can set the link hostname. See README's Allowed hosts section for Host allowlisting and LAVISH_AXI_ALLOWED_HOSTS. LAVISH_AXI_NO_OPEN=1 (or --no-open) suppresses the local browser launch.
`
  };
}

// bin/lavish-axi.js
await run(process.argv.slice(2));
