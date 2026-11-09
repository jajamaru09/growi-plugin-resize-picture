import { it, expect } from 'vitest';
import { parseWidthComment } from './parse-width-comment';

it.each([
  ['<!--50%-->', 50], ['<!-- 50% -->', 50], ['<!--100%-->', 100], ['<!--1%-->', 1], ['<!--\t5%\t-->', 5],
])('valid %s', (s, w) => expect(parseWidthComment(s)).toBe(w));
it.each(['<!--0%-->', '<!--101%-->', '<!--50-->', '<!--50.5%-->', '<!--50% x-->', '<!-- -->',
  '<!--５０%-->', '<!--50％-->', '<!--050%-->', '<!--50%--><!--60%-->', '<b>50%</b>'])
  ('invalid %s', (s) => expect(parseWidthComment(s)).toBeNull());
