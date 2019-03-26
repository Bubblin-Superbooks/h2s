function pagify() {
	const fsp = require('fs-extra');
	const path = require('path');
	const chalk = require('chalk');
	
	const puppeteer = require('puppeteer');

	const headerTags = [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ];
	const spanStart = '<span class="pagy"';
	const lastSpanStart = '<span class="pagy last-pagy"';
	const spanEnd = '</span>';

	let book = {};
	let index = {};
	let page_count = 1;
	const emptyPageHtml = fsp.readFileSync(path.join(__dirname, '..', 'templates', 'pagy-template.html'), 'utf-8');

	fsp
		.readJson(path.join('.', 'interim', 'tmp', '.prebook'))
		.then((prebook) => {
			page_count = parseInt(prebook.START_PAGE);
			const elemCount = Object.keys(prebook).length;
			let html = '';
			let indexer = 0;
			let crashPageCounter = 0;
			return puppeteer.launch().then(async (browser) => {
				let page = await browser.newPage();
				await page.setViewport({ width: 462, height: 600 }); // Do not change these values unless you know what this means.

				for (const key in prebook) {
					if (prebook.hasOwnProperty(key)) {
						let elem = prebook[key];
						console.log("page_count = "+page_count+" and key = "+key)
						if(crashPageCounter > 1000) {
							page.close();
							page = await browser.newPage();
							await page.setViewport({ width: 462, height: 600 }); 
							crashPageCounter = 0;
						}
						for (const tag in elem) {
							if (elem.hasOwnProperty(tag)) {
								if (tag === 'img') {
									if (html !== '') {
										book[`page-${page_count}`] = html;
										page_count += 1;
										html = '';
									}
									let image = `<${tag} width = "100%" src = "${elem[tag]}" />`;
									book[`page-${page_count}`] = image;
									page_count += 1;
								} else if (headerTags.includes(tag)) {
									if (html !== '') {
										book[`page-${page_count}`] = html;
										page_count += 1;
										html = '';
									}

									let heading = `<${tag}>${elem[tag]}</${tag}>`;
									book[`page-${page_count}`] = heading;

									if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
										index[indexer] = `<li><a class = "page" href="${page_count}"> ${elem[
											tag
										]} </a> <span class="flex">${page_count}</span> </li>`;
										indexer++;
									}

									page_count += 1;
								} else if (tag === 'hr') {
                  if (html != '') html += '<hr class="section">';
                  
								} else if (tag === 'ol' || tag === 'ul') {
                  let list = elem[tag];
                  for (const key in list) {
                    if (key === 'list') {
                      let listElements = list[key];
                      // TODO add logic for start tag
                      let tagHtml = `<${tag}>`;
                      let tagEndHtml = `</${tag}>`;
                      let tagAdded = false; // the flag is to check whether ol/ul tag needs to be added for this li
                      // let listContinued = false; // the flag is to check whether the list has not completed ion previous page
                      for (const liIndex in listElements) {
                        let currentliIndex = parseInt(liIndex) + 1;
                        let isliNotContained = true;
                        let liContinued = false;
                        let liElem = listElements[liIndex];
                        let liContent = liElem;
                        let liHtml = `<li>${liContent}</li>`;
                        let pageInnerHtml = '';
                        if(tagAdded) {
                          pageInnerHtml = `${html}<li>${getSpannedHtmlOfPara(
                            liContent
                          )}</li>${tagEndHtml}`;
                          } else {
                            pageInnerHtml = `${html}${tagHtml}<li>${getSpannedHtmlOfPara(
                              liContent
                            )}</li>${tagEndHtml}`;
                          }
  
                        do {
                          const pageHtml = emptyPageHtml.replace(
                            'PAGE_INNER_HTML',
                            pageInnerHtml
                          );
                          await page.setContent(pageHtml);
                          await page.waitForSelector('.last-pagy');
                          const hiddenSpan = await page.evaluate(() => {
                            const pageDiv = $('div.inner');
                            const pageDivEl = pageDiv[0];
  
                            const isPageDivOverflowing =
                              pageDivEl.clientHeight < pageDivEl.scrollHeight;
                            if (isPageDivOverflowing) {
                              const visibleOffset =
                                pageDivEl.offsetTop + pageDivEl.clientHeight;
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
  
                          if (hiddenSpan) {
                            if (hiddenSpan != 0) {
                              const selectedliContent = getSelectedPara(
                                liContent,
                                hiddenSpan - 1
                              );
                              var selectedLiHtml = getHtmlOfPara(selectedliContent);
                              liContent = getRemainingPara(liContent, hiddenSpan);
  
                              const lastIndexEm = selectedLiHtml.lastIndexOf('<em>');
                              const lastIndexEmEnd = selectedLiHtml.lastIndexOf('</em>');
  
                              const lastIndexStrong = selectedLiHtml.lastIndexOf('<strong>');
                              const lastIndexStrongEnd = selectedLiHtml.lastIndexOf(
                                '</strong>'
                              );
  
                              if (lastIndexEm != -1 && lastIndexEm > lastIndexEmEnd) {
                                selectedLiHtml += selectedLiHtml + '</em>';
                                liContent = '<em>' + liContent;
                              }
  
                              if (
                                lastIndexStrong != -1 &&
                                lastIndexStrong > lastIndexStrongEnd
                              ) {
                                selectedLiHtml += selectedLiHtml + '</em>';
                                liContent = '<strong>' + liContent;
                              }
  
                              if (liContinued) 
                                html += `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li class="split-li stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                              else {
                                //TODO what if the li was absrobed completely in last page
                                if (tagAdded) html += `<li class="stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                                else {
                                  if(currentliIndex > 1) 
                                    html += `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li class="stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                                  else
                                    html += `${tagHtml}<li class="stretch-last-line">${selectedLiHtml}</li>${tagEndHtml}`;
                                }
                              }
                              
                              liHtml = `<li class="split-li">${liContent}</li>`;
                              pageInnerHtml = `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li class="split-li">${getSpannedHtmlOfPara(
                                  liContent
                                )}</li>${tagEndHtml}`;
                              liContinued = true;
                            } else {
                                  pageInnerHtml = `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}"><li>${getSpannedHtmlOfPara(
                                    liContent
                                  )}</li>${tagEndHtml}`;
                                  html += `${tagEndHtml}`
                            }
                            book[`page-${page_count}`] = html;
                            page_count += 1;
                            crashPageCounter += 1;
                            html = '';
                            tagAdded = false;
                          } else {
                            if (tagAdded) {
                              html += liHtml;
                            } else {
                              if(liIndex > 0) 
                                html += `<${tag} style="--start:${currentliIndex}" start="${currentliIndex}">${liHtml}`;
                              else 
                                html += `${tagHtml}${liHtml}`;
                              tagAdded = true;
                            }
  
                            isliNotContained = false;
                            liContinued = false;
                          }
                        } while (isliNotContained);
                      }
  
                      html += `${tagEndHtml}`;
                    }
                  }
                } else if (tag === 'p') {
									let isParaNotContained = true;
									let paraContinued = false;
									let pContent = elem[tag];
                  let pHtml = `<p>${pContent}</p>`;
									let pageInnerHtml = `${html}<p>${getSpannedHtmlOfPara(pContent)}</p>`;
									do {
										const pageHtml = emptyPageHtml.replace('PAGE_INNER_HTML', pageInnerHtml);
										await page.setContent(pageHtml);
										await page.waitForSelector('.last-pagy');
										const hiddenSpan = await page.evaluate(() => {
											const pageDiv = $('div.inner');
											const pageDivEl = pageDiv[0];
											//pageDiv.innerHtml(pageInnerHtml)
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
										if (hiddenSpan) {
											if (hiddenSpan != 0) {
												const selectedPara = getSelectedPara(pContent, hiddenSpan - 1);
												var selectedParaHtml = getHtmlOfPara(selectedPara);
												pContent = getRemainingPara(pContent, hiddenSpan);

												const lastIndexEm = selectedParaHtml.lastIndexOf('<em>');
												const lastIndexEmEnd = selectedParaHtml.lastIndexOf('</em>');

												const lastIndexStrong = selectedParaHtml.lastIndexOf('<strong>');
												const lastIndexStrongEnd = selectedParaHtml.lastIndexOf('</strong>');

												if (lastIndexEm != -1 && lastIndexEm > lastIndexEmEnd) {
													selectedParaHtml += selectedParaHtml + '</em>';
													pContent = '<em>' + pContent;
												}

												if (lastIndexStrong != -1 && lastIndexStrong > lastIndexStrongEnd) {
													selectedParaHtml += selectedParaHtml + '</em>';
													pContent = '<strong>' + pContent;
												}

												if (paraContinued)
													html += `<p class="no-indent stretch-last-line">${selectedParaHtml}</p>`;
												else html += `<p class="stretch-last-line">${selectedParaHtml}</p>`;
												pHtml = `<p class="no-indent">${pContent}</p>`;
												pageInnerHtml = `<p class="no-indent">${getSpannedHtmlOfPara(
													pContent
												)}</p>`;
												paraContinued = true;
											} else {
												if (paraContinued)
													pageInnerHtml = `<p class="no-indent">${getSpannedHtmlOfPara(
														pContent
													)}</p>`;
												else pageInnerHtml = `<p>${getSpannedHtmlOfPara(pContent)}</p>`;
											}
											book[`page-${page_count}`] = html;

											page_count += 1;
											crashPageCounter += 1;
											html = '';
										} else {
											html += pHtml;
											isParaNotContained = false;
											paraContinued = false;
										}
										if (page_count == 46) {
											page_count = page_count;
										}
									} while (isParaNotContained);
								}
							}
						}
					}
        }
        if(html != '') {
          book[`page-${page_count}`] = html
        }
				await browser.close();
			});
		})
		.then(() => {
			fsp
				.writeFile(path.join('.', 'interim', 'tmp', '.book'), JSON.stringify(book, null, 2))
				.then(() => {
					console.log(chalk.green(`Bookification… (.book) is ${chalk.blue('complete')}`));
				})
				.catch((err) => {
					if (err) {
						return console.log(chalk.bold.red('Failed to write .book json', err));
					}
				});
		})
		.then(() => {
			fsp
				.writeFile(path.join('.', 'interim', 'tmp', '.index'), JSON.stringify(index, null, 2))
				.then(() => {
					console.log(chalk.green(`A book.index was ${chalk.blue('prepared.')}`));
				})
				.catch((err) => {
					if (err) {
						return console.log(chalk.bold.red('Failed to write index json', err));
					}
				});
		})
		.catch((err) => {
			if (err) {
				console.log(chalk.red('Could not read .book json', err));
			}
		});

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
}

module.exports.pagify = pagify;
