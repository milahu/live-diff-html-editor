# live diff html editor

generate exact diffs of rich text
by tracking all changes in a wysiwyg html editor

all diff-algos will, in rare cases, produce "false diffs"
which are not intended by the user.
the diff format is always ambiguous,
since there are many representations of one change

## status

deprecated

this was just a proof of the "live diff html editor" concept

### prosemirror track changes plugin

probably the best candidate
to implement a FOSS "track changes" editor is the
[prosemirror](https://github.com/ProseMirror/prosemirror) rich text editor,
with support for live collaboration via [y-prosemirror](https://github.com/yjs/y-prosemirror)
and [yts](https://github.com/yjs/yjs)

* https://github.com/milahu/prosemirror-track-changes-demo based on [fiduswriter](https://github.com/fiduswriter/fiduswriter/issues/1142)

similar but different: track changes as commits

* https://prosemirror.net/examples/track/
  * https://github.com/ProseMirror/website/blob/master/example/track/index.js
* https://github.com/newsdev/prosemirror-change-tracking-prototype
* https://github.com/TeemuKoivisto/prosemirror-track-changes-example

### other track changes plugins

ckeditor5 has a commercial
[track changes](https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/track-changes/track-changes.html)
but we want a FOSS solution

## live demo

[codesandbox.io: live diff html editor](https://codesandbox.io/s/javascript-live-html-diff-editor-work-in-progress-7045p?file=/src/index.js)

## offline demo

```
git clone https://github.com/milahu/live-diff-html-editor.git
cd live-diff-html-editor
npm install
npm run start
```

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
    * https://stackoverflow.com/questions/58887843/how-do-i-perform-track-changes-in-the-quill-editor-just-like-google-docs
* https://convergence.io/
* https://github.com/share/sharedb backend database
* https://ckeditor.com/ckeditor-5/features/ commercial
* https://github.com/collaborativejs/collaborative-js
* backends: https://www.tag1consulting.com/blog/evaluating-real-time-collaborative-editing-solutions-top-fortune-50-company
    * https://github.com/yjs/yjs with bindings for editors:
        * https://github.com/ProseMirror/prosemirror rich text editor
        * https://github.com/ianstormtaylor/slate rich text editor, built on React (boo!)
        * https://github.com/quilljs/quill rich text editor
            * https://stackoverflow.com/questions/58887843/how-do-i-perform-track-changes-in-the-quill-editor-just-like-google-docs
            * https://stackoverflow.com/questions/58887843/how-do-i-perform-track-changes-in-the-quill-editor-just-like-google-docs/65288202#65288202
        * https://codemirror.net/ source code editor
        * https://microsoft.github.io/monaco-editor/ source code editor
* Open source collaborative text editors @ https://news.ycombinator.com/item?id=19845776

### rich text editors

* [slate](https://github.com/ianstormtaylor/slate)
* [trix](https://github.com/basecamp/trix) 200 KB
* [etherpad-lite](https://github.com/ether/etherpad-lite)
* [ckeditor5](https://github.com/ckeditor/ckeditor5) 500 KB
    * commercial [track changes](https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/track-changes/track-changes.html) feature
* [tinyMCE core](https://www.tiny.cloud/) (old)
* [firepad](https://firepad.io/examples/#richtext-YCQs8ZL5VM)
* https://prosemirror.net/ with [change tracker](https://prosemirror.net/examples/track/)
* [pell](https://github.com/jaredreich/pell) 4 KB (smallest editor) (old)
* [quill](https://github.com/quilljs/quill) built for compatibility and extensibility (old)
* [Trumbowyg](https://github.com/Alex-D/Trumbowyg) requires JQuery

more: https://github.com/JefMari/awesome-wysiwyg

### data labeling for machine learning

* https://github.com/heartexlabs/awesome-data-labeling

## license

license is [CC0-1.0](LICENSE.txt): zero limits and zero warranty
