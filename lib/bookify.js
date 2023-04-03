import fse from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
// eslint-disable-next-line import/extensions
import { iconsole } from './messages.js';

const HREF_REGEX = /<a /g;

/* __dirname isn't available inside ES modules: */
// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(__filename);

export default async function bookifier() {
  fse.readFile(path.join('.', 'interim', 'tmp', '.book'))
    .then((content) => {
      content = content.toString();
      content = content.replace(HREF_REGEX, '<a rel=\\"nofollow noopener noreferrer\\" ');
      return Promise.resolve(JSON.parse(content));
    })
    .then((book) => {
      const promises = [];

      // for (let i = 0; i <= book.length; i += 1) {
      // eslint-disable-next-line guard-for-in
      Object.keys(book).forEach((page) => {
        // const page = book[i];
        if (Object.prototype.hasOwnProperty.call(book, page)) {
          const PAGE_TEMPLATE_START = '<div class="leaf flex"><div class="inner justify">';
          const HEADING_TEMPLATE_START = '<div class="leaf flex"><div class="inner justify">';
          const TEMPLATE_END = '</div> </div>';

          let pageHtml = '';

          if (book[page].startsWith('<h')) {
            pageHtml = HEADING_TEMPLATE_START + book[page] + TEMPLATE_END;
          } else {
            pageHtml = PAGE_TEMPLATE_START + book[page] + TEMPLATE_END;
          }

          const htmlFile = path.join('.', 'manuscript', page, 'body.html');

          const thisPage = fse.outputFile(htmlFile, pageHtml);

          promises.push(thisPage);
        }
      });

      return Promise.all(promises);
    }).then(() => {
      const promises = [];

      fse.readdir(path.join('.', 'manuscript'))
        .then((files) => {
          const bookLength = files.filter((fn) => fn.startsWith('page-')).length;
          if (bookLength % 2 === 0) {
          /* Insert the backside Cover and a few empty pages
          on the book after layering the manuscript */
            promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n-1'), path.join('.', 'manuscript', `page-${bookLength + 1}`)).catch((err) => iconsole.log(err)));
            promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n'), path.join('.', 'manuscript', `page-${bookLength + 2}`)).catch((err) => iconsole.log(err)));
          } else {
            promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n-1'), path.join('.', 'manuscript', `page-${bookLength + 1}`)).catch((err) => iconsole.log(err)));
            promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n-1'), path.join('.', 'manuscript', `page-${bookLength + 2}`)).catch((err) => iconsole.log(err)));
            promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n'), path.join('.', 'manuscript', `page-${bookLength + 3}`)).catch((err) => iconsole.log(err)));
          }
        });

      return Promise.all(promises);
    })
    .then(() => iconsole.log(chalk.yellow(`Bookification… ${chalk.blue('complete.')}`)))
    .then(() => {
      fse.readJson(path.join('.', 'interim', 'tmp', '.index'))
        .then((json) => {
          let tocListOfLinks = '';
          Object.keys(json).forEach((key) => {
            if (Object.prototype.isPrototypeOf.call(json, key)) {
              tocListOfLinks += json[key];
            }
          });
          return tocListOfLinks;
        }).then((tocListOfLinks) => {
          const unorderedListToc = `<ul class="toc">${tocListOfLinks}</ul>`;
          return unorderedListToc;
        }).then((unorderedListToc) => {
          const promised = fse.outputFile(path.join('.', 'cover', 'toc.html'), unorderedListToc)
            .then(() => {
              iconsole.log(chalk.green(`Table of Contents HTML is ${chalk.magenta('ready')}`));
            }).catch((err) => iconsole.error(chalk.bold.red('Failed to write index HTML', err)));

          return Promise.all[promised];
        })
        .catch((err) => iconsole.error(chalk.red(`Failed to read .index json: ${err}`)));
    })
    .catch((err) => iconsole.error(chalk.red(`Failed to read .book json: ${err}`)));
}
