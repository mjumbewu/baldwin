module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    meta: {
      banner: '#version <%= grunt.template.today() %>'
    },
    concat: {
      dist: {
        src: ['src/js/stations.js', 'src/js/baldwin.js'],
        dest: 'src/dist/baldwin.js'
      },
      appcache: {
        src: ['src/baldwin.appcache.template', '<banner:meta.banner>'],
        dest: 'src/baldwin.appcache'
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
      files: ['src/js/baldwin.js', 'src/baldwin.appcache.template'],
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