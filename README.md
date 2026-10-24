# PrepVault 📝

A personal interview question bank — write answers in Markdown, render Mermaid diagrams, share topics via a link.

**Free forever:** Supabase (database + auth) + GitHub Pages (hosting)

---

## What it does

- Create unlimited **topics** (React, System Design, SQL, …)
- Write **questions and answers** with a live Markdown split-pane editor
- Embed **Mermaid diagrams** (flowcharts, ERDs, sequence diagrams) inside answers
- **Code blocks** with copy button, language label and Cascadia Code font
- Toggle any topic **public** → share a read-only link with anyone
- **Search** across all your questions instantly
- Dark / light / auto **theme**
- Works on **mobile** (responsive sidebar)

---

## Project structure

```
prepvault/
├── docs/               ← everything GitHub Pages serves
│   ├── index.html      ← markup + modal shells
│   ├── style.css       ← all styling
│   ├── app.js          ← all logic (Supabase, rendering, state)
│   └── 404.html        ← SPA redirect for GitHub Pages
├── supabase/
│   └── schema.sql      ← run once in Supabase SQL editor
├── .github/workflows/
│   └── deploy.yml      ← auto-deploy on every push to main
└── README.md
```

---

## Quick-start (15 min)

### 1 · Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Wait ~2 min for it to provision

### 2 · Run the database schema

Supabase dashboard → **SQL Editor** → paste & run each of the 14 statements in `supabase/schema.sql` one at a time.

### 3 · Grab your API credentials

Supabase dashboard → **Project Settings → API**:
- **Project URL** e.g. `https://abcdef.supabase.co`
- **anon / public key** (long JWT)

### 4 · Push code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/prepvault.git
git branch -M main
git push -u origin main
```

### 5 · Add GitHub Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJh…` |

### 6 · Enable GitHub Pages

Repo → **Settings → Pages → Source: GitHub Actions** → Save

### 7 · Deploy

Go to **Actions → Deploy PrepVault → Run workflow**

Your site is live at `https://YOUR_USERNAME.github.io/prepvault/`

### 8 · Configure Supabase auth redirect

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://YOUR_USERNAME.github.io`
- **Redirect URLs:** `https://YOUR_USERNAME.github.io/prepvault/`

---

## Future deploys

Every `git push` to `main` triggers an automatic redeploy — no action needed.

---

## Mermaid example

In the answer editor type:

    ```mermaid
    graph TD
      A[Question] --> B{Understood?}
      B -- Yes --> C[Practice]
      B -- No  --> D[Re-read]
      C --> E[Ace the interview 🎉]
    ```

---

## Supabase free tier

| Resource | Free limit |
|---|---|
| Database | 500 MB |
| API requests | 2 M / month |
| Auth users | Unlimited |

More than enough for personal use. No credit card required.
