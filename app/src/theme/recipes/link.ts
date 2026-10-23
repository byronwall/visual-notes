import { defineRecipe } from '@pandacss/dev'

// Links are colored text only: body weight, no underline, no fill, and one
// shared hover. `underline` stays as a variant name for existing call sites.
export const link = defineRecipe({
  className: 'link',
  base: {
    alignItems: 'center',
    borderRadius: 'l1',
    color: 'fg.link',
    cursor: 'pointer',
    display: 'inline-flex',
    focusVisibleRing: 'outside',
    gap: '1.5',
    outline: 'none',
    textDecorationLine: 'none',
    transitionDuration: 'normal',
    transitionProperty: 'color',
    _hover: {
      color: 'fg.linkHover',
    },
    _icon: {
      boxSize: '1em',
    },
  },
  defaultVariants: {
    variant: 'underline',
  },
  variants: {
    variant: {
      underline: {},
      plain: {},
    },
  },
})
