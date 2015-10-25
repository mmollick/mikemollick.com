var gulp = require('gulp');
var sass = require('gulp-sass');
var cssmin = require('gulp-cssmin');

var dir = {
    sass: './sass',
    css: './css'
}

/**
 * Sass build
 */
gulp.task('sass', function () {
    gulp.src(dir.sass + '/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest(dir.css));
});

/**
 * Our sass watch command
 */
gulp.task('sass:watch', function () {
    gulp.watch(dir.sass + '/**/*.scss', ['sass']);
});


/**
 * Our build command
 */
gulp.task('build:watch', ['sass','sass:watch']);

/**
 * Our build command
 */
gulp.task('build:pro', function () {
    gulp.src(dir.sass + '/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(cssmin())
        .pipe(gulp.dest(dir.css));
});