# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side, zero-dependency (except Chart.js via CDN) expense tracking web app using plain HTML, CSS, and Vanilla JavaScript. Implementation proceeds in layers: scaffold → pure logic modules (Storage, Validator, formatters) → UI components → Controller wiring → styling → optional challenge modules → tests. Each layer builds directly on the previous one, with integration checkpoints to verify correctness before moving forward.

---

## Tasks

### MVP

- [ ] 1. Scaffold project structure and HTML entry point *(MVP)*
  - Create the root directory layout: `index.html`, `css/styles.css`, `js/app.js`
  - Add `<meta name="viewport" content="width=device-width, initial-scale=1.0">` meta tag for mobile support
  - Write `index.html` with all required DOM elements: `#input-form` (name text field, amount number field, category `<select>`, submit button), `#balance-display`, `#transaction-list`, `<canvas id="expense-chart">`, and placeholder containers for inline error messages
  - Add `#monthly-summary` container element
  - Add `#sort-control` `<select>` element with options: default (insertion order), Amount ↑ (`amount-asc`), Amount ↓ (`amount-desc`), Category A–Z (`category-asc`)
  - Add `#theme-toggle` button element
  - Add the Chart.js CDN `<script>` tag (`https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`) before `js/app.js`
  - Add the `<link>` tag referencing `css/styles.css`
  - Verify the page opens in a browser without console errors and all DOM IDs are present
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.1, 10.1, 11.1, 12.1_

- [ ] 2. Implement StorageModule *(MVP)*
  - [ ] 2.1 Implement `StorageModule.saveTransactions`, `StorageModule.loadTransactions`, `StorageModule.loadTheme`, and `StorageModule.saveTheme`
    - Define storage key constants: `"ebv_transactions"` and `"ebv_theme"`
    - Implement `loadTransactions()`: reads from `localStorage`, JSON-parses the value, returns `[]` when key is absent; wraps all access in `try/catch` and throws `{ type: "StorageError", message }` on `SecurityError` or parse failure
    - Implement `saveTransactions(transactions)`: JSON-serializes and writes the full array; wraps in `try/catch` and throws `{ type: "StorageError", message }` on `QuotaExceededError` or `SecurityError`
    - Implement `loadTheme()`: reads from `"ebv_theme"` key; returns `null` if absent; wraps in `try/catch` and returns `null` on any error
    - Implement `saveTheme(theme)`: writes the theme string to `"ebv_theme"` key; wraps in `try/catch` and throws `{ type: "StorageError", message }` on failure
    - Note: `"ebv_theme"` and `"ebv_transactions"` are completely independent — no cross-key reads or writes ever occur
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 12.4_

  - [ ]* 2.2 Write property test for StorageModule round-trip (Property 3)
    - **Property 3: Transaction add persists to storage (round-trip)**
    - For any valid transaction object, after `saveTransactions([...tx])` a subsequent `loadTransactions()` SHALL return an array containing an object with identical `id`, `name`, `amount`, `category`, and `createdAt`
    - Use `fc.array(fc.record({id, name, amount, category, createdAt}))` arbitrary
    - **Validates: Requirements 1.4, 6.1**

  - [ ]* 2.3 Write property test for StorageModule ordering (Property 8)
    - **Property 8: Transaction list preserves insertion order after storage round-trip**
    - For any ordered array written via `saveTransactions`, `loadTransactions` SHALL return the same transactions in the same order
    - Use `fc.array(transactionArbitrary, {minLength: 1})` arbitrary
    - **Validates: Requirements 2.3, 6.3**

