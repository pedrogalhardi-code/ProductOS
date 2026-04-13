# ProductOS — Figma Prototype Prompt

Paste the prompt below into Figma AI, First Draft, or a plugin like Magician.

---

```
Design a high-fidelity web app prototype called "ProductOS" — an AI PRD Builder for Telus Digital's internal product management team.

BRAND
- Primary: Telus Purple #4B286D | Accent: Telus Green #00A651
- Background: #F4F4F7 | Cards: white | Danger: #EF4444 | Warning: #F59E0B
- Font: Inter (UI), JetBrains Mono (code blocks)
- Cards: rounded-xl, 1px #E5E7EB border, subtle shadow
- Aesthetic: clean enterprise SaaS — Linear/Notion style

LAYOUT
- Left sidebar: 240px, white, border-right
- Top header: 64px, white, border-bottom
- Content area: flex-1, #F4F4F7, 32px padding

SCREEN 1 — LOGIN
Centered card (max-width 400px) on purple-to-green 5% gradient. Contains: ProductOS logo (purple-to-green gradient square + "P"), "Welcome Back" heading, email + password inputs with icons, full-width "Sign In" purple button, toggle to Create Account mode.

SCREEN 2 — DASHBOARD
Full shell (sidebar + header + content). Sidebar: logo, "New Project" CTA, nav (Dashboard active, Settings), project list, footer count. Header: title, user avatar + name, logout. Content: H1 "Dashboard", 3 stat cards (Total Projects, Total Documents, In Review), "Recent Documents" 2×3 card grid (type badge, status badge, title, project, timestamp), "Your Projects" 2-col grid.

SCREEN 3 — NEW PROJECT
Centered form card (560px): project name input, large "Client Context" textarea with helper text ("This context is injected into every AI call for this project"), "Create Project" primary button.

SCREEN 4 — PROJECT PAGE
Full shell. Breadcrumb + H1 project title + "New Document" button. 3-col document card grid: type badge, status badge, title, author avatar + name, timestamp, 3-dot menu. Empty state: icon + "No documents yet" + CTA.

SCREEN 5 — NEW DOCUMENT (3-step AI flow)
Left step indicator panel + right content panel.
- Step 1: 6 type cards in 2×3 grid (PRD, User Stories, Technical Spec, Product Brief, Roadmap, OKRs) with icon, label, description. Selected = purple border + bg.
- Step 2: idea textarea, input type toggle (Idea/Notes/Form), language dropdown, Tone segmented control (Formal/Startup/Technical), "Generate with AI" purple button.
- Step 3: animated purple progress bar + "Claude is generating…" + streaming text preview with blinking cursor.

SCREEN 6 — DOCUMENT EDITOR
Sidebar + editor center + slide-in right drawer.
- Editor: breadcrumb, editable H1 title, formatting toolbar (Bold, Italic, H1-H3, Lists, Code, Quote), rich text content with a sample PRD. Acceptance Criteria section shows GIVEN/WHEN/THEN as keyword pills: GIVEN=blue, WHEN=amber, THEN=green, AND=purple. "Auto-saved 2m ago" footer.
- Top-right actions: Status dropdown (Draft→In Review→Approved), "CPO Review" outline button, Export dropdown, "Push to Jira" button.
- CPO Review Drawer (slides in from right, 400px): 7 sections (Executive Summary, Strategic Alignment, User Value, Technical Feasibility, Risk Assessment, Success Metrics, Recommendation) each with a score badge 1–10. Overall score with progress ring at bottom.

SCREEN 7 — SETTINGS
Content split into left sub-nav (Profile, Preferences, Integrations) + right panel.
- Preferences: Language dropdown, Tone segmented control, AI System Prompt Prefix textarea, Save button.
- Integrations: cards for Jira, Confluence, Slack, Figma, Google Drive — each with logo, name, "Connected" green badge or "Connect" purple button.

SCREEN 8 — VERSION HISTORY
Full shell. Vertical timeline: each row = version circle badge (v1, v2…), author avatar + name, timestamp, optional label, "Restore" + "Preview" buttons. Current version has purple left border highlight.

COMPONENT LIBRARY (separate page)
Buttons (Primary/Secondary/Danger/Ghost), status badges (Draft/In Review/Approved/Archived), document type badges (6 types, blue), input/textarea/select/label, card, sidebar nav item (default+active), avatar (sm/md/lg), Gherkin pills (GIVEN/WHEN/THEN/AND/BUT), shimmer skeleton, toast (success/error/info), modal overlay.

PROTOTYPE WIRING
1. Login → Dashboard
2. Dashboard → New Project (button)
3. New Project → Project Page (submit)
4. Project Page → New Document (button)
5. Step 1 → Step 2 (type card click)
6. Step 2 → Step 3 (Generate button)
7. Step 3 → Document Editor (2s delay)
8. Editor → CPO Review Drawer (button, slide-in)
9. Editor → Version History (clock icon)
10. Sidebar → Dashboard, Settings

Design for 1440px desktop. Sidebar collapses to icon-only at 1024px.
```

---

## Color Tokens

| Token | Hex |
|---|---|
| `brand/purple` | #4B286D |
| `brand/purple-dark` | #2A0D45 |
| `brand/green` | #00A651 |
| `neutral/background` | #F4F4F7 |
| `neutral/border` | #E5E7EB |
| `status/draft` | #F3F4F6 |
| `status/review` | #FEF3C7 |
| `status/approved` | #DCFCE7 |
| `semantic/danger` | #EF4444 |
