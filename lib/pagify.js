function pagify() {
	const fsp = require('fs-extra');
	const path = require('path');
	const chalk = require('chalk');
	const wc = require('wordcount');

	const puppeteer = require('puppeteer');

	const headerTags = [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ];
	const spanStart = '<span class="pagy"';
	const lastSpanStart = '<span class="pagy last-pagy"';
	const spanEnd = '</span>';

	let book = {};
	let index = {};
	let page_count = 1;
	const emptyPageHtml = fsp.readFileSync(path.join(__dirname, '..', 'templates', 'pagy-template.html'), 'utf-8');
	// const emptyPageHtml = fsp.readFileSync(path.join('.', 'templates' ,'pagy-template.html'), 'utf-8')

	// fsp.readJson(path.join('.', 'templates', 'test.prebook')).then((prebook) => {
	fsp
		.readJson(path.join('.', 'interim', 'tmp', '.prebook'))
		.then((prebook) => {
			page_count = parseInt(prebook.START_PAGE);
			const elemCount = Object.keys(prebook).length;
			let html = '';
			let indexer = 0;

			return puppeteer.launch({ headless: false }).then(async (browser) => {
				const page = await browser.newPage();
				await page.setViewport({ width: 429, height: 557 }); // Do not change these values unless you know what it entails.
				//await page.setContent(emptyPageHtml);
				//await page.waitForSelector(".inner");

				for (const key in prebook) {
					if (prebook.hasOwnProperty(key)) {
						let elem = prebook[key];

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
													html += `<p class="no-indent">${selectedParaHtml}</p>`;
												else html += `<p>${selectedParaHtml}</p>`;
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
