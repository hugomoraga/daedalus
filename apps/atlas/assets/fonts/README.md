# Fonts

The canonical typography trio is declared in [`src/tokens.ts`](../src/tokens.ts):

- **Display:** Inter Tight
- **Body:** Inter
- **Mono:** JetBrains Mono

For exact typography, drop the corresponding WOFF2 files here:

```
assets/fonts/
  Inter-Tight-Regular.woff2
  Inter-Tight-Medium.woff2
  Inter-Tight-SemiBold.woff2
  Inter-Regular.woff2
  Inter-Medium.woff2
  JetBrainsMono-Regular.woff2
  JetBrainsMono-Medium.woff2
```

Then uncomment the `@font-face` block in [`src/templates/layout.ts`](../src/templates/layout.ts).

Until then, ATLAS falls back to system fonts — the design language (color, spacing, layout) is unchanged.

## License note

Inter and Inter Tight are licensed under the [SIL Open Font License 1.1](https://github.com/rsms/inter/blob/master/LICENSE.txt). JetBrains Mono is licensed under the [SIL Open Font License 1.1](https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt). Both are free to redistribute; the binaries are not committed here to keep the repo small.