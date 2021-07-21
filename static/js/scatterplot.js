// Set the dimensions and margins of the graph
var margin = {top: 30, right: 10, bottom: 30, left: 50},
	width = 800 - margin.left - margin.right,
	height = 600 - margin.top - margin.bottom;

// Select the chart object
var svg = d3.select("#my_dataviz")
	.append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		// .on("mousemove", trackMouse)
		// .on("click", trackMouse)
	.append("g")
		.attr("transform",
			"translate(" + margin.left + "," + margin.top + ")");

// Global X and Y axis
var x = d3.scaleLinear()
	.range([0, width]);

var y = d3.scaleLinear()
	.range([height, 0]);

// Set global axis limits
x.domain([3.5, 14.5]);
y.domain([-1.5, 6.5]);

// Add X axis
svg.append("g")
	.attr("class", "axis")
	.attr("transform", "translate(0," + height + ")")
	.call(d3.axisBottom(x)
    	.ticks(6)
    	.tickFormat(d => "£" + d + "m")
    	.tickSize(-height)
	)
	.select(".domain").remove();

// Add Y axis
svg.append("g")
	.attr("class", "axis")
	.call(d3.axisLeft(y)
		.ticks(6)
		.tickSize(-width)
	)
	.select(".domain").remove();

// Add Y axis label & other labels
axisLableY();
percentileLabels();
addLegend();
// addInfoButton();

// Set a global active season TODO: dynamic
var season = 20;


function updateChart() {
	// Read in data
	d3.csv('xpts.csv')
		.then(createChart)
		.catch(err => {
			console.log(err)
		});
};

function createChart(data) {
	// console.log(data)

    var history = data.filter(filterNonActiveSeason);
    var current = data.filter(filterActiveSeason);
    var teams = d3.group(current, d => d.team);
    var activeTeam = d3.select("#selectTeam").property("value");
    var showHistory = d3.select("#showHistory").property("checked");

    // Check if we are filtering on a team
    if (!(activeTeam == "" || activeTeam == "(All Teams)")) {
    	// console.log(current)
    	// console.log(activeTeam)
    	var current = current.filter(filterSelectedTeam);
    	var history = history.filter(filterSelectedTeam);

	    // createScatter({
	    // 	"data": history,
	    // 	"type": "history"
	    // });
	};

   	// Populate buttons
	populateSelectTeamButton(teams);
	populateSelectPlayerButton(current);

	var highlightPlayer = current.filter(filterSelectedPlayer);
	var current = current.filter(filterRemoveSelectedPlayer)

	// Add the percentile line
	addPercentileLine(data);

	// Plot past seasons if checkbox is ticked, if not remove any
	if (showHistory) {
		createScatter({
    		"data": history,
    		"type": "history"
    	});

    	d3.selectAll(".dots").filter(".history").lower()
	} else {
    	d3.selectAll(".dots").filter(".history").remove()
	};

    createScatter({
    	"data": current,
    	"type": "current"
    });
    createScatter({
    	"data": highlightPlayer,
    	"type": "highlight"
    });

    // Add chart elements
	addPriceLines(data);
    addDataLabel(highlightPlayer);

};


function createScatter(d) {
	// console.log(d)

	var data = d["data"];
	var dtype = d["type"];
	// console.log(dtype)
	// console.log(data)

	// seems that we need to manually remove dots to avoid layering due to update func
	// svg.selectAll(".dots").filter("." + dtype).remove();

	svg.selectAll(".dots").filter("." + dtype)
		.data(data)
		.join(
			enter => enter.append("circle")
				.attr("class", function(d) {
					if (dtype == "current") {
						return "dots current " + d["group_color"] + " p" + d["player_id"];
					} else if (dtype == "history") {
						return "dots history " + "p" + d["player_id"];
					} else {
						return "dots highlight " + d["group_color"] + " p" + d["player_id"];
					}
				})
				.attr("cx", function(d) {
					return x(d["value"]);
				})
				.attr("cy", function(d) {
					return y(d["xpts_90"]);
				})
				.attr("r", 6)
				.on("mouseover", mouseover)
	        	.on("mouseout", mouseout)
	        	.on("click", mouseclick), 
			update => update
				.attr("class", function(d) {
					if (dtype == "current") {
						return "dots current " + d["group_color"] + " p" + d["player_id"];
					} else if (dtype == "history") {
						return "dots history " + "p" + d["player_id"];
					} else {
						return "dots highlight " + d["group_color"] + " p" + d["player_id"];
					}
				})
				.attr("cx", function(d) {
					return x(d["value"]);
				})
				.attr("cy", function(d) {
					return y(d["xpts_90"]);
				})
				.attr("r", 6)
				.on("mouseover", mouseover)
	        	.on("mouseout", mouseout)
	        	.on("click", mouseclick),
			exit => exit
				.remove()
		)
};

