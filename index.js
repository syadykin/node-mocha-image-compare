var crypto = require('crypto'),
    fs = require('fs'),
    path = require('path'),
    async = require('async'),
    cp = require('cp'),
    gm = require('gm'),
    extend = require('extend'),

    format = require('util').format;

var TestImage = function (options) {

  var defaults = {
    report: './report',
    highlight: 'red'
  };

  this.tests = [];
  this.options = extend(defaults, options || {});

  return this;
};

function compare(test, file, threshold, source, cb) {
  var that = this,
      step = test.test,
      dirprefix = this.options.report,
      stack = [], info,
      testfile = step.file,
      fileprefix = crypto.createHash('sha1');

  while(step.title) {
    stack.push(step.title);
    fileprefix.update(step.title);
    step = step.parent;
  }

  fileprefix = fileprefix.digest('hex');

  stack.reverse();

  info = {
    threshold: threshold,
    test: testfile,
    name: stack,
    src: dirprefix + '/' + fileprefix + '-src' +
                                  path.extname(file).toLowerCase(),
    dst: dirprefix + '/' + fileprefix + '-dst.',
    diff: dirprefix + '/' + fileprefix + '-diff.png',
    report: dirprefix + '/' + fileprefix + '-report.json'
  };

  this.tests.push(info);

  async.auto({
    mkdir: function(cb) {
      fs.exists(that.options.report, function(exists) {
        return !exists ? fs.mkdir(that.options.report, cb) : cb();
      });
    },
    cp: function(cb) {
      cp(file, info.src, cb);
    },
    src: ['cp', function(cb) {
      gm(info.src).identify(cb);
    }],
    dst: ['mkdir', function(cb) {
      gm(source).identify(cb);
    }],
    write: ['dst', function(cb, data) {
      info.dst += data.dst.format.toLowerCase();
      fs.writeFile(info.dst, source, cb);
    }],
    basic: ['src', 'dst', function(cb, data) {
      var src = data.src,
          dst = data.dst;

      info.geometry = {
        src: src.Geometry,
        dst: dst.Geometry
      };

      info.format = {
        src: src.Format,
        dst: dst.Format
      };

      if (src.Format !== dst.Format)
        return cb(format('Format is different: %s vs %s',
                                             src.Format, dst.Format));

      if (src.Geometry !== dst.Geometry)
        return cb(format('Geometry is different: %s vs %s',
                                          src.Geometry, dst.Geometry));
      cb();
    }],
    content: ['src', 'write', function(cb) {
      gm.compare(info.src, info.dst,
        {
          file: info.diff,
          tolerance: info.threshold,
          highlightColor: that.options.highlight
        }, cb);
    }],
    equality: ['content', function(cb, data) {
      info.equality = data.content[1];
      info.isEqual = data.content[0];

      if (info.isEqual) return cb();
      cb('Images are differrent by content');
    }]
  }, function(err, data) {
    var report = (err && err.message || err);

    if (report) info.error = report;
    fs.writeFileSync(info.report, JSON.stringify(info, null, 2));

    if (!err) return cb();

    report   += '\n\n';
    report   += '\torig image: ' + info.src + '\n';
    report   += '\tnew image:  ' + info.dst + '\n';
    if (data.content)
      report += '\tdiff image: ' + info.diff + '\n';
    else
      delete info.diff;
    report   += '\treport:     ' + info.report;

    cb(new Error(report));
  });
}

TestImage.prototype.test = function(test) {
  return compare.bind(this, test);
};

var scope = new TestImage();

TestImage.prototype = scope;
module.exports = TestImage.bind(scope);

for (var method in TestImage.prototype) {
  module.exports[method] = TestImage.prototype[method];
}
