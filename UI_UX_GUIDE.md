# Silence Notes - UI/UX Design Guide

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Core Principles](#core-principles)
3. [Color System](#color-system)
4. [Typography System](#typography-system)
5. [Icon Standards](#icon-standards)
6. [Component Patterns](#component-patterns)
7. [Layout & Spacing](#layout--spacing)
8. [Brutalist Elements](#brutalist-elements)
9. [State Patterns](#state-patterns)
10. [Implementation Checklist](#implementation-checklist)

---

## Design Philosophy

Silence Notes follows a **Raw Industrial Brutalist** design language characterized by:
- Stark contrasts and high visual impact
- Heavy borders and visible grid structures
- Raw, unpolished aesthetic with no shadows or gradients
- Functional minimalism - every element serves a purpose
- Bold typography with geometric precision

### Anti-Patterns (What We Avoid)
- NO emoticons/emojis under any circumstances
- NO rounded corners (use 0px or minimal 2px radius)
- NO drop shadows or gradients
- NO subtle/translucent backgrounds
- NO soft pastel colors
- NO decorative elements without function

---

## Core Principles

### 1. Function Over Form
Every UI element must have a clear purpose. Decorative elements are minimized.

### 2. High Contrast
All text must meet WCAG AAA standards for contrast. Use black (#0A0A0A) on white (#FFFFFF) as the base.

### 3. Heavy Boundaries
Use 2px solid borders for all containers and interactive elements. This creates the industrial grid aesthetic.

### 4. Real Icons Only
Use Lucide React icons exclusively. Never use Unicode emoticons or emoji.

### 5. Sharp Edges
Border-radius should be 0px by default. Use 2px only for small interactive elements like tags.

---

## Color System

### Primary Palette
```css
--primary: #FF4D00;        /* Orange - CTAs, active states */
--primary-dark: #E64500;   /* Darker orange - hover states */
```

### Neutral Palette
```css
--neutral-950: #0A0A0A;   /* Black - text, borders */
--neutral-900: #111111;   /* Near black - headings */
--neutral-500: #6B7280;   /* Gray - secondary text */
--neutral-200: #EAEAEA;   /* Light gray - disabled states */
--neutral-100: #F3F3F3;   /* Off white - subtle backgrounds */
--white: #FFFFFF;         /* White - main backgrounds */
```

### Semantic Colors
```css
--success: #22C55E;       /* Green - success states */
--warning: #F59E0B;       /* Amber - warnings */
--error: #EF4444;         /* Red - errors, destructive actions */
```

### Color Usage Rules
| Element | Color | When to Use |
|---------|-------|-------------|
| Primary text | `--neutral-950` | Body text, headings |
| Secondary text | `--neutral-500` | Descriptions, metadata |
| Borders | `--neutral-950` | All borders, dividers |
| Backgrounds | `--white` | Main container backgrounds |
| Accent background | `--neutral-100` | Subtle section differentiation |
| CTAs | `--primary` | Primary action buttons |
| Error backgrounds | `#FEF2F2` | Error state containers |

---

## Typography System

### Font Families
```css
/* Display/Headings */
font-family: 'Archivo', sans-serif;

/* Body/UI Text */
font-family: 'Inter', sans-serif;
```

### Type Scale
| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display | 6rem (96px) | 900 | 1.0 | Hero sections (rare) |
| H1 | 4.5rem (72px) | 700 | 1.1 | Page titles |
| H2 | 3rem (48px) | 700 | 1.2 | Section headers |
| H3 | 1.5rem (24px) | 600 | 1.4 | Subsection headers |
| Body Large | 1.125rem (18px) | 400 | 1.6 | Emphasized body text |
| Body | 1rem (16px) | 400 | 1.75 | Default body text |
| Caption | 0.875rem (14px) | 400 | 1.5 | Metadata, notes |
| Small | 0.75rem (12px) | 500 | 1.4 | Labels, tags |

### Typography Rules
- **Headings**: Always use `Archivo` font, uppercase for page titles
- **Body**: Always use `Inter` font for readability
- **Letter spacing**: Add 0.05em for uppercase headings
- **Text transform**: Uppercase for main titles only

---

## Icon Standards

### Icon Library: Lucide React
```bash
npm install lucide-react
```

### Icon Import Pattern
```tsx
import { IconName1, IconName2 } from 'lucide-react';
```

### Common Icon Mappings
| Concept | Lucide Icon | Size | Stroke Width |
|---------|-------------|------|--------------|
| Lock/Security | `Lock` | 16-24px | 2 |
| Shield/Protected | `ShieldCheck` | 48px | 1.5 |
| File/Document | `FileText` | 24px | 2 |
| Refresh/Sync | `RefreshCw` | 24px | 2 |
| Hashtag/Tag | `Hash` | 24px | 2 |
| Warning/Error | `AlertTriangle` | 32px | Default |
| Success | `CheckCircle` | 24px | Default |
| Settings | `Settings` | 20px | 2 |
| Close/Dismiss | `X` | 20px | 2 |
| Edit | `Pencil` | 16-20px | 2 |
| Delete | `Trash2` | 16-20px | 2 |
| Search | `Search` | 20px | 2 |
| Plus/Add | `Plus` | 20px | 2 |
| Chevron/Nav | `ChevronRight` | 16px | 2 |

### Icon Usage Rules
1. **Color**: Icons inherit text color or use `--neutral-950`
2. **Stroke width**: Use 2 for standard icons, 1.5 for large display icons
3. **Size**: Match icon size to adjacent text (16px for small text, 24px for body)
4. **Wrapping**: Always wrap icons in a container for consistent sizing:
   ```tsx
   <div className="icon-wrapper">
     <IconName size={24} strokeWidth={2} />
   </div>
   ```

### Forbidden: Emoticon Replacements
| ❌ DO NOT USE | ✅ USE INSTEAD |
|---------------|----------------|
| 🔐 | `Lock` or `ShieldCheck` |
| 📝 | `FileText` or `FileEdit` |
| 🔄 | `RefreshCw` or `RotateCw` |
| 🔒 | `Lock` |
| ⚠️ | `AlertTriangle` |
| ✅ | `CheckCircle` |
| ❌ | `XCircle` |
| 📁 | `Folder` |
| 🗑️ | `Trash2` |
| ✏️ | `Pencil` |

---

## Component Patterns

### Buttons

#### Primary Button (Orange CTA)
```tsx
<button className="btn-primary">
  <IconName size={18} strokeWidth={2} />
  Action Text
</button>
```

```css
.btn-primary {
  background: var(--primary);
  color: var(--white);
  border: 2px solid var(--neutral-950);
  border-radius: 0;
  padding: var(--space-3) var(--space-6);
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 200ms ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-primary:active {
  transform: translate(1px, 1px);
}
```

#### Secondary Button (Gray)
```css
.btn-secondary {
  background: var(--neutral-200);
  color: var(--neutral-700);
  border: 2px solid var(--neutral-950);
  border-radius: 0;
  /* ... rest same as primary */
}

.btn-secondary:hover {
  background: var(--neutral-100);
}
```

#### Destructive Button (Red)
```css
.btn-destructive {
  background: var(--error);
  color: var(--white);
  border: 2px solid var(--neutral-950);
  /* ... rest same as primary */
}

.btn-destructive:hover {
  background: #DC2626;
}
```

### Cards/Containers

#### Standard Card
```tsx
<div className="brutalist-card">
  {/* Content */}
</div>
```

```css
.brutalist-card {
  background: var(--white);
  border: 2px solid var(--neutral-950);
  border-radius: 0;
  padding: var(--space-6);
}
```

#### Error Card
```css
.error-card {
  background: #FEF2F2;
  border: 2px solid var(--error);
  /* ... rest same as standard card */
}
```

### Form Inputs

#### Text Input
```tsx
<input
  type="text"
  className="brutalist-input"
  placeholder="Placeholder text"
/>
```

```css
.brutalist-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--white);
  border: 2px solid var(--neutral-950);
  border-radius: 0;
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  color: var(--neutral-950);
}

.brutalist-input:focus {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.brutalist-input::placeholder {
  color: var(--neutral-500);
}
```

### Feature Lists (Grid Style)
```tsx
<div className="feature-grid">
  <div className="feature-row">
    <div className="feature-icon-wrapper">
      <FileText size={24} strokeWidth={2} />
    </div>
    <span className="feature-text">Feature description</span>
  </div>
  <div className="feature-divider"></div>
  {/* More rows */}
</div>
```

```css
.feature-grid {
  display: flex;
  flex-direction: column;
  border: 2px solid var(--neutral-950);
}

.feature-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
}

.feature-icon-wrapper {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-icon-wrapper svg {
  color: var(--neutral-950);
}

.feature-text {
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 1rem;
  color: var(--neutral-950);
}

.feature-divider {
  height: 2px;
  background: var(--neutral-950);
  margin: 0;
}
```

---

## Layout & Spacing

### Spacing Scale
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;
```

### Spacing Guidelines
| Context | Spacing |
|---------|---------|
| Button padding | `var(--space-3) var(--space-6)` |
| Card padding | `var(--space-6)` |
| Section gap | `var(--space-8)` |
| Icon-text gap | `var(--space-2)` to `var(--space-3)` |
| Form input padding | `var(--space-3) var(--space-4)` |

### Dividers
Always use 2px solid black borders:
```css
.horizontal-divider {
  height: 2px;
  background: var(--neutral-950);
  margin: var(--space-4) 0;
}

.vertical-divider {
  width: 2px;
  background: var(--neutral-950);
  margin: 0 var(--space-4);
}
```

---

## Brutalist Elements

### Heavy Borders
- All containers: `border: 2px solid var(--neutral-950)`
- No subtle borders (1px is too light)
- No translucent borders

### Visible Grid Structure
- Use dividers between sections
- Feature lists should show grid lines between items
- Borders should create a visible box/grid structure

### No Rounded Corners
- Default: `border-radius: 0`
- Small elements: `border-radius: 2px` (tags, badges only)
- Never use `border-radius: 9999px` (pill shapes)

### High Contrast
- Background: Always `var(--white)` for cards
- Text: Always `var(--neutral-950)` for primary
- Borders: Always `var(--neutral-950)`

### Flat Design
- No box-shadows
- No gradients
- No backdrop-filter blur
- No rgba transparency (use solid colors only)

### Active States
- Buttons: `transform: translate(1px, 1px)` (physical press feel)
- Color change only for hover/active states

---

## State Patterns

### Loading States

#### Spinner with Text
```tsx
<div className="loading-state">
  <div className="spinner"></div>
  <p className="loading-text">Loading...</p>
</div>
```

```css
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  min-height: 400px;
  gap: var(--space-6);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--neutral-200);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 1rem;
  color: var(--neutral-500);
}
```

### Error States

#### Inline Error
```tsx
<div className="inline-error">
  <AlertTriangle size={16} strokeWidth={2} />
  <span>{errorMessage}</span>
</div>
```

```css
.inline-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: #FEF2F2;
  border: 2px solid var(--error);
  color: var(--neutral-950);
  font-size: 0.875rem;
}

.inline-error svg {
  color: var(--error);
  flex-shrink: 0;
}
```

#### Full Error Card
```tsx
<div className="error-card">
  <div className="error-icon-wrapper">
    <AlertTriangle className="error-icon" size={32} />
  </div>
  <h3 className="error-heading">Error Title</h3>
  <p className="error-message">Error description</p>
  <div className="error-actions">
    <button className="btn-primary">Try Again</button>
    <button className="btn-secondary">Dismiss</button>
  </div>
</div>
```

```css
.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-12) var(--space-8);
  border: 2px solid var(--error);
  background: #FEF2F2;
  text-align: center;
  gap: var(--space-6);
}

.error-icon-wrapper {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--error);
  background: var(--white);
}

.error-icon {
  color: var(--error);
}

.error-heading {
  font-family: 'Archivo', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--neutral-950);
  margin: 0;
}

.error-message {
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  color: var(--neutral-700);
  margin: 0;
}

.error-actions {
  display: flex;
  gap: var(--space-4);
}
```

### Success States

#### Success Toast/Notification
```tsx
<div className="success-notification">
  <CheckCircle size={20} strokeWidth={2} />
  <span>Success message</span>
</div>
```

```css
.success-notification {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: #F0FDF4;
  border: 2px solid var(--success);
  color: var(--neutral-950);
}

.success-notification svg {
  color: var(--success);
}
```

### Empty States

#### Empty State with Icon
```tsx
<div className="empty-state">
  <div className="empty-icon-wrapper">
    <FolderOpen size={48} strokeWidth={1.5} />
  </div>
  <h3 className="empty-heading">No items found</h3>
  <p className="empty-description">Get started by creating your first item.</p>
  <button className="btn-primary">Create Item</button>
</div>
```

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-12) var(--space-8);
  text-align: center;
  gap: var(--space-4);
}

.empty-icon-wrapper {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--neutral-200);
  background: var(--white);
  margin-bottom: var(--space-4);
}

.empty-icon-wrapper svg {
  color: var(--neutral-300);
}

.empty-heading {
  font-family: 'Archivo', sans-serif;
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--neutral-950);
  margin: 0;
}

.empty-description {
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  color: var(--neutral-500);
  margin: 0;
}
```

---

## Implementation Checklist

Use this checklist when implementing any new UI component:

### Design Compliance
- [ ] No emoticons/emojis anywhere
- [ ] All icons imported from `lucide-react`
- [ ] Heavy 2px borders on all containers
- [ ] Border-radius is 0 (or 2px for small elements only)
- [ ] High contrast text (black on white)
- [ ] Primary actions use orange (#FF4D00)
- [ ] No drop shadows
- [ ] No gradients
- [ ] No translucent backgrounds

### Code Standards
- [ ] Icons wrapped in container for consistent sizing
- [ ] Proper semantic HTML (button for actions, a for links)
- [ ] Accessible focus states (2px outline)
- [ ] Loading states defined
- [ ] Error states defined
- [ ] Empty states defined (if applicable)

### Testing
- [ ] Verify at 200% zoom (accessibility)
- [ ] Test with keyboard navigation
- [ ] Test with screen reader (labels, ARIA)
- [ ] Verify contrast ratios (WCAG AAA)

### Files to Reference
- CSS Variables: `extension/src/popup/popup.css` (lines 11-54)
- Login Example: `extension/src/components/LoginForm.tsx`
- Login Styles: `extension/src/popup/popup.css` (search for "BRUTALIST LOGIN FORM")

---

## Quick Reference: Common Replacements

| Element | Pattern |
|---------|---------|
| Success checkmark | `<CheckCircle size={20} className="text-success" />` |
| Error warning | `<AlertTriangle size={20} className="text-error" />` |
| Info tip | `<Info size={20} className="text-primary" />` |
| Settings gear | `<Settings size={20} />` |
| Close X | `<X size={20} />` |
| External link | `<ExternalLink size={16} />` |
| Copy to clipboard | `<Copy size={16} />` |
| Trash/delete | `<Trash2 size={20} />` |
| Edit/pencil | `<Pencil size={20} />` |
| Plus/add | `<Plus size={20} />` |
| Search | `<Search size={20} />` |
| Filter | `<Filter size={20} />` |
| Chevron right | `<ChevronRight size={16} />` |
| Chevron down | `<ChevronDown size={16} />` |
| Menu/hamburger | `<Menu size={24} />` |
| User/profile | `<User size={20} />` |
| Bell/notification | `<Bell size={20} />` |

---

## Page Templates

### Standard Page Structure
```tsx
export const PageName: React.FC = () => {
  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">PAGE TITLE</h1>
        <div className="page-divider"></div>
        <p className="page-subtitle">Optional subtitle</p>
      </header>

      <main className="page-content">
        {/* Page content */}
      </main>
    </div>
  );
};
```

```css
.page-container {
  background: var(--white);
  border: 2px solid var(--neutral-950);
  min-height: 700px;
  width: 100%;
}

.page-header {
  padding: var(--space-12) var(--space-8) var(--space-8);
  border-bottom: 2px solid var(--neutral-950);
  text-align: center;
}

.page-title {
  font-family: 'Archivo', sans-serif;
  font-weight: 900;
  font-size: 2.5rem;
  color: var(--neutral-950);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-4);
}

.page-divider {
  width: 100%;
  height: 2px;
  background: var(--neutral-950);
  margin: var(--space-4) 0;
}

.page-subtitle {
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  color: var(--neutral-500);
  margin: var(--space-4) 0 0;
}

.page-content {
  padding: var(--space-8);
}
```

---

*Last Updated: 2025-01-26*
*Version: 1.0.0*