function addPriceLines(d) {
	// seems that we need to manually remove dots to avoid layering due to update func
	// svg.selectAll(".priceLines").remove();

	// Sort the data based on season
	d.sort(function(a, b) { return a.season - b.season; });
	
	// Group the data by price group
	var data = d3.group(d, d1 => "p" + d1.player_id);
	// console.log(data)

	var lineGen = d3.line()
		.x(function(d1) { return x(d1["value"]) })
		.y(function(d1) { return y(d1["xpts_90"]) });

	data.forEach(function(d1, k) {

		if (d1.length > 1) {
			// console.log(d1[1])
			// Plot the percentile line
		  	svg.selectAll(".priceLines").filter("." + k)
		  		.data(d1)
		  		.join(
		  			enter => enter.append("path")
		  				.datum(d1)
		  				.attr("d", lineGen(d1))
			    		.attr("class", "priceLines " + k)
			    		.attr("opacity", 0),
			    	update => update
			    		.datum(d1)
			    		.attr("d", lineGen(d1))
			    		.attr("class", "priceLines " + k)
			    		.attr("opacity", 0),
			    	exit => exit
			    		.remove()
	  		)
		};
	});
	// Ensure lines are below other elements
	d3.selectAll(".priceLines").lower()
};

function addPercentileLine(d) {
	// console.log(d)

	// Sort the data based on value (avg_price)
	d.sort(function(a, b) { return a.value - b.value; }); 
	
	// Group the data by price group
	var data = d3.group(d, d1 => d1.value_group);	
  	var percentileLine = new Array();

  	// Percentile line - for each price group
  	data.forEach(function(d1, k){
  		// d1 are the valiues, k is the key
    	// sorting needed for quantiles
    	d1.sort(function(a, b) {
      		return a.xpts_90 - b.xpts_90;
    	});

    	percentileLine.push({
        	"x": parseFloat(k),
        	"y": d3.quantile(d1, .8, d2 => d2.xpts_90),
        	"z": d1.length
     	});
  	});

  	// Plot the percentile line
  	svg.selectAll(".percentileLine")
  		.data(percentileLine)
  		.join(
  			enter => enter.append("path")
  				.datum(percentileLine)
  				.attr("d", d3.line()
		        	.curve(d3.curveBasis)
		        	.x(function(d1) { return x(d1["x"]) })
		        	.y(function(d1) { return y(d1["y"]) })
	    		)
	    		.attr("class", "percentileLine"),
	    	update => update
	    		.datum(percentileLine)
	    		.attr("d", d3.line()
		        	.curve(d3.curveBasis)
		        	.x(function(d1,i) { return x(d1["x"]) })
		        	.y(function(d1,i) { return y(d1["y"]) })
	    		)
	    		.attr("class", "percentileLine"),
	    	exit => exit
	    		.remove()
  		)
};

function addDataLabel(d) {
	// console.log(d)

	svg.selectAll(".dataLabel")
		.data(d)
		.join(
			enter => enter.append("text")
				.attr("class", "dataLabel")
				.attr("x", function(d1) { return x(d1["value"]) - 0 })
				.attr("y", function(d1) { return y(d1["xpts_90"]) - 12 })
				.text(function(d1) { return d1["web_name"] })
				.raise(),
			update => update
				.attr("class", "dataLabel")
				.attr("x", function(d1) { return x(d1["value"]) - 0 })
				.attr("y", function(d1) { return y(d1["xpts_90"]) - 12 })
				.text(function(d1) { return d1["web_name"] })
				.raise(),
			exit => exit
				.remove()
		)
};

function axisLableY() {
	svg.append("text")
		.attr("class", "yLabel")
	    .attr("y", 0)
	    .attr("x", -43)
	    // .attr("transform", "rotate(-90)")
	    .text("xPTS");

	svg.append("text")
		.attr("class", "yLabel")
	    .attr("y", 15)
	    .attr("x", -50)
	    // .attr("transform", "rotate(-90)")
	    .text("per 90");
};

