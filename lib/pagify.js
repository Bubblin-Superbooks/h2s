async function pagify() {
	const fse = require('fs-extra');
	const path = require('path');
	const chalk = require('chalk');

	const puppeteer = require('puppeteer');

	const spanStart = '<span class="pagy"';
	const lastSpanStart = '<span class="pagy last-pagy"';
  const spanEnd = '</span>';
  const hrefRegex = href_regex = /<a([^>]*?)href\s*=\s*(['"])([^\2]*?)\2\1*>/i;

	let book = {}, index = {};

	const emptyPageHtml = await fse.readFile(path.join(__dirname, '..', 'templates', 'pagy-template.html'), 'utf-8');

  const bookrc = await fse.readJson(path.join('.', '.bookrc')).catch(err => {
    if (err) console.log(chalk.red('Could not read .bookrc ', err));
  })
  const startPage = bookrc ? parseInt(bookrc.start_page):1;

    const prebook = await fse.readJson(path.join('.', 'interim', 'tmp', '.prebook')).catch(err => {
      if (err) console.log(chalk.red('Could not read .book json', err));
    })

  const elemCount = Object.keys(prebook).length;

  let pageHtml = ''; // This is the finalized HTML for the page - this will only include content that fits
  let indexer = 0;
  let crashPageCounter = 0;

  const browser = await puppeteer.launch({headless:false});
  let page = await browser.newPage();
  await page.setViewport({ width: 462, height: 600 }); // Do not change these values.

  let pageCounter = startPage;
  let imageToAddNext = false, imageHtmlToAdd = '';

  for (const elem of prebook) {
  //await prebook.forEach(async function (elem) {
    let pageHtmlToCheck = pageHtml, // This is the HTML that is pageHtml + new tag html and will be checked with puppeteer
    htmltoAdd = '', // This is the new tag HTML that needs to be checked if fits
    tag = elem.tag;
    switch (tag) {
      case 'img' :
        htmltoAdd = `<img width = "100%" src = "${elem.innerHtml}" />`
        if(imageToAddNext) {
          finishPage()
        }
        if(pageHtml !== '') { // Page has some content
          pageHtmlToCheck += htmltoAdd // page already has some content so need to check if it fits in page
          let isOverFlowing = await isContentOverflowing(pageHtmlToCheck)
          if(isOverFlowing) {
            imageToAddNext = true
            imageHtmlToAdd = htmltoAdd
          } else {
            pageHtml += htmltoAdd
          }
        } else {
          pageHtml = htmltoAdd // New page so add the entire image without checking with puppeteer
        }

        break;
      
      case 'h3': case 'h4':
        finishPage()
        pageHtml = `<${elem.tag}>${elem.innerHtml}</${elem.tag}>`;
        index[indexer++] = `<li><a class = "page" href="${pageCounter}">${elem.innerHtml}</a> <span class="flex">${pageCounter}</span> </li>`;
        
        break;

      case 'hr':
        if (pageHtml != '') 
          pageHtml += '<hr class="section">';

        break;

        case 'p': case 'code': case 'blockquote': case 'cite': case 'h1': case 'h2': case 'h5': case 'h6':
        tag = elem.tag; 
        let isParaNotContained = true, // Flag whether paragraph is contained in current page
        paraContinued = false; // Flag whether paragraph is continued from last page
        let pContent = elem.innerHtml;
        htmltoAdd = `<${tag}>${pContent}</${tag}>`;
        pageHtmlToCheck = pageHtml + getSpannedHtmlOfPara(pContent);

        do {
          const hiddenSpan = await getHiddenSpan(pageHtmlToCheck)
          if(hiddenSpan) {
            if (hiddenSpan != 0) {
              const selectedPara = getSelectedPara(pContent, hiddenSpan - 1);
              var selectedParaHtml = getHtmlOfPara(selectedPara);
              pContent = getRemainingPara(pContent, hiddenSpan);

              const adjustedInlineTags = adjustInlineTags(selectedParaHtml, pContent)
              selectedParaHtml = adjustedInlineTags.selectedHtml
              pContent = adjustedInlineTags.content

              if (paraContinued)
								pageHtml += `<${tag} class="no-indent stretch-last-line">${selectedParaHtml}</${tag}>`;
              else 
                pageHtml += `<${tag} class="stretch-last-line">${selectedParaHtml}</${tag}>`;

							htmltoAdd = `<${tag} class="no-indent">${pContent}</${tag}>`;
							pageHtmlToCheck = `<${tag} class="no-indent">${getSpannedHtmlOfPara(pContent)}</${tag}>`;
							paraContinued = true;
            } else {
							if (paraContinued)
                pageHtmlToCheck = `<${tag} class="no-indent">${getSpannedHtmlOfPara(pContent)}</${tag}>`;
              else 
                pageHtmlToCheck = `<${tag}>${getSpannedHtmlOfPara(pContent)}</${tag}>`;
						}
						finishPage()
					} else {
						pageHtml += htmltoAdd;
						isParaNotContained = false;
						paraContinued = false;
          }

      } while (isParaNotContained);
    
      break;

      case 'ol' : case 'ul':
        let list = elem.innerHtml.list;
        let tagAdded = false; // the flag is to check whether ol/ul tag needs to be added for this li
        let tagHtml = `<${elem.tag}>`, tagEndHtml = `</${elem.tag}>`;

        for (const liIndex in list) {
          let currentliIndex = parseInt(liIndex) + 1;
          let isliNotContained = true;
          let liContinued = false;
          let liElem = list[liIndex];
          let liContent = liElem;
          let liHtml = `<li>${liContent}</li>`;
          pageHtmlToCheck = '';
          if (tagAdded) {
            pageHtmlToCheck = `${pageHtml}<li>${getSpannedHtmlOfPara(liContent)}</li>${tagEndHtml}`;
          } else {
            pageHtmlToCheck = `${pageHtml}${tagHtml}<li>${getSpannedHtmlOfPara(liContent)}</li>${tagEndHtml}`;
          }

          do {
            const hiddenSpan = await getHiddenSpan(pageHtmlToCheck)
              
            if (hiddenSpan) {
              if (hiddenSpan != 0) {
                const selectedliContent = getSelectedPara(liContent,hiddenSpan - 1);
                var selectedLiHtml = getHtmlOfPara(selectedliContent);
                liContent = getRemainingPara(liContent, hiddenSpan);

                const adjustedInlineTags = adjustInlineTags(selectedLiHtml, liContent)
                selectedLiHtml = adjustedInlineTags.selectedHtml
                liContent = adjustedInlineTags.content

                
                if (liContinued)
                  if(elem.tag == 'ol')
                    pageHtml += `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li class="split-li stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                  else
                    pageHtml += `<${tag}><li class="split-li stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                else {
                  if (tagAdded) 
                    pageHtml += `<li class="stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                  else {
                    if (currentliIndex > 1)
                      if(elem.tag == 'ol')
                        pageHtml += `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li class="stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                      else 
                        pageHtml += `<${tag}><li class="stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                    else
                      pageHtml += `${tagHtml}<li class="stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                  }
                }

                liHtml = `<li class="split-li">${liContent}</li>`;
                liContinued = true;

                if(elem.tag == 'ol')
                  pageHtmlToCheck = `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li class="split-li">${getSpannedHtmlOfPara(liContent)}</li>${tagEndHtml}`;
                else
                  pageHtmlToCheck = `<${tag}"><li class="split-li">${getSpannedHtmlOfPara(liContent)}</li>${tagEndHtml}`;
                
              } else {
                if(elem.tag == 'ol')
                  pageHtmlToCheck = `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li>${getSpannedHtmlOfPara(liContent)}</li>${tagEndHtml}`;
                else
                  pageHtmlToCheck = `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li>${getSpannedHtmlOfPara(liContent)}</li>${tagEndHtml}`;
               
                pageHtml += `${tagEndHtml}`
              }
              finishPage()
              tagAdded = false;
            } else {
              if (tagAdded) {
                pageHtml += liHtml;
              } else {
                if (liIndex > 0)
                  if(elem.tag == 'ol')
                    pageHtml += `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}">${liHtml}`;
                  else
                    pageHtml += `<${tag}>${liHtml}`;
                else
                  pageHtml += `${tagHtml}${liHtml}`;
                  tagAdded = true;
              }

              isliNotContained = false;
              liContinued = false;
            }
          } while (isliNotContained);
        }

        pageHtml += `${tagEndHtml}`; 

      break;

      default:
        console.log("Unhandled tag encountered = "+ elem.tag);
    }


  }

  if (pageHtml != '') {
    book[pageCounter++] = pageHtml
  }
  await browser.close();

  await fse.writeFile(path.join('.', 'interim', 'tmp', '.book'), JSON.stringify(book, null, 2)).catch(err => {
    if (err) return console.log(chalk.bold.red('Failed to write .book json', err));
  })
  console.log(chalk.green(`Pagification… (.book) is ${chalk.blue('complete')}`));
 

  await fse.writeFile(path.join('.', 'interim', 'tmp', '.index'), JSON.stringify(index, null, 2)).catch(err => {
    if (err) return console.log(chalk.bold.red('Failed to write index json', err));
  })
	console.log(chalk.green(`A book.index was ${chalk.blue('prepared.')}`));
 
  function finishPage() {
    if (pageHtml !== '') {
      book[pageCounter++] = pageHtml
    }
    crashPageCounter += 1;
    checkCrashPageCounter(); // Puppeteer crashes after a few thousand pages so create a new page after 1000
    setNewPageHtml()
  }

  function setNewPageHtml() {
    pageHtml = ''
    if(imageToAddNext) {
      pageHtml = imageHtmlToAdd
      imageHtmlToAdd = ''
      imageToAddNext = false
    }
    pageHtmlToCheck = pageHtml
  }

  function adjustInlineTags(selectedHtml, content) {
    const lastIndexEm = selectedHtml.lastIndexOf('<em>');
    const lastIndexEmEnd = selectedHtml.lastIndexOf('</em>');

    const lastIndexStrong = selectedHtml.lastIndexOf('<strong>');
    const lastIndexStrongEnd = selectedHtml.lastIndexOf('</strong>');

    const lastIndexAnchor = selectedHtml.lastIndexOf('<a');
    const lastIndexAnchorEnd = selectedHtml.lastIndexOf('</a>');

    if (lastIndexEm != -1 && lastIndexEm > lastIndexEmEnd) {
      selectedHtml += selectedParaHtml + '</em>';
      content = '<em>' + content;
    }

    if (lastIndexStrong != -1 && lastIndexStrong > lastIndexStrongEnd) {
      selectedHtml += selectedHtml + '</em>';
      content = '<strong>' + content;
    }

    if (lastIndexAnchor != -1 && lastIndexAnchor > lastIndexAnchorEnd) {
      selectedHtml += selectedHtml + '</a>';
      let anchorString = selectedHtml.substring(lastIndexAnchor)
      let href = anchorString.match(hrefRegex)

      content = `<a href="${href}">${content}`
    }
    return {selectedHtml: selectedHtml, content: content}
  }

  async function checkCrashPageCounter() {
    if (crashPageCounter > 1000) {
      page.close();
      page = await browser.newPage();
      await page.setViewport({ width: 462, height: 600 });
      crashPageCounter = 0;
    }
  }

  async function isContentOverflowing(pageHtmlToCheck) {
    const pageHtmlFromTemplate = emptyPageHtml.replace('PAGE_INNER_HTML', pageHtmlToCheck);
    await page.setContent(pageHtmlFromTemplate);
    return page.evaluate(() => {
      const pageDiv = $('div.inner');
      const pageDivEl = pageDiv[0];
      const isPageDivOverflowing =
        pageDivEl.clientHeight < pageDivEl.scrollHeight;
      return isPageDivOverflowing;
    });
  }

  async function getHiddenSpan(pageHtmlToCheck) {
    const pageHtmlFromTemplate = emptyPageHtml.replace('PAGE_INNER_HTML', pageHtmlToCheck);
    await page.setContent(pageHtmlFromTemplate);
    return page.evaluate(() => {
      const pageDiv = $('div.inner');
      const pageDivEl = pageDiv[0];
      const isPageDivOverflowing =
        pageDivEl.clientHeight < pageDivEl.scrollHeight;
      if (isPageDivOverflowing) {
        const visibleOffset = pageDivEl.offsetTop + pageDivEl.clientHeight;
        let firstHiddenSpan;
        $.each(
          $('div.inner span.pagy'),
          (i, { offsetTop, offsetHeight, id }) => {
            const spanNeeds = offsetTop + offsetHeight;
            if (spanNeeds > visibleOffset) {
              firstHiddenSpan = id;
              return false;
            }
          }
        );
        return firstHiddenSpan;
      }
    });
  }

	function getSpannedHtmlOfPara(paraHtml) {
		//wrap all words with span
		let spannedHtml = '';
		const words = paraHtml.split(' ');
		const lastIndex = words.length - 1;
		words.forEach((v, i) => {
			if (spannedHtml === '')
				if (i == lastIndex) spannedHtml = `${spannedHtml}${lastSpanStart} id="${i}">${v}${spanEnd}`;
				else spannedHtml = `${spannedHtml}${spanStart} id="${i}">${v}${spanEnd}`;
			else {
				if (i == lastIndex) spannedHtml = `${spannedHtml}${lastSpanStart} id="${i}"> ${v}${spanEnd}`;
				else spannedHtml = `${spannedHtml}${spanStart} id="${i}"> ${v}${spanEnd}`;
			}
		});
		return spannedHtml;
  }
  
	function getHtmlOfPara(paraHtml) {
		let html = '';
		const words = paraHtml.split(' ');
		words.forEach((v, i) => {
			if (html === '') html = v;
			else html += ` ${v}`;
		});
		return html;
  }
  
	function getRemainingPara(paraHtml, startIndex) {
		let html = '';
		const words = paraHtml.split(' ');
		words.forEach((v, i) => {
			if (i >= startIndex) {
				if (html === '') html = v;
				else html += ` ${v}`;
			} else return false;
		});
		return html;
  }
  
	function getSelectedPara(paraHtml, endIndex) {
		let html = '';
		const words = paraHtml.split(' ');
		words.forEach((v, i) => {
			if (i <= endIndex) {
				if (html === '') html = v;
				else html += ` ${v}`;
			} else return false;
		});
		return html;
	}
};

pagify();
//module.exports.pagify = pagify;
