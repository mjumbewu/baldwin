var Baldwin = Baldwin || {};

(function(B, $){
  // Mustache style templates with underscore (one less dependency)
  _.templateSettings = {
    interpolate : /\{\{(.+?)\}\}/g
  };

  // Collection for all of the trips (start and end stations)
  B.RouteList = Backbone.Collection.extend({
    localStorage: new Store('baldwin-route-list')
  });

  // View for a list of trips
  B.RouteListView = Backbone.View.extend({
    tagName: 'ol',

    attributes: {
      'class': 'unstyled'
    },

    initialize: function(){
      this.collection.on('reset', this.render, this);
      this.collection.on('add', this.render, this);
      this.collection.on('remove', this.render, this);

      this.routeTemplate = _.template(
        '<li class="well well-small">' +
          '<h2>{{ start }} to {{ end }}</h2>' +
          '<ol class="unstyled trip-list"></ol>' +
        '</li>'
      );

      this.noRoutesTemplate = _.template(
        '<li class="alert alert-block alert-info">Add some routes to see the upcoming trips!</li>'
      );

      this.tripTemplate = _.template(
        '<li class="alert alert-block {{ status_alert_class }}">' +
          '<h4>Departs at {{ orig_departure_time }} <span class="label {{ status_label_class }}">{{ orig_delay }}</span></h4>' +
          'Arrives at {{ orig_arrival_time }} on the {{ orig_line }} Line' +
        '</li>'
      );

      this.messageTemplate = _.template(
        '<li class="alert alert-block alert-info">{{ message }}</li>'
      );
    },
    render: function(){
      var self = this;
      if (this.collection.size() === 0) {
        this.$el.html(this.noRoutesTemplate());
      } else {
        this.$el.empty();
        this.collection.each(function(model){
          var $routeEl = $(self.routeTemplate(model.toJSON())).appendTo(self.$el);
          self.renderTrips($routeEl, model);
        });
      }

      return this;
    },
    renderTrips: function($routeEl, model) {
      var self = this;
      $.ajax({
        url: 'http://www3.septa.org/hackathon/NextToArrive/',
        data: {
          req1: model.get('start'),
          req2: model.get('end'),
          req3: 3
        },
        dataType: 'jsonp',
        success: function(trips){
          if (trips.length > 0) {
            _.each(trips, function(trip) {
              self.renderTrip($routeEl, trip);
            });
          } else {
            self.renderMessage($routeEl, 'Sorry, no upcoming trips were found.');
          }
        },
        error: function() {
          self.renderMessage($routeEl, 'Oops, something went wrong when our ' +
            'robots were talking to SEPTA\'s robots. Try again in a sec!');
        }
      });
    },
    renderTrip: function($routeEl, trip) {
      var data = _.extend({}, trip),
          minsLate = parseInt(data.orig_delay, 10);

      if (minsLate > 0 && minsLate <= 5) {
        data.status_alert_class = '';
        data.status_label_class = 'label-warning';
      } else if (minsLate > 5) {
        data.status_alert_class = 'alert-error';
        data.status_label_class = 'label-important';
      } else {
        data.status_alert_class = 'alert-success';
        data.status_label_class = 'label-success';
      }

      $routeEl.append(this.tripTemplate(data));

    },
    renderMessage: function($routeEl, message) {
      $routeEl.html(this.messageTemplate({
        message: message
      }));
    }
  });


  // View for adding a trip to the collection
  B.AddRouteView = Backbone.View.extend({
    initialize: function(){},
    render: function(){

    }
  });

  window.routes = new B.RouteList();

  window.routeListView = new B.RouteListView({
    el: '#route-list',
    collection: window.routes
  }).render();

  $('.station').typeahead({source: B.stations});
})(Baldwin, jQuery);