function percentileLabels() {
	var y_offset = .82  // use to manually adjust height
	var xcoord = 13.2;  // manually adjust
	var ycoord = 3.2 + y_offset;  // manually adjust
	var rot = 12;  // manually adjust

	svg.append("text")
    	.attr("y", function(){ return y(ycoord) })  
    	.attr("x", function(){ return x(xcoord) })
    	.attr("class", "percentileLabel")
    	.attr("transform", "rotate(-" + rot + "," + x(xcoord) + "," + y(ycoord) +")")
    	.text("80th percentile");

    // Arrow annotations
  	var arrowLines = [
     	[
        	{"x": 13.8, "y": 3.7 + y_offset},
        	{"x": 13.8, "y": 4.2 + y_offset},
        	{"x": 13.6, "y": 4.5 + y_offset}
      	],
      	[
        	{"x": 13.8, "y": 3.2 + y_offset},
        	{"x": 13.8, "y": 2.6 + y_offset},
        	{"x": 13.6, "y": 2.3 + y_offset}
      	]
  	];

  	for (var i = 0; i < arrowLines.length; i++) {
    	svg.append("path")
        	.datum(arrowLines[i])
        	.attr("d", d3.line()
          		.curve(d3.curveBasis)
          		.x(function(d,j) { return x(arrowLines[i][j]["x"]) })
          		.y(function(d,j) { return y(arrowLines[i][j]["y"]) })
        	)
        	.attr("class", "percentileArrowLine")
  	};

  	var triangle = d3.symbol()
        .type(d3.symbolTriangle)
        .size(20);

  	svg.append("path")
        .attr("d", triangle)
        .attr("class", "percentileArrow")
        .attr("transform", function(d) {
            return "translate(" + x(arrowLines[0][2]["x"]) + "," + y(arrowLines[0][2]["y"]) + ")rotate(80)";
        });

  	svg.append("path")
        .attr("d", triangle)
        .attr("class", "percentileArrow")
        .attr("transform", function(d) {
			return "translate(" + x(arrowLines[1][2]["x"]) + "," + y(arrowLines[1][2]["y"]) + ")rotate(90)";
        });

    svg.append("text")
    	.attr("y", function(){ return y(4.65 + y_offset)})
    	.attr("x", function(){ return x(13)})
    	.attr("class", "percentileLabel")
    	.text("Value Pick");

  	svg.append("text")
    	.attr("y", function(){ return y(2.05 + y_offset)})
    	.attr("x", function(){ return x(13)})
    	.attr("class", "percentileLabel")
    	.text("Cost Pick");
};

function addLegend() {
	var legendWidth = width/2.5;
	var legendHeight = height/20;

	svg.append("rect")
    	.attr("class", "legend legengBG")
    	.attr("x", width/2 - (legendWidth/2))  // to get center shift by half of width
    	.attr("y", 15)
     	.attr("width", legendWidth)
    	.attr("height", legendHeight)
    	.attr('fill', '#2C363F');

  	svg.append("text")
    	.attr("class", "legend legengPriceLow")
     	.attr("x", width/2 - (legendWidth/2)+10)
     	.attr("y", 25)
     	.text("<£5.5m");

  	svg.append("text")
	     .attr("class", "legend legengPriceMid1")
	     .attr("x", width/2 - (legendWidth/2)+60)
	     .attr("y", 25)
	     .text("£5.5m - £7.5m");

  	svg.append("text")
	     .attr("class", "legend legengPriceMid2")
	     .attr("x", width/2 - (legendWidth/2)+150)
	     .attr("y", 25)
	     .text("£7.5m - £10m");

  	svg.append("text")
	     .attr("class", "legend legengPriceHigh")
	     .attr("x", width/2 - (legendWidth/2)+235)
	     .attr("y", 25)
	     .text("£10m+");

	svg.append("text")
	     .attr("x", width/2)
	     .attr("y", 60)
	     .attr("font-size", "12px")
	     .attr('fill', "grey")
	     .style("text-anchor", "middle")
	     .text("Players with 900+ mins. Click on a player to see their history.");
};

