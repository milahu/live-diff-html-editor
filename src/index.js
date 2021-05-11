// javascript live html diff editor. work in progress

// we use `inputevent` and `selectionchangeevent`
// to build an exact live diff view of the user input

// author: milahu, license: CC0-1.0

// TODO handle replace operation: select old text, insert/paste new text -> <del>old text</del><ins>new text</ins>
// FIXME delete across html nodes, e.g. text <b>bold bold</b> text -> delete 'ext <b>bol'. handle forward-select vs backward-select

import "./styles.css";
//import * as htmldiff from "./htmldiff.js";
import { Cursor } from "./cursor.js";
//import * as Diff from 'diff';
//import XRegExp from 'xregexp';
//const unicodeLetterExpr = XRegExp('\\p{L}|\\d'); // unicode letter or ascii decimal
//import unraw from "unraw"; // only decode, no encode
import { addSlashes, stripSlashes } from 'slashes';

import 'regenerator-runtime/runtime'; // required for parcel + async


var backslashEncode = (function backslashEncodeFactory() {
  const escapeCode = Array(32);
  for (let i = 0; i < 32; i++)
    escapeCode[i] = '\\x'+i.toString(16).padStart(2, '0');
  escapeCode[0] = '\\0';
  escapeCode[8] = '\\b';
  escapeCode[9] = '\\t';
  //escapeCode[10] = '\\n';
  escapeCode[10] = '\n'; // dont escape newline
  escapeCode[11] = '\\v';
  escapeCode[12] = '\\f';
  escapeCode[13] = '\\r';
  
  return function backslashEncode(str) {
    let res = '';
    for (let i = 0; i < str.length; i++) {
      const char16bit = str[i];
      const code = char16bit.charCodeAt(0);
      res += (
        (code < 32) ? escapeCode[code] : // ascii control
        (code == 92) ? '\\\\' :
        (code < 128) ? char16bit : // ascii printable
        '\\u'+code.toString(16).padStart(4, '0') // unicode
      );
    }
    return res;
  }
})();

const debugTextEditor = true;
const liveDiffEditorClassNameDel = 'live-diff-editor-node-del';
const liveDiffEditorClassNameIns = 'live-diff-editor-node-ins';

function wrapLines(str, width) {
  if (!width) width = 70; // usually 70 to 78 chars width for email
  if (width < 2) throw new Error('wrapLines error: width must be 2 or more');
  const controlWrap = '$';

  /* broken, see https://github.com/Shakeskeyboarde/slashes/issues/3
  str = addSlashes(str, {
    escapeNonAscii: true, // escape all non-ASCII characters (unicode code points > 127)
    characters: "\b\f\r\t\v\0'\"\\", // all except \n
  });
  */
  str = backslashEncode(str);
  
  const lines = str.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > (width - 1)) {
      let wrappedline = '';
      let first = true;
      for (let c = 0; c < line.length; c += (width - 1)) {
        if (first) {
          first = false;
        } else {
          wrappedline += controlWrap + '\n';
        }
        wrappedline += line.slice(c, c+width-1); 
      }
      lines[i] = wrappedline;
    }
  }
  return lines.join('\n');
}
function encodeString(str) {
  return str.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t'); // TODO more ...
}

// btoa works only for strings!
// https://stackoverflow.com/a/63526839/10440128
// binary to base64
var encoder = new TextEncoder("ascii");
var decoder = new TextDecoder("ascii");
var base64Table = encoder.encode('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=');
function base64OfBuffer(buffer){
    var dataArr = new Uint8Array(buffer);
    var padding = dataArr.byteLength % 3;
    var len = dataArr.byteLength - padding;
    padding = padding > 0 ? (3 - padding) : 0;
    var outputLen = ((len/3) * 4) + (padding > 0 ? 4 : 0);
    var output = new Uint8Array(outputLen);
    var outputCtr = 0;
    for(var i=0; i<len; i+=3){              
        var buffer = ((dataArr[i] & 0xFF) << 16) | ((dataArr[i+1] & 0xFF) << 8) | (dataArr[i+2] & 0xFF);
        output[outputCtr++] = base64Table[buffer >> 18];
        output[outputCtr++] = base64Table[(buffer >> 12) & 0x3F];
        output[outputCtr++] = base64Table[(buffer >> 6) & 0x3F];
        output[outputCtr++] = base64Table[buffer & 0x3F];
    }
    if (padding == 1) {
        var buffer = ((dataArr[len] & 0xFF) << 8) | (dataArr[len+1] & 0xFF);
        output[outputCtr++] = base64Table[buffer >> 10];
        output[outputCtr++] = base64Table[(buffer >> 4) & 0x3F];
        output[outputCtr++] = base64Table[(buffer << 2) & 0x3F];
        output[outputCtr++] = base64Table[64];
    } else if (padding == 2) {
        var buffer = dataArr[len] & 0xFF;
        output[outputCtr++] = base64Table[buffer >> 2];
        output[outputCtr++] = base64Table[(buffer << 4) & 0x3F];
        output[outputCtr++] = base64Table[64];
        output[outputCtr++] = base64Table[64];
    }
    
    var ret = decoder.decode(output);
    output = null;
    dataArr = null;
    return ret;
}

async function sha1sum(str) {
  const buffer = new TextEncoder("utf-8").encode(str);
  const binaryDigest = await crypto.subtle.digest("SHA-1", buffer);
  //const base16sum = hexOfBuffer(binaryDigest); return base16sum; // 40 chars, human readable
  const base64sum = base64OfBuffer(binaryDigest); return base64sum; // 28 chars, machine readable
}

function hexOfBuffer(buffer) {
  // based on https://8gwifi.org/docs/window-crypto-digest.jsp
  const view = new DataView(buffer);
  let res = "";
  for (let i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    res += view.getUint32(i).toString(16).padStart(8, '0');
  }
  return res;
}



