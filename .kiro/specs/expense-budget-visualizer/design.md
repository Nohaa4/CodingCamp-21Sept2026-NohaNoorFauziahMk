# Design Document

## Expense & Budget Visualizer

---

## Overview

The Expense & Budget Visualizer is a fully client-side single-page web application (SPA) built with plain HTML, CSS, and Vanilla JavaScript. It allows users to record personal expense transactions, view a running balance total, and visualize spending distribution across three fixed categories — Food, Transport, and Fun — via an interactive pie chart powered by [Chart.js](https://www.chartjs.org/).

All data is persisted exclusively in the browser's Local Storage API. There is no backend, no build step, and no external runtime dependencies beyond Chart.js loaded via CDN. The app opens directly in a browser as a static file.

**Key design goals:**
- Zero-dependency runtime (except Chart.js via CDN)
- Single HTML file entry point, one CSS file, one JS file
- Predictable module boundaries between UI, storage, validation, and chart logic
- Graceful error handling when Local Storage is unavailable
- Mobile-friendly responsive layout supporting viewports from 320px upward
- Monthly Summary view grouping spending by calendar month (Optional Challenge 1)
- Sort Transactions control for display-order sorting without mutating storage (Optional Challenge 2)
- Dark/Light Mode toggle with Local Storage persistence (Optional Challenge 3)

---

## Architecture

The application follows a **layered, module-based architecture** within a single JavaScript file, separated into logical sections using the Module Pattern (IIFE or ES module-style closures). Responsibility is divided across four concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  InputFormUI · TransactionListUI · BalanceUI · ChartModule  │
│  MonthlySummaryUI · SortControl · ThemeToggle               │
├─────────────────────────────────────────────────────────────┤
│                    Controller Layer                         │
│     (orchestrates all data flow on every user action)       │
├──────────────────┬──────────────────┬───────────────────────┤
│  Validator       │  Chart Module    │  Sort/Summary Helpers │
│  (input valid.)  │  (Chart.js wrap) │  (pure functions)     │
├──────────────────┴──────────────────┴───────────────────────┤
│                    Storage Module                           │
│   transactions key · theme key (separate, no cross-write)   │
└─────────────────────────────────────────────────────────────┘
```

**Data flow for adding a transaction:**
1. User fills Input_Form and submits
2. Validator validates fields → returns errors or passes
3. Controller calls Storage to persist new transaction
4. Controller calls TransactionListUI to re-render list (respecting active sort order if any)
5. Controller calls BalanceUI to recompute and re-render total
6. Controller calls ChartModule to re-render pie chart
7. Controller calls MonthlySummaryUI to re-render monthly totals

**Data flow for deleting a transaction:**
1. User clicks delete control on a transaction row
2. Controller calls ConfirmationDialog.confirm()
3. If dismissed: no changes
4. If confirmed: Controller removes transaction from in-memory array
5. Controller calls Storage to persist updated array (before any DOM mutation)
6. Controller calls TransactionListUI.render() (respecting active sort order if any)
7. Controller calls BalanceUI.render()
8. Controller calls ChartModule.render()
9. Controller calls MonthlySummaryUI.render()

**Data flow on page load:**
1. StorageModule.loadTransactions() reads transaction array
2. StorageModule.loadTheme() reads saved theme preference
3. ThemeToggle.apply(theme) applies theme to document root
4. Controller passes transactions to TransactionListUI.render(), BalanceUI.render(), ChartModule.render(), MonthlySummaryUI.render()

**Data flow for sorting:**
1. User selects a sort option from SortControl
2. SortControl reads the current in-memory transaction array from Controller
3. SortControl.sort(transactions, option) returns a sorted copy (does NOT mutate the stored array)
4. Controller calls TransactionListUI.render(sortedCopy)
5. Storage is NOT written — the stored array order is unchanged

**Data flow for theme toggle:**
1. User activates ThemeToggle
2. ThemeToggle toggles between 'light' and 'dark'
3. ThemeToggle applies the new theme class/attribute to the document root
4. StorageModule.saveTheme(theme) persists preference to a separate Local Storage key `"ebv_theme"`
5. Transaction data in `"ebv_transactions"` is not touched

### File Structure

```
/
├── index.html          ← single entry point; loads CSS and JS
├── css/
│   └── styles.css      ← all application styles
└── js/
    └── app.js          ← all application logic
```

---

## Responsive Layout Design

The application uses a **single-column fluid layout** that adapts from 320px to full desktop widths. No JavaScript is involved in layout switching — responsiveness is achieved entirely through CSS.

**Breakpoints:**
- Default (mobile-first): single column, full-width components
- `@media (min-width: 600px)`: balance and chart may display side-by-side if space allows
- `@media (min-width: 900px)`: optional two-column layout for form + list

**Mobile-specific requirements:**
- All form fields use `width: 100%` with `box-sizing: border-box`
- `#transaction-list` uses `max-height` + `overflow-y: auto` to scroll within the viewport
- Chart canvas uses `max-width: 100%` to prevent overflow
- No fixed pixel widths on any top-level container
- Minimum touch target size: 44×44px for delete buttons and theme toggle (WCAG 2.5.5)

**CSS variable approach for theming:**
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-color: #dddddd;
  --accent-color: #4a90e2;
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #f5f5f5;
  --text-secondary: #aaaaaa;
  --border-color: #444444;
  --accent-color: #6ab0f5;
}
```

All component styles use these CSS variables, so theme switching is achieved by toggling `data-theme="dark"` on `<html>` with no additional JS DOM traversal.

---

## Components and Interfaces

### 1. StorageModule

Responsible for all interaction with `window.localStorage`. All methods are synchronous and throw a typed `StorageError` on failure.

| Method | Signature | Description |
|--------|-----------|-------------|
| `loadTransactions` | `() → Transaction[]` | Reads and deserializes the transaction array from Local Storage. Returns `[]` if key is absent. Throws `StorageError` on parse failure or security exception. |
| `saveTransactions` | `(transactions: Transaction[]) → void` | Serializes and writes the full transaction array to Local Storage. Throws `StorageError` on quota or security exception. |
| `loadTheme` | `() → string \| null` | Reads theme preference from `"ebv_theme"` key. Returns `null` if absent. |
| `saveTheme` | `(theme: string) → void` | Writes theme preference to `"ebv_theme"` key. Throws `StorageError` on failure. |

**Storage keys:**

| Key | Content |
|-----|---------|
| `"ebv_transactions"` | JSON array of Transaction objects |
| `"ebv_theme"` | String: `"light"` or `"dark"` |

**StorageError shape:**
```js
{ type: "StorageError", message: string }
```

---

### 2. Validator

A pure, stateless module. Takes raw form values and returns a structured validation result.

| Method | Signature | Description |
|--------|-----------|-------------|
| `validate` | `(name: string, amount: string, category: string) → ValidationResult` | Returns `{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }`. |

**Validation rules:**
- `name`: must be non-empty after trimming, max 100 characters
- `amount`: must parse to a finite number, between 0.01 and 999,999,999.99 (inclusive), up to 2 decimal places
- `category`: must be one of `"Food"`, `"Transport"`, `"Fun"`

---

### 3. TransactionListUI

Manages the `#transaction-list` DOM element.

