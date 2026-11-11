/** One selectable row in `ItemPickerSidebar` (and the product catalogue's `ItemAssignmentSection`). */
export interface AssignableItem {
  id: string;
  name: string;
  secondaryName?: string;
  subtitle?: string;
  disabled?: boolean;
  disabledReason?: string;
  categoryIds?: string[];
  categorySortPositions?: Record<string, number>;
  trailing?: string;
}