function mouseclick(event, d) {
	// console.log(event.x)
	// console.log(d['value'])
	// console.log(d3.select(this).attr("class"))
	// console.log(event.target.classList)

	var currentClass = d3.select(this).attr("class").split(" ");
	var selectedPlayer = currentClass[currentClass.length - 1];

	d3.selectAll(".dots")
		.style("opacity", .1);

	d3.selectAll(".dataLabel")
     	.style("opacity", .1);

	d3.selectAll(".dots" ).filter("." + selectedPlayer)
		.style("opacity", 1);

	d3.selectAll(".priceLines").filter("." + selectedPlayer)
      	// .transition()
      	// .duration(200)
      	.style("opacity", 1);

    // Add lines + labels of dot position against axis
    svg.append("line")
			.attr("class", "mouseLine mouseLinesX")
			.attr("x1", x(d["value"]))
			.attr("x2", x(3.8))
			.attr("y1", y(d["xpts_90"]))
			.attr("y2", y(d["xpts_90"]))

	svg.append("line")
			.attr("class", "mouseLine mouseLinesY")
			.attr("x1", x(d["value"]))
			.attr("x2", x(d["value"]))
			.attr("y1", y(-1.3))
			.attr("y2", y(d["xpts_90"]))

	svg.append("text")
		.attr("class", "mouseLabel mouseLabelX")
		.attr("x", x(d["value"]))
		.attr("y", height)
		.text("£" + parseFloat(d["value"]).toFixed(1) + "m"),

	svg.append("text")
		.attr("class", "mouseLabel mouseLabelY")
		.attr("x", x(3.5))
		.attr("y", y(d["xpts_90"]))
		.text(parseFloat(d["xpts_90"]).toFixed(1)),

	svg.selectAll(".mouseLine").lower()
};

function mouseover(event, d) {
	// console.log(event.x)
	// console.log(d)
	// console.log(d3.select(this).attr("class"))
	// console.log(event.target.classList)

	var currentClass = d3.select(this).attr("class");

	d3.select(event.currentTarget)
		.style("stroke", "white")
		.style("stroke-width", 1)

	// Add the data label
	svg.append("text")
		.attr("class", "hoverLabel")
		.attr("x", x(d["value"]) - 0)
		.attr("y", y(d["xpts_90"]) - 12)
		.text(function() {
			if (d.season == season) {
				return d.web_name;
			} else {
				return d.web_name + " '" + d.season;
			} 
		});

	// Bring dot to front
	d3.select(this).raise()

};

function mouseout(event, d) {
	
	var currentClass = d3.select(this).attr("class").split(" ");
	var selectedPlayer = currentClass[currentClass.length - 1];
	
	// Reset styling
	d3.select(event.currentTarget)
		.style("stroke", "")
		.style("stroke-width", "");

	// Remove the data label
	svg.selectAll(".hoverLabel").remove();

	// Move dot to back  (only if secondary data) -- Not sure if working properly
	// if (currentClass.indexOf("history") === -1) {
	// 	// -1 means not found, otherwise an INT is returned
	// 	d3.select(this).lower()
	// };

	// Hide price lines
	d3.selectAll(".priceLines" ).filter("." + selectedPlayer)
      // .transition()
      // .duration(200)
      .style("opacity", 0);

    // Show all "current" dots again
    d3.selectAll(".dots").filter(".current")
		.style("opacity", 1);

	// Show highlighted player dots again
    d3.selectAll(".dots").filter(".highlight")
		.style("opacity", 1);

	// Hide history dots again
    d3.selectAll(".dots").filter(".history")
		.style("opacity", "");

	// Show highlight label again
    d3.selectAll(".dataLabel")
		.style("opacity", 1);

	// Remove all mouselines
	svg.selectAll(".mouseLine").remove()
	svg.selectAll(".mouseLabel").remove()
	
};

