import fs from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "imranshiundu";
const githubToken = process.env.GITHUB_TOKEN || "";
const groqKey = process.env.GROQ_API_KEY || "";
const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const readmePath = new URL("../README.md", import.meta.url);
const projectsPath = new URL("../data/projects.json", import.meta.url);
const codingSystemPath = new URL("../docs/CODING_SYSTEM.md", import.meta.url);

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function replaceBlock(source, name, replacement) {
  const start = `<!-- ${name}:START -->`;
  const end = `<!-- ${name}:END -->`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (!pattern.test(source)) {
    throw new Error(`Missing block markers for ${name}. Expected ${start} and ${end}.`);
  }
  return source.replace(pattern, `${start}\n${replacement.trim()}\n${end}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function githubFetch(path) {
  const response = await fetchWithTimeout(`https://api.github.com${path}`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": `${username}-profile-readme-bot`,
      ...(githubToken ? { "Authorization": `Bearer ${githubToken}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status} for ${path}: ${await response.text()}`);
  }

  return response.json();
}

async function getPublicSignal() {
  try {
    const [user, repos, events] = await Promise.all([
      githubFetch(`/users/${username}`),
      githubFetch(`/users/${username}/repos?sort=updated&per_page=100`),
      githubFetch(`/users/${username}/events/public?per_page=30`)
    ]);

    const ownRepos = repos.filter((r) => !r.fork);

    const totalStars = ownRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    const topRepos = ownRepos
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 5)
      .map((r) => `- **${r.name}**${r.language ? ` \`${r.language}\`` : ""}${r.stargazers_count ? ` ⭐ ${r.stargazers_count}` : ""}`)
      .join("\n");

    const recentPushes = events
      .filter((e) => e.type === "PushEvent")
      .slice(0, 3)
      .map((e) => {
        const repo = e.repo?.name?.replace(`${username}/`, "") || "unknown";
        const msg = e.payload?.commits?.[0]?.message?.split("\n")[0] || "pushed";
        return `- \`${repo}\`: ${msg}`;
      })
      .join("\n");

    const langMap = {};
    ownRepos.forEach((r) => {
      if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1;
    });
    const topLangs = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => `\`${lang}\` ×${count}`)
      .join("  ");

    return {
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      totalStars,
      topLangs,
      topRepos: topRepos || "- No public repositories found",
      recentPushes: recentPushes || "- No recent pushes",
      latestRepos: topRepos || "- GitHub API unavailable during this run"
    };
  } catch (error) {
    console.warn(error.message);
    return {
      publicRepos: "unknown",
      followers: "unknown",
      following: "unknown",
      totalStars: "unknown",
      topLangs: "",
      topRepos: "- GitHub API unavailable during this run",
      recentPushes: "- GitHub API unavailable during this run",
      latestRepos: "- GitHub API unavailable during this run"
    };
  }
}

function renderGithubSignal(signal) {
  const now = new Date().toUTCString();
  if (signal.publicRepos === "unknown") {
    return `> ⚠️ GitHub API was unavailable during this run. Stats will update on the next refresh.\n\n*Last attempted: ${now}*`;
  }

  return [
    `<table>`,
    `<tr>`,
    `<td align="center"><b>📦 Public Repos</b><br/><b>${signal.publicRepos}</b></td>`,
    `<td align="center"><b>👥 Followers</b><br/><b>${signal.followers}</b></td>`,
    `<td align="center"><b>⭐ Total Stars</b><br/><b>${signal.totalStars}</b></td>`,
    `<td align="center"><b>🔤 Top Languages</b><br/>${signal.topLangs}</td>`,
    `</tr>`,
    `</table>`,
    ``,
    `**🏆 Most starred repos:**`,
    signal.topRepos,
    ``,
    `**📬 Recent pushes:**`,
    signal.recentPushes,
    ``,
    `<sub>Auto-refreshed by GitHub Actions · ${now}</sub>`
  ].join("\n");
}

