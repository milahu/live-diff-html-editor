# live diff html editor

generate exact diffs of rich text
by tracking all changes in a wysiwyg html editor

all diff-algos will, in rare cases, produce "false diffs"
which are not intended by the user.
the diff format is always ambiguous,
since there are many representations of one change

## live demo

[codesandbox.io: live diff html editor](https://codesandbox.io/s/javascript-live-html-diff-editor-work-in-progress-7045p?file=/src/index.js)

## use cases

* feedback: allow users to edit html documents in their browser and generate patches in unidiff format (`diff -u`)
* postprocessing: edit diff files to optimize the `<del>` and `<ins>` chunks for human-readability

## implementation

we use `inputevent` and `selectionchangeevent`
to build an exact live diff view of the user input

## status

there are many edge-cases to solve ...

### working

* insert text. this only requires to insert a `<ins>` tag, and continued inputs simply append to that `<ins>` tag
* delete text without crossing tag boundaries. simple. the cursor is by default placed after the `<del>` tag (forward delete as default), except when the user hits `backspace`, then the cursor is placed before the `<del>` tag

### todo

* delete text across tag boundaries. non-trivial. some bugs are known
* merge `<ins>` and `<del>` tags. non-trivial. not implemented
* inserting text into a `<del>` should be a noop. simple

## related

* [mblink/htmldiff.js](https://github.com/mblink/htmldiff.js/pull/2)

this could be interesting for the
[pijul](https://pijul.org/posts/2019-04-23-pijul-0.12/#refactoring-of-diff)
VCS, where exact diffs are desired

## license

license is [CC0-1.0](LICENSE.txt): zero limits and zero warranty
