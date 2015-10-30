var crypto = require('crypto'),
    fs = require('fs'),
    async = require('async'),
    gm = require('gm'),
    extend = require('extend'),

    format = require('util').format;

var TestImage = function (options) {

  if (!this.instantiated) {

    this.options = {
      report: './report',
      highlight: 'red',
      threshold: 0.001
    };

    this.tests = [];

    this.instantiated = true;
  }

  extend(this.options, options || {});

  return this;
};

function compare(test, file, threshold, source, cb) {

  if (arguments.length === 4) {
    cb = source;
    source = threshold;
    threshold = this.options.threshold;
  }

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

  fileprefix = fileprefix.update(file).digest('hex');

  stack.reverse();

  info = {
    threshold: threshold,
    test: testfile,
    name: stack,
    file: file,
    report: dirprefix + '/' + fileprefix + '-report.json'
  };

  this.tests.push(info);

  async.auto({
    mkdir: function(cb) {
      fs.exists(that.options.report, function(exists) {
        return !exists ? fs.mkdir(that.options.report, cb) : cb();
      });
    },
    read: function(cb) {
      async.parallel({
        src: async.apply(fs.readFile, file),
        dst: function(cb) {
          if (source instanceof Buffer)
            return cb(null, source);
          return fs.readFile(source, cb);
        }
      }, cb);
    },
    src: ['read', function(cb, data) {
      gm(data.read.src).identify(cb);
    }],
    dst: ['read', function(cb, data) {
      gm(data.read.dst).identify(cb);
    }],
    write: ['mkdir', 'src', 'dst', function(cb, data) {
      info.src = dirprefix + '/' + fileprefix + '-src.' +
                                              data.src.format.toLowerCase();
      info.dst = dirprefix + '/' + fileprefix + '-dst.' +
                                              data.dst.format.toLowerCase();
      async.parallel([
        async.apply(fs.writeFile, info.src, data.read.src),
        async.apply(fs.writeFile, info.dst, data.read.dst)
      ], cb);
    }],
    basic: ['src', 'dst', 'write', function(cb, data) {
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
    content: ['write', 'basic', function(cb) {
      info.diff = dirprefix + '/' + fileprefix + '-diff.png';
      gm.compare(info.src, info.dst, {
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
  }, function(err) {
    var report = (err && err.message || err);

    if (report) info.error = report;
    fs.writeFileSync(info.report, JSON.stringify(info, null, 2));

    if (!err) return cb();

    report   += '\n\n';
    if (info.src)
      report += '\torig image: ' + info.src + '\n';
    if (info.dst)
      report += '\tnew image:  ' + info.dst + '\n';
    if (info.diff)
      report += '\tdiff image: ' + info.diff + '\n';
    report   += '\treport:     ' + info.report;

    cb(new Error(report));
  });
}

function asSupertest() {
  var args = Array.prototype.slice.apply(arguments),
      fn = args.shift(),
      cb = args.pop();

  return function(err, res) {
    if (err) return cb(err);
    args.push(res.body, cb);
    fn.apply(null, args);
  };

}

TestImage.prototype.test = function(test) {
  var fn = compare.bind(this, test);
  fn.asSupertest = asSupertest.bind(this, fn);
  return fn;
};

compare.asSupertest = asSupertest;

var scope = new TestImage();

TestImage.prototype = scope;
module.exports = TestImage.bind(scope);

for (var method in TestImage.prototype) {
  module.exports[method] = TestImage.prototype[method];
}
