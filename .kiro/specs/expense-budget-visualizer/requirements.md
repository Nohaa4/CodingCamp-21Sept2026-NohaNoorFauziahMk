# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, view a running balance, and visualize spending by category through an interactive pie chart. The application runs entirely in the browser using HTML, CSS, and Vanilla JavaScript, with all data persisted in the browser's Local Storage. No backend server or build toolchain is required.

The application includes a mobile-friendly responsive layout (MVP) so that it works correctly on any screen size from 320px upward. Three optional challenge features are also specified: a Monthly Summary view that groups spending by calendar month (Optional Challenge 1), a Sort Transactions control that re-orders the transaction list by amount or category (Optional Challenge 2), and a Dark/Light Mode toggle that persists the user's theme preference (Optional Challenge 3).

---

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, a category, and a createdAt timestamp.
- **Transaction_List**: The scrollable UI component that displays all recorded transactions.
- **Input_Form**: The UI form component through which a user submits a new transaction.
- **Balance_Display**: The UI component at the top of the page that shows the computed total of all transaction amounts.
- **Category**: One of the three fixed expense classifications: Food, Transport, or Fun.
- **Chart**: The pie chart UI component that visualizes the spending distribution across categories.
- **Storage**: The browser's Local Storage API used to persist transaction data client-side.
- **Validator**: The client-side logic component responsible for checking form input before submission.
- **Monthly_Summary**: The UI component that displays total spending grouped by calendar month.
- **Sort_Control**: The UI control that allows the user to select a sort order for the Transaction_List.
- **Theme_Toggle**: The UI control that switches between light mode and dark mode.
- **createdAt**: A Unix timestamp (milliseconds since epoch, via Date.now()) recorded at the time a Transaction is created, used to derive the transaction's calendar month for the Monthly_Summary.

---

## Requirements

---

### Requirement 1: Transaction Input Form *(MVP)*

**User Story:** As a user, I want to fill in an item name, amount, and category and submit the form, so that I can record a new expense quickly without any complex setup.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for the item name accepting 1–100 characters, a number field for the amount accepting values between 0.01 and 999,999,999.99, and a dropdown selector with exactly the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form, THE Validator SHALL verify that the item name field is non-empty, the amount field contains a numeric value between 0.01 and 999,999,999.99, and a category option has been selected from the dropdown.
3. IF the user submits the Input_Form with one or more invalid or empty fields, THEN THE Validator SHALL prevent submission, display an inline error message adjacent to each invalid field identifying the specific validation failure, and retain the values already entered in the remaining valid fields.
4. WHEN all fields pass validation, THE App SHALL append the new Transaction to the Transaction_List, update the Balance_Display, update the Chart, update the Monthly_Summary, and persist it to Storage within 2 seconds.
5. IF Storage is unavailable when the user submits the Input_Form, THEN THE App SHALL prevent submission and display an error message indicating that the transaction could not be saved.
6. WHEN a Transaction is successfully added, THE Input_Form SHALL clear all fields and return to its default empty state within 500 milliseconds.

---

### Requirement 2: Transaction List Display *(MVP)*

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list showing the name, amount, and category, so that I can review my spending history at a glance.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each Transaction with its item name (up to 100 characters), monetary amount formatted as a non-negative number with exactly two decimal places, and category label.
2. THE Transaction_List SHALL be scrollable when the number of transactions exceeds the visible viewport height of the list container.
3. WHEN the App loads, THE Transaction_List SHALL render all transactions previously persisted in Storage, preserving the original entry order, and complete rendering within 2 seconds.
4. WHEN no transactions exist in Storage, THE Transaction_List SHALL display a message indicating that no expenses have been recorded yet.
5. IF Storage is unavailable when the App loads, THEN THE Transaction_List SHALL display an error message indicating that transactions could not be loaded.

---

### Requirement 3: Delete Transaction *(MVP)*

**User Story:** As a user, I want to delete a transaction from the list, so that I can correct mistakes or remove entries I no longer need.

#### Acceptance Criteria

