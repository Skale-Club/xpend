# Dark Mode Implementation Plan

> **Feature**: System-wide dark theme with smooth transitions
> **Estimated Effort**: 2-3 days
> **Priority**: High (Q2 2026 - Priority 1)

---

## 🎯 Goals

1. Beautiful dark theme that's easy on the eyes
2. Smooth transition between light/dark modes
3. Persist user preference
4. Respect system preference by default
5. Minimal code duplication

---

## 🛠️ Technical Approach

### Option 1: Tailwind CSS Dark Mode (Recommended)
- Built-in support with `dark:` variant
- No extra dependencies
- Class-based theming

### Option 2: CSS Variables + Theme Provider
- More flexible
- Runtime theme switching
- Support for multiple themes (not just dark)

**Decision**: Go with **Option 1** (Tailwind) for simplicity, can migrate to Option 2 later if needed.

---

## 📋 Implementation Steps

### Step 1: Configure Tailwind (30 min)

Update `tailwind.config.ts`:
```ts
module.exports = {
  darkMode: 'class', // or 'media' for system preference only
  // ... rest of config
}
```

### Step 2: Create Theme Provider (1 hour)

Create `src/components/providers/ThemeProvider.tsx`:
```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: 'system',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as Theme;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  // Prevent flash on initial load
  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Step 3: Add to Root Layout (15 min)

Update `src/app/layout.tsx`:
```tsx
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Step 4: Create Theme Toggle (30 min)

Create `src/components/ui/ThemeToggle.tsx`:
```tsx
'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'light'
            ? 'bg-white dark:bg-slate-700 shadow-sm'
            : 'hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title="Light mode"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'system'
            ? 'bg-white dark:bg-slate-700 shadow-sm'
            : 'hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title="System preference"
      >
        <Monitor className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'dark'
            ? 'bg-white dark:bg-slate-700 shadow-sm'
            : 'hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title="Dark mode"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}
```

### Step 5: Add Toggle to Sidebar (15 min)

Update `src/components/layout/Sidebar.tsx`:
```tsx
import { ThemeToggle } from '@/components/ui/ThemeToggle';

// Add to bottom of sidebar
<div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
  <ThemeToggle />
</div>
```

### Step 6: Update All Components with Dark Variants (6-8 hours)

This is the most time-consuming part. Go through each component and add `dark:` classes.

**Priority Components** (do these first):
1. Layout & Sidebar
2. Cards
3. Buttons
4. Inputs & Forms
5. Tables
6. Charts (special handling needed)
7. Modals

**Example Updates**:

#### Card Component
```tsx
// Before
<div className="bg-white border border-slate-200 rounded-xl">

// After
<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
```

#### Text Classes
```tsx
// Before
<h1 className="text-slate-900">

// After
<h1 className="text-slate-900 dark:text-slate-100">

// Before
<p className="text-slate-500">

// After
<p className="text-slate-500 dark:text-slate-400">
```

#### Backgrounds
```tsx
// Before
<div className="bg-slate-50">

// After
<div className="bg-slate-50 dark:bg-slate-800">
```

#### Hover States
```tsx
// Before
<button className="hover:bg-slate-100">

// After
<button className="hover:bg-slate-100 dark:hover:bg-slate-800">
```

### Step 7: Handle Charts (2-3 hours)

Charts need special attention since they use hardcoded colors.

#### Option A: Dynamic Colors Based on Theme
```tsx
const { theme } = useTheme();
const isDark = theme === 'dark';

<BarChart>
  <Bar fill={isDark ? '#60A5FA' : '#3B82F6'} />
</BarChart>
```

#### Option B: CSS Variables in Charts
```tsx
// In global CSS
:root {
  --chart-primary: #3B82F6;
  --chart-grid: #E2E8F0;
}

.dark {
  --chart-primary: #60A5FA;
  --chart-grid: #334155;
}

// In chart
<Bar fill="var(--chart-primary)" />
```

**Recommendation**: Use Option B for consistency.

### Step 8: Add Transition Animation (30 min)

Add smooth transition in `globals.css`:
```css
html {
  transition: background-color 0.3s ease, color 0.3s ease;
}

* {
  @apply transition-colors duration-200;
}
```

### Step 9: Prevent Flash of Unstyled Content (1 hour)

Add blocking script in `app/layout.tsx` `<head>`:
```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        const theme = localStorage.getItem('theme') || 'system';
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = theme === 'dark' || (theme === 'system' && systemDark);
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      })();
    `,
  }}
