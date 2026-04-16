# Landing Page Brand Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the post-login landing page (index.html) to match the exact branding of centrumrubacek.cz — same fonts, colors, and warm family-friendly feel.

**Architecture:** Pure CSS transformation. Introduce CSS custom properties for all brand tokens at the top of styles.css, import Google Fonts (Atma + Raleway), then replace every hardcoded color/font reference with the brand equivalents. No HTML or JS changes.

**Tech Stack:** CSS custom properties, Google Fonts (Atma, Raleway)

---

## Brand Token Reference

Extracted from centrumrubacek.cz source:

| Token | Value | Usage |
|-------|-------|-------|
| Primary (gold) | `#c5a880` | Header bg, nav accents, active tab border, capacity bar |
| CTA (orange) | `#f69c4e` | Primary buttons, links, hover states |
| CTA hover (dark orange) | `#e58a3a` | Button hover state (darkened #f69c4e) |
| Text dark | `#534445` | Headings, strong text |
| Text body | `#333333` | Body copy |
| Text muted | `#666666` | Secondary text, labels |
| Background page | `#f5f0eb` | Body background (warm off-white) |
| Background card | `#ffffff` | Cards, content areas |
| Background form | `#faf7f4` | Form cards (warm tint instead of cold gray) |
| Border light | `#e8e0d8` | Card borders, dividers (warm-tinted) |
| Border medium | `#d4c9be` | Input borders |
| Heading font | `'Atma', cursive` | h1, h2, h3, section headers |
| Body font | `'Raleway', Helvetica, Arial, sans-serif` | Everything else |
| Heading weight | `300` | Matches the website's light heading weight |
| Danger | `#dc3545` | Delete buttons, errors (unchanged) |
| Success | `#28a745` | Success notifications (unchanged) |
| Info | `#17a2b8` | Info notifications (unchanged) |

---

## File Structure

Only one file changes:

- **Modify:** `public/styles.css` — full reskin with CSS custom properties + brand values

No new files. No HTML changes. No JS changes.

---

### Task 1: Add Google Fonts import and CSS custom properties

**Files:**
- Modify: `public/styles.css:1-14` (top of file)

- [ ] **Step 1: Add Google Fonts import and CSS custom properties block**

Replace the top of `styles.css` (lines 1-14) with:

```css
@import url('https://fonts.googleapis.com/css2?family=Atma:wght@300;400;500;600;700&family=Raleway:wght@300;400;500;600;700&display=swap');

:root {
	--color-primary: #c5a880;
	--color-primary-light: #d4bc9a;
	--color-primary-dark: #b09570;
	--color-cta: #f69c4e;
	--color-cta-hover: #e58a3a;
	--color-text-dark: #534445;
	--color-text-body: #333333;
	--color-text-muted: #666666;
	--color-bg-page: #f5f0eb;
	--color-bg-card: #ffffff;
	--color-bg-form: #faf7f4;
	--color-border-light: #e8e0d8;
	--color-border-medium: #d4c9be;
	--color-danger: #dc3545;
	--color-danger-hover: #c82333;
	--color-success: #28a745;
	--color-info: #17a2b8;
	--font-heading: 'Atma', cursive;
	--font-body: 'Raleway', Helvetica, Arial, Lucida, sans-serif;
}

* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}

body {
	font-family: var(--font-body);
	background: var(--color-bg-page);
	min-height: 100vh;
	padding: 20px;
}
```

- [ ] **Step 2: Verify the page loads with new fonts**

Run: `npm run dev` (or whatever the dev server command is)
Open: `http://localhost:3000` in browser
Expected: Page loads, body text is now Raleway, background is warm off-white instead of purple gradient.

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: add brand CSS custom properties and Google Fonts (Atma + Raleway)"
```

---

### Task 2: Reskin header and container

**Files:**
- Modify: `public/styles.css:38-50` (container and header rules)

- [ ] **Step 1: Update container styles**

Replace the `.container` rule with:

```css
.container {
	max-width: 1200px;
	margin: 0 auto;
	background: var(--color-bg-card);
	border-radius: 12px;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
	overflow: hidden;
}
```

Changes: softer shadow (was aggressive 0 20px 60px), tighter border-radius (12px vs 20px), uses CSS variable.

- [ ] **Step 2: Update header styles**

Replace the `header` and `header h1` and `header p` rules with:

```css
header {
	background: var(--color-primary);
	color: white;
	padding: 24px 30px;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

header h1 {
	font-family: var(--font-heading);
	font-size: 2.2rem;
	font-weight: 400;
	margin-bottom: 4px;
}

header p {
	font-family: var(--font-body);
	font-size: 1rem;
	opacity: 0.9;
}
```

Changes: solid gold background (no gradient), Atma heading font, lighter weight.

- [ ] **Step 3: Verify in browser**

Expected: Header is warm gold (#c5a880) with Atma heading font. Container has subtle shadow. No more purple anywhere in header area.

- [ ] **Step 4: Commit**

```bash
git add public/styles.css
git commit -m "style: reskin header and container to Rubacek brand gold"
```

---

### Task 3: Reskin tabs navigation

**Files:**
- Modify: `public/styles.css` (`.tabs`, `.tab`, `.tab:hover`, `.tab.active` rules)

- [ ] **Step 1: Update tab styles**

Replace all tab-related rules with:

```css
.tabs {
	display: flex;
	background: var(--color-bg-card);
	border-bottom: 2px solid var(--color-border-light);
}

.tab {
	flex: 1;
	padding: 15px 20px;
	border: none;
	background: transparent;
	cursor: pointer;
	font-family: var(--font-body);
	font-size: 0.95rem;
	font-weight: 500;
	color: var(--color-text-muted);
	transition: all 0.3s;
	border-bottom: 3px solid transparent;
}

.tab:hover {
	background: var(--color-bg-form);
	color: var(--color-text-dark);
}

.tab.active {
	background: var(--color-bg-card);
	color: var(--color-cta);
	border-bottom-color: var(--color-cta);
	font-weight: 600;
}
```

Changes: white bg instead of gray, warm border colors, orange active state instead of purple.

- [ ] **Step 2: Verify in browser**

Expected: Tabs have clean white background. Active tab has orange underline and orange text. Hover shows warm tint.

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: reskin tab navigation with brand colors"
```

---

### Task 4: Reskin buttons

**Files:**
- Modify: `public/styles.css` (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` rules)

- [ ] **Step 1: Update button styles**

Replace all button rules with:

```css
.btn {
	padding: 12px 24px;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	font-family: var(--font-body);
	font-size: 1rem;
	font-weight: 600;
	transition: all 0.3s;
}

.btn-primary {
	background: var(--color-cta);
	color: white;
}

.btn-primary:hover {
	background: var(--color-cta-hover);
	transform: translateY(-1px);
	box-shadow: 0 4px 12px rgba(246, 156, 78, 0.3);
}

.btn-secondary {
	background: var(--color-primary);
	color: white;
}

.btn-secondary:hover {
	background: var(--color-primary-dark);
}

.btn-danger {
	background: var(--color-danger);
	color: white;
	padding: 8px 16px;
	font-size: 0.9rem;
}

.btn-danger:hover {
	background: var(--color-danger-hover);
}
```

Changes: primary buttons are now orange (CTA color), secondary buttons are gold (brand primary), orange shadow on hover instead of purple.

- [ ] **Step 2: Verify in browser**

Expected: "Pridat Lekci" button is orange. "Odhlasit se" button is gold. Hover effects feel warm.

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: reskin buttons to brand orange and gold"
```

---

### Task 5: Reskin section headers, forms, and inputs

**Files:**
- Modify: `public/styles.css` (`.section-header`, `.form-card`, `.form-group`, input/select rules)

- [ ] **Step 1: Update section header and form styles**

Replace section header and form rules with:

```css
.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 25px;
}

.section-header h2 {
	font-family: var(--font-heading);
	color: var(--color-text-dark);
	font-size: 1.8rem;
	font-weight: 400;
}

.tab-content {
	display: none;
	padding: 30px;
}

.tab-content.active {
	display: block;
}

.form-card {
	background: var(--color-bg-form);
	padding: 25px;
	border-radius: 12px;
	margin-bottom: 25px;
}

.form-group {
	margin-bottom: 20px;
}

.form-group label {
	display: block;
	margin-bottom: 8px;
	font-weight: 600;
	color: var(--color-text-muted);
}

.form-group input,
.form-group select {
	width: 100%;
	padding: 12px;
	border: 2px solid var(--color-border-medium);
	border-radius: 8px;
	font-family: var(--font-body);
	font-size: 1rem;
	transition: border-color 0.3s;
}

.form-group input:focus,
.form-group select:focus {
	outline: none;
	border-color: var(--color-cta);
}

.form-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 15px;
}

.form-actions {
	display: flex;
	gap: 10px;
	margin-top: 20px;
}
```

Changes: Atma font for h2 headings, warm form backgrounds, warm border colors, orange focus ring on inputs.

- [ ] **Step 2: Verify in browser**

Expected: Section headings use Atma font. Form cards have warm-tinted background. Input focus shows orange border.

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: reskin forms and section headers with brand tokens"
```

---

### Task 6: Reskin lesson cards and capacity bars

**Files:**
- Modify: `public/styles.css` (`.lesson-card`, `.capacity-bar`, related rules)

- [ ] **Step 1: Update lesson card and capacity bar styles**

Replace lesson card and capacity bar rules with:

```css
.lessons-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
	gap: 20px;
}

.lesson-card {
	background: var(--color-bg-card);
	border: 2px solid var(--color-border-light);
	border-radius: 12px;
	padding: 20px;
	transition: all 0.3s;
}

.lesson-card:hover {
	border-color: var(--color-primary);
	box-shadow: 0 4px 12px rgba(197, 168, 128, 0.2);
	transform: translateY(-2px);
}

.lesson-card h3 {
	font-family: var(--font-heading);
	color: var(--color-text-dark);
	margin-bottom: 15px;
	font-size: 1.3rem;
	font-weight: 400;
}

.lesson-info {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-bottom: 15px;
}

.lesson-info-item {
	display: flex;
	align-items: center;
	gap: 8px;
	color: var(--color-text-muted);
}

.lesson-info-item strong {
	color: var(--color-text-dark);
	min-width: 90px;
}

.capacity-bar {
	margin: 15px 0;
}

.capacity-bar-label {
	display: flex;
	justify-content: space-between;
	margin-bottom: 5px;
	font-size: 0.9rem;
	color: var(--color-text-muted);
}

.capacity-bar-track {
	height: 8px;
	background: var(--color-border-light);
	border-radius: 4px;
	overflow: hidden;
}

.capacity-bar-fill {
	height: 100%;
	background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-cta) 100%);
	transition: width 0.3s;
}

