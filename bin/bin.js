#! /usr/bin/env node

const program = require('commander');
const chalk = require('chalk');
const fs = require("fs");
const path = require('path');




const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')).toString());

program
  .command('fetch')
  .alias('f')
  .description('Fetch a longscroll webpage (.htm, .html and .txt )')
  .option('-f, --file <file_path>', 'Use path to file')
  .option('-u, --url <url>', 'Use url')
  .action(options => {
    const original = require(path.join('..', 'lib', 'fetch.js'));
    original.fetch(options);
  }).on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ abelone fetch http(s)://url.html');
    console.log('    $ abelone f http://url.html');
    console.log(chalk.bold('    $ a f https://full_url_here.html    # shortform'));
    console.log();
  });


program
  .command('sanitize')
  .alias('s')
  .description('Sanitizes HTML')
  .action(options => {
    const html = require(path.join('..', 'lib', 'sanitize.js'));
    html.sanitize(options)
  }).on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ abelone sanitize ')
    console.log('    $ abelone s ')
    console.log(chalk.bold.bgGreen('    $ a s'))
    console.log()
  });


program
  .command('objectify')
  .alias('o')
  .description('Objectify into a Array-like Json')
  .action(() => {
    const page = require(path.join('..', 'lib', 'objectify.js'));
    page.objectify();
  }).on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ abelone objectify ');
    console.log('    $ abelone o ');
    console.log(chalk.bold('    $ a o   #shortform'));
    console.log();
  });

program
  .command('pagify')
  .alias('p')
  .description('Pagination with formatting!')
  .action(() => {
    const book = require(path.join('..', 'lib', 'pagy.js'));
    book.pagify()
  }).on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ abelone g ');
    console.log(chalk.bold('$ a g' ));
    console.log();
  });


program
  .command('bookify')
  .alias('b')
  .description('Apply templates to form actual pages')
  .action(() => {
    const page = require(path.join('..', 'lib', 'paginate.js'));
    page.paginate();
  }).on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ abelone paginate ');
    console.log('    $ abelone p ');
    console.log(chalk.bold('    $ a p   #shortform'));
    console.log();
  });


// Command catchall
program
  .command('*')
  .on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ abelone <fetch> <url>');
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
