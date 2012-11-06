var Baldwin = Baldwin || {};

(function(B, $){
  // Collection for all of the trips (start and end stations)
  B.RouteList = Backbone.Collection.extend({
    localStorage: new Store('baldwin-route-list'),

    setPosition: function(position) {
      var p = {
        lat: parseFloat(position.coords.latitude.toFixed(4)),
        lng: parseFloat(position.coords.longitude.toFixed(4))
      };

      if (!_.isEqual(this.position, p)) {
        this.position = p;
        this.sort({silent: true});
        this.trigger('sort');
      }
    },

    initialize: function() {
      // Get the current location
      if(navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(_.bind(this.setPosition, this));
      }
    },

    comparator: function(route) {
      var aSq, bSq, c;

      // If current location has been set, sort the closest start station
      // to the top.
      if (this.position) {
        // Thanks Pythagoras!
        aSq = Math.pow(this.position.lat - route.get('start').lat, 2),
        bSq = Math.pow(this.position.lng - route.get('start').lng, 2);
        c = Math.sqrt(aSq + bSq);

        return c;
      } else {
        // Otherwise, use the default order
        return 0;
      }
    }
  });

  // View for a list of trips
  B.RouteListView = Backbone.View.extend({
    tagName: 'ol',

    attributes: {
      'class': 'unstyled'
    },

    initialize: function(){
      this.collection.on('reset', this.render, this);
      this.collection.on('add', this.add, this);
      this.collection.on('remove', this.remove, this);
      this.collection.on('sort', this.sort, this);

      this.routeViews = {};
    },

    render: function(){
      this.routeViews = {};

      // Empty the list first
      this.$el.empty();
      if (this.collection.size() === 0) {
        this.$el.closest('.results-box').addClass('empty');
      } else {
        this.collection.each(function(model){
          this.add(model);
        }, this);
      }

      return this;
    },

    remove: function(model) {
      this.routeViews[model.cid].remove();
      delete this.routeViews[model.cid];

      if (this.collection.size() === 0) {
        this.$el.closest('.results-box').addClass('empty');
      }
    },

    add: function(model, collection, options) {
      this.$el.closest('.results-box').removeClass('empty');
      this.routeViews[model.cid] = new B.RouteView({ model: model });

      if(options && options.index === 0) {
        this.$el.prepend(this.routeViews[model.cid].render().$el);
      } else if(options && options.index > 0) {
        this.$('.trip-group:nth-child(' + options.index + ')')
          .after(this.routeViews[model.cid].render().$el);
      } else {
        this.$el.append(this.routeViews[model.cid].render().$el);
      }
    },

    sort: function() {
      this.collection.each(function(model){
        this.routeViews[model.cid].$el.appendTo(this.$el);
      }, this);
    }
  });

  B.RouteView = Backbone.View.extend({
    tagName: 'li',
     attributes: {
      'class': 'trip-group'
    },
    events: {
      'click .remove-route': 'removeRoute'
    },

    initialize: function() {
      this.$now = $('#now');
      setInterval(_.bind(this.renderTrips, this), 30000);
    },

    render: function() {
      this.$el.html(ich['route-template'](this.model.toJSON()));
      this.renderTrips();

      return this;
    },

    remove: function() {
      this.$el.remove();
    },

    mapRange: function(value, low1, high1, low2, high2) {
      return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
    },

    renderTrips: function() {
      var self = this;

      // Set the time
      this.$now.html(moment().format('h:mm') + '<span class="am-pm">'+moment().format('A')+'</span>');

      $.ajax({
        url: 'http://www3.septa.org/hackathon/NextToArrive/',
        data: {
          req1: this.model.get('start').name,
          req2: this.model.get('end').name,
          req3: 3
        },
        dataType: 'jsonp',
        success: function(trips){
          self.$('.trip-list').empty();
          if (trips.length > 0) {
            _.each(trips, function(trip) {
              var $trip = self.renderTrip(trip);
              self.$('.trip-list').append($trip.template);
              //render pietimer
              $trip.template.find(".timer").each(function(i){
                $(this).pietimer({
                    seconds: $trip.data.mins_to_dep[i] * 60,
                    sliceColor: $trip.data.slice_color[i],
                    // map time value from a range of 0 to 60 minutes to 0 to 360 degrees
                    start: self.mapRange($trip.data.mins_to_dep[i], 0, 60, 0, 360)
                }).pietimer('start');
               });
            });
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

    parseTime: function(timeStr) {
      if (!_.isUndefined(timeStr)) {
        var now = moment();
        var time = moment(timeStr, "hhmma")
                              .month(now.month())
                              .date(now.date())
                              .year(now.year());

        //set date to tomorrow in case of rollover
        if (now.hours() > time.hours()) {
          time.add('days',1);
        }

        return {
            time: time.format('h:mm'),
            meridian: time.format('a'),
            diff: time.diff(now, 'minutes')
        };
      }
    },

    renderTrip: function(trip) {
      var data = _.extend({}, trip),
          origDelay = parseInt(data.orig_delay, 10),
          termDelay = parseInt(data.term_delay, 10),
          lateLabel = " late";

      //process times for styling and calcuation
      data.orig_departure_time = this.parseTime(data.orig_departure_time);
      data.orig_arrival_time = this.parseTime(data.orig_arrival_time);
      data.term_depart_time = this.parseTime(data.term_depart_time);
      data.term_arrival_time = this.parseTime(data.term_arrival_time);

      //default color and time to on-time departure
      data.slice_color = [];
      data.mins_to_dep = [];

        if (data.isdirect === 'false') {
          data.trip_class = 'multi-leg';
        }

        if (origDelay > 0 && origDelay < 10) {
          data.orig_alert_class = 'status-delayed';
          data.orig_delay = data.orig_delay + lateLabel;
          data.mins_to_dep.push(data.orig_departure_time.diff + origDelay);
          data.slice_color.push('#ffd71c');
        } else if (origDelay >= 10) {
          data.orig_alert_class = 'status-late';
          data.orig_delay = data.orig_delay + lateLabel;
          data.mins_to_dep.push(data.orig_departure_time.diff + origDelay);
          data.slice_color.push('#ff4328');
        } else if (isNaN(origDelay)) {
          data.orig_alert_class = 'status-ontime';
          data.slice_color.push('#45ff5d');
          data.mins_to_dep.push(data.orig_departure_time.diff);
        }

        if (!_.isUndefined(data.term_depart_time)) {
          if (termDelay > 0 && termDelay < 10) {
            data.term_alert_class = 'status-delayed';
            data.term_delay = data.term_delay + lateLabel;
            data.mins_to_dep.push(data.term_depart_time.diff + termDelay);
            data.slice_color.push('#ffd71c');
          } else if (termDelay >= 10) {
            data.term_alert_class = 'status-late';
            data.term_delay = data.term_delay + lateLabel;
            data.mins_to_dep.push(data.term_depart_time.diff + termDelay);
            data.slice_color.push('#ff4328');
          } else if (isNaN(termDelay)) {
            data.term_alert_class = 'status-ontime';
            data.slice_color.push('#45ff5d');
            data.mins_to_dep.push(data.term_depart_time.diff);
          }
        }

      return {template: ich['trip-template'](data), data: data};

    },
    renderMessage: function(message) {
      this.$('.trip-list').html(ich['message-template']({
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
      'submit': 'addRoute',
      'change input': 'onChange'
    },

    getAttrs: function() {
      var attrs = {};

      // Get values from the form
      _.each(this.$el.serializeArray(), function(item, i) {
        attrs[item.name] = item.value;
      });

      return attrs;
    },

    onChange: function(evt) {
      var $target = $(evt.target);

      if(_.find(B.stations, function(s) { return s.name === $target.val(); })) {
        $target.removeClass('error');
      } else {
        $target.addClass('error');
      }
    },

    addRoute: function(evt) {
      evt.preventDefault();

      var formAttrs = this.getAttrs(),
          data = {
            start: _.find(B.stations, function(s) { return s.name === formAttrs.start; }),
            end:   _.find(B.stations, function(s) { return s.name === formAttrs.end; })
          };

      if (data.start && data.end && data.start !== data.end) {
        // Reset the form
        this.el.reset();

        this.$('input').removeClass('error');

        // Save the route to local storage
        this.collection.create(data);
      }
    }
  });

  $(function(){
    var routeCollection = new B.RouteList(),
        addRouteView = new B.AddRouteView({
          el: '#add-route-form',
          collection: routeCollection
        }),
        routeListView = new B.RouteListView({
          el: '#route-list',
          collection: routeCollection
        });

    routeCollection.fetch();

    $('.station').typeahead({source: _.pluck(B.stations, 'name') });

    // init pietimer
    $('.timer').each(function(){
      $(this).pietimer({
        seconds: 5,
        sliceColor: data.sliceColor
      }).pietimer('start');
    });
  });

})(Baldwin, jQuery);