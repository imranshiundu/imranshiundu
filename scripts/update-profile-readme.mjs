import fs from "node:fs/promises";

const username        = process.env.GITHUB_USERNAME || "imranshiundu";
const githubToken     = process.env.GITHUB_TOKEN || "";
const groqKey         = process.env.GROQ_API_KEY || "";
const groqModel       = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const readmePath        = new URL("../README.md",                    import.meta.url);
const activityPath      = new URL("../docs/GITHUB_ACTIVITY.md",      import.meta.url);
const projectsPath      = new URL("../data/projects.json",           import.meta.url);
const codingSystemPath  = new URL("../docs/CODING_SYSTEM.md",        import.meta.url);

// ─── Utilities ───────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}, timeoutMs = 14000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function replaceBlock(source, name, replacement) {
  const start   = `<!-- ${name}:START -->`;
  const end     = `<!-- ${name}:END -->`;
  const pattern = new RegExp(`${esc(start)}[\\s\\S]*?${esc(end)}`);
  if (!pattern.test(source)) throw new Error(`Missing markers for ${name}`);
  return source.replace(pattern, `${start}\n${replacement.trim()}\n${end}`);
}

function esc(v) { return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ─── GitHub API ───────────────────────────────────────────────────────────────

async function githubFetch(path) {
  const res = await fetchWithTimeout(`https://api.github.com${path}`, {
    headers: {
      "Accept":     "application/vnd.github+json",
      "User-Agent": `${username}-profile-bot`,
      ...(githubToken ? { "Authorization": `Bearer ${githubToken}` } : {})
    }
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  return res.json();
}

async function getPublicSignal() {
  try {
    const [user, repos, events] = await Promise.all([
      githubFetch(`/users/${username}`),
      githubFetch(`/users/${username}/repos?sort=updated&per_page=100&type=public`),
      githubFetch(`/users/${username}/events/public?per_page=50`)
    ]);

    const ownRepos   = repos.filter(r => !r.fork && !r.private);
    const totalStars = ownRepos.reduce((s, r) => s + (r.stargazers_count || 0), 0);

    // Top languages by repo count
    const langMap = {};
    ownRepos.forEach(r => { if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1; });
    const topLangs = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([l]) => `\`${l}\``).join(" · ");

    // Recent meaningful pushes — own repos, exclude profile repo, exclude bot/merge commits
    const pushEvents = events.filter(e =>
      e.type === "PushEvent" &&
      e.repo?.name?.startsWith(`${username}/`) &&
      e.repo?.name !== `${username}/${username}`
    );

    const recentCommits = pushEvents
      .flatMap(e => {
        const repo = e.repo.name.replace(`${username}/`, "");
        return (e.payload?.commits || [])
          .filter(c => c.message && !c.message.startsWith("Merge") && !c.message.includes("[skip ci]") && !c.message.includes("generated"))
          .map(c => ({ repo, message: c.message.split("\n")[0], date: e.created_at }));
      })
      .slice(0, 8);

    const recentPushesText = recentCommits.slice(0, 4)
      .map(c => `- \`${c.repo}\` — ${c.message}`)
      .join("\n") || "- No recent public commits found";

    const activeRepos = [...new Set(pushEvents.map(e => e.repo.name.replace(`${username}/`, "")))].slice(0, 6);

    return {
      publicRepos: user.public_repos,
      followers:   user.followers,
      totalStars,
      topLangs,
      recentCommits,
      recentPushesText,
      activeRepos,
      latestRepoNames: ownRepos.slice(0, 6).map(r => `${r.name}${r.language ? ` (${r.language})` : ""}`).join(", ")
    };
  } catch (err) {
    console.warn("GitHub signal failed:", err.message);
    return {
      publicRepos: "—", followers: "—", totalStars: "—", topLangs: "—",
      recentCommits: [], recentPushesText: "- API unavailable",
      activeRepos: [], latestRepoNames: ""
    };
  }
}

// ─── Groq AI Engine ───────────────────────────────────────────────────────────

async function groqComplete(systemPrompt, userPrompt, maxTokens = 120, temperature = 0.4) {
  if (!groqKey) return null;
  try {
    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   }
        ],
        temperature,
        max_tokens: maxTokens
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.warn("Groq call failed:", err.message);
    return null;
  }
}

// ─── AI: Daily Status Snapshot ────────────────────────────────────────────────
// One punchy line summarising Imran's current velocity. Shows up at top of profile.

async function getAiSnapshot(signal) {
  const fallback = `> Shipping daily — ${signal.publicRepos} public repos · ${signal.totalStars} ⭐ total.`;

  const result = await groqComplete(
    "You write brutally honest, non-hype GitHub profile status lines. One sentence. Max 30 words. No emojis. No quotes. Present tense.",
    `Developer: Imran Shiundu — full-stack engineer + AI systems builder from Kenya.
Public repos: ${signal.publicRepos}. Stars: ${signal.totalStars}.
Active repos this week: ${signal.activeRepos.slice(0, 4).join(", ")}.
Recent commits: ${signal.recentCommits.slice(0, 4).map(c => c.message).join(" | ")}.
Write one status line about what this developer is currently doing and shipping.`
  );

  return result ? `> ${result.replace(/^>\s*/, "")}` : fallback;
}

// ─── AI: Current Focus ────────────────────────────────────────────────────────
// Detects what Imran is actually working on right now from commit patterns.