.capacity-bar-fill.full {
	background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
}

.lesson-actions {
	display: flex;
	gap: 10px;
}
```

Changes: warm border/shadow colors on cards, Atma for card headings, gold-to-orange gradient for capacity bars, warm track background.

- [ ] **Step 2: Verify in browser**

Expected: Lesson cards have warm hover glow (gold tint). Card headings are Atma. Capacity bars show gold-to-orange gradient.

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: reskin lesson cards and capacity bars with brand palette"
```

---

### Task 7: Reskin info boxes, notifications, and responsive overrides

**Files:**
- Modify: `public/styles.css` (`.info-box`, `.notification`, `@media` rules)

- [ ] **Step 1: Update info box, notification, and responsive styles**

Replace info box, notification, and media query rules with:

```css
.info-box {
	background: #fef8f0;
	border-left: 4px solid var(--color-cta);
	padding: 15px;
	border-radius: 8px;
	margin-bottom: 20px;
}

.info-box h3 {
	font-family: var(--font-heading);
	color: var(--color-cta-hover);
	margin-bottom: 10px;
	font-weight: 400;
}

.info-box ul {
	margin-left: 20px;
	color: var(--color-text-muted);
}

.info-box ul li {
	margin-bottom: 5px;
}

.notification {
	position: fixed;
	top: 20px;
	right: 20px;
	padding: 15px 25px;
	border-radius: 8px;
	color: white;
	font-family: var(--font-body);
	font-weight: 600;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	transform: translateX(400px);
	transition: transform 0.3s;
	z-index: 1000;
}

.notification.show {
	transform: translateX(0);
}

.notification.success {
	background: var(--color-success);
}

.notification.error {
	background: var(--color-danger);
}

.notification.info {
	background: var(--color-info);
}

@media (max-width: 768px) {
	.lessons-grid {
		grid-template-columns: 1fr;
	}

	.form-row {
		grid-template-columns: 1fr;
	}

	.tabs {
		flex-wrap: wrap;
	}

	.tab {
		flex: 1 1 50%;
		font-size: 0.9rem;
		padding: 12px 10px;
	}
}
```

Changes: info box uses warm orange accent instead of blue, Atma font for info heading, font-family on notifications.

- [ ] **Step 2: Final full visual check in browser**

Verify entire landing page:
- Header: gold background, Atma heading, white text
- Tabs: white background, orange active state
- Lesson cards: warm borders, gold hover, Atma card titles
- Buttons: orange primary, gold secondary
- Forms: warm backgrounds, orange focus rings
- Capacity bars: gold-to-orange gradient
- Info boxes: warm orange accent
- Overall: no purple remnants anywhere

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: complete landing page reskin to Rubacek brand identity"
```

---

## Summary

7 tasks, all modifying the single file `public/styles.css`. Each task targets a specific component group. Zero HTML/JS changes. The final result replaces every purple gradient with the centrumrubacek.cz warm gold/orange palette and swaps fonts to Atma + Raleway.
