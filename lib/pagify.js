module.exports.pagify = (async () => {
  const fse = require('fs-extra');
  const path = require('path');
  const chalk = require('chalk');

  const puppeteer = require('puppeteer');

  const spanStart = '<span class="pagy"';
  const lastSpanStart = '<span class="pagy last-pagy"';
  const spanEnd = '</span>';
  const hrHtml = '<hr class="section">';
  // const hrefRegex = href_regex = /<a([^>]*?)href\s*=\s*(['"])([^\2]*?)\2\1*>/i;
  // const anchorTagRegex = /<a[^>]*>/g
  // const anchorTagEndRegex = /<\/a>/g

  const book = {};
  const	index = {};
  const HREF_REGEX = new RegExp(/<a href=([^>]*?)>/g);
  const ANCHOR_HREF_REGEX = new RegExp(/<a href=/g);
  const ANCHOR_HREF_REV_REGEX = new RegExp(/<ahref=/g);
  const ANCHOR_REGEX = new RegExp(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1([^>]*)?>(.*?)<\/a>/g);
  const NEWLINE_REGEX = new RegExp(/\n/g);
  const NEWLINE_SPACE_REGEX = new RegExp(/\n /g);

  const pageTemplateHtml = await fse.readFile(path.join(__dirname, '..', 'templates', 'pagy-template.html'), 'utf-8').catch((err) => { console.log(`Could not read the page-template file: ${err}`); });

  const bookrc = await fse.readJson(path.join('.', '.bookrc')).catch((err) => {
    if (err) console.log(chalk.red('Could not read .bookrc ', err));
  });
  const startPage = bookrc && bookrc.start_page ? parseInt(bookrc.start_page) : 9;

  const prebook = await fse.readJson(path.join('.', 'interim', 'tmp', '.prebook')).catch((err) => {
    if (err) console.log(chalk.red('Could not read .book json', err));
  });

  const bookLayoutTemplate = await fse.readFile(path.join('.', 'templates', 'style.css')).catch((err) => {
    if (err) console.log(chalk.red('Could not read stle.css from templates', err));
  });
  const bookHeadTemplate = await fse.readFile(path.join('.', 'templates', 'head.html')).catch((err) => {
    if (err) console.log(chalk.red('Could not read head.html from templates', err));
  });
  const PAGE_TEMPLATE_KEY = 'PAGE_INNER_HTML';
  const LAYOUT_TEMPLATE_KEY = 'BOOK_LAYOUT_TEMPLATE';
  const HEAD_TEMPLATE_KEY = 'BOOK_HEAD_TEMPLATE';
  const emptyPageHtml = pageTemplateHtml.replace(LAYOUT_TEMPLATE_KEY, bookLayoutTemplate)
    .replace(HEAD_TEMPLATE_KEY, bookHeadTemplate);

  let pageHtml = ''; // This is the finalized HTML for the page - this will only include content that fits
  let indexer = 0;
  let crashPageCounter = 0;
  let tagAdded = false;
		let tagHtml = ''; // the flag is to check whether ol/ul tag needs to be added for this li

  const browser = await puppeteer.launch({
    headless: false,
	});
  // let page = await browser.newPage();
  const page = (await browser.pages())[0];
  await page.setViewport({
    width: 462,
    height: 600,
	}); // Do not change these values. Ever!

  let pageCounter = startPage;
  let imageToAddNext = false;
		let imageHtmlToAdd = '';
		let pageHtmlToCheck = '';
    let chapterStartPara = false;
    let prevTag = '';

  for (const elem of prebook) {
    pageHtmlToCheck = pageHtml, // This is the HTML that is pageHtml + new tag html and will be checked with puppeteer
    htmltoAdd = '', // This is the new tag HTML that needs to be checked if fits
    tag = elem.tag;

    let chapterStart = chapterStartPara;
    if (chapterStartPara) chapterStartPara = !chapterStartPara;

    switch (tag) {
      case 'div':
        const divElem = elem.innerHtml;
        pageHtmlToCheck = `${pageHtml  }<${tag} id="hiddenDivCheck">${elem.innerHtml}</${tag}>`;
        const pageHtmlDivFromTemplate = emptyPageHtml.replace(PAGE_TEMPLATE_KEY, pageHtmlToCheck);
        await page.setContent(pageHtmlDivFromTemplate);
        const hiddenFlag = await page.evaluate(() => {
          const $pageDiv = $('div.inner');
          const pageDivEl = $pageDiv[0];
          const $currentDiv = $("#hiddenDivCheck");
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

      case 'img':

        let nextPage = false;

        if (imageToAddNext) {
          finishPage(false);
        }
        let imgSrc = elem.innerHtml;
        if (imgSrc.startsWith('http')) {
          const imagePath = imgSrc.split("/");
          imgSrc = 'data:image/jpeg;base64,' + fse.readFileSync(path.resolve('.', 'assets', 'images', imagePath[imagePath.length - 1])).toString('base64');
        }

        pageHtmlToCheck = `${pageHtml  }<img id="checkImg" class="center" src = "${imgSrc}" />`;
        const pageHtmlFromTemplate = emptyPageHtml.replace(PAGE_TEMPLATE_KEY, pageHtmlToCheck);
        await page.setContent(pageHtmlFromTemplate);

        const imageAttr = await page.evaluate(() => {
          const $pageDiv = $('div.inner');
          const pageDivEl = $pageDiv[0];
          let nextPage = false;
          let widthPercent = '';

          const visibleOffsetHeight = pageDivEl.offsetTop + pageDivEl.clientHeight;
          const $currentSpan = $("#checkImg");
          const ratio = $currentSpan.width() / $currentSpan.height();

          // const imgNeedsWidth = $currentSpan.offset().left + $currentSpan.width()
          const imgNeedsWidth = $currentSpan.width();
          let width = `${$currentSpan.width()  }px`;

          const widthOverFlowing = imgNeedsWidth > pageDivEl.clientWidth;

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
            const availableHeight = pageDivEl.clientHeight - $currentSpan.offset().top + pageDivEl.offsetTop;
            $currentSpan.height(availableHeight);
            $currentSpan.width(availableHeight * ratio);
          }

          const lineHeight = parseInt($pageDiv.css('line-height').replace('px', ''));
          const multiple = Math.floor($currentSpan.height() / lineHeight);
          $currentSpan.width(ratio * multiple * lineHeight);
          $currentSpan.height(multiple * lineHeight);
          widthPercent = (($currentSpan.width() * 100) / $pageDiv.width());

          return {
            width: widthPercent,
            nextPage
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
        if (pageHtml != '') {pageHtml += hrHtml;}
        else if (book[`page-${pageCounter - 1}`]) {
          // If the chapter's content has already been included on last page, add the horizontal rule on the last page
          book[`page-${pageCounter - 1}`] += hrHtml;
        }

        break;

      case 'blockquote':
        const anda="batata";
      		case 'pre':
      case 'p':
      case 'code':

      case 'cite':
      case 'h5':
      case 'h6':


        let isParaNotContained = true; // Flag whether content is contained in current page
					let paraContinued = false; // Flag whether content is continued from last page
        let pContent = elem.innerHtml;
        htmltoAdd = getIndentAndStretchParaHtml(tag, pContent, false, false, chapterStart);
        pageHtmlToCheck = pageHtml + getIndentAndStretchParaHtml(tag, getSpannedHtmlOfPara(pContent), false, false, chapterStart);

        do {
          const hiddenSpan = await getHiddenSpan(pageHtmlToCheck);
          if (hiddenSpan) {
            if (hiddenSpan != 0) {
              const selectedPara = getSelectedPara(pContent, hiddenSpan - 1);
              let selectedParaHtml = getHtmlOfPara(selectedPara);
              pContent = getRemainingPara(pContent, hiddenSpan);

              const adjustedInlineTags = adjustInlineTags(selectedParaHtml, pContent);
              selectedParaHtml = adjustedInlineTags.selectedHtml;
              pContent = adjustedInlineTags.content;

              pageHtml += getIndentAndStretchParaHtml(tag, selectedParaHtml, paraContinued, true, chapterStart);
              htmltoAdd = getIndentAndStretchParaHtml(tag, pContent, true, false);
              pageHtmlToCheck = getIndentAndStretchParaHtml(tag, getSpannedHtmlOfPara(pContent), true, false);
              paraContinued = true;
            } else {
              pageHtmlToCheck = getIndentAndStretchParaHtml(tag, getSpannedHtmlOfPara(pContent), paraContinued, false, chapterStart);
            }
            finishPage(false);
          } else {
            pageHtml += htmltoAdd;
            isParaNotContained = false;
            paraContinued = false;
          }
          chapterStart = false;
        } while (isParaNotContained);

        break;

      case 'ol':
      case 'ul':
        const list = elem.innerHtml.list;
        tagHtml = `<${tag}>`;
        tagAdded = false;

        for (const liIndex in list) {
          const currentliIndex = parseInt(liIndex) + 1;
          let isliNotContained = true;
						let liContinued = false;
          let liContent = list[liIndex];
          let liHtml = `<li>${liContent}</li>`;
          pageHtmlToCheck = `${pageHtml}${tagHtml}<li>${getSpannedHtmlOfPara(liContent)}</li></${tag}>`;

          do {
            const hiddenSpan = await getHiddenSpan(pageHtmlToCheck);

            if (hiddenSpan) {
              if (hiddenSpan != 0) {
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
              setTagAdded(false);
            } else {
              if (tagAdded) pageHtml += liHtml;
              else {
                let indexHtml = '';
                if (liIndex > 0 && tag == 'ol') indexHtml = ` style="--start:${currentliIndex}" start="${currentliIndex}"`;
                pageHtml += `<${tag}${indexHtml}>${liHtml}`;
                setTagAdded(true);
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
        if (prevTag != 'h3' && prevTag != 'h4') {finishPage(true)};
        pageHtml += `<${tag}>${elem.innerHtml}</${tag}>`;
        index[indexer++] = `<li><a class = "page" href="${pageCounter}">${elem.innerHtml}</a> <span class="flex">${pageCounter}</span> </li>`;
        chapterStartPara = true;
        break;

      default:
        console.log('Unhandled tag encountered = ' + tag);
    }
    prevTag = tag;
  }

  if (pageHtml != '') {
    book[`page-${pageCounter++}`] = pageHtml;
  }
  await browser.close();

  await fse.writeFile(path.join('.', 'interim', 'tmp', '.book'), JSON.stringify(book, null, 2)).catch((err) => {
    if (err) return console.log(chalk.bold.red('Failed to write .book json', err));
  });
  console.log(chalk.green(`Pagification… (.book) is ${chalk.blue('complete')}`));

  await fse.writeFile(path.join('.', 'interim', 'tmp', '.index'), JSON.stringify(index, null, 2)).catch((err) => {
    if (err) return console.log(chalk.bold.red('Failed to write index json', err));
  });
  console.log(chalk.green(`A book.index was ${chalk.blue('prepared.')}`));

  function setTagAdded(newTagAdded) {
    tagAdded = newTagAdded;
    if (tagAdded) {tagHtml = ''};
    else {tagHtml = `<${tag}>`};
  }

  function getIndentAndStretchParaHtml(tag, selectedHtml, indent, stretch, chapterStart) {
		let stretchClass = '',
      indentClass = '',
      chapterStartClass = ''
		if (indent) indentClass = "no-indent"
    if (stretch && tag == "p") stretchClass = "stretch-last-line"
    if (chapterStart && tag == "p") chapterStartClass = "start-chapter"
		if (indent || stretch || chapterStart)
			return `<${tag} class="${indentClass} ${stretchClass} ${chapterStartClass}">${selectedHtml}</${tag}>`
		return `<${tag}>${selectedHtml}</${tag}>`
	}

  function finishPage(newChapter) {
    if (pageHtml !== '') {
      book[`page-${pageCounter++}`] = pageHtml;
    }
    crashPageCounter += 1;
    checkCrashPageCounter(); // Puppeteer crashes after a few thousand pages so create a new page after 1000
    setNewPageHtml(newChapter);
  }

  function setNewPageHtml(newChapter) {
    pageHtml = '';
    if (imageToAddNext) {
      pageHtml = imageHtmlToAdd;
      imageHtmlToAdd = '';
      imageToAddNext = false;
      if (newChapter) {
        book[`page-${pageCounter++}`] = pageHtml;
        pageHtml = '';
      }
      pageHtmlToCheck = pageHtml + pageHtmlToCheck;
    }
  }

  function getSelectedSplitAndStretchListHtml(tag, currentliIndex, selectedLiHtml, split, stretch, tagStart, tagEnd) {
		let splitClass = '',
			stretchClass = '',
			tagEndHtml = '',
			tagStartHtml = ''
		if (split) splitClass = 'split-li'
		if (stretch) stretchClass = 'stretch-last-line'
		if (tagEnd) tagEndHtml = `</${tag}>`
		if (tag == 'ol') tagStartHtml = `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}">`

		if (split || stretch) {
			if (tagStart) return `${tagStartHtml}<li class="${splitClass} ${stretchClass}">${selectedLiHtml}</li>${tagEndHtml}`;
			return `<li class="${splitClass} ${stretchClass}">${selectedLiHtml}</li>${tagEndHtml}`;
		} else {
			if (tagStart) return `${tagStartHtml}<li>${selectedLiHtml}</li>${tagEndHtml}`;
			else return `<li>${selectedLiHtml}</li>${tagEndHtml}`;
		}
	}

  function adjustInlineTags(selectedHtml, content) {
    const lastIndexP = selectedHtml.lastIndexOf('<p>');
    const lastIndexPEnd = selectedHtml.lastIndexOf('</p>');

    const lastIndexEm = selectedHtml.lastIndexOf('<em>');
    const lastIndexEmEnd = selectedHtml.lastIndexOf('</em>');

    const lastIndexI = selectedHtml.lastIndexOf('<i>');
    const lastIndexIEnd = selectedHtml.lastIndexOf('</i>');

    const lastIndexStrong = selectedHtml.lastIndexOf('<strong>');
    const lastIndexStrongEnd = selectedHtml.lastIndexOf('</strong>');

    const lastIndexAnchor = selectedHtml.lastIndexOf('<a href');
    const lastIndexAnchorEnd = selectedHtml.lastIndexOf('</a>');

    if (lastIndexP != -1 && lastIndexP > lastIndexPEnd) {
      content = `<p>${  content}`;
      selectedHtml += '</p>';
		  }

    if (lastIndexEm != -1 && lastIndexEm > lastIndexEmEnd) {
      content = `<em>${  content}`;
      selectedHtml += '</em>';
    }

    if (lastIndexI != -1 && lastIndexI > lastIndexIEnd) {
      content = `<i>${  content}`;
      selectedHtml += '</i>';
    }

    if (lastIndexStrong != -1 && lastIndexStrong > lastIndexStrongEnd) {
      content = `<strong>${  content}`;
      selectedHtml += '</strong>';
    }

    if (lastIndexAnchor != -1 && lastIndexAnchor > lastIndexAnchorEnd) {
      selectedHtml += `${selectedHtml  }</a>`;
      const anchorString = selectedHtml.substring(lastIndexAnchor);
      const href = HREF_REGEX.exec(anchorString);
      content = `<a href=${href[1]}>${content}`;
    }

    return {
      selectedHtml,
      content
    };
  }

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

  async function isContentOverflowing(pageHtmlToCheck) {
    const pageHtmlFromTemplate = emptyPageHtml.replace(PAGE_TEMPLATE_KEY, pageHtmlToCheck);
    await page.setContent(pageHtmlFromTemplate);
    return page.evaluate(() => {
      const pageDiv = $('div.inner');
      const pageDivEl = pageDiv[0];
      const isPageDivOverflowing =				pageDivEl.clientHeight < pageDivEl.scrollHeight;
      return isPageDivOverflowing;
    });
  }

  async function getHiddenSpan(pageHtmlToCheck) {
    const pageHtmlFromTemplate = emptyPageHtml.replace(PAGE_TEMPLATE_KEY, pageHtmlToCheck);
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

  function getSpannedHtmlOfPara(paraHtml) {
    paraHtml = paraHtml.replace(ANCHOR_REGEX, '$4');
    paraHtml = paraHtml.replace(NEWLINE_REGEX, '\n ');
    // wrap all words with span
    let spannedHtml = '';
    // paraHtml = paraHtml.replace(anchorTagRegex, '')
    // paraHtml = paraHtml.replace(anchorTagEndRegex, '')
    const words = paraHtml.split(' ');
    const lastIndex = words.length - 1;
    words.forEach((v, i) => {
      if (spannedHtml === '') {if (i == lastIndex) spannedHtml = `${spannedHtml}${lastSpanStart} id="${i}">${v}${spanEnd}`;
				else spannedHtml = `${spannedHtml}${spanStart} id="${i}">${v}${spanEnd}`;}
      else if (i == lastIndex) spannedHtml = `${spannedHtml}${lastSpanStart} id="${i}"> ${v}${spanEnd}`;
				else spannedHtml = `${spannedHtml}${spanStart} id="${i}"> ${v}${spanEnd}`;
    });
    return spannedHtml.replace(NEWLINE_SPACE_REGEX, '\n');
  }

  function getHtmlOfPara(paraHtml) {
    paraHtml = paraHtml.replace(ANCHOR_HREF_REGEX, '<ahref=');

    let html = '';
    const words = paraHtml.split(' ');
    words.forEach((v, i) => {
      if (html === '') html = v;
      else html += ` ${v}`;
    });
    return html.replace(ANCHOR_HREF_REV_REGEX, '<a href=');
  }

  function getRemainingPara(paraHtml, startIndex) {
    paraHtml = paraHtml.replace(NEWLINE_REGEX, '\n ');
    paraHtml = paraHtml.replace(ANCHOR_HREF_REGEX, '<ahref=');

    let html = '';
    const words = paraHtml.split(' ');
    words.forEach((v, i) => {
      if (i >= startIndex) {
        if (html === '') html = v;
        else html += ` ${v}`;
      } else return false;
    });
    return html.replace(NEWLINE_SPACE_REGEX, '\n').replace(ANCHOR_HREF_REV_REGEX, '<a href=');
  }

  function getSelectedPara(paraHtml, endIndex) {
    paraHtml = paraHtml.replace(NEWLINE_REGEX, '\n ');
    paraHtml = paraHtml.replace(ANCHOR_HREF_REGEX, '<ahref=');
    let html = '';
    const words = paraHtml.split(' ');
    words.forEach((v, i) => {
      if (i <= endIndex) {
        if (html === '') html = v;
        else html += ` ${v}`;
      } else return false;
    });
    return html.replace(NEWLINE_SPACE_REGEX, '\n').replace(ANCHOR_HREF_REV_REGEX, '<a href=');
  }
})
