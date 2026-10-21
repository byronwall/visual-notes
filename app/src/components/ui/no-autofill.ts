/**
 * Spread onto inputs that are not identity or login fields (property names,
 * option search, inline cell edits) so password managers do not attach their
 * autofill menus. Each manager reads its own opt-out attribute.
 */
export const noAutofill = {
  autocomplete: "off",
  "data-1p-ignore": "",
  "data-lpignore": "true",
  "data-bwignore": "",
  "data-form-type": "other",
} as const;
