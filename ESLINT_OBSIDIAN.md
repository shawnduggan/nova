# ESLint Rules for Obsidian Plugin Development

This configuration enforces Obsidian's plugin review requirements through automated linting.

## 🛡️ Security Rules

### `no-unsanitized/property` & `no-unsanitized/method`
Prevents unsafe DOM manipulation that could lead to XSS vulnerabilities.

**❌ Bad:**
```typescript
element.innerHTML = userContent;
element.outerHTML = `<div>${data}</div>`;
```

**✅ Good:**
```typescript
element.textContent = userContent;
element.createEl('div', { text: data });
```

### `no-restricted-properties`
Prevents direct manipulation of DOM properties that should use CSS classes.

**❌ Bad:**
```typescript
element.style.display = 'none';
element.innerHTML = '<span>content</span>';
```

**✅ Good:**
```typescript
element.addClass('hidden');
element.createEl('span', { text: 'content' });
```

### `no-restricted-syntax`
Prevents unsafe DOM methods and style attribute manipulation.

**❌ Bad:**
```typescript
element.setAttribute('style', 'color: red');
element.insertAdjacentHTML('beforeend', html);
```

**✅ Good:**
```typescript
element.addClass('text-red');
element.appendChild(newElement);
```

## 🎨 Styling Rules

### Direct Style Manipulation Prevention
These rules enforce using CSS classes instead of JavaScript styling:

- `element.style.*` → Use CSS classes
- `cssText` property → Use CSS classes
- `setAttribute('style', ...)` → Use CSS classes

**Why:** Better theme compatibility and maintainability.

## 🔧 TypeScript Rules

### `@typescript-eslint/no-explicit-any`
Warns about `any` type usage - should be minimized.

### `@typescript-eslint/consistent-type-assertions`
Enforces consistent type assertion style.

### `@typescript-eslint/no-unnecessary-type-assertion`
Prevents unnecessary type assertions.

## 🎯 Command Naming Rules

### Custom Rule: `no-plugin-prefix-commands`
Prevents command names from including plugin name prefix.

**❌ Bad:**
```typescript
.setTitle('Nova: Open sidebar')
```

**✅ Good:**
```typescript
.setTitle('Open sidebar')
```

## 📝 Usage

### Available Scripts

```bash
# Standard linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Strict Obsidian compliance check
npm run lint:obsidian

# Security-focused check
npm run lint:security
```

### Pre-commit Integration

Add to your pre-commit hook:
```bash
npm run lint:obsidian
```

### IDE Integration

For VSCode, install the ESLint extension and add to `.vscode/settings.json`:
```json
{
  "eslint.validate": ["typescript"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 🚀 Best Practices

1. **Use CSS classes over inline styles**
   - Better theme compatibility
   - Easier maintenance
   - Better performance

2. **Use DOM API over innerHTML**
   - Better security
   - Type safety
   - Obsidian helper functions

3. **Proper type guards over casting**
   - Runtime safety
   - Better IntelliSense
   - Clearer intent

4. **Minimal `any` usage**
   - Better type safety
   - Easier refactoring
   - Better documentation

## 🔍 Continuous Improvement

These rules will help catch violations early and maintain code quality that meets Obsidian's standards. Consider running the strict checks (`lint:obsidian`) in your CI/CD pipeline to prevent regressions.