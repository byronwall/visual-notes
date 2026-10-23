import { defineSemanticTokens } from '@pandacss/dev'

export const slate = defineSemanticTokens.colors({
  '1': { value: { _light: '#fbfcfe', _dark: '#111112' } },
  '2': { value: { _light: '#f8f9fb', _dark: '#18191a' } },
  '3': { value: { _light: '#eff1f3', _dark: '#212224' } },
  '4': { value: { _light: '#e6e9ec', _dark: '#282a2c' } },
  '5': { value: { _light: '#dfe2e5', _dark: '#2f3134' } },
  '6': { value: { _light: '#d7dade', _dark: '#373a3d' } },
  '7': { value: { _light: '#cbcfd5', _dark: '#44484c' } },
  '8': { value: { _light: '#b7bcc4', _dark: '#5c6167' } },
  '9': { value: { _light: '#878e98', _dark: '#686e77' } },
  // Step 10 is tuned for text (fg.subtle): >= 4.6:1 on bg.default, >= 4.1:1 on bg.subtle.
  '10': { value: { _light: '#6e757e', _dark: '#7c828a' } },
  '11': { value: { _light: '#5e656d', _dark: '#adb4be' } },
  '12': { value: { _light: '#1c2025', _dark: '#eceef1' } },
  a1: { value: { _light: '#0040bf04', _dark: '#00000000' } },
  a2: { value: { _light: '#00246d07', _dark: '#d7f4f509' } },
  a3: { value: { _light: '#00204010', _dark: '#ddeaf714' } },
  a4: { value: { _light: '#001f3d19', _dark: '#e2f5ff1c' } },
  a5: { value: { _light: '#00183020', _dark: '#e0eefc25' } },
  a6: { value: { _light: '#00132d28', _dark: '#dfeffb2f' } },
  a7: { value: { _light: '#00143134', _dark: '#dff0fd3f' } },
  a8: { value: { _light: '#00122e48', _dark: '#e1effe5c' } },
  a9: { value: { _light: '#000f2478', _dark: '#ddebfe6d' } },
  a10: { value: { _light: '#000c1c91', _dark: '#e3effd82' } },
  a11: { value: { _light: '#000b18a1', _dark: '#e7f0feba' } },
  a12: { value: { _light: '#00040ae3', _dark: '#fafcfff0' } },
  solid: {
    bg: {
      DEFAULT: { value: { _light: '{colors.gray.12}', _dark: '{colors.gray.12}' } },
      hover: { value: { _light: '{colors.gray.11}', _dark: '{colors.gray.11}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.white}', _dark: '{colors.gray.1}' } } },
  },
  // Shorthand aliases: `<palette>.subtle` (tinted bg) and `<palette>.fg` (readable text).
  fg: { DEFAULT: { value: { _light: '{colors.gray.a11}', _dark: '{colors.gray.a11}' } } },
  subtle: {
    DEFAULT: { value: { _light: '{colors.gray.a3}', _dark: '{colors.gray.a3}' } },
    bg: {
      DEFAULT: { value: { _light: '{colors.gray.a3}', _dark: '{colors.gray.a3}' } },
      hover: { value: { _light: '{colors.gray.a4}', _dark: '{colors.gray.a4}' } },
      active: { value: { _light: '{colors.gray.a5}', _dark: '{colors.gray.a5}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.gray.12}', _dark: '{colors.gray.12}' } } },
  },
  surface: {
    bg: {
      DEFAULT: { value: { _light: '{colors.white}', _dark: '{colors.gray.1}' } },
      hover: { value: { _light: '{colors.gray.2}', _dark: '{colors.gray.2}' } },
      active: { value: { _light: '{colors.gray.3}', _dark: '{colors.gray.3}' } },
    },
    border: {
      DEFAULT: { value: { _light: '{colors.gray.6}', _dark: '{colors.gray.6}' } },
      hover: { value: { _light: '{colors.gray.7}', _dark: '{colors.gray.7}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.gray.12}', _dark: '{colors.gray.12}' } } },
  },
  outline: {
    bg: {
      hover: { value: { _light: '{colors.gray.a2}', _dark: '{colors.gray.a2}' } },
      active: { value: { _light: '{colors.gray.a3}', _dark: '{colors.gray.a3}' } },
    },
    border: { DEFAULT: { value: { _light: '{colors.gray.6}', _dark: '{colors.gray.6}' } } },
    fg: { DEFAULT: { value: { _light: '{colors.gray.12}', _dark: '{colors.gray.12}' } } },
  },
  plain: {
    bg: {
      hover: { value: { _light: '{colors.gray.a3}', _dark: '{colors.gray.a3}' } },
      active: { value: { _light: '{colors.gray.a4}', _dark: '{colors.gray.a4}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.gray.12}', _dark: '{colors.gray.12}' } } },
  },
})
