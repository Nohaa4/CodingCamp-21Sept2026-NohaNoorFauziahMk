/**
 * app.js — Expense & Budget Visualizer
 *
 * All application logic lives in this single file, organized into clearly
 * separated module sections.  No frameworks, no build step — just plain
 * Vanilla JavaScript that runs directly in the browser.
 *
 * Module order:
 *   1.  StorageModule           — localStorage read/write
 *   2.  Validator               — form field validation
 *   3.  Pure utility functions  — formatAmount, computeBalance,
 *                                 computeChartData, sortTransactions,
 *                                 computeMonthlySummary
 *   4.  TransactionListUI       — #transaction-list DOM management
 *   5.  InputFormUI             — #input-form DOM management
 *   6.  BalanceUI               — #balance-display DOM management
 *   7.  ChartModule             — Chart.js pie chart wrapper
 *   8.  ConfirmationDialog      — window.confirm wrapper
 *   9.  MonthlySummaryUI        — #monthly-summary DOM management
 *  10.  SortControl             — #sort-control DOM management
 *  11.  ThemeToggle             — data-theme / dark-mode toggle
 *  12.  Controller              — orchestrates all data flow
 *  13.  Bootstrap               — kicks everything off on DOMContentLoaded
 */

'use strict';

/* =========================================================================
 * 1. STORAGE MODULE
 * =========================================================================
 * Handles all interaction with window.localStorage.
 * Two completely independent keys:
 *   "ebv_transactions" — JSON array of Transaction objects
 *   "ebv_theme"        — "light" | "dark" string
 * All methods throw { type: "StorageError", message } on failure.
 */
const StorageModule = (() => {
  const STORAGE_KEY = 'ebv_transactions';
  const THEME_KEY   = 'ebv_theme';

  /**
   * loadTransactions() → Transaction[]
   * Returns [] when the key is absent.
   * Throws StorageError on SecurityError or JSON parse failure.
   */
  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      return JSON.parse(raw);
    } catch (err) {
      throw { type: 'StorageError', message: `Could not load transactions: ${err.message}` };
    }
  }

  /**
   * saveTransactions(transactions) → void
   * Serialises and writes the full array to localStorage.
   * Throws StorageError on QuotaExceededError or SecurityError.
   */
  function saveTransactions(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (err) {
      throw { type: 'StorageError', message: `Could not save transactions: ${err.message}` };
    }
  }

  /**
   * loadTheme() → string | null
   * Returns null when absent or on any error (non-critical).
   */
  function loadTheme() {
    try {
      return localStorage.getItem(THEME_KEY); // null when absent
    } catch (_) {
      return null;
    }
  }

  /**
   * saveTheme(theme) → void
   * Throws StorageError on failure.
   */
  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      throw { type: 'StorageError', message: `Could not save theme: ${err.message}` };
    }
  }

  return { loadTransactions, saveTransactions, loadTheme, saveTheme };
})();


/* =========================================================================
 * 2. VALIDATOR
 * =========================================================================
 * Pure, stateless validation of the three form fields.
 * Returns { valid: boolean, errors: { name?, amount?, category? } }.
 */
