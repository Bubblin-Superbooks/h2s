#! /usr/bin/env node

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Command } from 'commander';

import objectifier from '../lib/objectify.js';

// import pagifier from '../lib/pagify.js';
// import bookifier from '../lib/bookify.js';

const program = new Command();

/* __dirname isn't available inside ES modules: */
// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')).toString());

program
  .command('objectify')
  .alias('o')
  .description('Objectify into a array-like json')
  .action(() => {
    objectifier();
  })
  .on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ h2s objectify ');
    console.log('    $ h2s o ');
    console.log(chalk.bold('    $ m o   #shortform'));
    console.log();
  });

// program
//   .command('pagify')
//   .alias('p')
//   .description('Pagination with formatting!')
//   .action(() => {
//     pagifier();
//   })
//   .on('--help', () => {
//     console.log('  Examples:');
//     console.log('    $ h2s pagify');
//     console.log('    $ m p # short form');
//     console.log(chalk.bold('$ tmp/.prebook must be ready for this command to work properly.'));
//     console.log();
//   });

// program
//   .command('bookify')
//   .alias('b')
//   .description('Apply templates to form actual pages')
//   .action(() => {
//     bookifier();
//   })
//   .on('--help', () => {
//     console.log('  Examples:');
//     console.log();
//     console.log('    $ h2s bookify ');
//     console.log('    $ h2s b ');
//     console.log(chalk.bold('    $ m b   #short form'));
//     console.log();
//   });

// Command catchall
program
  .command('*')
  .on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ h2s <fetch> <url>');
    console.log();
  });

// Library version
program
  .version(packageJson.version, '-v, --VERSION', 'New version @bookiza')
  .parse(process.argv);

if (!program.args.length) {
  program.help();
}
