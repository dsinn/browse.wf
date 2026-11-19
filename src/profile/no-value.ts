/**
 The placeholder for a table cell that has no value, and the sort value that puts such cells below every real one.

 table-sort-js treats cells with empty text as blank and puts them first when sorting descending, ignoring any
 data-sort value; so the placeholder is actual text, and the sort value (below any real figure) puts it last instead.
 */

export const NO_VALUE_TEXT = '—';
export const NO_VALUE_SORT = -1;
