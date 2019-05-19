

Usage: `$ m2s [options] [command]`

Options:
  -V, --version      output the version number
  -v, --version      output the version number
  -h, --help         output usage information

Commands:
  objectify|o        Objectify into a Array-like Json
  pagify|p           Pagination with line-tracking!
  bookify|b          Apply templates to form actual pages


Steps:

1. Place sanitized.html at `./interim` folder (sibling to `manuscript`) at the root of your [Bookiza](https://bookiza.io) project. 

2. Execute `$ m2s objectify` to pull up the content into key: value pairs. 

3. Run `$ m2s pagify` to reproduce the prepared key: value pairs into a responsive paginated codex container.

5. Run `$ m2s bookify` to apply pagination. Voila, your Superbook is ready!


