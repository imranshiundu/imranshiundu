# Setup Guide

## 1. Copy the files

Copy these files into your GitHub profile repository:

```txt
README.md
data/projects.json
scripts/update-profile-readme.mjs
.github/workflows/readme-ai-refresh.yml
.github/workflows/snake.yml
.github/workflows/profile-3d.yml
.github/ISSUE_TEMPLATE/daily-build.yml
docs/CODING_SYSTEM.md
```

Your profile repository should be named exactly:

```txt
imranshiundu
```

## 2. Commit and push

```bash
git add .
git commit -m "feat: upgrade GitHub profile README system"
git push
```

## 3. Enable Actions

Go to the repository's Actions tab and run these manually once:

1. `Generate Contribution Snake`
2. `Generate 3D Contribution Profile`
3. `README AI Refresh`

## 4. Optional AI integration

The README itself cannot run a live AI chat. The safe way is to let GitHub Actions call an AI API and update a small generated section.

To enable the AI-generated status block:

1. Open GitHub repository settings.
2. Go to Secrets and variables → Actions.
3. Add a repository secret named:

```txt
GROQ_API_KEY
```

4. Optional: add a repository variable named:

```txt
GROQ_MODEL
```

The script will still work without Groq. It will use a fallback non-AI status line.

## 5. Update projects

Edit:

```txt
data/projects.json
```

Then run the `README AI Refresh` workflow or push to GitHub.

## 6. Important

Do not use automation to create fake commits. Let automation update generated visuals, but your main contribution graph should come from real work.
