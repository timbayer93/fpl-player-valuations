
// set the dimensions and margins of the graph
var margin = {top: 10, right: 30, bottom: 30, left: 60},
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

// append the svg object to the body of the page
var ValuationPlot = d3.select("#my_dataviz")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");


var colors = ['#1f77b4', '#6D597A', '#E56B6F', '#f7b267'];

//Read the data
d3.csv("data.csv").then(function(data) {

  // List of teams for button
  var allTeams = d3.map(data, function(d){
    return(d.team_now)}).keys();

  allTeams.sort();
  allTeams.unshift("(All Teams)");

  // remove empty values or nulls
  var allTeams = allTeams.filter(Boolean);

  // add the options to the button
  d3.select("#selectButton")
      .selectAll('myOptions')
      .data(allTeams)
      .enter()
      .append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; }) // corresponding value returned by the button

  // Filter on minutes played
  var data = data.filter(function(d){
    return d.minutes >=900 & d.position > 1;
  });

  // Latest season
  var thisSeason = data.filter(function(d){
    return d.season == 2019;
  });

  // Historic data only
  var previousSeason = data.filter(function(d){
    return d.season < 2019;
  });

  // History and Current Season
  var dataHistory = data.filter(function(d){
    return d.season <= 2019;
  });

  // Group the data by player for each season
  var dataPercentiles = d3.nest()
      .key(function(d) {return d.group2;})
      .entries(previousSeason);

  // Group the data by player for each season
  var dataPlayers = d3.nest()
      .key(function(d) {return d.fpl_player_code;})
      .entries(dataHistory);

  // Add X axis
  var x = d3.scaleLinear()
    .domain([3.5, 14.5])
    .range([ 0, width ]);
  ValuationPlot.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x)
      .ticks(6)
      .tickFormat(d => "£" + d + "m")
      .tickSize(-height))
    .attr("stroke-dasharray", ("1,1"))
    .select(".domain").remove();

  // Add Y axis
  var y = d3.scaleLinear()
    .domain([-1.5, 6.5])
    .range([height, 0]);
  ValuationPlot.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y)
      .tickSize(-width))
    .attr("stroke-dasharray", ("1,1"))
    .select(".domain").remove();

  // Tooltips
  // Add a tooltip div.
  // Its opacity is set to 0: we don't see it by default.
  var tooltip = d3.select("#my_dataviz")
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "#2C363F")
    .style("border", "solid")
    .style("border-width", "0px")
    .style("border-radius", "50px")
    .style("padding", "10px")
    .style('font-size', '10px');

  var mouseover = function(d){

    selectedPlayer = d.fpl_player_code.toString()
    //console.log(selectedPlayer)

    tooltip
      .style("opacity", 1)

    d3.selectAll(".playerDot").filter(".fpl" + selectedPlayer)
      // .transition()
      // .duration(200)
      .style("stroke", "white")
      .style("stroke-width", 3)

    d3.selectAll(".aline" + selectedPlayer)
      .transition()
      .duration(200)
      .attr("stroke", "white")
      .style("opacity", 1)
  };

  var mouseleave = function(d){

    selectedPlayer = d.fpl_player_code.toString()

    tooltip
      .transition()
      .duration(200)
      .style("opacity", 0)

    d3.selectAll(".playerDot").filter(".fpl" + selectedPlayer)
      .style("stroke", "#252932")
      .style("stroke-width", 1)

    d3.selectAll(".aline" + selectedPlayer)
      .attr("stroke", "#252932")
      .style("opacity", 0)
  };

  // A function that change this tooltip when the user hover a point.
  // Set the text and position of tooltip depending on the datapoint (d)
  var mousemove = function(d) {
    var mouse = d3.mouse(d3.select("#my_dataviz").node())
      .map(function(d) {return parseInt(d)});

    tooltip
      .html(d.web_name + " | " + d.team_short_now + " | xPTS: " + Math.round(d.npxPTS_90 * 100) / 100)
      .style("left", (mouse[0] + 40) + "px")
      .style("top", (mouse[1] + 100) + "px")
      .style("opacity", 1)
  };

  // Add historic dots
  ValuationPlot.append("g")
    .selectAll("dotHistory")
    .data(previousSeason)
    .enter()
    .append("circle")
      .attr("cx", function(d) { return x(d.avg_price) } )
      .attr("cy", function(d) { return y(d.npxPTS_90) } )
      .attr("r", 5)
      .attr("fill", "grey")
      .attr("opacity", .1)

  // Loop through each player and add line
  dataPlayers.forEach(function(d) {
      var player_id = d.key.toString()

      ValuationPlot.append("path")
        .datum(d.values)
        .attr("class", function (d) {return "aline" + player_id})
        .attr("d", d3.line()
          .x(function(d) { return x(d.avg_price) })
          .y(function(d) { return y(d.npxPTS_90) })
          )
        .attr("fill", "none")
        .attr("stroke", "#252932")  // "#939393")
        .attr("stroke-width", 1.5)
        .style("opacity", 0)  // hide initally

    });

  // Percentile line
  // per price group get percentile
  var percentileLine = new Array();

  dataPercentiles.forEach(function(d){
    // sorting needed for quantiles
    d.values.sort(function(a, b) {
      return a.npxPTS_90 - b.npxPTS_90;
    });

    percentileLine.push(
      {
        "x": d.key,
        "y": d3.quantile(d.values, .8, d1 => d1.npxPTS_90),
        "z": d.values.length
      }
    );

  });

  // Sort the array to get correct path
  percentileLine.sort(function(a, b) {
    return a.x - b.x;
  });

  // Add percentile line to chart
  ValuationPlot.append("path")
    .datum(percentileLine)
    .attr("d", d3.line()
      .curve(d3.curveBasis)
      .x(function(d,i) { return x(percentileLine[i]["x"]) })
      .y(function(d,i) { return y(percentileLine[i]["y"]) })
    )
    .attr("fill", "none")
    .attr("stroke", "white")  // "#939393")
    .attr("stroke-width", 2)
    .style("stroke-dasharray", ("6, 3"));

  // Annotations
  // Color Legend: Draw the Rectangle
  var legendWidth = width/2.5;
  var legendHeight = height/20;

  var legengBG = ValuationPlot.append("rect")
     .attr("class", "legend legengBG")
     .attr("x", width/2 - (legendWidth/2))  // to get center shift by half of width
     .attr("y", 15)
     .attr("width", legendWidth)
     .attr("height", legendHeight)
     .attr('fill', '#2C363F');

  var annoPriceLow = ValuationPlot.append("text")
     .attr("class", "legend legengPriceLow")
     .attr("x", width/2 - (legendWidth/2)+10)
     .attr("y", 25)
     .attr("dominant-baseline", "hanging")
     .attr("font-size", "12px")
     .attr('fill', colors[0])
     .style("font-weight", "bold")
     .text("<£5.5m");

  var annoPriceMid1 = ValuationPlot.append("text")
     .attr("class", "legend legengPriceMid1")
     .attr("x", width/2 - (legendWidth/2)+60)
     .attr("y", 25)
     .attr("dominant-baseline", "hanging")
     .attr("font-size", "12px")
     .attr('fill', colors[1])
     .style("font-weight", "bold")
     .text("£5.5m - £7.5m");

  var annoPriceMid2 = ValuationPlot.append("text")
     .attr("class", "legend legengPriceMid2")
     .attr("x", width/2 - (legendWidth/2)+150)
     .attr("y", 25)
     .attr("dominant-baseline", "hanging")
     .attr("font-size", "12px")
     .attr('fill', colors[2])
     .style("font-weight", "bold")
     .text("£7.5m - £10m");

  var annoPriceHigh = ValuationPlot.append("text")
     .attr("class", "legend legengPriceHigh")
     .attr("x", width/2 - (legendWidth/2)+235)
     .attr("y", 25)
     .attr("dominant-baseline", "hanging")
     .attr("font-size", "12px")
     .attr('fill', colors[3])
     .style("font-weight", "bold")
     .text("£10m+");

  var annoValuePick = ValuationPlot.append("text")
     .attr("y", function(){ return y(5)})
     .attr("x", function(){ return x(13)})
     .attr("class", "percentileLabel") //easy to style with CSS
     .text("Value Pick");

  var annoCostPick = ValuationPlot.append("text")
     .attr("y", function(){ return y(2)})
     .attr("x", function(){ return x(13)})
     .attr("class", "percentileLabel") //easy to style with CSS
     .text("Cost Pick");

  var annoPercentile = ValuationPlot.append("text")
     .attr("y", function(){ return y(3.3)})
     .attr("x", function(){ return x(13.2)})
     .attr("class", "percentileLabel") //easy to style with CSS
     .attr("transform", "rotate(-20," + x(13.2) + "," + y(3.3) +")")
     .text("80th percentile");

  var annoClick1 = ValuationPlot.append("text")
     .attr("x", width/2 - 100)
     .attr("y", 65)
     .attr("font-size", "12px")
     .attr('fill', "grey")
     .style("font-weight", "bold")
     .text("Click on");

  var annoClick2 = ValuationPlot.append("text")
     .attr("x", width/2-55)
     .attr("y", 65)
     .attr("font-size", "12px")
     .attr('fill', "grey")
     .text("a player to see their history");

  var annoGK = ValuationPlot.append("text")
     .attr("x", width/2)
     .attr("y", height-10)
     .attr("font-size", "12px")
     .attr('fill', "grey")
     .style("text-anchor", "middle")
     .text("Players with 900+ mins. All data points (current and historic) are based on the 2019/20 FPL positions.");

  // Arrow annotations
  var arrowLines = [
      [
        {"x": 13.8, "y": 3.9},
        {"x": 13.8, "y": 4.5},
        {"x": 13.6, "y": 4.8}
      ],
      [
        {"x": 13.8, "y": 3.3},
        {"x": 13.8, "y": 2.7},
        {"x": 13.6, "y": 2.4}
      ]
  ];

  for (var i = 0; i < arrowLines.length; i++) {
      ValuationPlot.append("path")
        .datum(arrowLines[i])
        .attr("d", d3.line()
          .curve(d3.curveBasis)
          .x(function(d,j) { return x(arrowLines[i][j]["x"]) })
          .y(function(d,j) { return y(arrowLines[i][j]["y"]) })
        )
        .attr("fill", "none")
        .attr("stroke", "white")  // "#939393")
        .attr("stroke-width", 2)
        .attr('stroke', 'white');
  };

  var triangle = d3.symbol()
            .type(d3.symbolTriangle)
            .size(20);

  ValuationPlot.append("path")
            .attr("d", triangle)
            .attr("stroke", "white")
            .attr("fill", "white")
            .attr("transform", function(d) {
              return "translate(" + x(13.6) + "," + y(4.8) + ")rotate(80)";
             });

  ValuationPlot.append("path")
            .attr("d", triangle)
            .attr("stroke", "white")
            .attr("fill", "white")
            .attr("transform", function(d) {
              return "translate(" + x(13.6) + "," + y(2.4) + ")rotate(90)";
            });
    ;

  var annoYLabel = ValuationPlot.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "hanging")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height/2))
    .attr("dy", ".75em")
    .attr('fill', "#939393")
    .attr("transform", "rotate(-90)")
    .text("xPTS per 90 min.");

  // Info button

  var mouseOnInfo = function(d){

    d3.selectAll(".infoCircle")
      .transition()
      .duration(200)
      .attr("stroke", "white");

    d3.selectAll(".infoButton")
      .transition()
      .attr("fill", "white");

    d3.selectAll(".infoRect")
      .transition()
      .attr("opacity", .92);

    d3.selectAll(".annoClick")
      .transition()
      .attr("opacity", 0);

    d3.selectAll(".infoText")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".playerDot")
      .transition()
      .attr("opacity", 0.06);

    d3.selectAll(".playerLabels")
      .transition()
      .attr("opacity", 0.08);

    d3.selectAll(".legend")
      .transition()
      .attr("opacity", 0.1);

  };

  var mouseOutInfo = function(d){

    d3.selectAll(".infoCircle")
      .transition()
      .duration(200)
      .attr("stroke", "grey");

    d3.selectAll(".infoButton")
      .transition()
      .duration(200)
      .attr("fill", "grey");

    d3.selectAll(".infoRect")
      .transition()
      .attr("opacity", 0);

    d3.selectAll(".annoClick")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".infoText")
      .transition()
      .attr("opacity", 0);

    d3.selectAll(".playerDot")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".playerLabels")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".legend")
      .transition()
      .attr("opacity", 1);

  };

  var infoRect = ValuationPlot.append("rect")
    .attr("class", "infoRect")
    .attr("x", 33)
    .attr("y", 35)
    .attr("width", 500)
    .attr("height", 480)
    .attr("fill", "#2C363F")
    .attr("opacity", 0);

  var infoCircle = ValuationPlot.append("circle")
    .attr("class", "infoCircle")
    .attr("cx", 33)
    .attr("cy", 35)
    .attr("r", 8.5)
    .attr("fill", "#2C363F")
    .attr("stroke", "grey")
    .on("click", mouseOnInfo )
    .on("mouseleave", mouseOutInfo);

  var infoButton = ValuationPlot.append("text")
    .attr("class", "infoButton")
    .attr("x", 33)
    .attr("y", 37)
    .attr("font-size", "14px")
    .attr('fill', "grey")
    .style("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .text("i")
    .on("click", mouseOnInfo )
    .on("mouseleave", mouseOutInfo);

  var infoAnno = ValuationPlot.append("text")
    .attr("class", "infoAnno")
    .attr("x", 40)
    .attr("y", 20)
    .attr("font-size", "11px")
    .attr('fill', "grey")
    .text("what are xPTS?")

  ValuationPlot.append("path")
    .attr("class", "infoAnno")
    .datum([{"x": 4.3, "y": 6}, {"x": 4.45, "y": 6}, {"x": 4.6, "y": 6.16}])
    .attr("d", d3.line()
      .curve(d3.curveBasis)
      .x(function(d,j) { return x(d["x"]) })
      .y(function(d,j) { return y(d["y"]) })
    )
    .attr("fill", "none")
    .attr("stroke", "grey")
    .attr("stroke-width", 1);

  ValuationPlot.append("path")
    .attr("d", d3.symbol()
      .type(d3.symbolTriangle)
      .size(12))
    .attr("stroke", "grey")
    .attr("fill", "grey")
    .attr("transform", function(d) {
      return "translate(" + x(4.3) + "," + y(6) + ")rotate(30)";
     });

  var infoTexts = [
    "How to read:",
    "Expected Points (xPTS) are based on xG. A player's xG, xA and xG against (clean sheets)",
    "are multiplied based on FPL's scoring rules for each position (i.e. midfielders score 5",
    "points for a goal, 1 point for a clean sheet and 3 points for an assist). For example, a",
    "forward with 7.8 xG and 2.1 xA would have a xPTS total of (7.8 x 4) + (2.1 x 3) = 37.5.",
    "This total is then divided by the total minutes played x 90 = per 90 mins. xPTS does not",
    "consider points for minutes played, yellow cards, bonus or other scoring ways in FPL.",
    "",
    "The 80th percentile is calculated based on previous FPL seasons and xG data. Starting",
    "with the 2014/15 season up to the previous season. It can help identify 'elite' players.",
    "",
    "Value picks are those who are above the historical 80th percentile while cost picks",
    "are below. This does not mean Cost picks cannot be good in certain GWs - though",
    "across a full season better value is elsewhere.",
    "",
    "Additional Notes:",
    "The faded grey dots on the plot are players from previous seasons (starting in 2014/15).",
    "GKs are excluced as a large % of their points is generated from saves.",
    "All xPTS (current and historic) are based on a player's FPL position in 2019/20 season."
  ];

  for (var i = 0; i < infoTexts.length; i++) {

    if (i>0) {
      var ySpacing = 10;
      var boldText = "normal";
    } else {
      var ySpacing = 0;
      var boldText = "bold";
    };

    ValuationPlot.append("text")
      .attr("class", "infoText")
      .attr("x", 50)
      .attr("y", 60 + ySpacing + i*20)
      .attr("font-weight", boldText)
      .attr("font-size", "12px")
      .attr("fill", "white")
      .attr("opacity", 0)
      .text(infoTexts[i]);
  };

  
  function updateChart(selectedTeam){

    if (selectedTeam == "(All Teams)") {
      
      var dataFiltered = thisSeason;

      var dataLabels = dataFiltered.filter(function(d){
        return d.label == "True" & (d.avg_price > 8.5 || d.npxPTS_90 > 2.5) & d.web_name != "Abraham";
      });

    } else {
      
      var dataFiltered = thisSeason.filter(function(d){
        return d.team_now == selectedTeam;
      })

      var dataLabels = dataFiltered.filter(function(d){
        return d.label == "True";
      });
      
    };


    // Add dots
    var scatter = ValuationPlot.selectAll(".playerDot")
      .data(dataFiltered)
      .join(
        enter => enter.append("circle")
            .attr("class", function (d) {
              return "playerDot fpl" + d.fpl_player_code.toString()
            })
            .attr("r", 6)
            .attr("cx", function (d) {
              return x(d.avg_price);
            })
            .attr("cy", function (d) {
              return y(d.npxPTS_90);
            })
            .attr("fill", function (d) {
              return d.color;
            })
            .attr("stroke", "#252932")
            .attr("stroke-width", 1)
            .on("click", mouseover )
            .on("mousemove", mousemove )
            .on("mouseleave", mouseleave ),
        update => update
            .attr("class", function (d) {
              return "playerDot fpl" + d.fpl_player_code.toString()
            })
            .attr("r", 6)
            .attr("cx", function (d) {
              return x(d.avg_price);
            })
            .attr("cy", function (d) {
              return y(d.npxPTS_90);
            })
            .attr("fill", function (d) {
              return d.color;
            })
            .attr("stroke", "#252932")
            .attr("stroke-width", 1)
            .on("click", mouseover )
            .on("mousemove", mousemove )
            .on("mouseleave", mouseleave ),
        exit => exit
            .remove()
      );

    // Player annotations
    var scatterLabels = ValuationPlot.selectAll(".playerLabels")
      .data(dataLabels)
      .join(
        enter => enter.append("text")
          .text(function(d){
            return d.web_name
          })
          .attr("x", function (d) {
            return x(d.avg_price)+7;
          })
          .attr("y", function (d) {
            return y(d.npxPTS_90)-5;
          })
          .style("fill", function (d) {
            return d.color;
          })
          .attr("class", "playerLabels")
          .style("font-size", 10)
          .style("font-weight", "bold"),
        update => update
          .text(function(d){
            return d.web_name
          })
          .attr("x", function (d) {
            return x(d.avg_price)+7;
          })
          .attr("y", function (d) {
            return y(d.npxPTS_90)-5;
          })
          .style("fill", function (d) {
            return d.color;
          })
          .attr("class", "playerLabels")
          .style("font-size", 10)
          .style("font-weight", "bold"),
        exit => exit
            .remove()
      );

  };

  // When the button is changed, run the updateChart function
  d3.select("#selectButton").on("change", function(d) {
      // recover the option that has been chosen
      var selectedOption = d3.select(this).property("value")
      // run the updateChart function with this selected option
      updateChart(selectedOption)
  });

  updateChart("(All Teams)")

  
})
.catch(function(error) {
  // handle error
  console.log(error)

})
