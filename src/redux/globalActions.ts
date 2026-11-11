// Global cross-slice actions (not tied to any single feature reducer).

// Dispatched on logout to wipe the previous user's cached report data so a
// different account never sees the prior session's numbers. Handled in
// rootReducer.ts, which resets the affected slices back to their initialState.
export const RESET_REPORTS_DATA = 'app/RESET_REPORTS_DATA';

export const resetReportsData = () => ({ type: RESET_REPORTS_DATA });
