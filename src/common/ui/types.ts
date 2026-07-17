import type { Component } from "vue";

/** Entry in a ContextMenu's model. */
export type MenuItem = {
  label: string;
  icon?: Component;
  command?: () => void;
};

/** Column definition for DataTable. */
export type DataTableColumn = {
  field: string;
  header: string;
  sortable?: boolean;
  /** Render a per-column text filter input under the header. */
  filter?: boolean;
  filterPlaceholder?: string;
  /** CSS width for the column, e.g. "25%". */
  width?: string;
};

/** Option shape for Select: keys are looked up via optionLabel/optionValue. */
export type SelectOption = Record<string, unknown>;

/** Option shape for MultiSelect. */
export type MultiSelectOption = {
  label: string;
  value: string;
};