- [ ] 3. Implement Validator module *(MVP)*
  - [ ] 3.1 Implement `Validator.validate(name, amount, category)`
    - Name rule: non-empty after `.trim()`, max 100 characters — error message: `"Item name is required"` / `"Item name must be 100 characters or fewer"`
    - Amount rule: parses to a finite number, between 0.01 and 999,999,999.99 inclusive, max 2 decimal places — error message: `"Amount must be a number between 0.01 and 999,999,999.99"`
    - Category rule: must be one of `"Food"`, `"Transport"`, `"Fun"` — error message: `"Please select a category"`
    - Returns `{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }`
    - _Requirements: 1.2, 1.3_

  - [ ]* 3.2 Write property test for Validator rejecting invalid inputs (Property 1)
    - **Property 1: Validator rejects invalid inputs**
    - For any (name, amount, category) where at least one field is invalid, `validate()` SHALL return `{ valid: false }` with at least one error key populated
    - Use `fc.oneof(fc.constant(""), fc.string({minLength: 101}))` for invalid name; out-of-range floats / non-numeric strings for invalid amount; non-enum strings for invalid category
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 3.3 Write property test for Validator accepting valid inputs (Property 2)
    - **Property 2: Validator accepts valid inputs**
    - For any (name, amount, category) within all valid ranges, `validate()` SHALL return `{ valid: true, errors: {} }`
    - Use `fc.string({minLength:1, maxLength:100})` × valid amounts × `fc.constantFrom("Food","Transport","Fun")`
    - **Validates: Requirements 1.2**

- [ ] 4. Implement pure utility functions *(MVP)*
  - [ ] 4.1 Implement `formatAmount(amount)` and `computeBalance(transactions)`
    - `formatAmount(amount)`: returns a string formatted to exactly 2 decimal places using `Number.prototype.toFixed(2)`
    - `computeBalance(transactions)`: sums all `.amount` fields; returns `0` for an empty array; result is the arithmetic sum
    - _Requirements: 2.1, 4.2, 4.5_

  - [ ] 4.2 Implement `computeChartData(transactions)`
    - Aggregates transactions by category into `CategoryTotal[]`
    - Excludes any category whose total is `0`
    - Returns empty array when `transactions` is empty
    - Computes each category's proportion as `categoryTotal / grandTotal`
    - Returns `{ labels, data, colors }` structure ready for Chart.js
    - Fixed color map: Food → `#FF6384`, Transport → `#36A2EB`, Fun → `#FFCE56`
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7_

  - [ ] 4.3 Implement `sortTransactions(transactions, option)` and `computeMonthlySummary(transactions)`
    - `sortTransactions(transactions, option)`:
      - Returns a NEW array (never mutates the input array)
      - `"amount-asc"`: sort by `.amount` ascending
      - `"amount-desc"`: sort by `.amount` descending
      - `"category-asc"`: sort by `.category` alphabetically ascending
      - When `option` is `null`, returns the array in its original insertion order (a shallow copy)
    - `computeMonthlySummary(transactions)`:
      - Groups transactions by calendar month using `new Date(createdAt)`
      - Month key: `"YYYY-MM"` (e.g. `"2026-09"`)
      - Display label: `"Month YYYY"` using `toLocaleString('en-US', { month: 'long', year: 'numeric' })` on the Date
      - Each group entry: `{ monthKey, label, total }` where `total` is the sum of `.amount` for that month
      - Returns entries sorted by `monthKey` descending (most recent month first)
      - Returns `[]` when `transactions` is empty
    - _Requirements: 11.1, 11.2, 11.3, 10.1, 10.2, 10.5_

  - [ ]* 4.4 Write property test for `formatAmount` (Property 6)
    - **Property 6: Amount formatting always produces exactly two decimal places**
    - For any float in range 0.01–999,999,999.99, `formatAmount()` SHALL return a string ending with exactly two decimal digit characters after a decimal point
    - Use `fc.float({min: 0.01, max: 999999999.99})`
    - **Validates: Requirements 2.1, 4.2**

  - [ ]* 4.5 Write property test for `computeBalance` (Property 7)
    - **Property 7: Balance equals the arithmetic sum of all transaction amounts**
    - For any array of transactions, `computeBalance()` SHALL equal the arithmetic sum of all `.amount` fields; for empty array, result SHALL be `0`
    - Use `fc.array(fc.record({amount: fc.float({min:0.01, max:999999999.99})}))`
    - **Validates: Requirements 4.2, 4.5, 3.7**

  - [ ]* 4.6 Write property test for `computeChartData` (Property 10)
    - **Property 10: Chart data includes only non-zero categories with correct proportions**
    - For any non-empty transactions array, `computeChartData()` SHALL include only categories with total > 0; proportions SHALL sum to 1.0 (within floating-point tolerance); no two categories share a fill color; for empty array, returns empty dataset
    - Use `fc.array(transactionArbitrary, {minLength: 1})`
    - **Validates: Requirements 5.1, 5.2, 5.6, 5.7**