| Method | Signature | Description |
|--------|-----------|-------------|
| `render` | `(transactions: Transaction[]) → void` | Full re-render of the list from an array. Shows empty-state message when array is empty. |
| `appendItem` | `(transaction: Transaction) → void` | Appends a single row to the existing list. |
| `removeItem` | `(id: string) → void` | Removes the DOM row matching the given transaction ID. |
| `showError` | `(message: string) → void` | Replaces list content with an error message. |

Each row contains: item name, formatted amount (2dp), category label, and a delete button with `data-id` attribute set to the transaction's ID.

---

### 4. InputFormUI

Manages the `#input-form` DOM element and its inline error display.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getValues` | `() → { name: string, amount: string, category: string }` | Reads current raw field values. |
| `showErrors` | `(errors: ValidationResult["errors"]) → void` | Displays inline error messages adjacent to invalid fields. |
| `clearErrors` | `() → void` | Removes all inline error messages. |
| `reset` | `() → void` | Clears all fields and resets to default empty state. |

---

### 5. BalanceUI

Manages the `#balance-display` DOM element.

| Method | Signature | Description |
|--------|-----------|-------------|
| `render` | `(transactions: Transaction[]) → void` | Computes sum and displays as formatted currency (2dp). |
| `showError` | `() → void` | Shows an error indication while retaining the last displayed value. |

