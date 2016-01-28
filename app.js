'use strict';

var koa = require('koa');
var marked = require('marked');
var hljs = require('highlight.js');
var fs = require('fs');
var path = require('path');
var co = require('co');

var app = koa();

var mdDir = "./md";
var staticDir = "./public";

//增加的代码，用于个性化输出table
var renderer = new marked.Renderer();
renderer.table = function(header, body) {
        //增加bootstrap table式样
        return '<table class="table table-striped table-bordered">' + header + body + '</table>'
    }
    // marked配置
marked.setOptions({
    renderer: renderer,
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false,
    highlight: function(code) { // 代码高亮配置
        return hljs.highlightAuto(code).value;
    }
});

// x-response-time
app.use(function*(next) {
    var start = new Date;
    yield next;
    var ms = new Date - start;
    this.set('X-Response-Time', ms + 'ms');
});

// logger
app.use(function*(next) {
    var start = new Date;
    yield next;
    var ms = new Date - start;
    console.log('%s %s - %sms', this.method, this.url, ms);
});

// 404 NOT FOUND
app.use(function*(next) {
    yield next;
    if (404 != this.status) return;

    this.status = 404;
    this.type = 'text'
    this.body = 'Page Not Found'
});

// URL -> DIR PATH
// readfile
app.use(function*(next) {
    var flag = false;
    var filePath = '';
    // STATIC 有后缀直接返回 
    if (this.url.indexOf(".") > -1) {
        flag = true;
        filePath = path.normalize(staticDir + this.url);
    } else {
        if (this.url == '/') this.url = '/index';

        filePath = path.normalize(mdDir + [this.url, '.md'].join(''));
    }
    if (fs.existsSync(filePath)) {
        if (flag) {
            // stream
            var stats = fs.statSync(filePath);
            this.set('Last-Modified', stats.mtime.toUTCString());
            this.set('Content-Length', stats.size);
            if (filePath.startsWith('/css') || filePath.startsWith('/js')) {
                this.set('Cache-Control', 'max-age=' + (60 * 60 * 1000 / 1000 | 0));
            }
            this.type = path.extname(path.basename(filePath, '.gz'));
            this.body = fs.readFileSync(filePath);
            return
        }
        this.body = marked(fs.readFileSync(filePath, 'utf8'));
        yield next;
    } else {
        this.status = 404;
    }
});

// 基本布局
app.use(function*() {
    // 增加HTML页头
    var header = '<!DOCTYPE html>' +
        '<html lang="zh-CN">' +
        '<head>' +
        '<title>Mark-Note</title>' +
        '<link rel="stylesheet" href="/css/bootstrap_3_3_6.min.css">' +
        '<link rel="stylesheet" href="/css/highlight_9_1_0_monokai-sublime.min.css">' +
        '</head><body>';
    //增加bootstap基本布局
    var layoutHeader = '<div class="row">' +
        '<div class="col-md-2"></div>' +
        '<div class="col-md-8 col-sm-12 col-xs-12">';
    var layoutFooter = '</div>' +
        '<div class="col-md-2"></div>' +
        '</div>';

    //增加HTML的页底
    var footer = '<script src="/js/highlight_9_1_0.min.js"></script>' +
        '<script>hljs.initHighlightingOnLoad();</script>' +
        '</body></html>';

    this.body = header + layoutHeader + this.body + layoutFooter + footer;
});

// app.use(function*(next) {
//     this.body = 'Hello World';
// });

app.on('error', function(err) {
    log.error('server error', err);
});

app.name = "MarkNote";
app.listen(3000);