- [ ] 5. Checkpoint — pure logic complete *(MVP)*
  - Ensure all tests for StorageModule, Validator, `formatAmount`, `computeBalance`, and `computeChartData` pass; ask the user if questions arise before proceeding to UI components.

- [ ] 6. Implement TransactionListUI *(MVP)*
  - [ ] 6.1 Implement `TransactionListUI.render(transactions)`
    - Clears `#transaction-list` and rebuilds it from the array
    - Each row displays: item name, `formatAmount(amount)` value, category label, and a delete `<button>` with `data-id` set to the transaction's `id` and an accessible `aria-label`
    - When `transactions` is empty, renders the empty-state message: `"No expenses recorded yet."`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

  - [ ] 6.2 Implement `TransactionListUI.appendItem(transaction)`, `removeItem(id)`, and `showError(message)`
    - `appendItem`: creates and appends a single row in the same format as `render` without rebuilding the whole list
    - `removeItem`: finds the row whose delete button has `data-id === id` and removes that row from the DOM
    - `showError`: replaces list content with the provided error message string (used for storage-load failures)
    - _Requirements: 2.5, 3.1_

  - [ ]* 6.3 Write property test for TransactionListUI.render delete controls (Property 9)
    - **Property 9: Each rendered transaction row has a delete control with the correct identifier**
    - For any non-empty array passed to `render()`, the DOM SHALL contain exactly one delete control per transaction, each with a `data-id` matching the transaction's `id`
    - Use `fc.array(transactionArbitrary, {minLength: 1})`
    - **Validates: Requirements 3.1**

- [ ] 7. Implement InputFormUI *(MVP)*
  - [ ] 7.1 Implement `InputFormUI.getValues()`, `showErrors()`, `clearErrors()`, and `reset()`
    - `getValues()`: reads raw string values from `#name-input`, `#amount-input`, `#category-select`
    - `showErrors(errors)`: for each key in `errors` (`name`, `amount`, `category`), renders the error string in the adjacent error `<span>` element; leaves other fields untouched
    - `clearErrors()`: clears all inline error `<span>` elements
    - `reset()`: calls `form.reset()` and `clearErrors()`; completes within 500ms (synchronous DOM ops)
    - Add `aria-describedby` attributes linking each input to its error span for accessibility
    - _Requirements: 1.1, 1.3, 1.6_

- [ ] 8. Implement BalanceUI *(MVP)*
  - [ ] 8.1 Implement `BalanceUI.render(transactions)` and `BalanceUI.showError()`
    - `render(transactions)`: calls `computeBalance(transactions)`, then displays `formatAmount(result)` in `#balance-display`; updates within 500ms (synchronous DOM op)
    - `showError()`: appends an error indicator to `#balance-display` while retaining the last successfully rendered value
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 9. Implement ChartModule *(MVP)*
  - [ ] 9.1 Implement `ChartModule.render(transactions)`
    - If `transactions` is empty, destroys any existing Chart.js instance and renders the placeholder text `"No spending data available."` in the chart container
    - Otherwise, calls `computeChartData(transactions)`, destroys any existing Chart.js instance, creates a new `Chart` (type `"pie"`) on `<canvas id="expense-chart">` with labels, data, and fixed background colors; updates within 500ms
    - Wraps Chart.js initialization in `try/catch`; on failure, displays a text-based fallback in the chart container
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 10. Implement ConfirmationDialog *(MVP)*
  - [ ] 10.1 Implement `ConfirmationDialog.confirm(message)`
    - Wraps `window.confirm(message)`; returns `true` if the user confirms, `false` if dismissed
    - _Requirements: 3.2, 3.4_

