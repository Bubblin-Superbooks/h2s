function bookify() {
    const fse = require('fs-extra')
    const path = require('path')
    const chalk = require('chalk')

    let book = {};

    fse.readJson(path.join('.', 'interim', 'tmp', '.book'))
        .then(book => {
            let bookLength = parseInt(Object.keys(book).length) + 4

            let promises = []

            if (bookLength % 2 === 0) {
                promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n-1'), path.join('.', 'manuscript', `page-${bookLength+1}`)).catch(err => console.log(err)))
                promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n'), path.join('.', 'manuscript', `page-${bookLength+2}`)).catch(err => console.log(err)))
            } else {
                promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n-1'), path.join('.', 'manuscript', `page-${bookLength+1}`)).catch(err => console.log(err)))
                promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n-1'), path.join('.', 'manuscript', `page-${bookLength+2}`)).catch(err => console.log(err)))
                promises.push(fse.copy(path.join(__dirname, '..', 'last', 'page-2n'), path.join('.', 'manuscript', `page-${bookLength+3}`)).catch(err => console.log(err)))
            }

            for (const page in book) {
                if (book.hasOwnProperty(page)) {
                    const TEMPLATE_START = '<div class="leaf flex"><div class="inner justify">'
                    const TEMPLATE_END = '</div> </div>';

                    let page_html = TEMPLATE_START + book[page] + TEMPLATE_END;

                    let htmlFile = path.join('.', 'manuscript', page, 'body.html')

                    let thisPage = fse.outputFile(htmlFile, page_html)

                    promises.push(thisPage)

                }
            }

            return Promise.all(promises)

        }).then(() => console.log(chalk.yellow(`Pagination… ${chalk.blue('Complete.')}`))).then(() => {
            fse.readJson(path.join('.', 'interim', 'tmp', '.index'))
                .then((json) => {
                    let list_items = ''
                    for (const key in json) {
                        if (json.hasOwnProperty(key)) {
                            list_items += json[key]

                        }
                    }
                    return list_items

                }).then((list_items) => {
                    let unordered_list = `<ul class="toc">${list_items}</ul>`
                    return unordered_list;
                }).then((unordered_list) => {
                    let promised = fse.outputFile(path.join('.', 'interim', 'index.contents.html'), unordered_list)
                        .then(() => {
                            console.log(chalk.green(`Table of Contents HTML is ${chalk.magenta('ready')}`))
                        }).catch((err) => {
                            if (err)
                                return console.log(chalk.bold.red('Failed to write index HTML', err))
                        });

                    return Promise.all[promised];

                }).catch((err) => {
                    if (err)
                        return console.log(chalk.red('Failed to read .index json'))
                })


        }).catch((err) => {
            if (err)
                return console.log(chalk.red('Failed to read .book json'))
        })



}

module.exports.bookify = bookify
