# Imran's Daily Coding System

This system is designed to increase real productivity and real commits without creating fake activity.

## The rule

One meaningful commit per day is better than ten empty commits.

A commit counts if it improves one of these:

- Code quality
- UI/UX
- Documentation
- Tests
- Automation
- Deployment
- Bug fixing
- Architecture clarity

## Daily workflow

### 1. Pick one task

Choose one task small enough to finish today:

- Fix one bug
- Add one route
- Improve one component
- Write one API endpoint
- Add one test
- Improve one README section
- Refactor one ugly function
- Add one script that saves future time

### 2. Create a branch

```bash
git checkout -b work/today-small-win
```

### 3. Build the smallest working version

Do not start with a massive rewrite. Make a working change first.

### 4. Test it

Use whatever the project supports:

```bash
npm run lint
npm run test
npm run build
```

or:

```bash
./mvnw test
```

### 5. Commit with a clean message

```bash
git add .
git commit -m "feat: add booking status filter"
git push
```

## Weekly system

Every Sunday, review your repositories and ask:

1. Which project moved forward this week?
2. Which project is abandoned and should be archived?
3. Which README is unclear?
4. Which repo needs tests?
5. Which repo could become a real product?

## Project lanes

Keep only three active lanes at once:

1. Main product lane
2. Learning/research lane
3. Maintenance/documentation lane

Everything else goes into backlog.

## Recommended local tools

- VS Code or Cursor for daily coding
- GitHub Issues for tasks
- GitHub Projects for weekly planning
- GitHub Actions for CI and README automation
- Prettier / ESLint for frontend consistency
- Maven / Gradle checks for Java projects
- Docker Compose for repeatable local setup
- `gh` CLI for fast GitHub work

## Commit message format

Use simple conventional commits:

```txt
feat: add user dashboard card
fix: handle empty API response
docs: improve setup instructions
refactor: simplify auth middleware
test: cover booking tracker status
chore: update README automation
```

## Anti-patterns

Avoid these:

- Empty commits just to grow the graph
- Creating ten repos and finishing none
- Rewriting the whole UI before fixing the core bug
- Pushing broken code to main without checks
- Adding AI-generated code you do not understand
- Hiding weak documentation behind fancy badges

## The productive day template

```txt
Today I shipped:
Problem:
Change made:
Test/check:
Next step:
```

Put this in a GitHub issue, PR, or local log. It will make your work look more professional and help you remember what you actually built.
