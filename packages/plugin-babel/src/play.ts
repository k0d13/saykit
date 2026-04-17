import { transformSync } from '@babel/core';
import saykit from './index'; // adjust path

const input = `
const x = 1;
console.log(x);
`;

const result = transformSync(input, {
  filename: '/absolute/path/to/test-file.ts', // important for your plugin
  plugins: [saykit],
  configFile: false,
  babelrc: false,
});

console.log('---- OUTPUT ----');
console.log(result?.code);