1. THE Transaction_List SHALL render a delete control (button or icon) for each Transaction entry, visually associated with that entry.
2. WHEN the user activates the delete control for a Transaction, THE App SHALL display a confirmation prompt before proceeding with deletion.
3. WHEN the user confirms deletion, THE App SHALL remove the corresponding record from Storage within 300 milliseconds.
4. WHEN the user dismisses the confirmation prompt without confirming, THE App SHALL leave the Transaction unchanged in the Transaction_List and in Storage.
5. WHEN a Transaction is deleted, THE App SHALL update Storage before updating the Transaction_List UI to ensure data consistency.
6. IF the Storage delete operation fails, THEN THE App SHALL display an error message and retain the Transaction in the Transaction_List without removing it from Storage.
7. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the revised total without requiring a page reload.
8. WHEN a Transaction is deleted, THE Chart SHALL update to reflect the revised category distribution without requiring a page reload.
9. WHEN a Transaction is deleted, THE Monthly_Summary SHALL update to reflect the revised monthly totals without requiring a page reload.

---

### Requirement 4: Total Balance Display *(MVP)*

**User Story:** As a user, I want to see my total spending at the top of the page, so that I always know my cumulative expense at a glance.

#### Acceptance Criteria

1. THE Balance_Display SHALL be rendered at the top of the page, visually distinct from the Transaction_List and Chart, where "visually distinct" means separated by a visible boundary such as a border, background contrast, or spatial gap of at least one UI section.
2. THE Balance_Display SHALL show the sum of all Transaction amounts as a non-negative currency value with exactly two decimal places, reflecting the absolute total of all recorded amounts.
3. WHEN a Transaction is added, THE Balance_Display SHALL update to reflect the new sum within 500 milliseconds without requiring a page reload.
4. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new sum within 500 milliseconds without requiring a page reload.
5. WHEN no Transactions exist, THE Balance_Display SHALL display a total of 0.00.
6. IF the Transaction data source is unavailable or returns an error, THEN THE Balance_Display SHALL display an error indication and retain the last successfully loaded total value until the data source becomes available.

---

### Requirement 5: Category Pie Chart *(MVP)*

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can quickly understand how my expenses are distributed across Food, Transport, and Fun.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart segmented by Category, where each segment's arc angle is proportional to that Category's share of total spending, calculated as (Category total ÷ sum of all transactions) × 360 degrees.
2. THE Chart SHALL visually distinguish each Category segment using a unique fill color, where no two Category segments share the same fill color.
3. THE Chart SHALL display a legend containing one entry per rendered Category, where each entry shows the Category's fill color and Category name.
4. WHEN a Transaction is added, THE Chart SHALL update to reflect the new category distribution within 500 milliseconds of the Transaction being committed to the transaction list.
5. WHEN a Transaction is deleted, THE Chart SHALL update to reflect the revised category distribution within 500 milliseconds of the Transaction being removed from the transaction list.
6. WHEN no transactions exist for a given Category, THE Chart SHALL exclude that Category's segment and its corresponding legend entry from the rendered chart.
7. WHEN no transactions exist at all, THE Chart SHALL display a placeholder state containing a text message indicating no spending data is available, instead of rendering a pie chart with zero segments.

---

### Requirement 6: Data Persistence *(MVP)*

**User Story:** As a user, I want my transactions to be saved between sessions, so that I do not lose my expense history when I close or refresh the browser tab.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE App SHALL write the updated transaction dataset to Local Storage immediately, before the UI update is considered complete.
2. WHEN a Transaction is deleted, THE App SHALL write the updated transaction dataset to Local Storage immediately, before the UI update is considered complete.
3. WHEN the App initializes, THE App SHALL read all persisted transactions from Local Storage and restore them to the Transaction_List, Balance_Display, Chart, and Monthly_Summary within 200 milliseconds of the page load event.
4. IF Local Storage is unavailable or throws a write error, THEN THE App SHALL display an error message indicating that data cannot be saved and that changes will be lost on refresh.
5. THE App SHALL store all transaction data exclusively in the browser's Local Storage API, with no data transmitted to any external server.

---

### Requirement 7: Technology and File Structure Constraints *(MVP)*

**User Story:** As a developer, I want the project to use only HTML, CSS, and Vanilla JavaScript organized in a defined folder structure, so that the codebase remains simple, readable, and dependency-free.

#### Acceptance Criteria

1. THE App SHALL be implemented using HTML for structure, CSS for styling, and Vanilla JavaScript for behavior, with no JavaScript frameworks such as React or Vue.
2. THE App SHALL contain exactly one CSS file located in the `css/` directory.
3. THE App SHALL contain exactly one JavaScript file located in the `js/` directory.
4. WHERE Chart.js or an equivalent lightweight chart library is used, THE App SHALL load the library via a CDN `<script>` tag rather than a bundled dependency.
5. THE App SHALL function as a standalone web application openable directly in a browser without requiring a local development server.

