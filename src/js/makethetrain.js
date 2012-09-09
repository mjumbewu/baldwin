var MakeTheTrain = MakeTheTrain || {};

(function(M, $){
  M.myTrip = [
    {
      name: '',
      start: '',
      end: ''
    }
  ];

  $('.station').typeahead({source: M.stations});


})(MakeTheTrain, jQuery);