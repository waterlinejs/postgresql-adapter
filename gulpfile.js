'use strict';

const gulp = require('gulp');
const babel = require('gulp-babel');

gulp.task('default', function () {
    return gulp.src(['lib/**'])
        .pipe(babel())
        .pipe(gulp.dest('dist'));
});