function trackMouse(event) {

	var coords = d3.pointer(event);

	svg.selectAll(".mouseLinesX")
		.data(coords)
		.join(
			enter => enter.append("line")
				.attr("class", "mouseLinesX")
				.attr("x1", coords[0] - margin.left)
				.attr("x2", 20)
				.attr("y1", coords[1] - margin.top)
				.attr("y2", coords[1] - margin.top),
			update => update
				.attr("class", "mouseLinesX")
				.attr("x1", coords[0] - margin.left)
				.attr("x2", 20)
				.attr("y1", coords[1] - margin.top)
				.attr("y2", coords[1] - margin.top),
			exit => exit
				.remove()
		)

	svg.selectAll(".mouseLinesY")
		.data(coords)
		.join(
			enter => enter.append("line")
				.attr("class", "mouseLinesY")
				.attr("x1", coords[0] - margin.left)
				.attr("x2", coords[0] - margin.left)
				.attr("y1", height - 12)
				.attr("y2", coords[1] - margin.top),
			update => update
				.attr("class", "mouseLinesY")
				.attr("x1", coords[0] - margin.left)
				.attr("x2", coords[0] - margin.left)
				.attr("y1", height - 12)
				.attr("y2", coords[1] - margin.top),
			exit => exit
				.remove()
		)

	svg.selectAll(".mouseLabelX")
		.data(coords)
		.join(
			enter => enter.append("text")
				.attr("class", "mouseLabelX")
				.attr("x", coords[0] - margin.left)
				.attr("y", height)
				.text("£" + x.invert(coords[0] - margin.left).toFixed(1) + "m"),
			update => update
				.attr("class", "mouseLabelX")
				.attr("x", coords[0] - margin.left)
				.attr("y", height)
				.text("£" + x.invert(coords[0] - margin.left).toFixed(1) + "m"),
			exit => exit
				.remove()
		)

	svg.selectAll(".mouseLabelY")
		.data(coords)
		.join(
			enter => enter.append("text")
				.attr("class", "mouseLabelY")
				.attr("x", 0)
				.attr("y", coords[1] - margin.top)
				.text(y.invert(coords[1] - margin.left).toFixed(1)),
			update => update
				.attr("class", "mouseLabelY")
				.attr("x", 0)
				.attr("y", coords[1] - margin.top)
				.text(y.invert(coords[1] - margin.top).toFixed(1)),
			exit => exit
				.remove()
		)

};

function filterActiveSeason(d, i) {
	if (d['season'] == season) {
		return d;
	};
};

function filterNonActiveSeason(d, i) {
	if (d['season'] != season) {
		return d;
	};
};

function filterSelectedTeam(d, i) {
	// Get values of buttons
	var selectedTeam = d3.select("#selectTeam").property("value");

	if (d['team'] == selectedTeam) {
		return d;
	};
};

function filterSelectedPlayer(d, i) {
	// Get values of buttons
	var selectedPlayer = d3.select("#selectPlayer").property("value");

	if (d['player_id'] == selectedPlayer) {
		return d;
	};
};

function filterRemoveSelectedPlayer(d, i) {
	// Get values of buttons
	var selectedPlayer = d3.select("#selectPlayer").property("value");

	if (d['player_id'] != selectedPlayer) {
		return d;
	};
};

function clearDropDown(d) {
	try {
		d.selectAll("option").remove()
	}
	catch(err) {
		console.log("no dropdown menu");
	};
};

function populateSelectPlayerButton(d) {
	// Sort values alphabetically
	d.sort(function(a, b) { return d3.ascending(a.web_name, b.web_name); });

	// Store current value first, first load this will be blank => set to custom player
	var defaultSelection = d3.select("#selectPlayer").property("value");
	if (defaultSelection == "") {
		defaultSelection = "61366"  // De Bruyne
	};	

	// clear existing options first
	clearDropDown(d3.select("#selectPlayer"))

	// add the options to the button
	d3.select("#selectPlayer")
	    .selectAll("myOptionsPlayer")
	    .data(d)
	    .enter()
	    .append('option')
	    .text(function (d1) { return d1.web_name; })  // text showed in the menu
	    .attr("value", function (d1) { return d1.player_id; })  // corresponding value returned by the button
	    .property("selected", function(d1) { return d1.player_id === defaultSelection })  // default value

	    // .join(
	    // 	enter => enter.append("option")
	    // 		.text(function (d1) { return d1.web_name; })
	    // 		.attr("value", function (d1) { return d1.player_id; })
	    // 		.property("selected", function(d1) { return d1.player_id === defaultSelection }),
	    // 	update => update
	    // 		.text(function (d1) { return d1.web_name; })
	    // 		.attr("value", function (d1) { return d1.player_id; })
	    // 		.property("selected", function(d1) { return d1.player_id === defaultSelection }),
	    // 	exit => exit
	    // 		.remove()
	    // )

	// console.log(d3.selectAll("#selectPlayer option"))
	// console.log(d3.select("#selectPlayer").property("value"))
};