- [ ] 11. Implement Controller and wire everything together *(MVP)*
  - [ ] 11.1 Implement `Controller.init()` (DOMContentLoaded handler)
    - Calls `StorageModule.loadTransactions()` inside `try/catch`
    - Calls `StorageModule.loadTheme()` and passes result to `ThemeToggle.init(savedTheme)`
    - On success: passes transactions to `TransactionListUI.render()`, `BalanceUI.render()`, `ChartModule.render()`, and `MonthlySummaryUI.render()`
    - On `StorageError`: calls `TransactionListUI.showError()` with the load-failure message; renders balance, chart, and monthly summary with empty state
    - Must complete all rendering within 200ms of `DOMContentLoaded`
    - _Requirements: 2.3, 2.5, 4.1, 5.7, 6.3, 10.1, 12.1, 12.4_

  - [ ] 11.2 Implement `Controller.handleAddTransaction()` (form submit handler)
    - Prevents default form submission
    - Calls `InputFormUI.clearErrors()` then `InputFormUI.getValues()`
    - Calls `Validator.validate()`; on failure: calls `InputFormUI.showErrors(errors)` and returns
    - Builds a `Transaction` object: `id` via `crypto.randomUUID()`, `name` trimmed, `amount` as `parseFloat`, `category`, `createdAt` as `Date.now()`
    - Calls `StorageModule.saveTransactions([...existing, newTx])` inside `try/catch`
    - On `StorageError`: displays inline save-failure error near submit button; retains form values; returns
    - On success: calls `BalanceUI.render(updated)`, `ChartModule.render(updated)`, `MonthlySummaryUI.render(updated)`, `InputFormUI.reset()`
    - When a sort is active: calls `TransactionListUI.render(sortTransactions(updated, SortControl.getActiveSort()))` to re-render the full sorted list; when no sort is active, `appendItem(newTx)` is acceptable as an optimisation
    - All UI updates must complete within 500ms
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 4.3, 5.4, 6.1, 10.3, 11.4_

  - [ ] 11.3 Implement `Controller.handleDeleteClick()` (delegated click handler on `#transaction-list`)
    - Reads `data-id` from the clicked delete button; ignores clicks elsewhere
    - Calls `ConfirmationDialog.confirm("Delete this transaction?")`
    - If dismissed (`false`): returns without any change
    - If confirmed (`true`): removes the transaction from the in-memory array, calls `StorageModule.saveTransactions(updated)` inside `try/catch`
    - On `StorageError`: displays error message; transaction remains in list and storage unchanged
    - On success: calls `TransactionListUI.removeItem(id)`, `BalanceUI.render(updated)`, `ChartModule.render(updated)`, `MonthlySummaryUI.render(updated)`
    - Storage is written before any DOM mutation
    - All UI updates must complete within 300ms
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 6.2, 10.4_

  - [ ] 11.4 Implement `Controller.handleSortChange()` (sort control change handler)
    - Registers a `change` event listener on `#sort-control`
    - Reads the selected value from `SortControl.getActiveSort()` (`null` for the default insertion-order option)
    - Calls `sortTransactions(masterTransactions, option)` to produce a display copy
    - Calls `TransactionListUI.render(sortedCopy)` — does NOT call `StorageModule.saveTransactions()`
    - The master in-memory `transactions` array is never reordered or mutated by this handler
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 11.5 Implement `Controller.handleThemeToggle()` (theme toggle click handler)
    - Registers a `click` event listener on `#theme-toggle`
    - Delegates to `ThemeToggle.toggle()`
    - `ThemeToggle.toggle()` switches the `data-theme` attribute on `<html>`, then calls `StorageModule.saveTheme(newTheme)`
    - If `StorageModule.saveTheme()` throws a `StorageError`, logs a warning; the visual theme change still applies to the current session
    - Does NOT read from or write to the `"ebv_transactions"` key
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

- [ ] 12. Checkpoint — full feature wired *(MVP)*
  - Open `index.html` in a browser; add several transactions across all three categories; delete one; reload the page and verify data persists; ask the user if questions arise before proceeding to styling.