---

### 6. ChartModule

Wraps Chart.js. Manages the `<canvas id="expense-chart">` element.

| Method | Signature | Description |
|--------|-----------|-------------|
| `render` | `(transactions: Transaction[]) → void` | Destroys the existing Chart.js instance (if any) and creates a new one with current data. Shows placeholder if `transactions` is empty. |

**Category colors (fixed):**

| Category | Fill Color |
|----------|------------|
| Food | `#FF6384` |
| Transport | `#36A2EB` |
| Fun | `#FFCE56` |

Chart.js is loaded via CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

---

### 7. ConfirmationDialog

A lightweight modal/confirm overlay using the browser-native `window.confirm()` API (or a custom modal for styling consistency).

| Method | Signature | Description |
|--------|-----------|-------------|
| `confirm` | `(message: string) → boolean` | Displays confirmation prompt. Returns `true` if user confirms, `false` if dismissed. |

---

### 8. Controller

The orchestrating layer. Wires all modules together. Contains no DOM queries of its own — delegates entirely to the UI and storage modules.

**Event handlers registered by Controller:**

| Event | Handler |
|-------|---------|
| `DOMContentLoaded` | `init()` — loads storage, renders all UI components, calls `MonthlySummaryUI.render()` and `ThemeToggle.init(savedTheme)` |
| Form `submit` | `handleAddTransaction()` — on success also calls `MonthlySummaryUI.render(updated)` |
| Transaction list `click` (delegated) | `handleDeleteClick()` — on success also calls `MonthlySummaryUI.render(updated)` |
| Sort control `change` | `handleSortChange()` — applies sort to display copy, calls `TransactionListUI.render(sorted)` |
| Theme toggle `click` | `handleThemeToggle()` — delegates to `ThemeToggle.toggle()` |

---

### 9. MonthlySummaryUI

Manages the `#monthly-summary` DOM element.

| Method | Signature | Description |
|--------|-----------|-------------|
| `render` | `(transactions: Transaction[]) → void` | Groups transactions by calendar month using `createdAt`, computes per-month totals, renders a summary row per month. Shows empty-state message when array is empty. |

Month grouping key: `YYYY-MM` derived from `new Date(createdAt)`. Display label: `"Month YYYY"` (e.g. `"September 2026"`). Each summary row shows: month label + formatted total (2dp).

---

### 10. SortControl

Manages the `#sort-control` DOM element (a `<select>` or button group).

| Method | Signature | Description |
|--------|-----------|-------------|
| `getActiveSort` | `() → SortOption \| null` | Returns the currently selected sort option, or `null` if default (insertion order). |
| `onSortChange` | `(callback: (option: SortOption \| null) → void) → void` | Registers a callback invoked whenever the user changes the sort selection. |

Sort options:
- `"amount-asc"` — Amount ascending
- `"amount-desc"` — Amount descending
- `"category-asc"` — Category alphabetical

**IMPORTANT:** SortControl never reads from or writes to Storage. It only affects the displayed order.

---

### 11. ThemeToggle

Manages the `#theme-toggle` button and the document-level theme state.

| Method | Signature | Description |
|--------|-----------|-------------|
| `init` | `(savedTheme: string \| null) → void` | Applies the saved theme on page load; defaults to `'light'` if null. |
| `toggle` | `() → void` | Switches between `'light'` and `'dark'`; applies theme class to `document.documentElement`; calls `StorageModule.saveTheme()`. |
| `getTheme` | `() → string` | Returns the current theme: `'light'` or `'dark'`. |

Theme is applied by toggling the CSS attribute `data-theme="dark"` on `<html>`. CSS variables in `styles.css` define colors for both themes.

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID v4, generated at creation time (crypto.randomUUID())
 * @property {string}  name      - Item name, 1–100 characters (trimmed)
 * @property {number}  amount    - Positive number, max 2 decimal places, 0.01–999999999.99
 * @property {string}  category  - One of: "Food" | "Transport" | "Fun"
 * @property {number}  createdAt - Unix timestamp (Date.now()) at time of creation
 */
