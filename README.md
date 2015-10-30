# mocha-image-compare

Module makes possible to compare images during mocha test execution. It
generates report in specified folder which includes provided test image,
image received from buffer/file, diff image (if previous tests were ok)
and report json file for each test.

It compares images by three parameters:

- format (PNG, JPG etc)
- geometry (width/height)
- content (by MSE metric)

## Installation

    npm install --save-dev mocha-image-compare

## Usage

This module is pretty easy to use. First include it into you test file:

```javascript
var mic = require('mocha-image-compare');
```

Also, you can specify optional parameters like

```javascript
var mic = require('mocha-image-comapre')({
  report: '/path/to/report/folder', // path to the report folder, default
                                    // is './report'
  threshold: 0.002, // default detection thresold, default is 0.001
  highlight: 'yellow' // image diff highlight color
});
```

Please note, this way you'll have common scope for all tests run in common,
even if you include it in other test file.

To have a separate scope you need to instantiate a new instance, like this:

```javascript
var scope = new mic(options);
```

To get actual compare function you need to bind test with the comparator
instance like

```javascript
it('my cool test', function(done) {
  var compare = mic.test(this);
  // other stuff
  compare('/path/to/file/to/compare/with.jpg', buffer, done);
});
```

You can test an already saved file too:

```javascript
it('my cool test', function(done) {
  var compare = mic.test(this);
  // other stuff
  compare('/file/to/compare/with.jpg', 0.004, // you can specify threshold too!
          '/test/file/to/compare.jpg', done);
});
```

There is also a syntax sugar which will be pretty useful for testing with
`supertest` library:

```javascript
it('my cool test', function(done) {
  var compare = mic.test(this);
  // other stuff
  api.get('/')
     .expect('Content-Type': 'image/jpeg')
     .end(compare.asSupertest('/file/to/compare/with.jpg' done));
});
```

## Report

Report folder contains up to four files per compare invocation:

1. <sha1-hash>-src.<filetype>: original file
2. <sha1-hash>-dst.<filetype>: resulting file saved from buffer/file
3. <sha1-hash>-diff.png: image shows visual difference between images
4. <sha1-hash>-report.json: JSON encoded test results.

Example JSON report is:

```javascript
{
  // threshold for test
  "threshold": 0.001,
  "test": "/project/test/001-thumbnails.js", // test suite file
  "name": [
    "thumbnails", // suite name
    "should create thumbnail with scaling" // test name
  ],
  // original file
  "src": "./report/1b924ae63414b5876a0b04feeaa88d41b0d2da41-src.png",
  // report file (this one!)
  "report": "./report/1b924ae63414b5876a0b04feeaa88d41b0d2da41-report.json",
  // object dimensions
  "geometry": {
    "src": "200x82",
    "dst": "200x82"
  },
  // object formats
  "format": {
    "src": "PNG (Portable Network Graphics)",
    "dst": "PNG (Portable Network Graphics)"
  },
  // got file/content
  "dst": "./report/1b924ae63414b5876a0b04feeaa88d41b0d2da41-dst.png",
  // image diff file
  "diff": "./report/1b924ae63414b5876a0b04feeaa88d41b0d2da41-diff.png",
  // actual equality value
  "equality": 0,
  // content comparison test result
  "isEqual": true
}
```
