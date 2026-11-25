import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const source = await readFile(new URL('../assets/icon.svg', import.meta.url), 'utf8');
const background = /\s*<rect id="background"[^>]*\/>/;
if (!background.test(source)) throw new Error('The icon background could not be found.');
const foreground = source.replace(background, '');
for (const [name, svg] of [['icon', source], ['splash-icon', foreground]]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 }, font: { loadSystemFonts: false } }).render().asPng();
  await writeFile(new URL(`../assets/images/${name}.png`, import.meta.url), png);
}
console.log('Generated 1024px app icon and transparent foreground from assets/icon.svg');