async function getAiCurrentFocus(signal) {
  const fallback = signal.activeRepos.length > 0
    ? `**Currently active on:** ${signal.activeRepos.slice(0, 3).join(", ")}`
    : "**Currently active:** building in private.";

  if (signal.recentCommits.length === 0) return fallback;

  const commitSummary = signal.recentCommits.slice(0, 6)
    .map(c => `[${c.repo}] ${c.message}`).join("\n");

  const result = await groqComplete(
    "You analyze developer commit history and write a factual, specific 1-sentence focus statement. Max 25 words. No hype. No emojis. Start with a verb (e.g. Building, Shipping, Refactoring, Designing, Integrating).",
    `Commits from the last few days:\n${commitSummary}\n\nWhat is this developer currently focused on building or fixing? Be specific about the domain or technology.`,
    80, 0.3
  );

  return result
    ? `**Current focus:** ${result.replace(/^(Building|Shipping|Refactoring|Designing|Integrating)\s/i, (m) => m)}`
    : fallback;
}

// ─── Render: GitHub Signal Block ─────────────────────────────────────────────

async function renderGithubSignal(signal) {
  const now = new Date().toUTCString();

  const currentFocus = await getAiCurrentFocus(signal);

  const statsRow = [
    `<td align="center"><b>📦 Public Repos</b><br/><b>${signal.publicRepos}</b></td>`,
    `<td align="center"><b>👥 Followers</b><br/><b>${signal.followers}</b></td>`,
    `<td align="center"><b>⭐ Total Stars</b><br/><b>${signal.totalStars}</b></td>`,
    `<td align="center"><b>🔤 Top Languages</b><br/>${signal.topLangs}</td>`
  ].join("\n");

  const lines = [
    `<table><tr>`,
    statsRow,
    `</tr></table>`,
    ``,
    currentFocus,
    ``,
    `**📬 Recent commits:**`,
    signal.recentPushesText,
    ``,
    `<sub>Auto-refreshed by GitHub Actions · ${now}</sub>`
  ].filter(l => l !== null);

  return lines.join("\n");
}

// ─── Render: AI Snapshot ──────────────────────────────────────────────────────

async function renderAiSnapshot(signal) {
  return getAiSnapshot(signal);
}

// ─── Render: Projects ─────────────────────────────────────────────────────────

function renderProjectCards(projects) {
  const cells = projects.map(p => {
    const tags = p.tags.map(t => `\`${t}\``).join(" ");
    const link = p.url ? `\n\n[Open project](${p.url})` : "";
    return `<td width="50%" valign="top">\n\n### ${p.name}\n${p.description}\n\n${tags}${link}\n\n</td>`;
  });
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>\n${cells[i]}\n${cells[i + 1] || '<td width="50%" valign="top"></td>'}\n</tr>`);
  }
  return `<table>\n${rows.join("\n")}\n</table>`;
}

// ─── Render: Coding System ────────────────────────────────────────────────────

async function renderCodingSystem() {
  try {
    const raw = await fs.readFile(codingSystemPath, "utf8");
    const ruleMatch = raw.match(/## The rule\n\n([\s\S]*?)(?=\n##)/);
    const antiMatch = raw.match(/## Anti-patterns\n\n([\s\S]*?)(?=\n##)/);
    const rule = ruleMatch?.[1]?.trim() ?? "";
    const anti = antiMatch?.[1]?.trim()
      .split("\n").filter(l => l.startsWith("-")).slice(0, 3)
      .map(l => l.replace(/^-\s*/, "")).join(" · ") ?? "";
    return [
      rule  ? `> ${rule}` : "",
      anti  ? `\n**Avoid:** ${anti}` : "",
      `\n→ [Full system: docs/CODING_SYSTEM.md](./docs/CODING_SYSTEM.md)`
    ].join("\n");
  } catch {
    return `→ [Full system: docs/CODING_SYSTEM.md](./docs/CODING_SYSTEM.md)`;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching GitHub signal...");
  const [readme, activityPage, projects, signal] = await Promise.all([
    fs.readFile(readmePath,   "utf8"),
    fs.readFile(activityPath, "utf8"),
    fs.readFile(projectsPath, "utf8").then(JSON.parse),
    getPublicSignal()
  ]);

  console.log(`Signal: ${signal.publicRepos} repos · ${signal.followers} followers · ${signal.totalStars} stars`);
  console.log("Running AI generation...");

  const [aiSnapshot, githubSignal, codingSystem] = await Promise.all([
    renderAiSnapshot(signal),
    renderGithubSignal(signal),
    renderCodingSystem()
  ]);

  // Update README.md
  let updatedReadme = readme;
  updatedReadme = replaceBlock(updatedReadme, "PROJECTS",      renderProjectCards(projects));
  updatedReadme = replaceBlock(updatedReadme, "AI-SNAPSHOT",   aiSnapshot);
  updatedReadme = replaceBlock(updatedReadme, "GITHUB-SIGNAL", githubSignal);
  updatedReadme = replaceBlock(updatedReadme, "CODING-SYSTEM", codingSystem);
  await fs.writeFile(readmePath, updatedReadme, "utf8");
  console.log("✓ README.md blocks refreshed.");

  // Update docs/GITHUB_ACTIVITY.md — only the GITHUB-SIGNAL block
  const updatedActivity = replaceBlock(activityPage, "GITHUB-SIGNAL", githubSignal);
  await fs.writeFile(activityPath, updatedActivity, "utf8");
  console.log("✓ docs/GITHUB_ACTIVITY.md signal refreshed.");
}

main().catch(err => { console.error(err); process.exit(1); });
