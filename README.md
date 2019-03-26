

Usage: `$ m2s [options] [command]`

Options:
  -V, --version      output the version number
  -v, --version      output the version number
  -h, --help         output usage information

Commands:
  fetch|f [options]  Fetch single markdown long-scroll (.md, .markdown or .txt )
  sanitize|s         Sanitize your HTML inline with Bookiza requirements
  objectify|o        Objectify into a Array-like Json
  pagify|p           Pagination with line-tracking!
  bookify|b          Apply templates to form actual pages


Steps:

1. Put your `prepared.markdown` file inside `interim` sibling folder to `manuscript` on your [Bookiza](https://bookiza.io) project. 

2. At the root, execute `$ m2s f -f interim/prepared.markdown` to produce your book as unwashed HTML.

3. At the root, execute `$ m2s sanitize` to strip unwanted HTML tags and extraneous attributes.

4. At the root, execute `$ m2s objectify` and then `$ m2s pagify` to produce paginated context for your book.

5. Run `$ m2s bookify` to complete the conversion. Now your Superbook is ready.

TODOs: Wire-up `.abelonerc`/core abelone features with `m2s`.

