var Baldwin = Baldwin || {};

(function(B, $){
  B.myTrip = [
    {
      name: '',
      start: 'Narberth',
      end: 'Market East'
    }
  ];

  $('.station').typeahead({source: B.stations});


})(Baldwin, jQuery);