---

### Requirement 8: Browser Compatibility and Performance *(MVP)*

**User Story:** As a user, I want the app to work smoothly in any modern browser with no noticeable lag, so that I can use it reliably regardless of which browser I prefer.

#### Acceptance Criteria

1. THE App SHALL function correctly in current stable releases of Chrome, Firefox, Edge, and Safari.
2. WHEN the user adds or deletes a Transaction, THE App SHALL update the Transaction_List, Balance_Display, Chart, and Monthly_Summary within 100 milliseconds on a standard desktop device with no more than 1,000 transactions in the Transaction_List.
3. THE App SHALL present a clean, minimal interface with a clear visual hierarchy, a base font size of no less than 14px, and sufficient color contrast such that all text meets a contrast ratio of at least 4.5:1 against its background, requiring no configuration before first use.

---

### Requirement 9: Mobile-Friendly Responsive Layout *(MVP)*

**User Story:** As a user, I want the app to work properly on both desktop and mobile screen sizes, so that I can track my expenses on any device without layout issues.

#### Acceptance Criteria

1. THE App SHALL use responsive CSS so that the layout adapts correctly to both desktop and mobile screen widths without horizontal scrolling or broken layout.
2. THE Input_Form fields (item name, amount, category dropdown, submit button) SHALL remain fully usable and legible on screen widths as narrow as 320px.
3. THE Transaction_List SHALL remain readable and scrollable on mobile screen sizes without content overflow or text truncation that prevents reading the item name, amount, or category.
4. THE Balance_Display SHALL remain fully visible and legible on mobile screen sizes.
5. THE Chart SHALL remain properly visible and legible on mobile screen sizes, scaling to fit the available width without overflowing its container.

---

### Requirement 10: Monthly Summary *(Optional Challenge 1)*

**User Story:** As a user, I want to see my expenses grouped by month, so that I can understand how my spending changes over time.

#### Acceptance Criteria

1. THE App SHALL display a Monthly_Summary view that groups transactions by calendar month derived from each Transaction's createdAt timestamp.
2. THE Monthly_Summary SHALL display, for each month that has at least one Transaction, the month label (formatted as "Month YYYY", e.g. "September 2026") and the total amount spent in that month, formatted to two decimal places.
3. WHEN a Transaction is added, THE Monthly_Summary SHALL update automatically to reflect the new monthly total without requiring a page reload.
4. WHEN a Transaction is deleted, THE Monthly_Summary SHALL update automatically to reflect the revised monthly total without requiring a page reload.
5. WHEN no transactions exist, THE Monthly_Summary SHALL display an appropriate empty state message.
6. THE Monthly_Summary SHALL derive month groupings exclusively from each Transaction's createdAt field; no separate date input is required from the user.

---

### Requirement 11: Sort Transactions *(Optional Challenge 2)*

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can quickly find and compare my expenses.

#### Acceptance Criteria

1. THE App SHALL provide a Sort_Control that allows the user to sort the Transaction_List by Amount (ascending or descending) or by Category (alphabetical).
2. WHEN the user selects a sort option, THE Transaction_List SHALL re-render to display transactions in the selected order within 500 milliseconds.
3. THE Sort_Control SHALL sort only the displayed order of transactions; it SHALL NOT modify, reorder, or delete any transaction record in Storage.
4. WHEN a Transaction is added or deleted while a sort option is active, THE Transaction_List SHALL re-render in the currently selected sort order after the add or delete operation completes.
5. WHEN no sort option is selected (default state), THE Transaction_List SHALL display transactions in their original insertion order as stored.

---

### Requirement 12: Dark/Light Mode Toggle *(Optional Challenge 3)*

**User Story:** As a user, I want to switch between dark and light display modes, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a Theme_Toggle control that switches the display between a light mode and a dark mode.
2. WHEN the user activates the Theme_Toggle, THE App SHALL apply the selected theme to all visible UI components, including the Input_Form, Transaction_List, Balance_Display, Chart container, Monthly_Summary, and Sort_Control.
3. Both light mode and dark mode SHALL maintain readable typography and meet a minimum contrast ratio of 4.5:1 for all text against its background.
4. WHEN the user selects a theme, THE App SHALL persist the selected theme preference to Local Storage so that the same theme is applied when the page is refreshed or reopened.
5. THE Theme_Toggle SHALL not affect, modify, or delete any transaction data stored in Local Storage.
