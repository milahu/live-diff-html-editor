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
export async function encode(html) {

  const wrapWidth = 40;
  const WL = str => wrapLines(str, wrapWidth);

  //console.log('chardiff.encode: input = ' + JSON.stringify(html))
  let res = 'chardiff 1.0\n'; // AKA mime-multipart, AKA tar
  // encode order: esc -> code -> wrap
  res += 'esc: \\\n';
  res += 'code: utf16\n';
  res += 'wrap: $\n';
  res += `width: ${wrapWidth}\n`;
  // "plaintar" header done, now we can use the esc and wrap controls
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

export async function decode(str) {
  const lines = str.split('\n');
  let L = 0;
  var line = lines[L];

  if (line != 'chardiff 1.0') { console.log('chardiff.decode: plaintar header not found'); return null; }

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^esc: (.+)$/);
  if (!m) { console.log('chardiff.decode: plaintar-esc header not found'); return null; }
  const controlEsc = m[1]; console.log(`chardiff.decode: control esesc: ${controlEsc}`);

  L++; line = lines[L]; // seek to next line
  if (line != 'code: utf16') { console.log('chardiff.decode: plaintar-encoding utf16 header not found'); return null; }

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^wrap: (.+)$/);
  if (!m) { console.log('chardiff.decode: plaintar-wrap header not found'); return null; }
  const controlWrap = m[1]; console.log(`chardiff.decode: control wrap: ${controlWrap}`);

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^width: ([0-9]+)$/);
  if (!m) { console.log('chardiff.decode: plaintar-wrap header not found'); return null; }
  const wrapWidth = parseInt(m[1]); console.log(`chardiff.decode: wrap width: ${wrapWidth}`);

  // plaintar header done. now we can decode line-wraps and escapes (inverse of function wrapLines)
  var lastLineLength = 0;
  for (let l = L; l < lines.length; l++) {

    if (lines[l].length == lastLineLength + wrapWidth) {
      // last char must be controlWrap
      // not-wrapped lines have a maximum width of (wrapWidth - 1)
      if (!lines[l].endsWith(controlWrap)) { console.log('chardiff.decode: controlWrap char not found at end of wrapped line: ' + JSON.stringify(lines[l])); return null; }
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
  var m = line.match(/^name: (.+)$/);
  if (!m) { console.log('chardiff.decode: chardiff-name header not found'); return null; }
  const chardiffName = m[1]; console.log('chardiff.decode: name: ' + chardiffName);

  L++; line = lines[L]; // seek to next line
  var m = line.match(/^files: ([0-9]+)$/);
  if (!m) { console.log('chardiff.decode: chardiff-files header not found'); return null; }
  const numFiles = m[1]; console.log('chardiff.decode: files: ' + numFiles);

  L++; line = lines[L]; // seek to next line
  if (line != '') { console.log('chardiff.decode: end of chardiff header not found'); return null; }

  let state = 'file';
  let file = null;
  let fileChunks = 0;
  let chunksDone = 0;
  while (L < (lines.length - 1)) {
    L++; line = lines[L];
    // TODO unwrapLines = seek to end of string in the next lines

    if (state == 'file') {
      var m = line.match(/^file: (.+)$/);
      if (!m) { console.log(`chardiff.decode: file header not found. remaining text: ${JSON.stringify(lines.slice(L).join('\n'))}`); return null; }
      file = m[1]; console.log('chardiff.decode: file: ' + file);

      L++; line = lines[L]; // seek to next line
      var m = line.match(/^chunks: ([0-9]+)$/);
      if (!m) { console.log('chardiff.decode: file-chunks header not found'); return null; }
      fileChunks = parseInt(m[1]); console.log('chardiff.decode: file chunks: ' + fileChunks)
      
      L++; line = lines[L]; // seek to next line
      if (line != '') { console.log('chardiff.decode: end of file header not found'); return null; }

      state = 'chunk';
    }

    else if (state == 'chunk') {
      var m = line.match(/^chunk: ([0-9]+)$/);
      if (!m) { console.log('chardiff.decode: chunk header not found'); return null; }
      var chunkNumber = parseInt(m[1]); console.log('chardiff.decode: chunk number: ' + chunkNumber);

      L++; line = lines[L]; // seek to next line
      var m = line.match(/^offset: ([0-9]+)$/);
      if (!m) { console.log('chardiff.decode: chunk-offset header not found'); return null; }
      var chunkOffset = parseInt(m[1]); console.log('chardiff.decode: chunk offset: ' + chunkOffset);

      L++; line = lines[L]; // seek to next line
      var m = line.match(/^length: ([0-9]+)$/);
      if (!m) { console.log('chardiff.decode: chunk-length header not found'); return null; }
      var chunkLength = parseInt(m[1]); console.log('chardiff.decode: chunk length: ' + chunkLength);

      L++; line = lines[L]; // seek to next line
      var m = line.match(/^sha1: (.+)$/);
      if (!m) { console.log('chardiff.decode: chunk-sha1 header not found'); return null; }
      var chunkSha1 = m[1]; console.log('chardiff.decode: chunk sha1: ' + chunkSha1);

      L++; line = lines[L]; // seek to next line
      if (line != '') { console.log('chardiff.decode: end of chunk header not found'); return null; }

      let chunkBody = '';
      let safety = 0;
      let firstLineInChunkBody = true;
      while (chunkBody.length < chunkLength) {
        L++; line = lines[L]; // seek to next line
        console.log(`chardiff.decode: chunk body buffer: ${encodeString(chunkBody)}`);
        const lenBefore = chunkBody.length;
        if (firstLineInChunkBody) firstLineInChunkBody = false; else chunkBody += '\n';
        chunkBody += line;
        console.log(`chardiff.decode: add line: ${encodeString(''+line)}`);
        console.log(`chardiff.decode: chunk body buffer length: ${lenBefore} of ${chunkLength} -> ${chunkBody.length} of ${chunkLength}`);
        safety++; if (safety > 100) { console.log(`DEBUG deadloop?`); break; }
      }
      console.log('chardiff.decode: chunk body: ' + chunkBody);
      //console.log('chardiff.encode: chunk body = ' + JSON.stringify(chunkBody))
      if (chunkBody.length == chunkLength) console.log(`chardiff.decode: chunk body found with length ${chunkBody.length} of ${chunkLength}`)
      else { console.log(`chardiff.decode: error: size mismatch in chunk body. expected ${chunkLength}, actual ${chunkBody.length}`); return null; }

      // note: the 'sha1' field can have only a prefix of the sha1 checksum
      const chunkSha1Actual = (await sha1sum(chunkBody)).slice(0, chunkSha1.length);
      if (chunkSha1Actual == chunkSha1) console.log(`chardiff.decode: chunk body checksum pass`);
      else { console.log(`chardiff.decode: error: checksum mismatch in chunk body. expected ${chunkSha1}, actual ${chunkSha1Actual}`); return null; }

      chunksDone++;
      console.log(`chardiff.decode: chunks done: ${chunksDone} of ${fileChunks}`)
      if (chunksDone == fileChunks) {
        L++; line = lines[L]; // seek to next line
        if (line != '') { console.log('chardiff.decode: end of file body not found'); return null; }
        state = 'file';
      }
    }
  }
  if (state == 'file') {
    console.log(`chardiff.decode: end state = ${state} -> ok`);
  } else {
    console.log(`chardiff.decode: end state = ${state} -> error: end state should be file`);
  }
}