function populateSelectTeamButton(d) {
	// Extract team names only
	var team_names = [];
	for ([key, value] of d) {
		team_names.push(key);
	}

	// Sort values alphabetically
	team_names.sort(d3.ascending);

	// Add an "All Teams" selection
	team_names.unshift("(All Teams)")

	// Store current value first
	var defaultSelection = d3.select("#selectTeam").property("value");
	if (defaultSelection == "") {
		defaultSelection = "(All Teams)"
	};	

	// clear existing options first
	clearDropDown(d3.select("#selectTeam"))

	// add the options to the button
	d3.select("#selectTeam")
	    .selectAll("myOptionsTeam")
	    .data(team_names)
	    .enter()
	    .append('option')
	    .text(function (d1) { return d1; })  // text showed in the menu
	    .attr("value", function (d1) { return d1; })  // corresponding value returned by the button
	    .property("selected", function(d1) { return d1 === defaultSelection })  // default value
};

function addInfoButton() {
	var mouseOnInfo = function(d){

	    d3.selectAll(".infoCircle")
	        .transition()
	        .style("stroke", "white");

	    d3.selectAll(".infoButton")
	        .transition()
	        .style("fill", "white");

	    d3.selectAll(".infoRect")
	        .transition()
	        .style("opacity", .92);

	    d3.selectAll(".infoText")
		    .transition()
		    .style("opacity", 1);

	    d3.selectAll(".dots")
	        .transition()
	        .style("opacity", 0.06);

	    d3.selectAll(".percentileLine")
	        .transition()
	        .style("opacity", 0);

	    d3.selectAll(".dataLabel")
	        .transition()
	        .style("opacity", 0.06);

	    d3.selectAll(".legend")
	        .transition()
	        .style("opacity", 0.1);

	   	d3.selectAll(".infoAnno")
	        .transition()
	        .style("fill", "white");

	};

  	var mouseOutInfo = function(d){

    	d3.selectAll(".infoCircle")
	        .transition()
	        .style("stroke", "grey");

    	d3.selectAll(".infoButton")
      		.transition()
      		.style("fill", "grey");

	    d3.selectAll(".infoRect")
	      	.transition()
	      	.style("opacity", 0);

	    d3.selectAll(".infoText")
	      	.transition()
	      	.style("opacity", 0);

	    d3.selectAll(".dots")
	      	.transition()
	      	.style("opacity", 1);

	  	d3.selectAll(".percentileLine")
	        .transition()
	        .style("opacity", 1);

	    d3.selectAll(".dataLabel")
	      	.transition()
	      	.style("opacity", 1);

	    d3.selectAll(".legend")
	      	.transition()
	      	.style("opacity", 1);

	   	d3.selectAll(".infoAnno")
	        .transition()
	        .style("fill", "");
  };

	// Add rectangle as background
	svg.append("rect")
	    .attr("class", "infoRect")
	    .attr("x", 33)
	    .attr("y", 35)
	    .attr("width", 500)
	    .attr("height", 480);

	// Add circle around button
	svg.append("circle")
	    .attr("class", "infoCircle")
	    .on("mouseover", mouseOnInfo )
	    .on("mouseleave", mouseOutInfo);

	// Add "i" label
	svg.append("text")
	    .attr("class", "infoButton")
	    .attr("x", 33)
	    .attr("y", 37)
	    .text("i")
	    .on("mouseover", mouseOnInfo )
	    .on("mouseleave", mouseOutInfo);

	svg.append("text")
	    .attr("class", "infoAnno")
	    .attr("x", 40)
	    .attr("y", 20)
	    .text("what are xPTS?")

	svg.append("path")
	    .attr("class", "infoAnnoLine")
	    .datum([{"x": 4.3, "y": 6}, {"x": 4.45, "y": 6}, {"x": 4.6, "y": 6.16}])
	    .attr("d", d3.line()
	      .curve(d3.curveBasis)
	      .x(function(d,j) { return x(d["x"]) })
	      .y(function(d,j) { return y(d["y"]) })
	    );
};

// When the button is changed, run the updateChart function
d3.select("#selectPlayer").on("change", function(d) {
	updateChart()
});

// When the button is changed, run the updateChart function
d3.select("#selectTeam").on("change", function(d) {
	updateChart()
});

// When the button is changed, run the updateChart function
d3.select("#showHistory").on("change", function(d) {
  updateChart()
});

updateChart()

