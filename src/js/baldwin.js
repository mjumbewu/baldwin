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
        this.sort();
      }
    },

    initialize: function() {
      // Get the current location
      //navigator.geolocation.getCurrentPosition(_.bind(this.setPosition, this));
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
      this.collection.on('add', this.render, this);
      this.collection.on('remove', this.render, this);

      this.routeViews = {};
    },
    render: function(){
      var self = this;
      this.routeViews = {};

      if (this.collection.size() === 0) {
        this.$el.closest('.results-box').addClass('empty');
        this.$el.html(ich['no-routes-template']());
      } else {
        this.$el.closest('.results-box').removeClass('empty');
        this.$el.empty();
        this.collection.each(function(model){
          self.routeViews[model.cid] = new B.RouteView({ model: model });
          self.$el.append(self.routeViews[model.cid].render().$el);
        });
      }

      return this;
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

    splitTime: function(timeStr) {
      if (!_.isUndefined(timeStr)) {
        timeStr = $.trim(timeStr);
        return {
            meridian: timeStr.slice(-2).toLowerCase(),
            hours: timeStr.slice(0, timeStr.indexOf(':')),
            minutes: timeStr.slice(timeStr.indexOf(':')+1, -2),
            time: timeStr.slice(0, -2)
        };
      }
    },

    minsToDepartureTime: function(time) {
      var date = new Date();
      //account for DST
      date.toLocaleString();
      var calcDate = new Date();
      //account for DST
      calcDate.toLocaleString();

      // parse 12hr time string into 24hr.
      // KNOWN ISSUE: This will need to take into account rollover into the next day
      if (time.meridian=='pm') {
          time.hours = (time.hours=='12') ? '12' : parseInt(time.hours, 10)+12 ;
      }
      else if(time.hours.length<2) {
          time.hours = '0' + time.hours;
      }
      //pull parsed string into time obj
      calcDate.setHours(time.hours);
      calcDate.setMinutes(time.minutes);
      //return time compareed to now, converted to minutes from milliseconds
      return Math.floor(((calcDate-date)/1000)/60);
    },

    renderTrip: function(trip) {
      var data = _.extend({}, trip),
          origDelay = parseInt(data.orig_delay, 10),
          termDelay = parseInt(data.term_delay, 10),
          lateLabel = " late";

      //split times for styling and parsability
      data.orig_departure_time = this.splitTime(data.orig_departure_time);
      data.orig_arrival_time = this.splitTime(data.orig_arrival_time);
      data.term_depart_time = this.splitTime(data.term_depart_time);
      data.term_arrival_time = this.splitTime(data.term_arrival_time);

      //default color and time to on-time departure
      data.slice_color = [];
      data.mins_to_dep = [];

        if (data.isdirect == "false") {
          data.trip_class = 'multi-leg';
        }

        if (origDelay > 0 && origDelay <= 5) {
          data.orig_alert_class = 'status-delayed';
          data.orig_delay = data.orig_delay + lateLabel;
          data.mins_to_dep.push(this.minsToDepartureTime(data.orig_departure_time) + origDelay);
          data.slice_color.push('#ffd71c');
        } else if (origDelay > 5) {
          data.orig_alert_class = 'status-late';
          data.orig_delay = data.orig_delay + lateLabel;
          data.mins_to_dep.push(this.minsToDepartureTime(data.orig_departure_time) + origDelay);
          data.slice_color.push('#ff4328');
        } else if (isNaN(origDelay)) {
          data.orig_alert_class = 'status-ontime';
          data.slice_color.push('#45ff5d');
          data.mins_to_dep.push(this.minsToDepartureTime(data.orig_departure_time));
        }

        if (!_.isUndefined(data.term_depart_time)) {
          if (termDelay > 0 && termDelay <= 5) {
            data.term_alert_class = 'status-delayed';
            data.term_delay = data.term_delay + lateLabel;
            data.mins_to_dep.push(this.minsToDepartureTime(data.term_depart_time) + termDelay);
            data.slice_color.push('#ffd71c');
          } else if (termDelay > 5) {
            data.term_alert_class = 'status-late';
            data.term_delay = data.term_delay + lateLabel;
            data.mins_to_dep.push(this.minsToDepartureTime(data.term_depart_time) + termDelay);
            data.slice_color.push('#ff4328');
          } else if (isNaN(termDelay)) {
            data.term_alert_class = 'status-ontime';
            data.slice_color.push('#45ff5d');
            data.mins_to_dep.push(this.minsToDepartureTime(data.term_depart_time));
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

      var formAttrs = this.getAttrs(),
          data = {
            start: _.find(B.stations, function(s) { return s.name === formAttrs.start; }),
            end:   _.find(B.stations, function(s) { return s.name === formAttrs.end; })
          };

      // Reset the form
      this.el.reset();

      // Save the route to local storage
      this.collection.create(data);
    }
  });

  var routeCollection = new B.RouteList(),
      addRouteView = new B.AddRouteView({
        el: '#add-route-form',
        collection: routeCollection
      }),
      routeListView = new B.RouteListView({
        el: '#route-list',
        collection: routeCollection
      });


  $(function(){
    routeCollection.fetch();
  });

  $('.station').typeahead({source: _.pluck(B.stations, 'name') });

      //init pietimer
   $('.timer').each(function(){
        $(this).pietimer({
            seconds: 5,
            sliceColor: data.sliceColor
        }).pietimer('start');
   });

})(Baldwin, jQuery);