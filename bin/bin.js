#! /usr/bin/env node

const program = require('commander')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')


const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')).toString())


program
  .command('objectify')
  .alias('o')
  .description('Objectify into a array-like json')
  .action(() => {
    const page = require(path.join('..', 'lib', 'objectify.js'));
    page.objectify();
  }).on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ m2s objectify ');
    console.log('    $ m2s o ');
    console.log(chalk.bold('    $ m o   #shortform'));
    console.log();
  });

program
  .command('pagify')
  .alias('p')
  .description('Pagination with formatting!')
  .action(() => {
    const book = require(path.join('..', 'lib', 'pagify.js'));
    book.pagify()
  }).on('--help', () => {
    console.log('  Examples:');
    console.log('    $ m2s pagify');
    console.log('    $ m p # short form');
    console.log(chalk.bold('$ tmp/.prebook must be ready for this command to work properly.' ));
    console.log();
  });


program
  .command('bookify')
  .alias('b')
  .description('Apply templates to form actual pages')
  .action(() => {
    const page = require(path.join('..', 'lib', 'bookify.js'));
    page.bookify();
  }).on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ m2s bookify ');
    console.log('    $ m2s b ');
    console.log(chalk.bold('    $ m b   #short form'));
    console.log();
  });


// Command catchall
program
  .command('*')
  .on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ m2s <fetch> <url>');
    console.log();
  });

// Command version
program
  .version(packageJson.version)
  .option('-v, --version', 'output the version number')
  .parse(process.argv);


if (!program.args.length) {
  program.help();
}