// TODO share encoder/decoder here https://stackoverflow.com/a/67465637/10440128
async function customDiffEncode(html) {

  const wrapWidth = 40;
  const WL = str => wrapLines(str, wrapWidth);

  //console.log('customDiffEncode: input = ' + JSON.stringify(html))
  let res = 'plaintar 1.0\n'; // AKA mime-multipart, AKA tar
  // encode order: esc -> code -> wrap
  res += 'esc: \\\n';
  res += 'code: utf16\n';
  res += 'wrap: $\n';
  res += `width: ${wrapWidth}\n`;
  res += '\n';
  // "plaintar" header done, now we can use the esc and wrap controls
  res += WL('type: chardiff') + '\n';
  res += WL('name: just a test') + '\n';
  res += WL('files: 1') + '\n';
  res += '\n';
  res += WL(`file: ${encodeString("some-file.html")}`) + '\n';
  res += WL(`chunks: 1`) + '\n';
  res += '\n';
  var chunk = WL(html);
  res += WL(`chunk: 1`) + '\n';
  res += WL(`offset: 0`) + '\n';
  res += WL(`length: ${html.length}`) + '\n';
  res += WL(`sha1: ${await sha1sum(html)}`) + '\n';
  res += '\n';
  res += chunk;
  res += '\n';
  return res;
}
// crc32: 10 (base 10)
// md5: 32 (base 16?)
// sha1: 40 (base 16)
// sha1: 28 (base 64)
// sha256: 64 (base 16?)

