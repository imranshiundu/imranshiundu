import fs from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "imranshiundu";
const githubToken = process.env.GITHUB_TOKEN || "";
const groqKey = process.env.GROQ_API_KEY || "";
const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const readmePath = new URL("../README.md", import.meta.url);
const activityPath = new URL("../docs/GITHUB_ACTIVITY.md", import.meta.url);
const codingSystemPath = new URL("../docs/CODING_SYSTEM.md", import.meta.url);

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

  if (!pattern.test(source)) {
    throw new Error(`Missing markers for ${name}`);
  }

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

  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${path}`);
  }

  return res.json();
}

function cleanLanguageList(topLangs) {
  return topLangs || "Unavailable";
}

function sentenceCaseList(items) {
  return items.length > 0 ? items.join(", ") : "Building in private";
}

async function getPublicSignal() {
  try {
    const [user, repos, events] = await Promise.all([
      githubFetch(`/users/${username}`),
      githubFetch(`/users/${username}/repos?sort=updated&per_page=100&type=public`),
      githubFetch(`/users/${username}/events/public?per_page=50`)
    ]);

    const ownRepos = repos.filter((repo) => !repo.fork && !repo.private);
    const totalStars = ownRepos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);

    const langMap = {};
    ownRepos.forEach((repo) => {
      if (repo.language) langMap[repo.language] = (langMap[repo.language] || 0) + 1;
    });

    const topLangs = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([language]) => language)
      .join(" · ");

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
          .map((commit) => ({
            repo,
            message: commit.message.split("\n")[0],
            date: event.created_at
          }));
      })
      .slice(0, 8);

    const activeRepos = [...new Set(pushEvents.map((event) => event.repo.name.replace(`${username}/`, "")))].slice(0, 4);

    return {
      publicRepos: user.public_repos,
      followers: user.followers,
      totalStars,
      topLangs: cleanLanguageList(topLangs),
      recentCommits,
      activeRepos
    };
  } catch (err) {
    console.warn("GitHub signal failed:", err.message);
    return {
      publicRepos: "Unavailable",
      followers: "Unavailable",
      totalStars: "Unavailable",
      topLangs: "Unavailable",
      recentCommits: [],
      activeRepos: []
    };
  }
}

async function groqComplete(systemPrompt, userPrompt, maxTokens = 90, temperature = 0.3) {
  if (!groqKey) return null;

  try {
    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
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

async function getAiSnapshot(signal) {
  const fallback = `> Building and shipping updates across ${sentenceCaseList(signal.activeRepos)}.`;

  const result = await groqComplete(
    "Write one factual GitHub profile status line. Max 22 words. No emojis. No hype. Do not call the developer a founder. No quotes.",
    `Developer: Imran Shiundu. Software engineer from Kenya. Active repositories: ${signal.activeRepos.join(", ")}. Recent commits: ${signal.recentCommits.map((commit) => commit.message).slice(0, 4).join(" | ")}. Write one current status line.`
  );

  return result ? `> ${result.replace(/^>\s*/, "")}` : fallback;
}

async function getAiCurrentFocus(signal) {
  if (signal.recentCommits.length === 0) {
    return `<strong>Current focus:</strong> ${sentenceCaseList(signal.activeRepos)}`;
  }

  const commitSummary = signal.recentCommits
    .slice(0, 6)
    .map((commit) => `[${commit.repo}] ${commit.message}`)
    .join("\n");

  const result = await groqComplete(
    "Analyze commit history and write one factual current-focus line. Max 20 words. No emojis. No hype. Do not call the developer a founder.",
    `Commits:\n${commitSummary}\n\nWrite the current focus.`
  );

  return `<strong>Current focus:</strong> ${result || sentenceCaseList(signal.activeRepos)}`;
}

function renderRecentCommits(signal) {
  if (signal.recentCommits.length === 0) {
    return "No recent public commits found.";
  }

  return signal.recentCommits
    .slice(0, 4)
    .map((commit) => `${commit.repo}: ${commit.message}`)
    .join("<br/>\n");
}

async function renderGithubSignal(signal) {
  const now = new Date().toUTCString();
  const currentFocus = await getAiCurrentFocus(signal);

  return `<table>
<tr>
<td align="center"><strong>Public repositories</strong><br/>${signal.publicRepos}</td>
<td align="center"><strong>Followers</strong><br/>${signal.followers}</td>
<td align="center"><strong>Total stars</strong><br/>${signal.totalStars}</td>
<td align="center"><strong>Top languages</strong><br/>${signal.topLangs}</td>
</tr>
</table>

${currentFocus}

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

  const [readme, activityPage, signal] = await Promise.all([
    fs.readFile(readmePath, "utf8"),
    fs.readFile(activityPath, "utf8"),
    getPublicSignal()
  ]);

  const [aiSnapshot, githubSignal, codingSystem] = await Promise.all([
    getAiSnapshot(signal),
    renderGithubSignal(signal),
    renderCodingSystem()
  ]);

  let updatedReadme = readme;
  updatedReadme = replaceBlock(updatedReadme, "AI-SNAPSHOT", aiSnapshot);
  updatedReadme = replaceBlock(updatedReadme, "GITHUB-SIGNAL", githubSignal);
  updatedReadme = replaceBlock(updatedReadme, "CODING-SYSTEM", codingSystem);

  await fs.writeFile(readmePath, updatedReadme, "utf8");
  console.log("README.md refreshed.");

  const updatedActivity = replaceBlock(activityPage, "GITHUB-SIGNAL", githubSignal);
  await fs.writeFile(activityPath, updatedActivity, "utf8");
  console.log("docs/GITHUB_ACTIVITY.md signal refreshed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
