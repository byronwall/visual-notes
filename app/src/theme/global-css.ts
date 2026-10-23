export const globalCss = {
  extend: {
    '*': {
      '--global-color-border': 'colors.border',
      '--global-color-placeholder': 'colors.fg.subtle',
      '--global-color-selection': 'colors.colorPalette.subtle.bg',
      '--global-color-focus-ring': 'colors.border.focus',
    },
    html: {
      colorPalette: 'gray',
      colorScheme: 'light',
      // Phones: no gray flash on tap, no font inflation in landscape.
      WebkitTapHighlightColor: 'transparent',
      textSizeAdjust: '100%',
    },
    // Drop the double-tap-to-zoom delay on controls; pinch zoom still works.
    ':where(a, button, input, select, textarea, label, [role=button])': {
      touchAction: 'manipulation',
    },
    // iOS zooms the page when a field under 16px takes focus and never zooms
    // back out. Touch screens get 16px fields; recipes are in a later layer,
    // so this needs !important to win.
    '@media (pointer: coarse)': {
      'input, select, textarea': {
        fontSize: 'max(16px, 1em) !important',
      },
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
