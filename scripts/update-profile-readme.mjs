import fs from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "imranshiundu";
const githubToken = process.env.GITHUB_TOKEN || "";
const groqKey = process.env.GROQ_API_KEY || "";
const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const readmePath = new URL("../README.md", import.meta.url);
const activityPath = new URL("../docs/GITHUB_ACTIVITY.md", import.meta.url);
const codingSystemPath = new URL("../docs/CODING_SYSTEM.md", import.meta.url);
const languageSvgPath = new URL("../profile-3d-contrib/language-pulse.svg", import.meta.url);

const languagePalette = ["#8b5cf6", "#22c55e", "#38bdf8", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6"];

async function fetchWithTimeout(url, options = {}, timeoutMs = 14000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function esc(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceBlock(source, name, replacement) {
  const start = `<!-- ${name}:START -->`;
  const end = `<!-- ${name}:END -->`;
  const pattern = new RegExp(`${esc(start)}[\\s\\S]*?${esc(end)}`);
  if (!pattern.test(source)) throw new Error(`Missing markers for ${name}`);
  return source.replace(pattern, `${start}\n${replacement.trim()}\n${end}`);
}

async function githubFetch(path) {
  const res = await fetchWithTimeout(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `${username}-profile-bot`,
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {})
    }
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  return res.json();
}

async function getAllPublicRepos() {
  const repos = [];
  for (let page = 1; page <= 5; page += 1) {
    const batch = await githubFetch(`/users/${username}/repos?sort=updated&per_page=100&type=public&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter((repo) => !repo.fork && !repo.private);
}

function sentenceCaseList(items) {
  return items.length > 0 ? items.join(", ") : "private systems";
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function getRepoLanguages(repoName) {
  try {
    return await githubFetch(`/repos/${username}/${repoName}/languages`);
  } catch {
    return {};
  }
}

async function getLanguageTotals(ownRepos) {
  const languageTotals = {};
  const repos = ownRepos.slice(0, 120);
  const chunkSize = 10;

  for (let i = 0; i < repos.length; i += chunkSize) {
    const chunk = repos.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((repo) => getRepoLanguages(repo.name)));
    results.forEach((languageMap) => {
      Object.entries(languageMap).forEach(([language, bytes]) => {
        languageTotals[language] = (languageTotals[language] || 0) + bytes;
      });
    });
  }

  return languageTotals;
}

async function getPublicSignal() {
  try {
    const [user, ownRepos, events] = await Promise.all([
      githubFetch(`/users/${username}`),
      getAllPublicRepos(),
      githubFetch(`/users/${username}/events/public?per_page=50`)
    ]);

    const totalStars = ownRepos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
    const languageTotals = await getLanguageTotals(ownRepos);

    const pushEvents = events.filter((event) =>
      event.type === "PushEvent" &&
      event.repo?.name?.startsWith(`${username}/`) &&
      event.repo?.name !== `${username}/${username}`
    );

    const recentCommits = pushEvents
      .flatMap((event) => {
        const repo = event.repo.name.replace(`${username}/`, "");
        return (event.payload?.commits || [])
          .filter((commit) =>
            commit.message &&
            !commit.message.startsWith("Merge") &&
            !commit.message.includes("[skip ci]") &&
            !commit.message.includes("generated")
          )
          .map((commit) => ({ repo, message: commit.message.split("\n")[0], date: event.created_at }));
      })
      .slice(0, 8);

    const activeRepos = [...new Set(pushEvents.map((event) => event.repo.name.replace(`${username}/`, "")))].slice(0, 4);

    return { publicRepos: user.public_repos, followers: user.followers, totalStars, languageTotals, recentCommits, activeRepos };
  } catch (err) {
    console.warn("GitHub signal failed:", err.message);
    return { publicRepos: "Unavailable", followers: "Unavailable", totalStars: "Unavailable", languageTotals: {}, recentCommits: [], activeRepos: [] };
  }
}

async function groqComplete(systemPrompt, userPrompt, maxTokens = 90, temperature = 0.3) {
  if (!groqKey) return null;
  try {
    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: groqModel,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
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

async function getAiSnapshot(signal) {
  const fallback = `> Building and shipping practical systems across ${sentenceCaseList(signal.activeRepos)}.`;
  const result = await groqComplete(
    "Write one factual GitHub profile status line. Max 22 words. No emojis. No hype. Do not call the developer a founder. Do not mention location. No quotes.",
    `Developer: Imran Shiundu. Software engineer. Active repositories: ${signal.activeRepos.join(", ")}. Recent commits: ${signal.recentCommits.map((commit) => commit.message).slice(0, 4).join(" | ")}. Write one current status line.`
  );
  return result ? `> ${result.replace(/^>\s*/, "")}` : fallback;
}

function renderRecentCommits(signal) {
  if (signal.recentCommits.length === 0) return "No recent public commits found.";
  return signal.recentCommits.slice(0, 4).map((commit) => `${commit.repo}: ${commit.message}`).join("<br/>\n");
}

function renderLanguageSvg(languageTotals) {
  const entries = Object.entries(languageTotals)
    .filter(([, bytes]) => bytes > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (entries.length === 0) {
    return `<svg width="720" height="132" viewBox="0 0 720 132" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Language activity awaiting GitHub data">
  <rect width="720" height="132" rx="18" fill="#0d1117"/>
  <text x="28" y="42" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Language activity</text>
  <text x="28" y="70" fill="#94a3b8" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13">Waiting for GitHub Actions to fetch public repository language data.</text>
  <rect x="28" y="92" width="664" height="12" rx="6" fill="#30363d"/>
</svg>\n`;
  }

  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  let x = 28;
  const barY = 82;
  const barHeight = 18;
  const barWidth = 664;

  const segments = entries.map(([language, bytes], index) => {
    const width = Math.max((bytes / total) * barWidth, index === entries.length - 1 ? 0 : 18);
    const segment = `<rect x="${x.toFixed(2)}" y="${barY}" width="${width.toFixed(2)}" height="${barHeight}" rx="9" fill="${languagePalette[index % languagePalette.length]}"><animate attributeName="opacity" values="0.72;1;0.72" dur="${(2.4 + index * 0.24).toFixed(2)}s" repeatCount="indefinite"/></rect>`;
    x += width;
    return segment;
  }).join("\n  ");

  const labels = entries.map(([language, bytes], index) => {
    const pct = Math.round((bytes / total) * 100);
    const labelX = 30 + (index % 3) * 210;
    const labelY = 124 + Math.floor(index / 3) * 18;
    return `<g><circle cx="${labelX}" cy="${labelY - 4}" r="4" fill="${languagePalette[index % languagePalette.length]}"/><text x="${labelX + 10}" y="${labelY}" fill="#e2e8f0" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12">${escapeXml(language)} ${pct}%</text></g>`;
  }).join("\n  ");

  return `<svg width="720" height="160" viewBox="0 0 720 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Language activity generated from public repository language data">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0d1117"/><stop offset="100%" stop-color="#161b22"/></linearGradient></defs>
  <rect width="720" height="160" rx="18" fill="url(#bg)"/>
  <text x="28" y="38" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Language activity</text>
  <text x="28" y="61" fill="#94a3b8" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12">Generated from GitHub public repository language bytes</text>
  <rect x="28" y="82" width="664" height="18" rx="9" fill="#30363d"/>
  ${segments}
  ${labels}
</svg>\n`;
}

async function renderGithubSignal(signal) {
  const now = new Date().toUTCString();
  return `<table width="100%">
<tr>
<td align="center" width="33%"><strong>Public repositories</strong><br/>${signal.publicRepos}</td>
<td align="center" width="33%"><strong>Followers</strong><br/>${signal.followers}</td>
<td align="center" width="33%"><strong>Total stars</strong><br/>${signal.totalStars}</td>
</tr>
</table>

<strong>Recent public commits:</strong><br/>
${renderRecentCommits(signal)}

<sub>Auto-refreshed by GitHub Actions · ${now}</sub>`;
}

async function renderCodingSystem() {
  try {
    const raw = await fs.readFile(codingSystemPath, "utf8");
    const ruleMatch = raw.match(/## The rule\n\n([\s\S]*?)(?=\n##)/);
    const rule = ruleMatch?.[1]?.trim();
    return `${rule || "Define one useful outcome. Build the smallest working improvement. Test the behavior before expanding the scope. Document the decision so another developer can continue."}

[Read the full coding system](./docs/CODING_SYSTEM.md)`;
  } catch {
    return "Define one useful outcome. Build the smallest working improvement. Test the behavior before expanding the scope. Document the decision so another developer can continue.";
  }
}

async function main() {
  console.log("Fetching GitHub signal...");
  const [readme, activityPage, signal] = await Promise.all([fs.readFile(readmePath, "utf8"), fs.readFile(activityPath, "utf8"), getPublicSignal()]);
  const [aiSnapshot, githubSignal, codingSystem] = await Promise.all([getAiSnapshot(signal), renderGithubSignal(signal), renderCodingSystem()]);

  let updatedReadme = readme;
  updatedReadme = replaceBlock(updatedReadme, "AI-SNAPSHOT", aiSnapshot);
  updatedReadme = replaceBlock(updatedReadme, "GITHUB-SIGNAL", githubSignal);
  updatedReadme = replaceBlock(updatedReadme, "CODING-SYSTEM", codingSystem);

  await fs.writeFile(languageSvgPath, renderLanguageSvg(signal.languageTotals), "utf8");
  await fs.writeFile(readmePath, updatedReadme, "utf8");
  const updatedActivity = replaceBlock(activityPage, "GITHUB-SIGNAL", githubSignal);
  await fs.writeFile(activityPath, updatedActivity, "utf8");
  console.log("README, docs activity, and language SVG refreshed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