- [ ] 13. Implement CSS styling *(MVP)*
  - [ ] 13.1 Write `css/styles.css` with responsive layout, typography, component styles, and theme support
    - Mobile-first responsive layout:
      - Use `box-sizing: border-box` on all elements
      - Single-column layout by default; no fixed pixel widths on top-level containers
      - `@media (min-width: 600px)`: balance and chart may display side-by-side
      - `@media (min-width: 900px)`: optional two-column layout for form + list
      - No horizontal scrolling at any viewport width from 320px upward
    - Component styles:
      - `Balance_Display` at top, visually separated by border or background contrast
      - `#transaction-list`: `max-height` + `overflow-y: auto` for scrollable list
      - Form fields: `width: 100%` with `box-sizing: border-box`, usable at 320px; error `<span>` elements styled in red with sufficient contrast
      - Delete buttons and `#theme-toggle`: minimum touch target 44×44px (WCAG 2.5.5)
      - Chart canvas: `max-width: 100%` to prevent overflow on small screens
      - `#monthly-summary`: clearly separated section below the chart
      - `#sort-control`: displayed above or adjacent to `#transaction-list`
    - Typography:
      - Base font size minimum `14px`
      - All text: minimum 4.5:1 contrast ratio against background in both light and dark modes
    - CSS variables for theming (define on `:root`, override on `[data-theme="dark"]`):
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
    - All component background and foreground colors must use these CSS variables
    - _Requirements: 2.2, 4.1, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 12.2, 12.3_

---

### Optional Challenge 1 — Monthly Summary

- [ ] 14. Implement MonthlySummaryUI *(Optional Challenge 1)*
  - [ ] 14.1 Implement `MonthlySummaryUI.render(transactions)`
    - Clears `#monthly-summary` and rebuilds it from the result of `computeMonthlySummary(transactions)`
    - Each row displays: month label (e.g. "September 2026") and formatted total (2dp)
    - Rows are ordered most-recent month first (matches `computeMonthlySummary` output order)
    - When `transactions` is empty, renders the empty-state message: `"No monthly data yet."`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

---

### Optional Challenge 2 — Sort Transactions

- [ ] 15. Implement SortControl *(Optional Challenge 2)*
  - [ ] 15.1 Implement `SortControl.getActiveSort()` and `SortControl.onSortChange(callback)`
    - `getActiveSort()`: reads the current value of `#sort-control`; returns `null` when the default (insertion order) option is selected, otherwise returns the SortOption string
    - `onSortChange(callback)`: registers a `change` event listener on `#sort-control` that invokes the callback with the new sort option (or `null` for default)
    - The `#sort-control` element has these `<option>` values: `""` (default), `"amount-asc"`, `"amount-desc"`, `"category-asc"`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

---

### Optional Challenge 3 — Dark/Light Mode

- [ ] 16. Implement ThemeToggle *(Optional Challenge 3)*
  - [ ] 16.1 Implement `ThemeToggle.init(savedTheme)`, `ThemeToggle.toggle()`, and `ThemeToggle.getTheme()`
    - `init(savedTheme)`: if `savedTheme` is `"dark"`, sets `document.documentElement.setAttribute("data-theme", "dark")` and updates the toggle button label/icon; defaults to light mode if `savedTheme` is `null` or `"light"`
    - `toggle()`: reads current theme from `document.documentElement`; switches to the other value; calls `document.documentElement.setAttribute("data-theme", newTheme)`; calls `StorageModule.saveTheme(newTheme)`; if `saveTheme` throws `StorageError`, logs a warning but does not revert the visual change
    - `getTheme()`: returns `document.documentElement.getAttribute("data-theme") || "light"`
    - Update the toggle button label or icon to reflect the current theme (e.g. "🌙 Dark" / "☀️ Light")
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

---

### Tests

