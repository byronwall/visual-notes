import { amber } from "~/theme/colors/amber";
import { green } from "~/theme/colors/green";
import { red } from "~/theme/colors/red";
import { slate } from "~/theme/colors/slate";
import { blue } from "~/theme/colors/blue";
import { animationStyles } from "~/theme/animation-styles";
import { zIndex } from "~/theme/tokens/z-index";
import { shadows } from "~/theme/tokens/shadows";
import { durations } from "~/theme/tokens/durations";
import { colors } from "~/theme/tokens/colors";
import { textStyles } from "~/theme/text-styles";
import { layerStyles } from "~/theme/layer-styles";
import { keyframes } from "~/theme/keyframes";
import { globalCss } from "~/theme/global-css";
import { conditions } from "~/theme/conditions";
import { slotRecipes, recipes } from "~/theme/recipes";
import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  plugins: [
    {
      name: "Remove Panda Preset Colors",
      hooks: {
        "preset:resolved": ({ utils, preset, name }) =>
          name === "@pandacss/preset-panda"
            ? utils.omit(preset, [
                "theme.tokens.colors",
                "theme.semanticTokens.colors",
              ])
            : preset,
      },
    },
  ],

  // Useful for theme customization
  theme: {
    extend: {
      animationStyles: animationStyles,
      recipes: recipes,
      slotRecipes: slotRecipes,
      keyframes: keyframes,
      layerStyles: layerStyles,
      textStyles: textStyles,

      tokens: {
        colors: colors,
        durations: durations,
        zIndex: zIndex,
      },

      semanticTokens: {
        colors: {
          bg: {
            canvas: { value: "{colors.gray.1}" },
            emphasized: { value: "{colors.gray.a4}" },
            default: {
              value: {
                _light: "{colors.gray.surface.bg}",
                _dark: "{colors.gray.surface.bg}",
              },
            },
            muted: {
              value: {
                _light: "{colors.gray.surface.bg.hover}",
                _dark: "{colors.gray.surface.bg.hover}",
              },
            },
            subtle: {
              value: {
                _light: "{colors.gray.subtle.bg}",
                _dark: "{colors.gray.subtle.bg}",
              },
            },
            // Interaction roles: hover is neutral; "you are here" / selected uses the
            // accent tint so the two never look alike.
            hover: { value: "{colors.gray.a3}" },
            active: { value: "{colors.gray.a4}" },
            selected: { value: "{colors.blue.a3}" },
            selectedHover: { value: "{colors.blue.a4}" },
            highlight: { value: "{colors.amber.a4}" },
          },

          fg: {
            error: { value: "{colors.red.11}" },
            danger: { value: "{colors.red.11}" },
            success: { value: "{colors.green.11}" },
            warning: { value: "{colors.amber.11}" },
            info: { value: "{colors.blue.11}" },
            // Links are colored text only; every link type shares this hover.
            link: { value: "{colors.blue.11}" },
            linkHover: { value: "{colors.blue.12}" },
            selected: { value: "{colors.blue.12}" },
            default: {
              value: {
                _light: "{colors.gray.12}",
                _dark: "{colors.gray.12}",
              },
            },

            muted: {
              value: {
                _light: "{colors.gray.11}",
                _dark: "{colors.gray.11}",
              },
            },

            subtle: {
              value: {
                _light: "{colors.gray.10}",
                _dark: "{colors.gray.10}",
              },
            },
          },

          border: {
            DEFAULT: {
              value: {
                _light: "{colors.gray.4}",
                _dark: "{colors.gray.4}",
              },
            },
            // Aliases used across pages; previously resolved to nothing.
            default: { value: "{colors.gray.4}" },
            subtle: { value: "{colors.gray.3}" },
            muted: { value: "{colors.gray.4}" },
            emphasized: { value: "{colors.gray.6}" },
            accent: { value: "{colors.blue.8}" },
            focus: { value: "{colors.blue.9}" },
            selected: { value: "{colors.blue.a7}" },
          },

          error: {
            value: {
              _light: "{colors.red.9}",
              _dark: "{colors.red.9}",
            },
          },

          gray: slate,
          red: red,
          green: green,
          blue: blue,
          amber: amber
        },

        shadows: shadows,

        radii: {
          l1: {
            value: "{radii.xs}",
          },

          l2: {
            value: "{radii.sm}",
          },

          l3: {
            value: "{radii.md}",
          },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",

  jsxFramework: "solid",
  globalCss: globalCss,
  conditions: conditions,
});