async function customDiffDecode(str) {
  const lines = str.split('\n');
  let L = 0;
  var line = lines[L];

  if (line != 'plaintar 1.0') { console.log('customDiffDecode: plaintar header not found'); return null; }

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^esc: (.+)$/);
  if (!m) { console.log('customDiffDecode: plaintar-esc header not found'); return null; }
  const controlEsc = m[1]; console.log(`customDiffDecode: control esesc: ${controlEsc}`);

  L++; line = lines[L]; // seek to next line
  if (line != 'code: utf16') { console.log('customDiffDecode: plaintar-encoding utf16 header not found'); return null; }

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^wrap: (.+)$/);
  if (!m) { console.log('customDiffDecode: plaintar-wrap header not found'); return null; }
  const controlWrap = m[1]; console.log(`customDiffDecode: control wrap: ${controlWrap}`);

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^width: ([0-9]+)$/);
  if (!m) { console.log('customDiffDecode: plaintar-wrap header not found'); return null; }
  const wrapWidth = parseInt(m[1]); console.log(`customDiffDecode: wrap width: ${wrapWidth}`);

  L++; line = lines[L]; // seek to next line
  if (line != '') { console.log('customDiffDecode: end of plaintar header not found'); return null; }

  // plaintar header done. now we can decode line-wraps and escapes (inverse of function wrapLines)
  var lastLineLength = 0;
  for (let l = L; l < lines.length; l++) {

    if (lines[l].length == lastLineLength + wrapWidth) {
      // last char must be controlWrap
      // not-wrapped lines have a maximum width of (wrapWidth - 1)
      if (!lines[l].endsWith(controlWrap)) { console.log('customDiffDecode: controlWrap char not found at end of wrapped line: ' + JSON.stringify(lines[l])); return null; }
      lastLineLength += (wrapWidth - 1);
      // join two lines
      lines[l] = (
        lines[l].slice(0, -1) + // remove controlWrap from line l
        lines.splice(l + 1, 1) // remove line l+1 from lines array
      );
      l--; // seek back to unwrap the joined line
    }
    else {
      lastLineLength = 0; // reset
    }
    // width 12
    // line sha1: W29iamVjdCBBcnJheUJ1ZmZlcl0=
    // expected:
    // sha1: W29ia$
    // mVjdCBBcnJh$
    // eUJ1ZmZlcl0$
    // =

    // actual:
    // sha1: W29ia$
    // mVjdCBBcnJh$
    // eUJ1ZmZlcl0$
    // =

    /* WONTFIX
    if (lines[l].endsWith(controlWrap)) {
      // test if controlWrap is escaped
      let i;
      for (i = lines[l].length - 2; i > 0; i--) {
        if (lines[l][i] != controlEsc) break;
      }
      const numEscapes = lines[l].length - 2 - i;
      console.log(`found ${numEscapes} escapes before linewrap in line: ${JSON.stringify(lines[l])}`)
      const wrapIsEscaped = (numEscapes % 2 == 1);
      if (wrapIsEscaped) continue;
      // join two lines
      lines[l] = (
        lines[l].slice(0, -1) + // remove controlWrap from line l
        lines.splice(l + 1, 1) // remove line l+1 from lines array
      );
      l--; // seek back to unwrap the joined line
    }
    */
  }
  console.log(`unwrapped lines:\n${lines.slice(L).join('\n')}`)

  // note: this decode stage must run in a new loop, after all wraps are decoded
  console.log('decode controls ...')
  for (let l = L; l < lines.length; l++) {
  
    // decode wraps
    lines[l] = lines[l].replace(/\\\$/g, (match, idx, str) => {
      // test if match is escaped -> count escapes before match
      let i; for (i = idx - 1; i > 0; i--) if (str[i] != controlEsc) break;
      const numEscapes = idx - 1 - i;
      const matchIsEscaped = (numEscapes % 2 == 1);
      if (matchIsEscaped) return match; // no change
      return '$';
    });

    // decode special chars
    lines[l] = stripSlashes(lines[l]); // \\t -> \t, \\x00 -> \x00, \\u0000 -> \u0000, ...
    //lines[l] = unraw(lines[l]); // \\t -> \t, \\x00 -> \x00, \\u0000 -> \u0000, ...

    /*
    // \r is not found? -> blame html. \r is replaced with \n in html source code!
    lines[l] = lines[l].replace(/\\r/g, (match, idx, str) => {
      // test if match is escaped -> count escapes before match
      let i; for (i = idx - 1; i > 0; i--) if (str[i] != controlEsc) break;
      const numEscapes = idx - 1 - i;
      //console.log(`found ${numEscapes} escapes before \\r in str: ${JSON.stringify(str)}`)
      const matchIsEscaped = (numEscapes % 2 == 1);
      if (matchIsEscaped) return match; // no change
      return '\r';
    });
    */

    // decode escapes
    lines[l] = lines[l].replace(/\\\\/g, (match, idx, str) => {
      // test if match is escaped -> count escapes before match
      let i; for (i = idx - 1; i > 0; i--) if (str[i] != controlEsc) break;
      const numEscapes = idx - 1 - i;
      //console.log(`found ${numEscapes} escapes before \\$ in str: ${JSON.stringify(str)}`)
      const matchIsEscaped = (numEscapes % 2 == 1);
      if (matchIsEscaped) return match; // no change
      return '\\';
    });
  }
  console.log('decode controls done')

  L++; line = lines[L]; // seek to next line
  if (line != 'type: chardiff') { console.log('customDiffDecode: chardiff header not found'); return null; }

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^name: (.+)$/);
  if (!m) { console.log('customDiffDecode: chardiff-name header not found'); return null; }
  const chardiffName = m[1]; console.log('customDiffDecode: name: ' + chardiffName);

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^files: ([0-9]+)$/);
  if (!m) { console.log('customDiffDecode: chardiff-files header not found'); return null; }
  const numFiles = m[1]; console.log('customDiffDecode: files: ' + numFiles);

  L++; line = lines[L]; // seek to next line
  if (line != '') { console.log('customDiffDecode: end of chardiff header not found'); return null; }

  let state = 'file';
  let file = null;
  let fileChunks = 0;
  let chunksDone = 0;
  while (L < (lines.length - 1)) {
    L++; line = lines[L];
    // TODO unwrapLines = seek to end of string in the next lines

    if (state == 'file') {
      var m = line.match(/^file: (.+)$/);
      if (!m) { console.log(`customDiffDecode: file header not found. remaining text: ${JSON.stringify(lines.slice(L).join('\n'))}`); return null; }
      file = m[1]; console.log('customDiffDecode: file: ' + file);

      L++; line = lines[L]; // seek to next line
      var m = line.match(/^chunks: ([0-9]+)$/);
      if (!m) { console.log('customDiffDecode: file-chunks header not found'); return null; }
      fileChunks = parseInt(m[1]); console.log('customDiffDecode: file chunks: ' + fileChunks)
      
      L++; line = lines[L]; // seek to next line
      if (line != '') { console.log('customDiffDecode: end of file header not found'); return null; }

      state = 'chunk';
    }

    else if (state == 'chunk') {
      var m = line.match(/^chunk: ([0-9]+)$/);
      if (!m) { console.log('customDiffDecode: chunk header not found'); return null; }
      var chunkNumber = parseInt(m[1]); console.log('customDiffDecode: chunk number: ' + chunkNumber);

      L++; line = lines[L]; // seek to next line
      var m = line.match(/^offset: ([0-9]+)$/);
      if (!m) { console.log('customDiffDecode: chunk-offset header not found'); return null; }
      var chunkOffset = parseInt(m[1]); console.log('customDiffDecode: chunk offset: ' + chunkOffset);

      L++; line = lines[L]; // seek to next line
      var m = line.match(/^length: ([0-9]+)$/);
      if (!m) { console.log('customDiffDecode: chunk-length header not found'); return null; }
      var chunkLength = parseInt(m[1]); console.log('customDiffDecode: chunk length: ' + chunkLength);

      L++; line = lines[L]; // seek to next line
      var m = line.match(/^sha1: (.+)$/);
      if (!m) { console.log('customDiffDecode: chunk-sha1 header not found'); return null; }
      var chunkSha1 = m[1]; console.log('customDiffDecode: chunk sha1: ' + chunkSha1);

      L++; line = lines[L]; // seek to next line
      if (line != '') { console.log('customDiffDecode: end of chunk header not found'); return null; }

      let chunkBody = '';
      let safety = 0;
      let firstLineInChunkBody = true;
      while (chunkBody.length < chunkLength) {
        L++; line = lines[L]; // seek to next line
        console.log(`customDiffDecode: chunk body buffer: ${encodeString(chunkBody)}`);
        const lenBefore = chunkBody.length;
        if (firstLineInChunkBody) firstLineInChunkBody = false; else chunkBody += '\n';
        chunkBody += line;
        console.log(`customDiffDecode: add line: ${encodeString(''+line)}`);
        console.log(`customDiffDecode: chunk body buffer length: ${lenBefore} of ${chunkLength} -> ${chunkBody.length} of ${chunkLength}`);
        safety++; if (safety > 100) { console.log(`DEBUG deadloop?`); break; }
      }
      console.log('customDiffDecode: chunk body: ' + chunkBody);
      //console.log('customDiffEncode: chunk body = ' + JSON.stringify(chunkBody))
      if (chunkBody.length == chunkLength) console.log(`customDiffDecode: chunk body found with length ${chunkBody.length} of ${chunkLength}`)
      else { console.log(`customDiffDecode: error: size mismatch in chunk body. expected ${chunkLength}, actual ${chunkBody.length}`); return null; }

      // note: the 'sha1' field can have only a prefix of the sha1 checksum
      const chunkSha1Actual = (await sha1sum(chunkBody)).slice(0, chunkSha1.length);
      if (chunkSha1Actual == chunkSha1) console.log(`customDiffDecode: chunk body checksum pass`);
      else { console.log(`customDiffDecode: error: checksum mismatch in chunk body. expected ${chunkSha1}, actual ${chunkSha1Actual}`); return null; }

      chunksDone++;
      console.log(`customDiffDecode: chunks done: ${chunksDone} of ${fileChunks}`)
      if (chunksDone == fileChunks) {
        L++; line = lines[L]; // seek to next line
        if (line != '') { console.log('customDiffDecode: end of file body not found'); return null; }
        state = 'file';
      }
    }
  }
  if (state == 'file') {
    console.log(`customDiffDecode: end state = ${state} -> ok`);
  } else {
    console.log(`customDiffDecode: end state = ${state} -> error: end state should be file`);
  }
}



