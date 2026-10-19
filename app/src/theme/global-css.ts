export const globalCss = {
  extend: {
    '*': {
      '--global-color-border': 'colors.border',
      '--global-color-placeholder': 'colors.fg.subtle',
      '--global-color-selection': 'colors.colorPalette.subtle.bg',
      '--global-color-focus-ring': 'colors.blue.9',
    },
    html: {
      colorPalette: 'gray',
      colorScheme: 'light',
    },
    // Dark mode: `.dark` on <html> is set before first paint by the theme boot
    // script (see ~/lib/theme-mode.ts) from the saved choice or the OS.
    'html.dark': {
      colorScheme: 'dark',
    },
    // One visible keyboard focus treatment for plain interactive elements
    // that have no recipe of their own (recipes still win: higher layer).
    ':where(a, button, summary, [role=button], [tabindex]):focus-visible': {
      outline: '2px solid',
      outlineColor: 'var(--global-color-focus-ring)',
      outlineOffset: '2px',
    },
    body: {
      background: 'bg.default',
      color: 'fg.default',
    },
  },
}
