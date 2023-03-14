import console from 'console';
import chalk from 'chalk';

export const iconsole = new console.Console(process.stdout, process.stderr);

export function fatalMessage(message, exitCode) {
  console.error(chalk.bold.red(message));
  process.exit(exitCode);
}