- [ ] 17. Write unit and integration tests
  - [ ]* 17.1 Write unit tests for specific behaviors and edge cases
    - Form validation UI: error messages appear for each invalid field; valid fields retain values (Req 1.3)
    - Empty storage on load: `TransactionListUI` shows `"No expenses recorded yet."` (Req 2.4)
    - Storage unavailable on load: `TransactionListUI.showError()` called with appropriate message (Req 2.5)
    - Storage unavailable on submit: submission blocked, inline error shown near submit button, form values retained (Req 1.5)
    - Delete confirmation dialog: `ConfirmationDialog.confirm()` invoked when delete button is clicked (Req 3.2)
    - Dismiss confirmation: transaction unchanged in list and storage (Req 3.4)
    - Chart placeholder: empty `transactions` array causes placeholder text to render instead of `<canvas>` chart (Req 5.7)
    - Storage written before DOM update: `saveTransactions` called before any list/balance/chart DOM mutation in add and delete flows (Req 6.1, 6.2)
    - Monthly summary empty state: no transactions → `MonthlySummaryUI` shows `"No monthly data yet."` (Req 10.5)
    - Sort default order: no sort selected → list displays in insertion order (Req 11.5)
    - Sort does not write to storage: activating sort → `StorageModule.saveTransactions` NOT called (Req 11.3)
    - Theme default: no saved theme → light mode applied (Req 12.1)
    - Theme does not write transactions: toggling theme → `"ebv_transactions"` key unchanged (Req 12.5)
    - _Requirements: 1.3, 1.5, 2.4, 2.5, 3.2, 3.4, 5.7, 6.1, 6.2, 10.5, 11.3, 11.5, 12.1, 12.5_

  - [ ]* 17.2 Write integration tests for end-to-end flows
    - Full add flow: fill form → submit → verify list row appended, balance updated, chart updated, MonthlySummaryUI updated (Req 1.4, 4.3, 5.4, 10.3)
    - Full delete flow: click delete → confirm → verify row removed, balance updated, chart updated, MonthlySummaryUI updated (Req 3.3, 3.7, 3.8, 3.9, 10.4)
    - Page reload persistence: add transactions → simulate reload (call `init()`) → verify all data restored to list, balance, chart, and monthly summary (Req 6.3)
    - Sort display-only: sort by amount → verify list order changes → reload → verify stored order unchanged (Req 11.3)
    - Theme persistence: toggle theme → reload → verify same theme restored (Req 12.4)
    - Theme no data effect: toggle theme → transaction data in `"ebv_transactions"` storage key unchanged (Req 12.5)
    - _Requirements: 1.4, 3.3, 3.7, 3.8, 3.9, 4.3, 5.4, 6.3, 10.3, 10.4, 11.3, 12.4, 12.5_

  - [ ]* 17.3 Write performance test for add/delete with 1,000 transactions
    - Pre-populate storage with 1,000 transactions; measure time from add/delete trigger to UI update completion; assert ≤ 100ms
    - _Requirements: 8.2_

- [ ] 18. Final checkpoint — all tests pass
  - Ensure all unit, integration, and property tests pass; verify the app opens correctly in Chrome, Firefox, Edge, and Safari stable; ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 5, 12, 18) ensure incremental validation before moving to the next layer
- Property tests validate universal correctness invariants across the pure logic functions; unit tests cover specific examples and edge cases — both are complementary
- All code lives in exactly two files: `css/styles.css` and `js/app.js` (plus `index.html`), per Requirements 7.2–7.3
- Storage writes ALWAYS precede DOM mutations in both add and delete flows — this ordering is enforced by the Controller, not the UI modules
- `crypto.randomUUID()` is available in all target browsers (Chrome 92+, Firefox 95+, Edge 92+, Safari 15.4+) with no polyfill needed
- The master in-memory `transactions` array is NEVER reordered or mutated by sorting. `sortTransactions()` always returns a new array.
- Theme switching uses CSS variables on `[data-theme="dark"]` — no JS DOM traversal beyond setting the attribute on `<html>`.
- `"ebv_theme"` and `"ebv_transactions"` are completely independent storage keys. Writing one never affects the other.
- All test tasks (marked `*`) are optional and do not block MVP implementation.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "4.2", "4.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "4.4", "4.5", "4.6"] },
    { "id": 3, "tasks": ["6.1", "7.1", "8.1", "9.1", "10.1"] },
    { "id": 4, "tasks": ["6.2"] },
    { "id": 5, "tasks": ["6.3", "11.1"] },
    { "id": 6, "tasks": ["11.2", "11.3", "11.4", "11.5"] },
    { "id": 7, "tasks": ["13.1"] },
    { "id": 8, "tasks": ["14.1", "15.1", "16.1"] },
    { "id": 9, "tasks": ["17.1"] },
    { "id": 10, "tasks": ["17.2", "17.3"] }
  ]
}
```
