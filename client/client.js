// client: start a vehicles subscription
// Meteor.subscribe("vehicles");

var width  = 1600,
    height = 1160;

// Subscribe to 'lists' collection on startup.
// Select a list once data has arrived.
var vehiclesHandle = Meteor.subscribe('vehicles', function () {
  var handle = Vehicles.find({}).observeChanges({
    changed: function (id, fields) {
      console.log('changed vehicles: id: ' + id);
      console.log(fields);      

      var projection = d3.geo.albers()
        .center([0, 21.4667])
        .rotate([157.9, 0])
        .parallels([15, 25])
        .scale(130000)
        .translate([width / 2, height / 2]);

      var svg = d3.select("svg");

      var circles = svg.selectAll("circle")
        .data(Vehicles.find().fetch(), function (vehicle) { return vehicle._id; });
      var moved = circles.filter(function (d, i) {
        return d._id === id;
      });
      var transition = svg.transition().duration(1000);
      moved
        .transition()
        .attr("transform", function(d) {
          console.log('moving d ->');
          console.log(d);
          return "translate(" + projection([d.longitude, d.latitude]) + ")";
        });

      // circles.exit()
      //     .transition()
      //     .duration(250)
      //     .attr("r", 0)
      //     .remove();
    }
  });
});

// var query = Vehicles.find({});
// var handle = query.observeChanges({
//   changed: function (id, fields) {
//     console.log("change");
//   }
// });

///////////////////////////////////////////////////////////////////////////////
// Map display

Template.map.rendered = function () {
  var self = this;
  self.node = self.find("svg");
  var svg = d3.select("svg");

  // Define the projection:
  // Hawaii: 19.5667° N, 155.5000° W
  // All of Hawaii's Islands:
  // var projection = d3.geo.albers()
  //   .center([0, 20.1])
  //   .rotate([157.6, 0])
  //   .parallels([15, 25])
  //   .scale(15000)
  //   .translate([width / 2, height / 2]);

  // Only O‘ahu:
  var projection = d3.geo.albers()
    .center([0, 21.4667])
    .rotate([157.9, 0])
    .parallels([15, 25])
    .scale(130000)
    .translate([width / 2, height / 2]);

  Deps.autorun(function () {
    // Data join
    var circles = svg.selectAll("circle")
      .data(Vehicles.find().fetch(), function (vehicle) { return vehicle._id; });

    circles
      .enter()
        .append("circle")
        .attr("r",5)
        .attr("transform", function(d) {return "translate(" + projection([d.longitude,d.latitude]) + ")";});
  });

  // Draw routes
  if (! self.handle) {
    self.handle = Deps.autorun(function () {

      var drawTopo = function( topo_json, feature_class ) {

        // Define path generator:
        var path = d3.geo.path()
          .projection(projection)
          .pointRadius(2);

        // Add state path:
        svg.append("path")
          .datum(topo_json)
          .attr("class", "path_defaults "+feature_class)
          .attr("d", path);
      };

      var geojson_tag_from_data_url = function(data_url) {
        var file = _.last(data_url.split("/"));
        return _.first(file.split("_topo.json")) + "_geo";
      };

      var load_dataset = function(dataset) {
        var data_url = dataset["data_url"];
        d3.json(data_url, function(topo_data) {
          // Convert back to GeoJSON:
          var geojson_tag = geojson_tag_from_data_url(data_url);
          var json = topojson.object(topo_data, topo_data.objects[geojson_tag]);
          drawTopo(json, dataset["feature_class"]);
        });
      };

      var datasets = [
        // { 
        //   "data_url": "data/oah_streets_topo.json",
        //   "feature_class": "streets",
        //   "color": "white",
        //   "circa": "2008" },
        { 
          "data_url": "data/bus_topo.json",
          "feature_class": "bus_routes",
          "color": "orange",
          "circa": "2006" }
          // ,
        // { 
        //   "data_url": "data/darstreams_topo.json",
        //   "feature_class": "rivers",
        //   "color": "steelblue",
        //   "circa": "2005" },
        // { 
        //   "data_url": "data/sewer_main_topo.json",
        //   "feature_class": "sewer_main",
        //   "color": "brown",
        //   "circa": "2008" },
        // { 
        //   "data_url": "data/sewer_lateral_topo.json",
        //   "feature_class": "sewer_lateral",
        //   "color": "yellow",
        //   "circa": "2008" },
        // { 
        //   "data_url": "data/sewer_offshore_topo.json",
        //   "feature_class": "sewer_offshore",
        //   "color": "red",
        //   "circa": "2002" }
      ];

      var task = function(data_idx) {
        return function(callback) {
          load_dataset(datasets[data_idx]);
          // first argument is error reason, second is result
          callback(null);
        }
      }

      var create_legend = function(data){
        var legend = svg.append("g")
          .attr("class", "legend")
          .attr("x", 20)
          .attr("y", 25)
          .attr("height", 100)
          .attr("width", 100);

        var legend_enter = legend.selectAll('rect')
          .data(data)
          .enter()
          .append("rect")
            .attr("x", 20)
            .attr("y", function(d, i){ return i * 20 + 20;})
            .attr("width", 30)
            .attr("height", 10)
            .attr("class", "legend_rect")
            .style("fill", function(d, i) { 
               return d["color"];
            })
            .style("cursor", "pointer")
          .on("click", function(d) {
            var feature_class = "."+d["feature_class"];
            var is_hidden = d3.select(feature_class).style("display") === "none";

            // toggle it
            d3.selectAll(feature_class).style("display", is_hidden ? "block" : "none");
            d3.select(this).style("fill-opacity", is_hidden ? 1 : 0);
          });
            
        legend.selectAll("text")
          .data(data)
          .enter()
          .append("text")
            .text(function(d) {
              return d["feature_class"]+" [~"+d["circa"]+"]";
            })
            .attr("x", 60)
            .attr("y", function(d, i){ return i * 20 + 30;})
            .attr("font-family", "sans-serif")
            .attr("font-size", "11px")
            .attr("fill", "white");
      };

      var q = queue(4);
      var tasks = _.map(_.range(datasets.length), task);
      _.each(tasks, function(t) { q.defer(t); });

      // create legend
      create_legend(datasets);
    });
  }
};