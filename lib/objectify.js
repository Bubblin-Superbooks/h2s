function objectify() {

    const fse = require('fs-extra');
    const path = require('path');
    const chalk = require('chalk');
    const cheerio = require("cheerio");

    let book = [];

            fse.readFile(path.join('interim', 'sanitized.html'), 'utf8')
                .then((contents) => {

                    const $ = cheerio.load(contents, {
                        decodeEntities: false
                      });
                    let index = 0;
                    $('body').children().each((i, elem) => {

                        let val = '';
                        let key = $(elem)[0].name;

                        switch (key) {
                          
                          case 'p': case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h5': case 'h6': case 'hr':
                          case 'pre': case 'code': case 'blockquote': case 'cite':
                            val = $(elem).html().trim();
                            break;

                          case 'img':
                            val = $(elem).attr('src');
                            break;

                          case 'ol': case 'ul':
                            let startIndex = $(elem).attr('start')
                            let olObj = []
                            let liIndex = 0
                            $(elem).find('li').each(function(i, elm) {
                                olObj[liIndex++] = $(this).text().trim()
                            });
                            val = {}
                            val.start = startIndex;
                            val.list = olObj;
                            break;

                          case 'br':
                            break;

                          default:
                            console.log('We have a situation Houston.', key, i)
                        }
  
                        book.push({tag: key, innerHtml: val});

                        let nextElement = $(elem)[0].next;
                        if(nextElement && nextElement.type=='text' && nextElement.data.trim() != '') 
                            book.push({tag: 'p', innerHtml : nextElement.data.trim()});
                    });


                }).then(() => {

                    fse.mkdirs(path.join('interim', 'tmp'))
                        .then(() => {
                            fse.writeFile(path.join('.', 'interim', 'tmp', '.prebook'), JSON.stringify(book, null, 2))
                                .then(() => {
                                    console.log(chalk.blue('Prebook object saved.'));
                                }).catch((err) => {
                                    if (err)
                                        return console.log(chalk.bold.red('Failed to write book URL', err));
                                });
                        })
                        .catch((err) => {
                            if (err)
                                return console.log(chalk.bold.red('Failed to write book URL', err));

                        });


                }).catch((err) => {
                    if (err)
                        console.log(chalk.bold.red('Failed to pick up contents', err));

                })




}

module.exports.objectify = objectify; // Should return boolean true/false