async function getAiSnapshot(signal) {
  const repoPhrase = signal.publicRepos === "unknown" ? "" : ` ${signal.publicRepos} public repos, ${signal.totalStars} total stars.`;
  const fallback = `> Current operating mode: ship one real improvement today.${repoPhrase} Keep the commit meaningful, small, and reviewable.`;

  if (!groqKey) return fallback;

  const prompt = `Write one short professional GitHub profile status for Imran Shiundu. Make it honest, motivating, and non-hype. Mention daily shipping and useful systems. Max 32 words. No emojis. Latest public signal:\n${signal.latestRepos}`;

  try {
    const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: "system", content: "You write concise, serious GitHub README status lines." },
          { role: "user", content: prompt }
        ],
        temperature: 0.35,
        max_tokens: 90
      })
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return fallback;
    return `> ${text.replace(/^>\s*/, "")}`;
  } catch (error) {
    console.warn(`Groq snapshot skipped: ${error.message}`);
    return fallback;
  }
}

function renderProjectCards(projects) {
  const cells = projects.map((project) => {
    const tags = project.tags.map((tag) => `\`${tag}\``).join(" ");
    const link = project.url ? `\n\n[Open project](${project.url})` : "";
    return `<td width="50%" valign="top">\n\n### ${project.name}\n${project.description}\n\n${tags}${link}\n\n</td>`;
  });

  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>\n${cells[i]}\n${cells[i + 1] || '<td width="50%" valign="top"></td>'}\n</tr>`);
  }
  return `<table>\n${rows.join("\n")}\n</table>`;
}

async function renderCodingSystem() {
  try {
    const raw = await fs.readFile(codingSystemPath, "utf8");
    // Extract just "The rule" and "Daily workflow" sections for embedding
    const ruleMatch = raw.match(/## The rule\n\n([\s\S]*?)(?=\n##)/);
    const dailyMatch = raw.match(/### 1\. Pick one task\n\n([\s\S]*?)(?=\n### 2)/);
    const antiMatch = raw.match(/## Anti-patterns\n\n([\s\S]*?)(?=\n##)/);

    const rule = ruleMatch ? ruleMatch[1].trim() : "";
    const daily = dailyMatch ? dailyMatch[1].trim() : "";
    const anti = antiMatch ? antiMatch[1].trim() : "";

    return [
      rule ? `**The rule:** ${rule}` : "",
      "",
      daily ? `**Pick one task — small enough to finish today:**\n${daily}` : "",
      "",
      anti ? `**Avoid these anti-patterns:**\n${anti}` : "",
      "",
      `<sub>Source: [docs/CODING_SYSTEM.md](./docs/CODING_SYSTEM.md)</sub>`
    ].filter(Boolean).join("\n");
  } catch {
    return `> See [docs/CODING_SYSTEM.md](./docs/CODING_SYSTEM.md) for the full daily coding system.`;
  }
}

async function main() {
  const readme = await fs.readFile(readmePath, "utf8");
  const projects = JSON.parse(await fs.readFile(projectsPath, "utf8"));
  const signal = await getPublicSignal();
  const aiSnapshot = await getAiSnapshot(signal);
  const codingSystem = await renderCodingSystem();

  let updated = readme;
  updated = replaceBlock(updated, "PROJECTS", renderProjectCards(projects));
  updated = replaceBlock(updated, "AI-SNAPSHOT", aiSnapshot);
  updated = replaceBlock(updated, "GITHUB-SIGNAL", renderGithubSignal(signal));
  updated = replaceBlock(updated, "CODING-SYSTEM", codingSystem);

  await fs.writeFile(readmePath, updated, "utf8");
  console.log("README generated blocks refreshed.");
  console.log(`Signal: ${signal.publicRepos} repos · ${signal.followers} followers · ${signal.totalStars} stars`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
