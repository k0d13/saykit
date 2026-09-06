#!/usr/bin/env node

import { program } from '@commander-js/extra-typings';
import clean from './clean.js';
import compile from './compile.js';
import extract from './extract.js';

program
  .name('saykit')
  .helpOption('-h, --help', 'Display help for command')
  .helpCommand('help [command]', 'Display help for command')
  .addCommand(extract)
  .addCommand(compile)
  .addCommand(clean)
  .parse();