document.getElementById("app").innerHTML = `

<div class="editable">
  hello world
  <b>please just</b>
  edit me
  \\backslashes\\ and $dollars$ are welcome here,
  also \rcarriage returns\r are accepted.
  unicode: äöüß´\`§€
  &amp;ampersand test&amp;
</div>

<textarea readonly cols="40" rows="20" title="editable.innerHTML"></textarea>
<textarea readonly cols="50" rows="20" title="custom diff format"></textarea>

`;

if (1) {

  // text editor
  // diff algos will always produce false diffs
  // so we use InputEvent and cursor to get the "real diff"
  // similar project: treesitter (incremental parser)
  const lastDiffMap = new Map();
  const editHistoryMap = new Map();
  let ignoreNextInput = false;
  let lastInputWasUndo = false;

  function findChildInParentClone(child, parent, parentClone) {
    //console.log(`findChildInParentClone`, { child, parent, parentClone })
    //console.log(`findChildInParentClone: (child == parent) = ${(child == parent)}`)

    // based on https://stackoverflow.com/a/23528539/10440128
    var b = child;
    var ia = [];
    while (b != parent) {
      ia.push(Array.prototype.indexOf.call(b.parentNode.childNodes, b));
      b = b.parentNode;
    }
    var i;
    //console.log(`findChildInParentClone: ia = ${ia.join(', ')}`)
    var bc = parentClone;
    while ((i = ia.pop()) != undefined) {
      bc = bc.childNodes[i];
    }
    return bc;
  }

  // TODO remove?
  function getCommonParentNode(node1, node2) {

    // based on https://stackoverflow.com/a/7648545/10440128 and https://stackoverflow.com/a/45404490/10440128
    if (node1 == node2) return node1;
    var parent = node1;
    do if (parent.contains(node2)) return parent
    while (parent = parent.parentNode);
    return null;
  }

  function formatText(s) {
    return s.replace(/\n/g, "↵").replace(/\t/g, "\\t").replace(/ /g, "·");
  }

  function formatNode(node) {
    if (node.nodeType == 3) {
      // text node
      return formatText(node.data);
    }
    return formatText(node.outerHTML);
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/Document/selectionchange_event
  // onselectionchange version
  //let selection = null;

  window.editableNodes = new Set();

  window.selection = {

    anchorNode: null, anchorOffset: 0,
    baseNode: null, baseOffset: 0, // start of selection
    extentNode: null, extentOffset: 0, // end of selection
    focusNode: null, focusOffset: 0,
    isCollapsed: true, // caret -> true, range -> false
    rangeCount: 1, // usually 1, can be more in firefox (use ctrl + click to select multiple)
    // https://javascript.info/selection-range
    //type: s.type, // "Range" | "Caret"
    isForwardDelete: false,
  };

  document.onselectionchange = async function () {

    // TODO debounce? we would need an "afterselectionchange" event
    // onselect works only on input and textarea
    // editable.onselect = function(inputEvent) { console.log('onselect', inputEvent); };

    // we must copy the properties, since getSelection returns a live object
    const s = document.getSelection(); // live object
    window.lastSelection = { ...window.selection };
    const ws = window.selection;
    ws.anchorNode = s.anchorNode; ws.anchorOffset = s.anchorOffset; // start pos?
    ws.baseNode = s.baseNode; ws.baseOffset = s.baseOffset; // start pos? same as anchor?
    ws.extentNode = s.extentNode; ws.extentOffset = s.extentOffset; // end pos
    ws.focusNode = s.focusNode; ws.focusOffset = s.focusOffset; // not needed
    ws.isCollapsed = s.isCollapsed; // caret -> true, range -> false
    ws.rangeCount = s.rangeCount; // usually 1, can be more in firefox (use ctrl + click to select multiple)
    //type = s.type; // "Range" | "Caret"
    //window.selection = Object.freeze(document.getSelection());
    //console.log(window.selection)

    //if (ws.baseNode && ws.extentNode) { // assert: either both are null, or both are not-null
    if (ws.baseNode) {

      //ws.parentNode = getCommonParentNode(ws.baseNode, ws.extentNode);
      //ws.parentNode = getCommonParentNode(ws.baseNode, ws.extentNode).parentNode.parentNode; // use next+1 parentNode: we need more context, when we forward-delete at the end of a node (line 370, "cuta2 is out of bound")

      // find the editable node
      var editable = ws.baseNode;
      do {
        if (window.editableNodes.has(editable)) break;
      } while (editable = editable.parentNode);
      if (!editable) {
        console.log('not found editable from selection');
        return;
      }
      ws.parentNode = editable; // we need a clone of the full DOM tree to find sibling nodes -> in the worst case, we must go up to the root node
      
      if (ws.parentNode == null) {
        console.log('FIXME failed to getCommonParentNode of ws.baseNode and ws.extentNode:', ws.baseNode, ws.extentNode)
      }
      ws.parentNodeClone = ws.parentNode.cloneNode(true); // true -> deep clone
  
      // we need pointer-equality, so we cannot use ws.baseNode.cloneNode()
      // FIXME? (ws.baseNodeClone.parentNode == null) in line 360
      ws.baseNodeClone = findChildInParentClone(ws.baseNode, ws.parentNode, ws.parentNodeClone);
      ws.extentNodeClone = findChildInParentClone(ws.extentNode, ws.parentNode, ws.parentNodeClone);
    }
    else {
      // TODO handle this earlier? ws.baseNode == null && ws.extentNode == null
      ws.parentNode = null;
      ws.parentNodeClone = null;
      ws.baseNodeClone = null;
      ws.extentNodeClone = null;
    }
  };

  document.querySelectorAll('div.editable').forEach(editable => {

    window.editableNodes.add(editable);

    // FIXME? we use 'display: hidden' to hide unused languages
    if (editable.style.display == 'none') return;

    //editable.style.display = 'inline-block'; // fix chrome bug https://stackoverflow.com/a/62700928/10440128
    // problem: 'display: inline-block' breaks float

    editable.setAttribute('data-start-html', editable.innerHTML);
    editable.setAttribute('contenteditable', 'true');

    const editHistory = [];
    editHistoryMap.set(editable, editHistory);

    editable.onkeydown = async function keydownHandler(keyboardEvent) {

      //console.log(`keydownHandler: keyboardEvent`, keyboardEvent)
      // keyboardEvent fires before inputEvent

      window.selection.isForwardDelete = (keyboardEvent.keyCode != 8); // default is forward delete. backward delete only on backspace (code 8)

      // Control + Z. set global state to stop the inputEvent handler
      window.selection.isHistoryUndo = (keyboardEvent.key == 'z' && keyboardEvent.ctrlKey && !keyboardEvent.shiftKey && !keyboardEvent.altKey && !keyboardEvent.metaKey);

      if (window.selection.isHistoryUndo) {

        if (debugTextEditor) console.log(`----------------------- historyUndo -----------------------`);

        // get editable
        let editable = keyboardEvent.target;
        do {
          if (editHistoryMap.has(editable)) break;
        } while (editable = editable.parentNode);
        if (editable == null) {
          console.log('keydownHandler: historyUndo: editable not found');
          return;
        }

        const editHistory = editHistoryMap.get(editable);
        console.log('keydownHandler: historyUndo: editHistory', editHistory)
        //if (debugTextEditor) console.log('undo edit on', editable, editHistory.slice());
        ignoreNextInput = true;
        if (!lastInputWasUndo) editHistory.pop(); // fix "off by one" bug
        // FIXME "off by two" bug ^^
        lastInputWasUndo = true;
        if (editHistory && editHistory.length > 0) {
          const { html, cursor } = editHistory.pop();
          editable.innerHTML = html;
          document.querySelector('textarea[title="editable.innerHTML"]').innerHTML = editable.innerHTML;
          document.querySelector('textarea[title="custom diff format"]').innerHTML = (await customDiffEncode(editable.innerHTML)).replace(/&/g, '&amp;');
          customDiffDecode(await customDiffEncode(editable.innerHTML));
          
          Cursor.setCurrentCursorPosition(cursor, editable);
          editable.focus();
        }
        else {
          editable.innerHTML = editable.getAttribute('data-start-html');
          document.querySelector('textarea[title="editable.innerHTML"]').innerHTML = editable.innerHTML;
          document.querySelector('textarea[title="custom diff format"]').innerHTML = (await customDiffEncode(editable.innerHTML)).replace(/&/g, '&amp;');
          customDiffDecode(await customDiffEncode(editable.innerHTML));
        }
        return;
      }

      //if (keyboardEvent.keyCode == 8) // backward delete
      //console.log(`keydownHandler: isForwardDelete = ${window.selection.isForwardDelete}`)
    }

    editable.oninput = async function(inputEvent) {

      // TODO add input handler only on demand -> editable.onclick
      const editable = inputEvent.target;

      // save cursor position
      let cursor = Cursor.getCurrentCursorPosition(editable);
      // NOTE cursor includes html whitespace
      //if (debugTextEditor) console.log(`cursor = ${cursor}`);

      // FIXME inserting into a <del> should be a noop
      // currently this will move the cursor to the next white-or-green and then start inserting

      //console.log('inputEvent', inputEvent);
      //if (inputEvent.inputType == 'historyUndo') {
      // WONTFIX historyUndo is not always fired -> listen for Control + Z in onkeydown
      if (window.selection.isHistoryUndo) {
        return; // undo is handled in onkeydown, since inputEvent is not always fired for undo operations
      }

      var selection = window.getSelection();

      if (selection.baseNode == null) {
        console.log('inputEvent: selection.baseNode is empty -> ignore')
        return;
      }

      //if (selection.baseNode.parentNode == null) {
      //  console.log('selection.baseNode.parentNode is null. selection.baseNode', selection.baseNode);
      //}
      
      if (selection.baseNode.parentNode.localName == 'ins') {
        // TODO eventually remove empty <ins> node
        if (selection.baseNode.parentNode.data == '') {
          console.log('inputEvent: remove empty <ins> node', selection.baseNode.parentNode);
          selection.baseNode.parentNode.remove();
        }
        console.log('inputEvent: append to old <ins> tag')
        editHistoryMap.get(editable).push({ html: editable.innerHTML, cursor });
        return;
      }

      if (inputEvent.inputType == 'insertText') {
        // locate cursor
        // seek back by inputEvent.data.length
        // if before is <ins>...</ins>, then add data to that <ins>
        // otherwise start new <ins>
        //console.log(`insert: data: ${formatText(inputEvent.data)}`)
        //console.log('selection', selection);
        if (selection.baseNode.nodeType == 3) {
          // text node
          //if (selection.baseNode.parentNode.localName == 'ins') return; // noop
          // start new <ins> tag
          console.log('inputEvent: start new <ins> tag in baseNode: ' + formatNode(selection.baseNode));
          var nodesFragment = document.createDocumentFragment();
          var e = document.createTextNode(
            selection.baseNode.data.slice(0, selection.baseOffset - inputEvent.data.length));
            nodesFragment.appendChild(e);
          var e = document.createElement('ins');
            e.innerHTML = inputEvent.data;
            nodesFragment.appendChild(e);
          var e = document.createTextNode(
            selection.baseNode.data.slice(selection.baseOffset));
            nodesFragment.appendChild(e);
          // FIXME dont insert <ins> into <del> nodes -> <ins> should be nextSibling
          selection.baseNode.replaceWith(nodesFragment);
        }
        // TODO fix cursor position

        // TODO refactor
        editHistoryMap.get(editable).push({ html: editable.innerHTML, cursor });
        document.querySelector('textarea[title="editable.innerHTML"]').innerHTML = editable.innerHTML;
        document.querySelector('textarea[title="custom diff format"]').innerHTML = (await customDiffEncode(editable.innerHTML)).replace(/&/g, '&amp;');
        customDiffDecode(await customDiffEncode(editable.innerHTML));
        Cursor.setCurrentCursorPosition(cursor, editable);
        editable.focus();

        return;
      }

      // non-trivial inputs
      if (debugTextEditor) console.log(`----------------------- inputEvent -----------------------`);

      const ws = window.selection;

      /*
      const inputEventRelevant = {
        data: inputEvent.data,
        dataTransfer: inputEvent.dataTransfer,
        inputType: inputEvent.inputType,
        isComposing: inputEvent.isComposing,
      };
      //console.log('inputEventRelevant = ' + JSON.stringify({ inputEventRelevant, selection: ws }));
      console.log('inputEvent', inputEvent);
      //console.log('selection', ws);

      const basePos = Cursor.getCurrentCursorPosition(editable, ws.baseNode, ws.baseOffset);
      console.log('basePos', basePos);

      if (!ws.isCollapsed) {
        const extentPos = Cursor.getCurrentCursorPosition(editable, ws.extentNode, ws.extentOffset);
        console.log('extentPos', extentPos);
      }
      */

      // inputEvent.inputType:
      // deleteContentBackward
      // deleteByCut
      // insertText: insert or replace
      // insertFromPaste
      // historyUndo = ctrl + z (todo move handler)
      // historyRedo = ctrl + y (also without handler)
      // (more?)

      if (ws.baseNode == ws.extentNode) {
        // trivial case
        // FIXME: keep <b>[delete] keep</b> keep
        //console.log('state: ws.baseNode == ws.extentNode');

        if (inputEvent.inputType[0] == 'd') { // deleteXXX

          // FIXME merge adjacent and overlapping <del> nodes

          // TODO also handle "cursor delete". currently only handles "range delete" = select range + hit ctrl-x / del / backspace
          //console.log(`state: inputEvent.inputType[0] == 'd'`);

          if (ws.baseOffset == ws.extentOffset) {
            // "cursor delete"
            if (inputEvent.inputType == 'deleteContentForward') {
              ws.extentOffset++;
              //cursor++; // this will break every other deleteContentForward (even numbers)
              // FIXME move cursor +1 to the right
            }
            else if (inputEvent.inputType == 'deleteContentBackward') {
              ws.baseOffset--;
              // FIXME continue last <del>
            }
          }

          // TODO detect full delete from <ins>...</ins> node -> noop. reproduce: insert text, remove inserted text
          console.log(`version a:`, formatNode(ws.baseNodeClone)); // before change
          console.log(`version b:`, formatNode(ws.baseNode)); // after change
          //console.log(`selection.baseNode`, selection.baseNode);

          // FIXME we need the content before edit
          // baseNode has the "b" version (after edit), se we only must insert <del>i was deleted</del> at baseOffset
          const h = (ws.baseNode.nodeType == 3) ? ws.baseNode.textContent : ws.baseNode.innerHTML;

          const aHtml = (ws.parentNodeClone.nodeType == 3) ? ws.parentNodeClone.textContent : ws.parentNodeClone.innerHTML;
          const parentNodeCloneData = (ws.parentNodeClone.nodeType == 3) ? ws.parentNodeClone.textContent : ws.parentNodeClone.innerHTML;
          const baseNodeCloneData = (ws.baseNodeClone.nodeType == 3) ? ws.baseNodeClone.textContent : ws.baseNodeClone.innerHTML;
          // TODO verify: does this really work with html nodes?

          const cs = document.getSelection();
          //const offset = cs.baseOffset;
          var cuta1 = Math.min(ws.baseOffset, ws.extentOffset);
          var cuta2 = Math.max(ws.baseOffset, ws.extentOffset); // base and extent are not ordered. extent can be smaller than base (when selecting text from right to left)
          var cutOffset = cuta1 - Math.min(cs.baseOffset, cs.extentOffset);
          var cutb1 = cuta1 - cutOffset;
          var cutb2 = cuta2 - cutOffset;
          console.log(`cut: a1 ${cuta1}, a2 ${cuta2}, offset ${cutOffset}, b1 ${cutb1}, b2 ${cutb2}`);

          //if (inputEvent.inputType == 'deleteContentForward') {
          if (window.selection.isForwardDelete) {
            // WORKAROUND when i delete with the "del" key, InputEvent says "deleteContentBackward"
            // but should say "deleteContentForward"
            // -> use window.selection.isForwardDelete from keydownHandler
            console.log(`forward delete (default): move cursor right by ${(cuta2 - cuta1)}`)
            cursor += (cuta2 - cuta1);
            // FIXME move cursor ${len} to the right
          }

          //console.log(`ws: anchorOffset ${ws.anchorOffset}, baseOffset ${ws.baseOffset}, extentOffset ${ws.extentOffset}, focusOffset ${ws.focusOffset}`);
          //console.log(`cs: anchorOffset ${cs.anchorOffset}, baseOffset ${cs.baseOffset}, extentOffset ${cs.extentOffset}, focusOffset ${cs.focusOffset}`);
          //console.log(`cut deletion: ${baseNodeCloneData.replace(/\n/g, 'N').replace(/ /g, '*')}`);
          //console.log(`cut deletion: a1 ${cuta1} to a2 ${cuta2} = ${baseNodeCloneData.slice(cuta1, cuta2)}`);
          //console.log(`cut deletion: b1 ${cutb1} to b2 ${cutb2} = ${baseNodeCloneData.slice(cutb1, cutb2)}`);
          //console.log(`data: baseClone: ${baseNodeCloneData}`);

          //console.log(`cut context: ${h.replace(/\n/g, 'N').replace(/ /g, '*')}`);
          //console.log(`cut context: 0 to b1 ${cutb1} = ${h.slice(0, cutb1)}`);
          //console.log(`cut context: b1 ${cutb1} to end = ${h.slice(cutb1)}`);

          // REVOKE! REVOKE we need ws.baseNodeClone only to read the deleted chars -> remove the .parentNode.parentNode workaround
          // yes we need that workaround. the deleted string is in the parentNode.nextSibling of baseNodeClone
          if (baseNodeCloneData.length < cuta2) { // cuta2 is out of bound
            console.log('state: cuta2 is out of bound')

            var safeCounter = 0;
            var nextSibling = null;
            var curNode = ws.baseNodeClone;
            do {
              if (curNode.nextSibling) {
                if (curNode.nextSibling.data != '') {
                  nextSibling = curNode.nextSibling;
                  break; // found
                }
                if (curNode.nextSibling.data == '') { // newline textnode?
                  curNode = curNode.nextSibling;
                  continue;
                }
              }
              else {
                if (!curNode.parentNode) {
                  console.log('error? nextSibling not found for baseNodeClone', ws.baseNodeClone);
                  break;
                }
                curNode = curNode.parentNode;
              }
            } while (safeCounter++ < 100);
            //console.log(`nextSibling`, nextSibling);

            // TODO generalize: find nextSibling in DOM tree -> worst case: clone the full DOM tree of editable
            //var nextData = ws.baseNodeClone.parentNode.nextSibling;
            //nextData = nextData.innerHTML || nextData.textContent;
            var nextData = nextSibling.innerHTML || nextSibling.textContent;
            cuta1 -= baseNodeCloneData.length;
            cuta2 -= baseNodeCloneData.length;
            console.log(`nextData: ${JSON.stringify(nextData)}, cuta1: ${cuta1}, cuta2: ${cuta2}`)

            // TODO delete from next sibling nodes
            // on repeated forward delete, baseNode is <del>: <del>last delete|</del>next delete
            if (ws.baseNode.parentNode.localName == 'del') {
              // FIXME the condition is more complex:
              // <b>bold <del>last delete|</del></b>next delete
              // -> dont append to <del> inside <b>, but start a new <del> after <b>
              // append to old <del> node
              console.log(`append ${JSON.stringify(nextData.slice(cuta1, cuta2))} to old <del> node`, ws.baseNode.parentNode)
              ws.baseNode.parentNode.innerHTML += nextData.slice(cuta1, cuta2);
              //console.log(`state: append ${JSON.stringify(baseNodeCloneData.slice(cuta1, cuta2))} to old <del> node`, ws.baseNode.parentNode)
              //ws.baseNode.parentNode.innerHTML += baseNodeCloneData.slice(cuta1, cuta2);
            }
            else {
              // TODO
              console.log('TODO ws.baseNodeClone.nextSibling', ws.baseNodeClone.nextSibling) // null
            }
          }
          else {
            // FIXME delete range an start of html tag
            // for example: text <b>[delete range] more bold text</b> text
            // actual result: <del> is inserted at wrong position
            //var cutCondition = 'cutb1'; // old
            var cutCondition = 'cuta1';
            // https://stackoverflow.com/questions/39452534
            var nodesFragment = document.createDocumentFragment();
            var nodesFragmentDebugArray = [];
            if (cutCondition == 'cutb1') {
              if (cutb1 > 0) { // delete after start of node
                console.log('state: cutb1 > 0');
                nodesFragmentDebugArray.push(h.slice(0, cutb1));
                var e = document.createTextNode(h.slice(0, cutb1));
                  nodesFragment.appendChild(e);
              }
            }
            else {
              if (cuta1 > 0) { // delete after start of node
                console.log('state: cuta1 > 0');
                nodesFragmentDebugArray.push(h.slice(0, cutb1));
                var e = document.createTextNode(h.slice(0, cutb1));
                  nodesFragment.appendChild(e);
              }
            }
            nodesFragmentDebugArray.push('<del>' + baseNodeCloneData.slice(cuta1, cuta2) + '</del>');
            var e = document.createElement('del');
              e.innerHTML = baseNodeCloneData.slice(cuta1, cuta2); // FIXME also add html nodes
              nodesFragment.appendChild(e);

            if (cutCondition == 'cutb1') {
              if (cutb1 == 0) { // delete at start of node
                console.log('state: cutb1 == 0');
                nodesFragmentDebugArray.push(h.slice(0, cutb1));
                var e = document.createTextNode(h.slice(0, cutb1));
                  nodesFragment.appendChild(e);
              }
            }
            else {
              if (cuta1 == 0) { // delete at start of node
                console.log('state: cuta1 == 0');
                nodesFragmentDebugArray.push(h.slice(0, cutb1));
                var e = document.createTextNode(h.slice(0, cutb1));
                  nodesFragment.appendChild(e);
              }
            }
            nodesFragmentDebugArray.push(h.slice(cutb1));
            var e = document.createTextNode(h.slice(cutb1));
              nodesFragment.appendChild(e);
            console.log(`nodesFragment: ${formatText(`<fragment>${nodesFragmentDebugArray.join('')}</fragment>`)}`);
            if (ws.baseNode.parentNode) {
              // ws.baseNode is still in the document
              //console.log('state: ws.baseNode.replaceWith(nodesFragment). nodesFragment', nodesFragment)
              ws.baseNode.replaceWith(nodesFragment);
            }
            else {
              console.log('FIXME ws.baseNode.parentNode is empty:', ws.baseNode.parentNode)
              // TODO in the selectionchange handler, store the parentNode and index of baseNode
              // so if baseNode is removed, we can insert `nodesFragment` at the original position
              // same goes for extentNode
            }
          }
        }
      }
      else {
        // complex case: ws.baseNode != ws.extentNode
        console.log(`mark: ws.baseNode != ws.extentNode`);

        const h = (ws.baseNode.nodeType == 3) ? ws.baseNode.textContent : ws.baseNode.innerHTML;
        const aHtml = (ws.parentNodeClone.nodeType == 3) ? ws.parentNodeClone.textContent : ws.parentNodeClone.innerHTML;
        const cs = document.getSelection();
        //const offset = cs.baseOffset;
        const cutOffset = ws.baseOffset - cs.baseOffset;
        const cuta1 = ws.baseOffset;
        const cuta2 = ws.extentOffset;
        const cutb1 = ws.baseOffset - cutOffset;
        const cutb2 = ws.extentOffset - cutOffset;

        console.log(`ws: anchorOffset ${ws.anchorOffset}, baseOffset ${ws.baseOffset}, extentOffset ${ws.extentOffset}, focusOffset ${ws.focusOffset}`);
        console.log(`cs: anchorOffset ${cs.anchorOffset}, baseOffset ${cs.baseOffset}, extentOffset ${cs.extentOffset}, focusOffset ${cs.focusOffset}`);
        console.log(`cut: a1 ${cuta1}, a2 ${cuta2}, b1 ${cutb1}, b2 ${cutb2}`);


        if (1) {
          // <del> end of baseNode
          console.log(`mark: <del> end of baseNode`);

          var baseDataA = (ws.baseNodeClone.nodeType == 3) ? ws.baseNodeClone.textContent : ws.baseNodeClone.innerHTML;
          var baseDataB = (ws.baseNode.nodeType == 3) ? ws.baseNode.textContent : ws.baseNode.innerHTML;
          console.log(`data: base a: ${JSON.stringify(baseDataA)}`);
          console.log(`data: base b: ${JSON.stringify(baseDataB)}`);

          var nodesFragment = document.createDocumentFragment();
          var e = document.createTextNode(h);
            nodesFragment.appendChild(e);
          var e = document.createElement('del');
            e.innerHTML = baseDataA.slice(cuta1); // FIXME a1 or b1
            nodesFragment.appendChild(e);
          ws.baseNode.replaceWith(nodesFragment);
        }


        if (1) {
          // <del> html nodes by adding class
          console.log(`mark: ws.parentNodeClone.childNodes`);
          //console.log('ws.baseNodeClone', ws.baseNodeClone);
          var pos = 0;
          var startFound = false;
          //console.log('ws.parentNodeClone.childNodes', ws.parentNodeClone.childNodes);
          for (const fooChild of ws.parentNodeClone.childNodes) {
            //console.log('ws.parentNodeClone.childNodes', ws.parentNodeClone.childNodes);
            //console.log('fooChild', fooChild);
            console.log(`fooChild ${fooChild.outerHTML || JSON.stringify(fooChild.data)}`);
            if (!startFound) {
              if (fooChild == ws.baseNodeClone) { // we need pointer-identity -> find baseNode in parentNodeClone
                console.log('fooChild found start');
                startFound = true;
              }
              else {
                console.log('fooChild seek to start ...');
                continue;
              }
            }
            if (fooChild == ws.extentNodeClone) {
              console.log(`fooChild found end ${fooChild.outerHTML || JSON.stringify(fooChild.data)}`);
              break;
            }
            // we must clone fooChild
            // otherwise fooChild is removed from childNodes, and the for-loop will skip nodes
            const fooChildClone = fooChild.cloneNode(true);
            if (fooChildClone.nodeType != 3) {
              // no text node
              ////////fooChildClone.classList.add(liveDiffEditorClassNameDel);
              // not needed, <del> style is inherited: <del>text <b>bold</b> text</del>
              // -> just use <del>...</del> and <ins>...</ins> to wrap whole nodes? -> avoid messing with css classes
            }
            console.log(`fooChild append ${fooChildClone.outerHTML || JSON.stringify(fooChild.data)}`);
            e.appendChild(fooChildClone);
            /*
            var childData = (fooChild.nodeType == 3) ? fooChild.textContent : fooChild.innerHTML;
            const end = pos + childData.length;
            if (end > cuta2 && cuta2 > pos) {
              // cut last child
              e.appendChild(document.createTextNode(childData.slice(cuta2 - pos)));
              console.log(`cut ${(cuta2 - pos)}-end`, fooChild)
              break;
            }
            else {
              e.appendChild(fooChild);
              console.log('append', fooChild)
            }
            pos = end;
            if (pos > cuta2) break;
            */
          }
        }

        if (1) {
          // <del> start of extentNode
          console.log(`mark: <del> start of extentNode`);
          // FIXME aHtml works only for baseNode
          var extentDataA = (ws.extentNodeClone.nodeType == 3) ? ws.extentNodeClone.textContent : ws.extentNodeClone.innerHTML;
          var extentDataB = (ws.extentNode.nodeType == 3) ? ws.extentNode.textContent : ws.extentNode.innerHTML;
          console.log(`data: base ${aHtml}, extent a: ${extentDataA}, extent b: ${extentDataB}`);
          var nodesFragment = document.createDocumentFragment();
          var e = document.createElement('del');
            e.innerHTML = extentDataA.slice(0, cuta2); // FIXME
            nodesFragment.appendChild(e);
          var e = document.createTextNode(extentDataB);
            nodesFragment.appendChild(e);
          if (ws.extentNode.parentNode) {
            // ws.baseNode is still in the document
            ws.extentNode.replaceWith(nodesFragment);
          }
          else {
            // TODO in the selectionchange handler, store the parentNode and index of extentNode
            // so if extentNode is removed, we can insert `nodesFragment` at the original position
            // same goes for baseNode
          }
        }

      }
      // TODO set cursor position to after <del>...</del>

      editHistoryMap.get(editable).push({ html: editable.innerHTML, cursor });
      document.querySelector('textarea[title="editable.innerHTML"]').innerHTML = editable.innerHTML;
      document.querySelector('textarea[title="custom diff format"]').innerHTML = (await customDiffEncode(editable.innerHTML)).replace(/&/g, '&amp;');
      customDiffDecode(await customDiffEncode(editable.innerHTML));
      Cursor.setCurrentCursorPosition(cursor, editable);
      editable.focus();

    };
  });

}