/>
```

---

## 🎨 Color Palette

### Light Mode (Current)
```
Background: white (#FFFFFF)
Surface: slate-50 (#F8FAFC)
Border: slate-200 (#E2E8F0)
Text Primary: slate-900 (#0F172A)
Text Secondary: slate-500 (#64748B)
Accent: blue-600 (#2563EB)
```

### Dark Mode (New)
```
Background: slate-950 (#020617)
Surface: slate-900 (#0F172A)
Border: slate-700 (#334155)
Text Primary: slate-100 (#F1F5F9)
Text Secondary: slate-400 (#94A3B8)
Accent: blue-500 (#3B82F6)
```

---

## 📁 Files to Update

### Core Files (Must Update)
- [ ] `tailwind.config.ts` - Enable dark mode
- [ ] `src/app/layout.tsx` - Add ThemeProvider + script
- [ ] `src/app/globals.css` - Add transitions
- [ ] `src/components/providers/ThemeProvider.tsx` - Create
- [ ] `src/components/ui/ThemeToggle.tsx` - Create
- [ ] `src/components/layout/Sidebar.tsx` - Add toggle

### Component Files (~50 files)
- [ ] `src/components/ui/Card.tsx`
- [ ] `src/components/ui/Button.tsx`
- [ ] `src/components/ui/Input.tsx`
- [ ] `src/components/ui/Select.tsx`
- [ ] `src/components/ui/Modal.tsx`
- [ ] `src/components/ui/Table.tsx`
- [ ] `src/components/dashboard/*.tsx` (all)
- [ ] `src/components/transactions/*.tsx` (all)
- [ ] `src/components/accounts/*.tsx` (all)
- [ ] `src/components/reports/*.tsx` (all)
- [ ] `src/app/**/page.tsx` (all pages)

### Chart Files (Special Handling)
- [ ] `src/components/dashboard/Charts.tsx`
- [ ] `src/components/dashboard/DistributionCarousel.tsx`
- [ ] `src/components/reports/TimeSeriesChart.tsx`

---

## ✅ Testing Checklist

- [ ] Toggle works in sidebar
- [ ] Theme persists on page reload
- [ ] No flash of wrong theme on load
- [ ] System preference auto-detection works
- [ ] All text is readable in both modes
- [ ] Charts display correctly in both modes
- [ ] Buttons and inputs have proper contrast
- [ ] Hover states work in both modes
- [ ] Modals and overlays work in both modes
- [ ] No console errors or warnings

---

## 🐛 Common Issues & Solutions

### Issue 1: Flash of Unstyled Content
**Solution**: Add blocking script in layout (Step 9)

### Issue 2: Charts Don't Update
**Solution**: Use CSS variables or force re-render on theme change

### Issue 3: Some Components Stay Light
**Solution**: Missing `dark:` classes - search for hardcoded colors

### Issue 4: Transition Feels Janky
**Solution**: Use `transition-colors` instead of `transition-all`

---

## 🎯 Success Criteria

- ✅ Users can toggle between light/dark/system modes
- ✅ Choice persists across sessions
- ✅ No flash on initial page load
- ✅ All components look good in both modes
- ✅ Smooth transitions between modes
- ✅ Charts are readable in both modes
- ✅ Accessibility maintained (contrast ratios)

---

## 📅 Timeline

**Day 1** (6-7 hours):
- Morning: Setup (Steps 1-5) - 2.5 hours
- Afternoon: Update UI components - 4 hours

**Day 2** (6-7 hours):
- Morning: Update remaining components - 3 hours
- Afternoon: Handle charts - 3 hours

**Day 3** (3-4 hours):
- Morning: Testing & bug fixes - 2 hours
- Afternoon: Polish & edge cases - 2 hours

**Total**: 16-18 hours ≈ **2-3 days**

---

## 🚀 Deployment

1. Merge feature branch to main
2. Deploy to production
3. Announce in release notes
4. Monitor for user feedback
5. Iterate on color choices if needed

---

## 🔮 Future Enhancements

- [ ] Multiple theme presets (ocean, forest, sunset)
- [ ] Custom color picker for accent color
- [ ] Scheduled theme switching (dark at night)
- [ ] High contrast mode for accessibility
- [ ] Themed app icons/logos

---

**Ready to implement? Start with Step 1!**