```

**Example serialized value in Local Storage (key: `"ebv_transactions"`):**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": 1700000000000
  }
]
```

**Invariants:**
- `amount > 0`
- `amount` has at most 2 decimal places
- `category` is always one of the three fixed values
- `id` is unique within the dataset
- `createdAt` is a positive integer

### ValidationResult

```js
/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {{ name?: string, amount?: string, category?: string }} errors
 */
```

### CategoryTotal

Used internally by ChartModule and BalanceUI to aggregate spending.

```js
/**
 * @typedef {Object} CategoryTotal
 * @property {string} category  - Category name
 * @property {number} total     - Sum of amounts for this category
 */
```

### SortOption

```js
/**
 * @typedef {"amount-asc" | "amount-desc" | "category-asc"} SortOption
 */
```

### MonthSummary

```js
/**
 * @typedef {Object} MonthSummary
 * @property {string} monthKey   - "YYYY-MM" derived from createdAt
 * @property {string} label      - Display string, e.g. "September 2026"
 * @property {number} total      - Sum of all transaction amounts in this month
 */
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Validator rejects invalid inputs

*For any* combination of (name, amount, category) inputs where at least one field is invalid (name is empty or exceeds 100 chars, amount is out of the range 0.01–999,999,999.99 or non-numeric, category is not one of the three valid values), the `Validator.validate()` function SHALL return `{ valid: false }` and populate the `errors` object with at least one field-specific error message.

**Validates: Requirements 1.2, 1.3**

---

### Property 2: Validator accepts valid inputs

*For any* combination of (name, amount, category) where name is a non-empty string of 1–100 characters, amount is a number in the range 0.01–999,999,999.99 with at most 2 decimal places, and category is one of `"Food"`, `"Transport"`, or `"Fun"`, the `Validator.validate()` function SHALL return `{ valid: true, errors: {} }`.

**Validates: Requirements 1.2**

---

### Property 3: Transaction add persists to storage (round-trip)

*For any* valid transaction object, after calling `StorageModule.saveTransactions(transactions)` with a list containing that transaction, a subsequent call to `StorageModule.loadTransactions()` SHALL return an array containing an object with the same `id`, `name`, `amount`, `category`, and `createdAt` values.

**Validates: Requirements 1.4, 6.1**

---

### Property 4: Confirmed deletion removes transaction from storage (round-trip)

*For any* non-empty array of transactions stored in Local Storage, after the user confirms deletion of a specific transaction by `id`, calling `StorageModule.loadTransactions()` SHALL return an array that does not contain any transaction with that `id`, and the remaining transactions SHALL be unchanged.

**Validates: Requirements 3.3, 3.5**

---

### Property 5: Dismissed confirmation leaves storage unchanged

*For any* array of transactions stored in Local Storage, when the user dismisses the deletion confirmation prompt, calling `StorageModule.loadTransactions()` SHALL return an array with identical contents (same transactions, same order) as before the prompt was shown.

**Validates: Requirements 3.4**

---

### Property 6: Amount formatting always produces exactly two decimal places

*For any* numeric amount value in the valid range (0.01–999,999,999.99), the `formatAmount(amount)` formatting function SHALL return a string that ends with exactly two decimal digit characters after a decimal point (e.g., `"12.50"`, `"0.01"`, `"1000.00"`).

**Validates: Requirements 2.1, 4.2**

---

### Property 7: Balance equals the arithmetic sum of all transaction amounts

*For any* array of transactions (including the empty array), the `computeBalance(transactions)` function SHALL return a value equal to the arithmetic sum of all `amount` fields, and the formatted display SHALL show that value with exactly two decimal places. For an empty array, the result SHALL be `0.00`.

**Validates: Requirements 4.2, 4.5, 3.7**

---

### Property 8: Transaction list preserves insertion order after storage round-trip

*For any* ordered array of transactions written to Local Storage via `StorageModule.saveTransactions()`, a subsequent call to `StorageModule.loadTransactions()` SHALL return an array with the same transactions in the same order (by `id` sequence).

**Validates: Requirements 2.3, 6.3**

---

### Property 9: Each rendered transaction row has a delete control with the correct identifier

*For any* non-empty array of transactions passed to `TransactionListUI.render()`, the resulting DOM SHALL contain exactly one delete control element per transaction, where each control's `data-id` attribute matches the corresponding transaction's `id`.

**Validates: Requirements 3.1**

---

### Property 10: Chart data includes only non-zero categories with correct proportions

*For any* non-empty array of transactions, the `computeChartData(transactions)` function SHALL return a dataset where:
- Only categories with a total `> 0` are included
- Each included category's proportion equals `(category total / grand total)`
- The sum of all proportions equals `1.0` (within floating-point tolerance)
- No two categories share the same fill color

For an empty array, the function SHALL return an empty dataset (triggering the placeholder state).

**Validates: Requirements 5.1, 5.2, 5.6, 5.7**

---

### Property 11: Sorting does not mutate the stored transaction array

*For any* non-empty array of transactions and any SortOption, calling `sortTransactions(transactions, option)` SHALL return a new array with the same transactions in the sorted order, while the original array passed as input remains unchanged (same reference contents, same order).

**Validates: Requirements 11.3**

---

### Property 12: Monthly summary totals equal per-month arithmetic sums

*For any* array of transactions, the `computeMonthlySummary(transactions)` function SHALL return a MonthSummary array where each entry's `total` equals the arithmetic sum of `.amount` for all transactions whose `createdAt` falls within that calendar month, and each month present in the input has exactly one corresponding summary entry.

**Validates: Requirements 10.1, 10.2**

---

### Property 13: Theme toggle cycles between exactly two states

*For any* initial theme state (light or dark), calling `ThemeToggle.toggle()` SHALL switch the active theme to the other value, and calling it again SHALL return to the original value. The theme preference written to Storage SHALL always be either `"light"` or `"dark"`.

**Validates: Requirements 12.1, 12.4**

---

## Error Handling

### Storage Errors

All interactions with `localStorage` are wrapped in `try/catch` blocks. When an exception is caught (e.g., `SecurityError`, `QuotaExceededError`), a `StorageError` object is thrown to the calling Controller, which then:
- Prevents the pending operation (add/delete) from completing
- Renders an error message in the appropriate UI zone without clearing existing valid data

**On load failure:** `TransactionListUI.showError()` is called; Balance and Chart display zero/placeholder states.
**On save failure (add):** Inline error shown near the form submit button; form fields retain their values.
**On save failure (delete):** Error message shown; transaction remains in the list.

### Validation Errors

Validation errors are handled purely in the UI layer — no exceptions are thrown. `Validator.validate()` returns a `ValidationResult`; the Controller checks `valid` and calls `InputFormUI.showErrors()` when `false`. Existing valid field values are preserved by only clearing fields on a successful submission.

### Chart Rendering Errors

If Chart.js fails to initialize (e.g., canvas not found, library not loaded), the ChartModule catches the error and displays a text-based fallback message in the chart container. This prevents a Chart.js failure from crashing the rest of the application.

### Theme Storage Errors

If `StorageModule.saveTheme()` throws a `StorageError`, the ThemeToggle still applies the visual theme change to the current session but logs a warning. The theme preference will not persist across reloads. The theme error does not affect transaction data.

---

## Testing Strategy

### Overview

The testing approach combines **unit/example-based tests** for specific behaviors and edge cases with **property-based tests** for universal invariants across the pure logic functions. This is appropriate because the app has well-defined pure functions (Validator, formatAmount, computeBalance, computeChartData, sortTransactions, computeMonthlySummary, StorageModule) alongside UI rendering concerns.

### Property-Based Testing

**Library:** [fast-check](https://github.com/dubzzz/fast-check) (loaded via CDN or npm for test environment)

**Configuration:** Each property test runs a minimum of **100 iterations** to exercise the input space.

**Test tagging convention:**
```js
// Feature: expense-budget-visualizer, Property 1: Validator rejects invalid inputs
```

**Properties to implement as property-based tests:**

| Property | Target Function | fast-check Arbitraries |
|----------|----------------|------------------------|
| Property 1 | `Validator.validate()` | `fc.oneof(fc.constant(""), fc.string({maxLength: 101}))` for name; out-of-range floats for amount |
| Property 2 | `Validator.validate()` | `fc.string({minLength:1, maxLength:100})` × valid amounts × category enum |
| Property 3 | `StorageModule.saveTransactions / loadTransactions` | `fc.array(fc.record({id, name, amount, category, createdAt}))` |
| Property 4 | `StorageModule` + Controller delete path | Random transaction arrays with a random deletion target |
| Property 5 | `StorageModule` + Controller confirm=false path | Random transaction arrays |
| Property 6 | `formatAmount()` | `fc.float({min: 0.01, max: 999999999.99})` |
| Property 7 | `computeBalance()` | `fc.array(fc.record({amount: fc.float({min:0.01, max:999999999.99})}))` |
| Property 8 | `StorageModule` round-trip | `fc.array(transactionArbitrary, {minLength: 1})` |
| Property 9 | `TransactionListUI.render()` | `fc.array(transactionArbitrary, {minLength: 1})` |
| Property 10 | `computeChartData()` | `fc.array(transactionArbitrary, {minLength: 1})` |
| Property 11 | `sortTransactions()` | `fc.array(transactionArbitrary, {minLength: 1})` × `fc.constantFrom("amount-asc", "amount-desc", "category-asc")` |
| Property 12 | `computeMonthlySummary()` | `fc.array(transactionArbitrary)` with varied `createdAt` timestamps spanning multiple months |
| Property 13 | `ThemeToggle.toggle()` | `fc.constantFrom("light", "dark")` as initial state |

### Unit / Example-Based Tests

Unit tests cover specific scenarios, edge cases, and UI interactions:

- **Form validation UI**: Error messages appear for each invalid field; valid fields retain values (Req 1.3)
- **Empty storage**: Transaction list shows empty-state message (Req 2.4)
- **Storage unavailable on load**: Error message displayed (Req 2.5)
- **Storage unavailable on submit**: Submission blocked, error shown (Req 1.5)
- **Delete confirmation dialog**: Confirm dialog invoked on delete button click (Req 3.2)
- **Chart placeholder**: Empty chart container shows placeholder text (Req 5.7)
- **Balance display position**: Balance_Display renders at the top of the page (Req 4.1)
- **Storage ordering**: `saveTransactions` writes before DOM update (Req 6.1, 6.2)
- **Monthly summary empty state**: No transactions → empty-state message shown (Req 10.5)
- **Sort default order**: No sort selected → list displays in insertion order (Req 11.5)
- **Theme default**: No saved theme → light mode applied (Req 12.1)

### Integration Tests

- **Full add flow**: Fill form → submit → verify list row, balance, chart, and MonthlySummaryUI all update correctly (Req 1.4, 4.3, 5.4, 10.3)
- **Full delete flow**: Click delete → confirm → verify row removed, balance updated, chart updated, MonthlySummaryUI updated (Req 3.3, 3.7, 3.8, 3.9, 10.4)
- **Page reload persistence**: Add transactions → reload page → verify all data restored (Req 6.3)
- **Performance**: Add/delete with 1,000 transactions → verify UI updates within 100ms (Req 8.2)
- **Sort display-only**: Sort by amount → verify list order changes → reload → verify stored order unchanged (Req 11.3)
- **Theme persistence**: Toggle theme → reload → verify same theme restored (Req 12.4)
- **Theme no data effect**: Toggle theme → verify transaction data in `"ebv_transactions"` storage key is unchanged (Req 12.5)

### Accessibility and Browser Compatibility

- Manual testing across Chrome, Firefox, Edge, Safari stable releases (Req 8.1)
- Color contrast audit: verify all text meets 4.5:1 contrast ratio in both light and dark modes (Req 8.3, 12.3)
- Keyboard navigation: form and delete controls reachable and operable via keyboard
- ARIA labels on form fields and delete buttons for screen reader support
- Touch target audit: delete buttons and theme toggle meet minimum 44×44px (Req 9.2, WCAG 2.5.5)
- Responsive layout testing at 320px, 600px, and 900px+ viewport widths (Req 9.1–9.5)
