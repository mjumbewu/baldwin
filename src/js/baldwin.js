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

      this.routeViews = {};

      this.$now = $('#now');

      this.noRoutesTemplate = _.template(
        '<li class="alert alert-block alert-info">Add some routes to see the upcoming trips!</li>'
      );
    },
    render: function(){
      var self = this;
      this.routeViews = {};

      // Set the time
      this.$now.text(moment().format('h:mm A'));

      if (this.collection.size() === 0) {
        this.$el.html(this.noRoutesTemplate());
      } else {
        this.$el.empty();
        this.collection.each(function(model){
          self.routeViews[model.cid] = new B.RouteView({ model: model });
          self.$el.append(self.routeViews[model.cid].render().el);
        });
      }

      return this;
    }
  });

  B.RouteView = Backbone.View.extend({
    events: {
      'click .remove-route': 'removeRoute'
    },

    initialize: function() {
      this.routeTemplate = _.template(
        '<li class="well well-small">' +
          '<button type="button" class="close remove-route">&times;</button>' +
          '<h4>{{ start }} to {{ end }}</h4>' +
          '<ol class="unstyled trip-list"></ol>' +
        '</li>'
      );

      this.tripTemplate = _.template(
        '<li class="alert alert-block {{ status_alert_class }}">' +
          '<strong class="departure">' +
            'Departs at {{ orig_departure_time }}' +
            '<span class="label {{ status_label_class }}">{{ orig_delay }}</span>' +
          '</strong> ' +
          '<span class="arrival">Arrives at {{ orig_arrival_time }} on the {{ orig_line }} Line' +
        '</li>'
      );

      this.messageTemplate = _.template(
        '<li class="alert alert-block alert-info">{{ message }}</li>'
      );

      setInterval(_.bind(this.renderTrips, this), 30000);

    },

    render: function() {
      this.$el.html(this.routeTemplate(this.model.toJSON()));
      this.renderTrips();

      return this;
    },

    renderTrips: function() {
      var self = this;
      $.ajax({
        url: 'http://www3.septa.org/hackathon/NextToArrive/',
        data: {
          req1: this.model.get('start'),
          req2: this.model.get('end'),
          req3: 3
        },
        dataType: 'jsonp',
        success: function(trips){
          if (trips.length > 0) {
            var html = '';
            _.each(trips, function(trip) {
              html += self.renderTrip(trip);
            });

            self.$('.trip-list').html(html);
          } else {
            self.renderMessage('Sorry, no upcoming trips were found.');
          }
        },
        error: function() {
          self.renderMessage('Oops, something went wrong when our ' +
            'robots were talking to SEPTA\'s robots. Try again in a sec!');
        }
      });
    },
    renderTrip: function(trip) {
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

      return this.tripTemplate(data);
    },
    renderMessage: function(message) {
      this.$el.html(this.messageTemplate({
        message: message
      }));
    },
    removeRoute: function() {
      if (window.confirm('Really delete?')) {
        this.model.destroy();
      }
    }
  });


  // View for adding a trip to the collection
  B.AddRouteView = Backbone.View.extend({
    events: {
      'submit': 'addRoute'
    },

    getAttrs: function() {
      var attrs = {};

      // Get values from the form
      _.each(this.$el.serializeArray(), function(item, i) {
        attrs[item.name] = item.value;
      });

      return attrs;
    },

    addRoute: function(evt) {
      evt.preventDefault();
      var attrs = this.getAttrs();
      this.collection.create(attrs);
    }
  });

  var routeCollection = new B.RouteList(),
      addRouteView = new B.AddRouteView({
        el: '#add-route',
        collection: routeCollection
      }),
      routeListView = new B.RouteListView({
        el: '#route-list',
        collection: routeCollection
      });

  routeCollection.fetch();

  $('.station').typeahead({source: B.stations});
})(Baldwin, jQuery);