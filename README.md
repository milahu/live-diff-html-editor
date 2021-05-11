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

we use the `contenteditable="true"` attribute
to make html contents editable

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

### annotation

* [hypothesis](https://github.com/hypothesis/h) annotation platform
    * [self-hosted hypothesis](https://web.hypothes.is/blog/mdpi-integrates-hypothesis/), cos all hosters are only publishers (who will censor content they dont like) (also see gab's [dissenter](https://dissenter.com/) app)
* https://www.w3.org/TR/annotation-protocol/
* https://github.com/recogito/recogito-js 60 stars
* https://github.com/zhan-huang/text-annotator 6 stars
* https://github.com/k-son/simple-text-annotations 1 star
* old projects
    * https://github.com/openannotation/annotator/ 2500 stars
    * https://github.com/FUB-HCC/neonion 70 stars
    * https://github.com/szabyg/annotate.js 60 stars
    * https://github.com/SuLab/YPet 30 stars
    * https://brat.nlplab.org/ year 2012
    * https://github.com/jamiemcg/moodle-collaborative-annotation plugin for moodle, 4 stars

### github as data store

* https://github.com/issue-db/issue-db 50 stars, year 2018
* https://github.com/DavidBruant/github-as-a-database 10 stars, year 2018

### collaboration

these tools focus on low-latency collaboration (real-time collaboration),
similar to text chats or
[agile software development](https://en.wikipedia.org/wiki/Agile_software_development)

* https://geovation.github.io/canvas-shared-editor "This blog describes 3 potential open-source tools (TogetherJS, Firepad and ShareDB)"
* https://firepad.io/ by google
* https://togetherjs.com/ by mozilla
* https://prosemirror.net/
* https://convergence.io/
* https://github.com/share/sharedb backend database
* https://ckeditor.com/ckeditor-5/features/ commercial
* https://github.com/collaborativejs/collaborative-js

### rich text editors

* [tinyMCE core](https://www.tiny.cloud/)
* [firepad](https://firepad.io/examples/#richtext-YCQs8ZL5VM)
* https://prosemirror.net/ with [change tracker](https://prosemirror.net/examples/track/)

### data labeling for machine learning

* https://github.com/heartexlabs/awesome-data-labeling

## license

license is [CC0-1.0](LICENSE.txt): zero limits and zero warranty
