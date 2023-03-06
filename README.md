<div align="center">
  <a href="https://bookiza.io">
    <img src="art/h2s.jpg" alt="Tech Interview Handbook" width="200">
  </a>
  <br>
  <h3>
    <a href="https://bubblin.io/blog/h2s">Read the blogpost.</a>
  </h3>
</div>


# Hydrogen Sulfide

Typeset and paginate long-form content into intrinsically scaling pages of a Superbook.

`h2s` is a Command Line Utility.


## Installation

To install the CLI:

```nodejs
$ npm i -g h2s
```

## Usage

```nodejs
$ h2s --help 		# Vocabulary

$ h2s [options] [command]
	
/*
  Options:
	  -V, --version      output the version number
	  -v, --version      output the version number
	  -h, --help         output usage information
*/
```
## Functions

	  1. $ h2s objectify|o        # Turns `sanitized.html` into a serialized array-like json. (Output: `interim/tmp/.prebook`)
	  2. $ h2s pagify|p           # Paginates using `gadda-gadda` typesetting, line-tracking, and minimal leading+orphan/widow handling. (Output: `interim/tmp/.book`)
	  3. $ h2s bookify|b          # Templatize markup with layout and content to form the pages of the book. 


#### Steps and their meaning:

1. Place your `sanitized.html` at `./interim` folder (sibling to the `manuscript` folder at the root of your [Bookiza](https://bookiza.io) project). 

2. Execute `$ h2s objectify` to pull up the contents into a set of key: value pairs. 

3. Run `$ h2s pagify` to paginate the key: value pairs according to a responsive template at `./templates` folder.

5. Run `$ h2s bookify` to apply layout on paginated content and produce book. And voila, your Superbook is ready!

Run `$ bookiza server` to load your book on development server at `localhost:4567`.


