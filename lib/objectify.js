import fse from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import _ from 'cheerio';
// eslint-disable-next-line import/extensions
import { iconsole } from './messages.js';

const { load } = _;

export default function objectifier() { // Should return a boolean
  // In the regex below, group-2 is the href attribute value and group-4 is the text.
  const ANCHOR_REGEX = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1([^>]*)?>(.*?)<\/a>/g;
  const TITLE_OR_ALT_BACKSLASH = /\\/gm;

  const book = [];

  const titleCaseText = (str) => {
    const romanNumeral = /^(M{1,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})|M{0,4}(CM|C?D|D?C{1,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})|M{0,4}(CM|CD|D?C{0,3})(XC|X?L|L?X{1,3})(IX|IV|V?I{0,3})|M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|I?V|V?I{1,3}))\.?$/gm;

    return str.toLowerCase().split(' ').map((word) => {
      if (word.toUpperCase().match(romanNumeral)) { return word.toUpperCase(); }
      const firstLetter = word.match('[A-Za-z]{1}');
      if (firstLetter) { return word.replace(firstLetter[0], firstLetter[0].toUpperCase()); }
      return word;
    }).join(' ');
  };

  fse.readFile(path.join('interim', 'sanitized.html'), 'utf8')
    .then((contents) => {
      // eslint-disable-next-line no-param-reassign
      contents = contents.replace(ANCHOR_REGEX, '<a href="$2">$4</a>');
      const $ = load(contents, {
        decodeEntities: false,
      });
      // const index = 0;
      $('body').children().each((i, elem) => {
        let val = '';
        const key = $(elem)[0].name;

        switch (key) {
          case 'p':
          case 'hr':
          case 'pre':
          case 'code':
          case 'blockquote':
          case 'cite':
          case 'div':
            val = $(elem).html().trim();
            break;

          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            val = $(elem).html().trim();
            val = titleCaseText(val);
            break;

          case 'img':
            // ?? operator: Use nullish coalescing to set undefined attributes as ''.
            const cleanTitle = ($(elem).attr('title') ?? '').replace(TITLE_OR_ALT_BACKSLASH, '');
            const cleanAlt = ($(elem).attr('alt') ?? '').replace(TITLE_OR_ALT_BACKSLASH, '');
            val = `["${$(elem).attr('src')}", "${cleanTitle}", "${cleanAlt}"]`;
            break;

          case 'ol':
          case 'ul': {
            const startIndex = $(elem).attr('start');
            const olObj = [];
            let liIndex = 0;
            $(elem).find('li').each((i, elm) => {
              olObj[liIndex] = $(this).text().trim();
              liIndex += 1;
            });
            val = {};
            val.start = startIndex;
            val.list = olObj;
            break;
          }
          case 'br':
            iconsole.log('Insert a line break here? Decision taken on March 10th, 2023: No.');
            break;
          default:
            iconsole.log('We have an unhandled HTML tag: ', key, i);
        }

        book.push({ tag: key, innerHtml: val });

        const nextElement = $(elem)[0].next;
        if (nextElement && nextElement.type === 'text' && nextElement.data.trim() !== '') {
          book.push({ tag: 'p', innerHtml: nextElement.data.trim() });
        }
      });
    }).then(() => {
      fse.mkdirs(path.join('interim', 'tmp'))
        .then(() => {
          fse
            .writeFile(path.join('.', 'interim', 'tmp', '.prebook'), JSON.stringify(book, null, 2))
            .then(() => iconsole.log(chalk.cyanBright('Prebook object saved.')))
            .catch((err) => iconsole.log(chalk.bold.red('Failed to create `interim/tmp/.prebook`: ', err)));
        })
        .catch((err) => iconsole.log(chalk.bold.red('Failed to create /tmp directory: ', err)));
    }).catch((err) => iconsole.log(chalk.bold.red('Failed to pick up the contents of sanitized html', err)));
}
