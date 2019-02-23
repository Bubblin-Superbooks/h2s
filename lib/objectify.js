function objectify() {

    const fse = require('fs-extra');
    const path = require('path');
    const chalk = require('chalk');
    const cheerio = require("cheerio");

    const headerTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'];

    let book = {};

    fse.readJson(path.join('.', '.abelonerc'))
        .then((abelonerc) => {

            book.START_PAGE   = abelonerc.START_PAGE;

            fse.readFile(path.join('interim', 'sanitized.html'), 'utf8')
                .then((contents) => {

                    const $ = cheerio.load(contents, {
						decodeEntities: false
					  });
                    let index = 0;
                    $('body').children().each((i, elem) => {

                        let key = '';
                        let val = '';

                        if ($(elem)[0].name === 'p' || headerTags.indexOf($(elem)[0].name) > -1 || $(elem)[0].name === 'pre') {
                            key = $(elem)[0].name;
							val = $(elem).html();

                        } else if ($(elem)[0].name === 'img') {
                            key = $(elem)[0].name;
                            val = $(elem).attr('src');
                        } else {
                            console.log('We have a situation Houston.', $(elem)[0].name, i)
                        }

                        const elemObj = {};

                        elemObj[key] = val;
                        book[ index++ ] = elemObj;

                        if($(elem)[0].next && $(elem)[0].next.type=='text' && $(elem)[0].next.data.trim() != '') {
                            const textObj = {};

                            textObj['p'] = $(elem)[0].next.data.trim();

                            book[ index++ ] = textObj;

                        }


                    });


                }).then(() => {

                    fse.mkdirs(path.join('interim', 'tmp'))
                        .then(() => {
                            fse.writeFile(path.join('.', 'interim', 'tmp', '.prebook'), JSON.stringify(book, null, 2))
                                .then(() => {
                                    console.log(chalk.blue('Prebook object saved.'));
                                }).catch((err) => {
                                    if (err)
                                        return console.log(chalk.bold.red('Failed to write abelone URL', err));
                                });
                        })
                        .catch((err) => {
                            if (err)
                                return console.log(chalk.bold.red('Failed to write abelone URL', err));

                        });


                }).catch((err) => {
                    if (err)
                        console.log(chalk.bold.red('Failed to pick up contents', err));

                });




        }).catch((err) => {
            if (err)
                console.log(chalk.red('Couldn\'t read abelonerc', err));
        });

}

module.exports.objectify = objectify; // Should return boolean true/false