const Validator = (() => {
  const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

  /**
   * validate(name, amount, category) → ValidationResult
   *
   * Rules:
   *  name     : non-empty after trim, ≤ 100 chars
   *  amount   : finite number, 0.01–999,999,999.99 inclusive, max 2 decimal places
   *  category : one of "Food" | "Transport" | "Fun"
   */
  function validate(name, amount, category) {
    const errors = {};

    // --- name ---
    const trimmedName = (name || '').trim();
    if (trimmedName.length === 0) {
      errors.name = 'Item name is required';
    } else if (trimmedName.length > 100) {
      errors.name = 'Item name must be 100 characters or fewer';
    }

    // --- amount ---
    const parsed = parseFloat(amount);
    if (
      amount === '' ||
      amount === null ||
      amount === undefined ||
      !isFinite(parsed) ||
      parsed < 0.01 ||
      parsed > 999999999.99
    ) {
      errors.amount = 'Amount must be a number between 0.01 and 999,999,999.99';
    } else {
      // Max 2 decimal places — check by inspecting the string representation
      const amountStr = String(amount).trim();
      const dotIndex = amountStr.indexOf('.');
      if (dotIndex !== -1 && amountStr.length - dotIndex - 1 > 2) {
        errors.amount = 'Amount must be a number between 0.01 and 999,999,999.99';
      }
    }

    // --- category ---
    if (!VALID_CATEGORIES.includes(category)) {
      errors.category = 'Please select a category';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }

  return { validate };
})();


/* =========================================================================
 * 3. PURE UTILITY FUNCTIONS
 * =========================================================================
 * All pure — no DOM access, no side-effects.
 */

/**
 * formatAmount(amount) → string
 * Returns the number formatted to exactly 2 decimal places.
 * Example: formatAmount(12.5) → "12.50"
 */
function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

/**
 * computeBalance(transactions) → number
 * Returns the arithmetic sum of all .amount fields.
 * Returns 0 for an empty array.
 */
function computeBalance(transactions) {
  if (!transactions || transactions.length === 0) return 0;
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * computeChartData(transactions) → { labels, data, colors }
 * Aggregates transactions by category, excludes zero-total categories.
 * Returns empty arrays when transactions is empty.
 *
 * Fixed colors:
 *   Food      → #FF6384
 *   Transport → #36A2EB
 *   Fun       → #FFCE56
 */
function computeChartData(transactions) {
  const COLOR_MAP = {
    Food:      '#FF6384',
    Transport: '#36A2EB',
    Fun:       '#FFCE56'
  };

  if (!transactions || transactions.length === 0) {
    return { labels: [], data: [], colors: [] };
  }

  // Aggregate totals by category
  const totals = {};
  for (const tx of transactions) {
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  }

  // Build output arrays, excluding zero-total categories
  const labels = [];
  const data   = [];
  const colors = [];

  for (const [category, total] of Object.entries(totals)) {
    if (total > 0) {
      labels.push(category);
      data.push(total);
      colors.push(COLOR_MAP[category] || '#999999');
    }
  }

  return { labels, data, colors };
}

/**
 * sortTransactions(transactions, option) → Transaction[]
 * Returns a NEW array — never mutates the input.
 *
 * option values:
 *   "amount-asc"   — ascending by amount
 *   "amount-desc"  — descending by amount
 *   "category-asc" — alphabetical by category
 *   null / ""      — original insertion order (shallow copy)
 */
function sortTransactions(transactions, option) {
  // Always work on a shallow copy to protect the master array
  const copy = [...transactions];

  if (!option) return copy; // default: preserve insertion order

  if (option === 'amount-asc') {
    return copy.sort((a, b) => a.amount - b.amount);
  }
  if (option === 'amount-desc') {
    return copy.sort((a, b) => b.amount - a.amount);
  }
  if (option === 'category-asc') {
    return copy.sort((a, b) => a.category.localeCompare(b.category));
  }

  return copy; // unknown option — return unsorted copy
}

/**
 * computeMonthlySummary(transactions) → MonthSummary[]
 * Groups transactions by calendar month derived from createdAt (Unix ms).
 * Returns entries sorted by monthKey descending (most recent first).
 * Returns [] for empty input.
 *
 * Each entry: { monthKey: "YYYY-MM", label: "Month YYYY", total: number }
 */
function computeMonthlySummary(transactions) {
  if (!transactions || transactions.length === 0) return [];

  const groups = {}; // monthKey → { label, total }

  for (const tx of transactions) {
    const date = new Date(tx.createdAt);

    // Build "YYYY-MM" key with zero-padded month
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const monthKey = `${year}-${month}`;

    // Human-readable label: "September 2026"
    const label = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    if (!groups[monthKey]) {
      groups[monthKey] = { monthKey, label, total: 0 };
    }
    groups[monthKey].total += tx.amount;
  }

  // Sort descending by monthKey (string comparison works for "YYYY-MM")
  return Object.values(groups).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}


/* =========================================================================
 * 4. TRANSACTION LIST UI
 * =========================================================================
 * Manages the #transaction-list <ul> element.
 */
const TransactionListUI = (() => {
  /** Build a single <li> row for one transaction. */
  function _buildRow(transaction) {
    const li = document.createElement('li');
    li.className = 'transaction-row';
    li.dataset.id = transaction.id;

    // Category badge
    const badge = document.createElement('span');
    badge.className = `category-badge category-${transaction.category.toLowerCase()}`;
    badge.textContent = transaction.category;

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.textContent = transaction.name;

    // Amount
    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    amountSpan.textContent = `$${formatAmount(transaction.amount)}`;

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.type = 'button';
    deleteBtn.dataset.id = transaction.id;
    deleteBtn.setAttribute('aria-label', `Delete expense: ${transaction.name}`);
    deleteBtn.textContent = '🗑 Delete';

    li.appendChild(nameSpan);
    li.appendChild(badge);
    li.appendChild(amountSpan);
    li.appendChild(deleteBtn);

    return li;
  }

  /**
   * render(transactions)
   * Fully rebuilds the list from the given array.
   * Shows empty-state message when array is empty.
   */
  function render(transactions) {
    const list = document.getElementById('transaction-list');
    list.innerHTML = '';

    if (!transactions || transactions.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent = 'No expenses recorded yet.';
      list.appendChild(empty);
      return;
    }

    for (const tx of transactions) {
      list.appendChild(_buildRow(tx));
    }
  }

  /**
   * appendItem(transaction)
   * Appends a single row without rebuilding the whole list.
   * If the list currently shows the empty-state message, clears it first.
   */
  function appendItem(transaction) {
    const list = document.getElementById('transaction-list');
    const emptyEl = list.querySelector('.empty-state');
    if (emptyEl) emptyEl.remove();
    list.appendChild(_buildRow(transaction));
  }

  /**
   * removeItem(id)
   * Finds the row whose delete button has data-id === id and removes it.
   * If the list becomes empty after removal, shows the empty-state message.
   */
  function removeItem(id) {
    const list = document.getElementById('transaction-list');
    const row = list.querySelector(`li[data-id="${id}"]`);
    if (row) row.remove();

    // Show empty state if no rows remain
    if (list.querySelectorAll('li.transaction-row').length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent = 'No expenses recorded yet.';
      list.appendChild(empty);
    }
  }

  /**
   * showError(message)
   * Replaces list content with a plain error message string.
   */
  function showError(message) {
    const list = document.getElementById('transaction-list');
    list.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'error-state';
    li.textContent = message;
    list.appendChild(li);
  }

  return { render, appendItem, removeItem, showError };
})();


/* =========================================================================
 * 5. INPUT FORM UI
 * =========================================================================
 * Manages the #input-form element and its inline error spans.
 */
const InputFormUI = (() => {
  /**
   * getValues() → { name, amount, category }
   * Reads raw string values from the three form fields.
   */
  function getValues() {
    return {
      name:     document.getElementById('name-input').value,
      amount:   document.getElementById('amount-input').value,
      category: document.getElementById('category-select').value
    };
  }

  /**
   * showErrors(errors)
   * Displays inline error strings in the adjacent error spans.
   * Only sets errors for keys present in the errors object.
   */
  function showErrors(errors) {
    if (errors.name)     document.getElementById('name-error').textContent     = errors.name;
    if (errors.amount)   document.getElementById('amount-error').textContent   = errors.amount;
    if (errors.category) document.getElementById('category-error').textContent = errors.category;
  }

  /**
   * clearErrors()
   * Clears all inline error spans (including the storage-error span).
   */
  function clearErrors() {
    document.getElementById('name-error').textContent     = '';
    document.getElementById('amount-error').textContent   = '';
    document.getElementById('category-error').textContent = '';
    document.getElementById('storage-error').textContent  = '';
  }

  /**
   * reset()
   * Calls native form.reset() and then clears all error spans.
   */
  function reset() {
    document.getElementById('input-form').reset();
    clearErrors();
  }

  /**
   * showStorageError(message)
   * Shows a save-failure error near the submit button.
   */
  function showStorageError(message) {
    document.getElementById('storage-error').textContent = message;
  }

  return { getValues, showErrors, clearErrors, reset, showStorageError };
})();


/* =========================================================================
 * 6. BALANCE UI
 * =========================================================================
 * Manages the #balance-display element.
 */
const BalanceUI = (() => {
  let _lastValue = '0.00'; // retained on error

  /**
   * render(transactions)
   * Computes and displays the formatted balance.
   */
  function render(transactions) {
    const balance = computeBalance(transactions);
    const formatted = formatAmount(balance);
    _lastValue = formatted;
    document.getElementById('balance-display').textContent = formatted;
  }

  /**
   * showError()
   * Retains the last successfully displayed value and appends an error indicator.
   */
  function showError() {
    const el = document.getElementById('balance-display');
    el.textContent = `${_lastValue} ⚠ (data unavailable)`;
  }

  return { render, showError };
})();


/* =========================================================================
 * 7. CHART MODULE
 * =========================================================================
 * Wraps Chart.js.  Manages the <canvas id="expense-chart"> element.
 */
const ChartModule = (() => {
  let _chartInstance = null; // holds the current Chart.js instance

  /**
   * render(transactions)
   * Destroys any existing chart, then either:
   *   - Creates a new pie chart (when transactions is non-empty)
   *   - Shows placeholder text (when transactions is empty)
   */
  function render(transactions) {
    const canvas      = document.getElementById('expense-chart');
    const placeholder = document.getElementById('chart-placeholder');

    // Destroy previous Chart.js instance to avoid "Canvas is already in use" errors
    if (_chartInstance) {
      _chartInstance.destroy();
      _chartInstance = null;
    }

    if (!transactions || transactions.length === 0) {
      // Show placeholder, hide canvas
      canvas.style.display      = 'none';
      placeholder.style.display = 'block';
      return;
    }

    // Hide placeholder, show canvas
    canvas.style.display      = 'block';
    placeholder.style.display = 'none';

    const { labels, data, colors } = computeChartData(transactions);

    if (labels.length === 0) {
      // All amounts somehow zero — show placeholder
      canvas.style.display      = 'none';
      placeholder.style.display = 'block';
      return;
    }

    try {
      _chartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data:            data,
            backgroundColor: colors,
            borderColor:     '#ffffff',
            borderWidth:     2
          }]
        },
        options: {
          responsive:          true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding:   16,
                boxWidth:  16,
                font: { size: 14 }
              }
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const total = context.dataset.data.reduce((s, v) => s + v, 0);
                  const pct   = ((context.parsed / total) * 100).toFixed(1);
                  return ` ${context.label}: $${formatAmount(context.parsed)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    } catch (err) {
      // Chart.js failed (e.g., library not loaded) — show text fallback
      console.error('Chart.js error:', err);
      canvas.style.display      = 'none';
      placeholder.style.display = 'block';
      placeholder.textContent   = 'Chart unavailable. Please refresh or check your connection.';
    }
  }

  return { render };
})();


/* =========================================================================
 * 8. CONFIRMATION DIALOG
 * =========================================================================
 * Thin wrapper around window.confirm for easy testing / future replacement.
 */
const ConfirmationDialog = (() => {
  /**
   * confirm(message) → boolean
   * Returns true if the user confirms, false if dismissed.
   */
  function confirm(message) {
    return window.confirm(message);
  }

  return { confirm };
})();


/* =========================================================================
 * 9. MONTHLY SUMMARY UI
 * =========================================================================
 * Manages the #monthly-summary element (Optional Challenge 1).
 */
const MonthlySummaryUI = (() => {
  /**
   * render(transactions)
   * Rebuilds the monthly summary from scratch.
   * Shows empty-state message when no transactions exist.
   */
  function render(transactions) {
    const container = document.getElementById('monthly-summary');
    container.innerHTML = '';

    const summaries = computeMonthlySummary(transactions);

    if (summaries.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'empty-state';
      msg.textContent = 'No monthly data yet.';
      container.appendChild(msg);
      return;
    }

    for (const entry of summaries) {
      const row = document.createElement('div');
      row.className = 'summary-row';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'summary-month';
      labelSpan.textContent = entry.label;

      const totalSpan = document.createElement('span');
      totalSpan.className = 'summary-total';
      totalSpan.textContent = `$${formatAmount(entry.total)}`;

      row.appendChild(labelSpan);
      row.appendChild(totalSpan);
      container.appendChild(row);
    }
  }

  return { render };
})();


/* =========================================================================
 * 10. SORT CONTROL
 * =========================================================================
 * Manages the #sort-control <select> element (Optional Challenge 2).
 */
const SortControl = (() => {
  /**
   * getActiveSort() → SortOption | null
   * Returns null when the default (insertion-order) option is selected.
   */
  function getActiveSort() {
    const value = document.getElementById('sort-control').value;
    return value || null; // empty string → null
  }

  /**
   * onSortChange(callback)
   * Registers a change event listener that invokes callback(option | null).
   */
  function onSortChange(callback) {
    document.getElementById('sort-control').addEventListener('change', (e) => {
      callback(e.target.value || null);
    });
  }

  return { getActiveSort, onSortChange };
})();


/* =========================================================================
 * 11. THEME TOGGLE
 * =========================================================================
 * Manages dark/light mode (Optional Challenge 3).
 * Theme is applied via data-theme attribute on <html>.
 * Persisted to localStorage under the "ebv_theme" key.
 */
const ThemeToggle = (() => {
  const DARK  = 'dark';
  const LIGHT = 'light';

  /** Update the toggle button label to reflect the active theme. */
  function _updateButtonLabel(theme) {
    const btn = document.getElementById('theme-toggle');
    if (theme === DARK) {
      btn.textContent = '☀️ Light Mode';
    } else {
      btn.textContent = '🌙 Dark Mode';
    }
  }

  /**
   * init(savedTheme)
   * Applies the saved theme on page load.
   * Defaults to light mode if savedTheme is null or "light".
   */
  function init(savedTheme) {
    const theme = savedTheme === DARK ? DARK : LIGHT;
    document.documentElement.setAttribute('data-theme', theme);
    _updateButtonLabel(theme);
  }

  /**
   * toggle()
   * Switches between light and dark mode.
   * Persists the new theme to localStorage.
   * If saving fails, logs a warning but keeps the visual change.
   */
  function toggle() {
    const current = getTheme();
    const next    = current === DARK ? LIGHT : DARK;
    document.documentElement.setAttribute('data-theme', next);
    _updateButtonLabel(next);
    try {
      StorageModule.saveTheme(next);
    } catch (err) {
      console.warn('Theme could not be saved:', err.message);
    }
  }

  /**
   * getTheme() → "light" | "dark"
   */
  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || LIGHT;
  }

  return { init, toggle, getTheme };
})();


/* =========================================================================
 * 12. CONTROLLER
 * =========================================================================
 * Orchestrates all data flow.  Owns the master in-memory transactions array.
 * The master array is NEVER reordered by sorting.
 */
const Controller = (() => {
  /** Master in-memory store — preserved in insertion order always. */
  let transactions = [];

  /* -----------------------------------------------------------------------
   * init()
   * Runs on DOMContentLoaded.
   *   1. Load transactions from storage (with error handling)
   *   2. Load and apply saved theme
   *   3. Render all UI components
   *   4. Register all event listeners
   * --------------------------------------------------------------------- */
  function init() {
    // 1. Load transactions
    try {
      transactions = StorageModule.loadTransactions();
    } catch (err) {
      // Storage unavailable — show error in list, render empty state elsewhere
      TransactionListUI.showError(
        'Transactions could not be loaded. Your browser storage may be unavailable.'
      );
      BalanceUI.render([]);
      ChartModule.render([]);
      MonthlySummaryUI.render([]);
      _registerListeners();
      return;
    }

    // 2. Apply saved theme
    const savedTheme = StorageModule.loadTheme();
    ThemeToggle.init(savedTheme);

    // 3. Render all UI with loaded data
    TransactionListUI.render(transactions);
    BalanceUI.render(transactions);
    ChartModule.render(transactions);
    MonthlySummaryUI.render(transactions);

    // 4. Register event listeners
    _registerListeners();
  }

  /** Register all event listeners (called once in init). */
  function _registerListeners() {
    // Form submit → add transaction
    document.getElementById('input-form')
      .addEventListener('submit', handleAddTransaction);

    // Delegated click on list → delete transaction
    document.getElementById('transaction-list')
      .addEventListener('click', handleDeleteClick);

    // Sort control change → re-render sorted list (no storage write)
    SortControl.onSortChange(handleSortChange);

    // Theme toggle click
    document.getElementById('theme-toggle')
      .addEventListener('click', handleThemeToggle);
  }

  /* -----------------------------------------------------------------------
   * handleAddTransaction(e)
   * Handles form submission to add a new transaction.
   * --------------------------------------------------------------------- */
  function handleAddTransaction(e) {
    e.preventDefault();

    // 1. Clear any previous inline errors
    InputFormUI.clearErrors();

    // 2. Read form values
    const { name, amount, category } = InputFormUI.getValues();

    // 3. Validate — abort with inline errors on failure
    const result = Validator.validate(name, amount, category);
    if (!result.valid) {
      InputFormUI.showErrors(result.errors);
      return;
    }

    // 4. Build the new transaction object
    const newTx = {
      id:        crypto.randomUUID(),
      name:      name.trim(),
      amount:    parseFloat(amount),
      category:  category,
      createdAt: Date.now()
    };

    // 5. Persist to storage BEFORE any UI update
    try {
      StorageModule.saveTransactions([...transactions, newTx]);
    } catch (err) {
      // Save failed — show inline error, keep form values, do NOT update UI
      InputFormUI.showStorageError(
        'Could not save transaction. Your browser storage may be full or unavailable.'
      );
      return;
    }

    // 6. Commit to in-memory master array
    transactions.push(newTx);

    // 7. Re-render all UI components
    //    List respects any active sort; balance/chart/summary use master array.
    const activeSort = SortControl.getActiveSort();
    const sorted     = sortTransactions(transactions, activeSort);

    TransactionListUI.render(sorted);
    BalanceUI.render(transactions);
    ChartModule.render(transactions);
    MonthlySummaryUI.render(transactions);

    // 8. Reset the form to empty state
    InputFormUI.reset();
  }

  /* -----------------------------------------------------------------------
   * handleDeleteClick(e)
   * Delegated click handler on #transaction-list.
   * Only acts when a delete button is clicked.
   * --------------------------------------------------------------------- */
  function handleDeleteClick(e) {
    // Find the closest delete button (handles clicks on child elements)
    const deleteBtn = e.target.closest('button.btn-delete');
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.id;
    if (!id) return;

    // Show confirmation dialog — abort if dismissed
    if (!ConfirmationDialog.confirm('Delete this transaction?')) return;

    // Build updated array (master array NOT mutated yet)
    const updated = transactions.filter(t => t.id !== id);

    // Persist to storage BEFORE any DOM mutation
    try {
      StorageModule.saveTransactions(updated);
    } catch (err) {
      // Save failed — show error, leave list and storage unchanged
      TransactionListUI.showError(
        'Could not delete transaction. Your browser storage may be unavailable.'
      );
      return;
    }

    // Commit deletion to in-memory master array
    transactions = updated;

    // Re-render all UI components (respecting active sort for the list)
    const activeSort = SortControl.getActiveSort();
    const sorted     = sortTransactions(transactions, activeSort);

    TransactionListUI.render(sorted);
    BalanceUI.render(transactions);
    ChartModule.render(transactions);
    MonthlySummaryUI.render(transactions);
  }

  /* -----------------------------------------------------------------------
   * handleSortChange(option)
   * Called when the sort control changes.
   * Re-renders the list with the selected sort order.
   * DOES NOT write to storage — stored order is never changed by sorting.
   * --------------------------------------------------------------------- */
  function handleSortChange(option) {
    const sorted = sortTransactions(transactions, option);
    TransactionListUI.render(sorted);
  }

  /* -----------------------------------------------------------------------
   * handleThemeToggle()
   * Delegates entirely to ThemeToggle.toggle().
   * Theme persistence is handled inside toggle().
   * --------------------------------------------------------------------- */
  function handleThemeToggle() {
    ThemeToggle.toggle();
  }

  return { init, handleAddTransaction, handleDeleteClick, handleSortChange, handleThemeToggle };
})();


/* =========================================================================
 * 13. BOOTSTRAP
 * =========================================================================
 * Kick off the app once the DOM is fully parsed.
 */
document.addEventListener('DOMContentLoaded', Controller.init);
