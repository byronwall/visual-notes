import { defineSemanticTokens } from '@pandacss/dev'

export const blue = defineSemanticTokens.colors({
  '1': { value: { _light: '#fbfdff', _dark: '#11141a' } },
  '2': { value: { _light: '#f6f9ff', _dark: '#151a23' } },
  '3': { value: { _light: '#eaf2fe', _dark: '#182334' } },
  '4': { value: { _light: '#dfebfc', _dark: '#1b2c44' } },
  '5': { value: { _light: '#d1e1f8', _dark: '#223653' } },
  '6': { value: { _light: '#c2d6f2', _dark: '#2b4263' } },
  '7': { value: { _light: '#acc4e8', _dark: '#365077' } },
  '8': { value: { _light: '#8eadda', _dark: '#446493' } },
  '9': { value: { _light: '#4169a5', _dark: '#4e75af' } },
  '10': { value: { _light: '#345c96', _dark: '#5f84bc' } },
  '11': { value: { _light: '#33578b', _dark: '#9dbceb' } },
  '12': { value: { _light: '#152946', _dark: '#dae7fb' } },
  a1: { value: { _light: '#0080ff04', _dark: '#1166f509' } },
  a2: { value: { _light: '#0055ff09', _dark: '#478af613' } },
  a3: { value: { _light: '#0061f315', _dark: '#418dfc25' } },
  a4: { value: { _light: '#0060e720', _dark: '#4091fe36' } },
  a5: { value: { _light: '#0059d82e', _dark: '#4f98ff46' } },
  a6: { value: { _light: '#0054c93d', _dark: '#5c9ffd58' } },
  a7: { value: { _light: '#004ab853', _dark: '#68a4fe6d' } },
  a8: { value: { _light: '#0046ac71', _dark: '#6fa9ff8b' } },
  a9: { value: { _light: '#003686be', _dark: '#6da8ffa9' } },
  a10: { value: { _light: '#00327bcb', _dark: '#7eb1ffb7' } },
  a11: { value: { _light: '#002d6ecc', _dark: '#aacbfeea' } },
  a12: { value: { _light: '#001635ea', _dark: '#ddeafffb' } },
  solid: {
    bg: {
      DEFAULT: { value: { _light: '{colors.blue.9}', _dark: '{colors.blue.9}' } },
      hover: { value: { _light: '{colors.blue.10}', _dark: '{colors.blue.10}' } },
    },
    fg: { DEFAULT: { value: { _light: 'white', _dark: 'white' } } },
  },
  // Shorthand aliases: `<palette>.subtle` (tinted bg) and `<palette>.fg` (readable text).
  fg: { DEFAULT: { value: { _light: '{colors.blue.a11}', _dark: '{colors.blue.a11}' } } },
  subtle: {
    DEFAULT: { value: { _light: '{colors.blue.a3}', _dark: '{colors.blue.a3}' } },
    bg: {
      DEFAULT: { value: { _light: '{colors.blue.a3}', _dark: '{colors.blue.a3}' } },
      hover: { value: { _light: '{colors.blue.a4}', _dark: '{colors.blue.a4}' } },
      active: { value: { _light: '{colors.blue.a5}', _dark: '{colors.blue.a5}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.blue.a11}', _dark: '{colors.blue.a11}' } } },
  },
  surface: {
    bg: {
      DEFAULT: { value: { _light: '{colors.blue.a2}', _dark: '{colors.blue.a2}' } },
      active: { value: { _light: '{colors.blue.a3}', _dark: '{colors.blue.a3}' } },
    },
    border: {
      DEFAULT: { value: { _light: '{colors.blue.a6}', _dark: '{colors.blue.a6}' } },
      hover: { value: { _light: '{colors.blue.a7}', _dark: '{colors.blue.a7}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.blue.a11}', _dark: '{colors.blue.a11}' } } },
  },
  outline: {
    bg: {
      hover: { value: { _light: '{colors.blue.a2}', _dark: '{colors.blue.a2}' } },
      active: { value: { _light: '{colors.blue.a3}', _dark: '{colors.blue.a3}' } },
    },
    border: { DEFAULT: { value: { _light: '{colors.blue.a7}', _dark: '{colors.blue.a7}' } } },
    fg: { DEFAULT: { value: { _light: '{colors.blue.a11}', _dark: '{colors.blue.a11}' } } },
  },
  plain: {
    bg: {
      hover: { value: { _light: '{colors.blue.a3}', _dark: '{colors.blue.a3}' } },
      active: { value: { _light: '{colors.blue.a4}', _dark: '{colors.blue.a4}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.blue.a11}', _dark: '{colors.blue.a11}' } } },
  },
})
