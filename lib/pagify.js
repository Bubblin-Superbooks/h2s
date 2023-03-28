/* eslint-disable no-await-in-loop */
/* eslint-disable no-case-declarations */
import fse from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
// eslint-disable-next-line import/extensions
import { iconsole } from './messages.js';

export default async function pagifier() {
  const spanStart = '<span class="pagy"';
  const lastSpanStart = '<span class="pagy last-pagy"';
  const spanEnd = '</span>';
  const hrHtml = '<hr class="section">';
  const book = {};
  const index = new Set(); // Use a Set() to ensure unique elements in the set.
  const HREF_REGEX = /<a href=([^>]*?)>/g;
  const ANCHOR_HREF_REGEX = /<a href=/g;
  const ANCHOR_REGEX = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1([^>]*)?>(.*?)<\/a>/g;
  const NEWLINE_REGEX = /\n/g;
  const NEWLINE_SPACE_REGEX = /\n /g;
  const ANCHOR_HREF_REV_REGEX = /<ahref=/g;
  // const anchorTagRegex = /<a[^>]*>/g
  // const anchorTagEndRegex = /<\/a>/g
  // const hrefRegex = href_regex = /<a([^>]*?)href\s*=\s*(['"])([^\2]*?)\2\1*>/i;

  /* __dirname isn't available inside ES modules: */
  // eslint-disable-next-line no-underscore-dangle
  const __filename = fileURLToPath(import.meta.url);
  // eslint-disable-next-line no-underscore-dangle
  const __dirname = path.dirname(__filename);

  // Pick up pagy-template from within the h2s library.
  const pageTemplateHtml = await fse
    .readFile(path.join(__dirname, '..', 'templates', 'pagy-template.html'), 'utf-8')
    .catch((err) => iconsole.log(`Could not read the page-template file: ${err}`));

  // Pick up book values from within the project.
  const bookrc = await fse
    .readJson(path.join('.', '.bookrc'))
    .catch((err) => iconsole.error(chalk.red('Could not read .bookrc ', err)));

  const startPage = bookrc && bookrc.start_page ? parseInt(bookrc.start_page, 10) : 9;

  const prebook = await fse
    .readJson(path.join('.', 'interim', 'tmp', '.prebook'))
    .catch((err) => iconsole.error(chalk.red('Could not read the .prebook json', err)));

  const bookLayoutTemplate = await fse
    .readFile(path.join('.', 'templates', 'style.css'))
    .catch((err) => iconsole.error(chalk.red('Could not pick up the layout: style.css', err)));

  const bookHeadTemplate = await fse
    .readFile(path.join('.', 'templates', 'head.html'))
    .catch((err) => iconsole.error(chalk.red('Could not read `templates/head.html`', err)));

  const PAGE_TEMPLATE_KEY = 'PAGE_INNER_HTML';
  const LAYOUT_TEMPLATE_KEY = 'BOOK_LAYOUT_TEMPLATE';
  const HEAD_TEMPLATE_KEY = 'BOOK_HEAD_TEMPLATE';

  const emptyPageHtml = pageTemplateHtml
    .replace(LAYOUT_TEMPLATE_KEY, bookLayoutTemplate)
    .replace(HEAD_TEMPLATE_KEY, bookHeadTemplate);

  let pageHtml = ''; // This variable will contain only the finalized HTML that fits a page.
  let indexer = 0;
  let crashPageCounter = 0;
  let tagAdded = false;
  let tagHtml = ''; // this flag is to check whether ol/ul tag needs to be added for this li

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 200, // slow motion puppeteer to help with debugging.
    args: [
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-sandbox',
      '--no-zygote',
      '--deterministic-fetch',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list',
      '--autoplay-policy=user-gesture-required',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-extensions',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-notifications',
      '--disable-offer-store-unmasked-wallet-cards',
      '--disable-popup-blocking',
      '--disable-print-preview',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-speech-api',
      '--disable-sync',
      '--disable-accelerated-2d-canvas',
      '--hide-scrollbars',
      '--ignore-gpu-blacklist',
      '--metrics-recording-only',
      '--window-size=375x812',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-pings',
      '--password-store=basic',
      '--use-gl=swiftshader',
      '--use-mock-keychain',
      // '--disable-gpu',
      // '--single-process',
    ],
  });

  let page = (await browser.pages())[0];
  await page.setViewport({
    width: 462,
    height: 600,
  }); // Do not change these values. Ever! Why?
  /*
    Explanation: The ratio of Superbook page iframe = 1115:1443.

    Factors of 1115 are 1, 5, 223, 1115.
    Factors of 1443 are 1, 3, 13, 37, 39, 111, 481, and 1443.

    1. Since there are no common factors between the two, we are
    forced to use a decimal place value on at least one side.

    2. Puppeteer doesn't accept decimal values.

    3. So in order to arrive at the closest shape of a page, we
    have to find an integer value of one side such that the other
    side is very close (to an integer) with the desired decimal
    value.

    Values above:
    Since width of the page is set 462px.
    ∴ Width of the pages = 462 × (1443/1115) ~ 600.
  */
  await page.setCacheEnabled(false);

  let pageCounter = startPage;
  let imageToAddNext = false;
  let imageHtmlToAdd = '';
  let pageHtmlToCheck = '';
  let chapterStartPara = false;
  let prevTag = '';

  async function checkCrashPageCounter() {
    // if(crashPageCounter%1000==0) {
    //   console.log(crashPageCounter)
    // }
    if (crashPageCounter > 10000) {
      await page.close();
      page = await browser.newPage();
      // console.log("new page")
      await page.setViewport({
        width: 462,
        height: 600,
      });
      crashPageCounter = 0;
    }
  }

  function setNewPageHtml(newChapter) {
    pageHtml = '';
    if (imageToAddNext) {
      pageHtml = imageHtmlToAdd;
      imageHtmlToAdd = '';
      imageToAddNext = false;
      if (newChapter) {
        book[`page-${pageCounter}`] = pageHtml;
        pageCounter += 1;
        pageHtml = '';
      }
      pageHtmlToCheck = pageHtml + pageHtmlToCheck;
    }
  }

  function finishPage(newChapter) {
    if (pageHtml !== '') {
      book[`page-${pageCounter}`] = pageHtml;
      pageCounter += 1;
    }
    crashPageCounter += 1;
    // Puppeteer crashes after a few thousand pages so start with a new webpage after 1000
    checkCrashPageCounter();
    setNewPageHtml(newChapter);
  }

  async function getHiddenSpan(pageHtmlToCheckNow) {
    const pageHtmlFromTemplate = emptyPageHtml.replace(PAGE_TEMPLATE_KEY, pageHtmlToCheckNow);
    await page.setContent(pageHtmlFromTemplate);
    await page.evaluate(async () => {
      const selectors = Array.from(document.querySelectorAll('img'));
      await Promise.all(selectors.map((img) => {
        if (img.complete) return;
        return new Promise((resolve, reject) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', reject);
        });
      }));
    });
    return page.evaluate(() => {
      const pageDiv = $('div.inner');
      const pageDivEl = pageDiv[0];
      const isPageDivOverflowing = pageDivEl.clientHeight < pageDivEl.scrollHeight;
      if (isPageDivOverflowing) {
        const visibleOffset = pageDivEl.offsetTop + pageDivEl.clientHeight;
        let firstHiddenSpan;
        $.each($('div.inner span.pagy'), (i, currentSpan) => {
          const $currentSpan = $(currentSpan);
          const spanNeeds = $currentSpan.offset().top + $currentSpan.height();
          if (spanNeeds > visibleOffset) {
            firstHiddenSpan = $currentSpan.attr('id');
            return false;
          }
        });
        return firstHiddenSpan;
      }
    });
  }

  function getIndentAndStretchParaHtml(tag, selectedHtml, indent, stretch, chapterStart) {
    let stretchClass = '';
    let indentClass = '';
    let chapterStartClass = '';
    if (indent) indentClass = 'no-indent';
    if (stretch && tag === 'p') stretchClass = 'stretch-last-line';
    if (chapterStart && tag === 'p') chapterStartClass = 'start-chapter';
    if (indent || stretch || chapterStart) { return `<${tag} class="${indentClass} ${stretchClass} ${chapterStartClass}">${selectedHtml}</${tag}>`; }
    return `<${tag}>${selectedHtml}</${tag}>`;
  }

  function getSpannedHtmlOfPara(paraHtml) {
    const inputHtml = paraHtml
      .replace(ANCHOR_REGEX, '$4')
      .replace(NEWLINE_REGEX, '\n ');
    // wrap all words with span
    let spannedHtml = '';
    // paraHtml = paraHtml.replace(anchorTagRegex, '')
    // paraHtml = paraHtml.replace(anchorTagEndRegex, '')
    const words = inputHtml.split(' ');
    const lastIndex = words.length - 1;
    words.forEach((v, i) => {
      if (spannedHtml === '') {
        if (i === lastIndex) spannedHtml = `${spannedHtml}${lastSpanStart} id="${i}">${v}${spanEnd}`;
        else spannedHtml = `${spannedHtml}${spanStart} id="${i}">${v}${spanEnd}`;
      } else if (i === lastIndex) spannedHtml = `${spannedHtml}${lastSpanStart} id="${i}"> ${v}${spanEnd}`;
      else spannedHtml = `${spannedHtml}${spanStart} id="${i}"> ${v}${spanEnd}`;
    });
    return spannedHtml.replace(NEWLINE_SPACE_REGEX, '\n');
  }

  function getSelectedPara(paraHtml, endIndex) {
    const inputHtml = paraHtml
      .replace(NEWLINE_REGEX, '\n ')
      .replace(ANCHOR_HREF_REGEX, '<ahref=');
    let html = '';
    const words = inputHtml.split(' ');
    words.forEach((v, i) => {
      if (i <= endIndex) {
        if (html === '') html = v;
        else html += ` ${v}`;
      }
    });

    return html
      .replace(NEWLINE_SPACE_REGEX, '\n')
      .replace(ANCHOR_HREF_REV_REGEX, '<a href=');
  }

  function getHtmlOfPara(paraHtml) {
    const inputHtml = paraHtml.replace(ANCHOR_HREF_REGEX, '<ahref=');
    let html = '';
    const words = inputHtml.split(' ');
    words.forEach((v) => {
      if (html === '') html = v;
      else html += ` ${v}`;
    });
    return html.replace(ANCHOR_HREF_REV_REGEX, '<a href=');
  }

  function getRemainingPara(paraHtml, startIndex) {
    const inputHtml = paraHtml
      .replace(NEWLINE_REGEX, '\n ')
      .replace(ANCHOR_HREF_REGEX, '<ahref=');

    let html = '';
    const words = inputHtml.split(' ');
    words.forEach((v, i) => {
      if (i >= startIndex) {
        if (html === '') html = v;
        else html += ` ${v}`;
      }
    });
    return html
      .replace(NEWLINE_SPACE_REGEX, '\n')
      .replace(ANCHOR_HREF_REV_REGEX, '<a href=');
  }

  function adjustInlineTags(newSelectedHtml, newContent) {
    const lastIndexEm = newSelectedHtml.lastIndexOf('<em>');
    const lastIndexEmEnd = newContent.lastIndexOf('</em>');

    const lastIndexI = newSelectedHtml.lastIndexOf('<i>');
    const lastIndexIEnd = newContent.lastIndexOf('</i>');

    const lastIndexStrong = newSelectedHtml.lastIndexOf('<strong>');
    const lastIndexStrongEnd = newContent.lastIndexOf('</strong>');

    const lastIndexAnchor = newSelectedHtml.lastIndexOf('<a href');
    const lastIndexAnchorEnd = newContent.lastIndexOf('</a>');

    let content = newContent;
    let selectedHtml = newSelectedHtml;

    if (lastIndexEm !== -1 && lastIndexEm > lastIndexEmEnd) {
      content = `<em>${content}`;
      selectedHtml += '</em>';
      iconsole.log(content);
    }

    if (lastIndexI !== -1 && lastIndexI > lastIndexIEnd) {
      content = `<i>${content}`;
      selectedHtml += '</i>';
    }

    if (lastIndexStrong !== -1 && lastIndexStrong > lastIndexStrongEnd) {
      content = `<strong>${content}`;
      selectedHtml += '</strong>';
    }

    if (lastIndexAnchor !== -1 && lastIndexAnchor > lastIndexAnchorEnd) {
      selectedHtml += `${selectedHtml}</a>`;
      const anchorString = selectedHtml.substring(lastIndexAnchor);
      const href = HREF_REGEX.exec(anchorString);
      content = `<a href=${href[1]}>${content}`;
    }

    return {
      selectedHtml,
      content,
    };
  }

  // eslint-disable-next-line max-len
  function getSelectedSplitAndStretchListHtml(tag, currentliIndex, selectedLiHtml, split, stretch, tagStart, tagEnd) {
    let splitClass = '';
    let stretchClass = '';
    let tagEndHtml = '';
    let tagStartHtml = '';
    if (split) splitClass = 'split-li';
    if (stretch) stretchClass = 'stretch-last-line';
    if (tagEnd) tagEndHtml = `</${tag}>`;
    if (tag === 'ol') tagStartHtml = `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}">`;

    if (split || stretch) {
      if (tagStart) return `${tagStartHtml}<li class="${splitClass} ${stretchClass}">${selectedLiHtml}</li>${tagEndHtml}`;
      return `<li class="${splitClass} ${stretchClass}">${selectedLiHtml}</li>${tagEndHtml}`;
    }
    if (tagStart) return `${tagStartHtml}<li>${selectedLiHtml}</li>${tagEndHtml}`;
    return `<li>${selectedLiHtml}</li>${tagEndHtml}`;
  }

  function setTagAdded(newTagAdded, tag) {
    tagAdded = newTagAdded;
    if (tagAdded) { tagHtml = ''; } else { tagHtml = `<${tag}>`; }
  }

  // Iterate over the tmp/.prebook to determine what goes in each page sequentially.
  for (let i = 0; i < prebook.length; i += 1) {
    const elem = prebook[i];
    pageHtmlToCheck = pageHtml;
    // ^^^ this is the variable that is "pageHtml + new tag html
    // element which will be evaluated within page area using puppeteer.
    let htmlToAdd = '';
    // This is the new tag HTML that needs to be checked if fits the page.
    const { tag } = elem;
    // iconsole.log(tag);
    let chapterStart = chapterStartPara;
    if (chapterStartPara) chapterStartPara = !chapterStartPara;
    switch (tag) {
      case 'img':
        let nextPage = false;
        if (imageToAddNext) {
          finishPage(false);
        }
        let imgSrc = elem.innerHtml;
        if (imgSrc.startsWith('http')) {
          const imagePath = imgSrc.split('/');
          imgSrc = `data:image/jpeg;base64,${fse.readFileSync(path.resolve('.', 'assets', 'images', imagePath[imagePath.length - 1])).toString('base64')}`;
        }
        pageHtmlToCheck = `${pageHtml}<img id="checkImg" class="center" src = "${imgSrc}" />`;
        const pageHtmlFromTemplate = emptyPageHtml.replace(PAGE_TEMPLATE_KEY, pageHtmlToCheck);
        await page.setContent(pageHtmlFromTemplate);
        const imageAttr = await page.evaluate(() => {
          const $pageDiv = $('div.inner');
          const pageDivEl = $pageDiv[0];
          nextPage = false;
          let widthPercent = '';
          const visibleOffsetHeight = pageDivEl.offsetTop + pageDivEl.clientHeight;
          const $currentSpan = $('#checkImg');
          const ratio = $currentSpan.width() / $currentSpan.height();
          // const imgNeedsWidth = $currentSpan.offset().left + $currentSpan.width()
          const imgNeedsWidth = $currentSpan.width();
          let width = `${$currentSpan.width()}px`;

          const widthOverFlowing = imgNeedsWidth > pageDivEl.clientWidth;
          // eslint-disable-next-line max-len
          const isHeightLessThanHalfPage = ($currentSpan.offset().top - pageDivEl.offsetTop) > pageDivEl.clientHeight / 2;

          if (widthOverFlowing) {
            width = '100%';
            $currentSpan.width('100%');
          }

          let imgNeedsHeight = $currentSpan.offset().top + $currentSpan.height();
          let heightOverFlowing = imgNeedsHeight > visibleOffsetHeight;

          if (heightOverFlowing && isHeightLessThanHalfPage) {
            nextPage = true;
            $pageDiv.empty();
            $pageDiv.append($currentSpan);
            $currentSpan.width(width);
            imgNeedsHeight = $currentSpan.offset().top + $currentSpan.height();
            heightOverFlowing = imgNeedsHeight > visibleOffsetHeight;
          }

          if (heightOverFlowing) {
            const availableHeight = pageDivEl.clientHeight
             - $currentSpan.offset().top
             + pageDivEl.offsetTop;
            $currentSpan.height(availableHeight);
            $currentSpan.width(availableHeight * ratio);
          }

          const lineHeight = parseInt($pageDiv.css('line-height').replace('px', ''), 10);
          const multiple = Math.floor($currentSpan.height() / lineHeight);
          $currentSpan.width(ratio * multiple * lineHeight);
          $currentSpan.height(multiple * lineHeight);
          widthPercent = (($currentSpan.width() * 100) / $pageDiv.width());

          return {
            width: widthPercent,
            nextPage,
          };
        });

        nextPage = imageAttr.nextPage;

        if (nextPage) {
          imageToAddNext = true;
          imageHtmlToAdd = `<img class="overlay center" width = "${imageAttr.width}%" src="${imgSrc}" url = "${elem.innerHtml}" />`;
        } else {
          pageHtml += `<img class="overlay center" width = "${imageAttr.width}%" src="${imgSrc}" url = "${elem.innerHtml}" />`;
        }
        break;
      case 'h1':
      case 'h2':
        finishPage(true);
        pageHtml = `<${tag}>${elem.innerHtml}</${tag}>`;
        finishPage(true);
        break;
      case 'hr':
        // Include the horizontal rule in the same page where chapter ends
        if (pageHtml !== '') {
          if (prevTag === 'h3' || prevTag === 'h4') {
            pageHtml += hrHtml;
            chapterStartPara = true;
          } else {
            pageHtml += hrHtml;
          }
        } else if (book[`page-${pageCounter - 1}`]) {
          // If the chapter's content has already been included on the
          // previous page, put the horizontal rule on the previous page too:
          book[`page-${pageCounter - 1}`] += hrHtml;
        }
        break;
      case 'p':
      case 'pre':
      case 'code':
      case 'cite':
      case 'h5':
      case 'h6':
        let isParaNotContained = true; // Flag whether content is contained in current page.
        let paraContinued = false; // Flag whether content is continued from last page.
        let pContent = elem.innerHtml;
        htmlToAdd = getIndentAndStretchParaHtml(tag, pContent, false, false, chapterStart);
        // eslint-disable-next-line max-len
        pageHtmlToCheck = pageHtml + getIndentAndStretchParaHtml(tag, getSpannedHtmlOfPara(pContent), false, false, chapterStart);
        do {
          const hiddenSpan = await getHiddenSpan(pageHtmlToCheck);
          if (hiddenSpan) {
            if (hiddenSpan !== 0) {
              const selectedPara = getSelectedPara(pContent, hiddenSpan - 1);
              let selectedParaHtml = getHtmlOfPara(selectedPara);
              pContent = getRemainingPara(pContent, hiddenSpan);

              const adjustedInlineTags = adjustInlineTags(selectedParaHtml, pContent);
              iconsole.log(adjustInlineTags);
              selectedParaHtml = adjustedInlineTags.selectedHtml;
              pContent = adjustedInlineTags.content;

              pageHtml += getIndentAndStretchParaHtml(tag, selectedParaHtml, paraContinued, true, chapterStart);
              htmlToAdd = getIndentAndStretchParaHtml(tag, pContent, true, false);
              pageHtmlToCheck = getIndentAndStretchParaHtml(tag, getSpannedHtmlOfPara(pContent), true, false);
              paraContinued = true;
            } else {
              pageHtmlToCheck = getIndentAndStretchParaHtml(tag, getSpannedHtmlOfPara(pContent), paraContinued, false, chapterStart);
            }
            finishPage(false);
          } else {
            pageHtml += htmlToAdd;
            isParaNotContained = false;
            paraContinued = false;
          }
          chapterStart = false;
        } while (isParaNotContained);
        break;
      case 'ol':
      case 'ul':
        const { list } = elem.innerHtml;
        tagHtml = `<${tag}>`;
        tagAdded = false;
        for (let j = 0; j < list.length; j += 1) {
          const liIndex = list[j];
          const currentliIndex = parseInt(liIndex, 10) + 1;
          let isliNotContained = true;
          let liContinued = false;
          let liContent = list[liIndex];
          let liHtml = `<li>${liContent}</li>`;
          pageHtmlToCheck = `${pageHtml}${tagHtml}<li>${getSpannedHtmlOfPara(liContent)}</li></${tag}>`;

          do {
            const hiddenSpan = await getHiddenSpan(pageHtmlToCheck);

            if (hiddenSpan) {
              if (hiddenSpan !== 0) {
                const selectedliContent = getSelectedPara(liContent, hiddenSpan - 1);
                let selectedLiHtml = getHtmlOfPara(selectedliContent);
                liContent = getRemainingPara(liContent, hiddenSpan);

                const adjustedInlineTags = adjustInlineTags(selectedLiHtml, liContent);
                selectedLiHtml = adjustedInlineTags.selectedHtml;
                liContent = adjustedInlineTags.content;

                pageHtml += getSelectedSplitAndStretchListHtml(tag, currentliIndex, selectedLiHtml, liContinued, true, !tagAdded, true);

                liHtml = getSelectedSplitAndStretchListHtml(tag, currentliIndex, liContent, true, false, false, false);

                pageHtmlToCheck = getSelectedSplitAndStretchListHtml(tag, currentliIndex, getSpannedHtmlOfPara(liContent), true, false, true, true);

                liContinued = true;
              } else {
                pageHtmlToCheck = getSelectedSplitAndStretchListHtml(tag, currentliIndex, getSpannedHtmlOfPara(liContent), false, false, true, true);
                pageHtml += `</${tag}>`;
              }
              finishPage(false);
              setTagAdded(false, tag);
            } else {
              if (tagAdded) pageHtml += liHtml;
              else {
                let indexHtml = '';
                if (liIndex > 0 && tag === 'ol') indexHtml = ` style="--start:${currentliIndex}" start="${currentliIndex}"`;
                pageHtml += `<${tag}${indexHtml}>${liHtml}`;
                setTagAdded(true, tag);
              }
              isliNotContained = false;
              liContinued = false;
            }
          } while (isliNotContained);
        }
        pageHtml += `</${tag}>`;
        break;
      case 'h3':
      case 'h4':
        if (prevTag !== 'h3' && prevTag !== 'h4') { finishPage(true); }

        pageHtml += `<${tag}>${elem.innerHtml}</${tag}>`;
        if (tag === 'h3' && !elem.innerHtml.includes('Chapter')) {
          index[indexer] = `<li>
                              <a class = "page" href="${pageCounter}">
                                ${elem.innerHtml}
                              </a>
                              <span class="flex">
                                ${pageCounter}
                              </span>
                            </li>`;
          indexer += 1;
        }
        chapterStartPara = true;
        break;
      case 'blockquote':
        iconsole.log('unhandled right now');
        break;
      case 'div':
        /* TODO: Move this block of code elsewhere.
          this block of code was introduced to handle the Girl Names book.
          it isn't coming from the idea of markdown compatible HTML. */
        pageHtmlToCheck = `${pageHtml}<${tag} id="hiddenDivCheck">${elem.innerHtml}</${tag}>`;
        const pageHtmlDivFromTemplate = emptyPageHtml.replace(PAGE_TEMPLATE_KEY, pageHtmlToCheck);
        await page.setContent(pageHtmlDivFromTemplate);
        const hiddenFlag = await page.evaluate(() => {
          const $pageDiv = $('div.inner');
          const pageDivEl = $pageDiv[0];
          const $currentDiv = $('#hiddenDivCheck');
          const visibleOffsetHeight = pageDivEl.offsetTop + pageDivEl.clientHeight;
          const divNeedsHeight = $currentDiv.offset().top + $currentDiv.height();
          const heightOverFlowing = divNeedsHeight > visibleOffsetHeight;
          return heightOverFlowing;
        });
        if (hiddenFlag) {
          finishPage(true);
          pageHtml = `<${tag}>${elem.innerHtml}</${tag}>`;
        } else {
          pageHtml += `<${tag}>${elem.innerHtml}</${tag}>`;
        }
        break;
      default:
        iconsole.log(`An unhandled tag ${tag} was encountered.`);
    }
    prevTag = tag;
  }

  if (pageHtml !== '') {
    book[`page-${pageCounter}`] = pageHtml;
    pageCounter += 1;
  }
  await browser.close();

  await fse
    .writeFile(path.join('.', 'interim', 'tmp', '.book'), JSON.stringify(book, null, 2))
    .catch((err) => iconsole.log(chalk.bold.red('Failed to write .book json', err)));
  iconsole.log(chalk.green(`Pagification… (.book) is ${chalk.blue('complete')}`));

  await fse
    .writeFile(path.join('.', 'interim', 'tmp', '.index'), JSON.stringify(index, null, 2))
    .catch((err) => iconsole.log(chalk.bold.red('Failed to write index json', err)));
  iconsole.log(chalk.green(`A book.index was ${chalk.blue('prepared.')}`));
}
