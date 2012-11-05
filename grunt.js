module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    concat: {
      dist: {
        src: ['src/js/stations.js', 'src/js/baldwin.js'],
        dest: 'src/dist/baldwin.js'
      }
    },
    min: {
      dist: {
        src: ['src/dist/baldwin.js'],
        dest: 'src/dist/baldwin.min.js'
      }
    },
    lint: {
      files: ['src/js/baldwin.js']
    },
    watch: {
      files: '<config:lint.files>',
      tasks: 'default'
    },
    jshint: {
      options: {
        "regexdash": true,
        "browser": true,
        "wsh": true,
        "trailing": true,
        "sub": true,
        "curly": true,
        "eqeqeq": true
      }
    },
    uglify: {}
  });

  // Default task.
  grunt.registerTask('default', 'lint concat min');

};