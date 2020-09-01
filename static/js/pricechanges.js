
// set the dimensions and margins of the graph
var margin = {top: 10, right: 30, bottom: 30, left: 60},
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

// append the svg object to the body of the page
var PriceChangePlot = d3.select("#my_dataviz2")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");


var colors = ['#1f77b4', '#6D597A', '#E56B6F', '#f7b267'];

//Read the data
d3.csv("data.csv").then(function(data) {

  var seasonNow = 2019;
  var minutesFilter = 900;

  // List of teams for button
  var allTeams = d3.map(data, function(d){
    return(d.team_now)}).keys();

  allTeams.sort();
  allTeams.unshift("(Most Popular Players)");

  // remove empty values or nulls
  var allTeams = allTeams.filter(Boolean);

  // add the options to the button
  d3.select("#selectButton2")
      .selectAll('myOptions')
      .data(allTeams)
      .enter()
      .append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; }) // corresponding value returned by the button

  // Filter on minutes played
  var data = data.filter(function(d){
    return d.minutes >=minutesFilter & d.position > 1;
  });

  // Historic data only
  var previousSeason = data.filter(function(d){
    return d.season < seasonNow;
  });

  // Group the data by player for each season
  var dataPercentiles = d3.nest()
      .key(function(d) {return d.group2;})
      .entries(previousSeason);

 // Add X axis
  var x = d3.scaleLinear()
    .domain([3.5, 14.5])
    .range([ 0, width ]);
  PriceChangePlot.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x)
      .ticks(6)
      .tickFormat(d => "£" + d + "m")
      .tickSize(-height))
    .attr("stroke-dasharray", ("1,1"))
    .select(".domain").remove();
      //.tickFormat("£");

  // Add Y axis
  var y = d3.scaleLinear()
    .domain([-1.5, 6.5])
    .range([height, 0]);
  PriceChangePlot.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y)
      .tickSize(-width))
    .attr("stroke-dasharray", ("1,1"))
    .select(".domain").remove();

  // Tooltips
  // Add a tooltip div.
  // Its opacity is set to 0: we don't see it by default.
  var tooltip = d3.select("#my_dataviz2")
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

    tooltip
      .style("opacity", 1)

    d3.selectAll(".playerDot2").filter(".fpl" + selectedPlayer)
      // .transition()
      // .duration(200)
      .style("stroke", "white")
      .style("stroke-width", 3)

    d3.selectAll(".bline" + selectedPlayer)
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

    d3.selectAll(".playerDot2").filter(".fpl" + selectedPlayer)
      .style("stroke", "#252932")
      .style("stroke-width", 1)

    d3.selectAll(".bline" + selectedPlayer)
      .attr("stroke", "#252932")
      .style("opacity", 0)
  };

  // A function that change this tooltip when the user hover a point.
  // Set the text and position of tooltip depending on the datapoint (d)
  var mousemove = function(d) {

    var mouse2 = d3.mouse(d3.select("#my_dataviz2").node())
      .map(function(d) {return parseInt(d)});

    tooltip
      .html(d.web_name + " | " + d.team_short_now + " | xPTS: " + Math.round(d.npxPTS_90 * 100) / 100)
      .style("left", (mouse2[0]+ 30) + "px")
      .style("top", (mouse2[1] + 120) + "px")
      .style("opacity", 1)
  };

  // Add historic dots
  PriceChangePlot.append("g")
    .selectAll("dotHistory")
    .data(previousSeason)
    .enter()
    .append("circle")
      .attr("cx", function(d) { return x(d.avg_price) } )
      .attr("cy", function(d) { return y(d.npxPTS_90) } )
      .attr("r", 5)
      .attr("fill", "grey")
      .attr("opacity", .1)

  // Group the data by player for each season
  var dataPlayerHistory = d3.nest()
      .key(function(d) {return d.fpl_player_code;})
      .entries(data);

  // Loop through each player and add line
  dataPlayerHistory.forEach(function(d) {
      var player_id = d.key.toString()

      PriceChangePlot.append("path")
        .datum(d.values)
        .attr("class", function (d) {return "bline" + player_id})
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
  PriceChangePlot.append("path")
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

  var legengBG = PriceChangePlot.append("rect")
     .attr("class", "legend2 legengBG")
     .attr("x", width/2 - (legendWidth/2))  // to get center shift by half of width
     .attr("y", 15)
     .attr("width", legendWidth)
     .attr("height", legendHeight)
     .attr('fill', '#2C363F');

  var annoPriceLow = PriceChangePlot.append("text")
     .attr("class", "legend2 legengPriceLow")
     .attr("x", width/2 - (legendWidth/2)+10)
     .attr("y", 25)
     .attr("dominant-baseline", "hanging")
     .attr("font-size", "12px")
     .attr('fill', colors[0])
     .style("font-weight", "bold")
     .text("<£5.5m");

  var annoPriceMid1 = PriceChangePlot.append("text")
     .attr("class", "legend2 legengPriceMid1")
     .attr("x", width/2 - (legendWidth/2)+60)
     .attr("y", 25)
     .attr("dominant-baseline", "hanging")
     .attr("font-size", "12px")
     .attr('fill', colors[1])
     .style("font-weight", "bold")
     .text("£5.5m - £7.5m");

  var annoPriceMid2 = PriceChangePlot.append("text")
     .attr("class", "legend2 legengPriceMid2")
     .attr("x", width/2 - (legendWidth/2)+150)
     .attr("y", 25)
     .attr("dominant-baseline", "hanging")
     .attr("font-size", "12px")
     .attr('fill', colors[2])
     .style("font-weight", "bold")
     .text("£7.5m - £10m");

  var annoPriceHigh = PriceChangePlot.append("text")
     .attr("class", "legend2 legengPriceHigh")
     .attr("x", width/2 - (legendWidth/2)+235)
     .attr("y", 25)
     .attr("dominant-baseline", "hanging")
     .attr("font-size", "12px")
     .attr('fill', colors[3])
     .style("font-weight", "bold")
     .text("£10m+");

  var annoValuePick = PriceChangePlot.append("text")
     .attr("y", function(){ return y(5)})
     .attr("x", function(){ return x(13)})
     .attr("class", "percentileLabel") //easy to style with CSS
     .text("Value Pick");

  var annoCostPick = PriceChangePlot.append("text")
     .attr("y", function(){ return y(2)})
     .attr("x", function(){ return x(13)})
     .attr("class", "percentileLabel") //easy to style with CSS
     .text("Cost Pick");

  var annoPercentile = PriceChangePlot.append("text")
     .attr("y", function(){ return y(3.3)})
     .attr("x", function(){ return x(13.2)})
     .attr("class", "percentileLabel") //easy to style with CSS
     .attr("transform", "rotate(-20," + x(13.2) + "," + y(3.3) +")")
     .text("80th percentile");

  var annoClick1 = PriceChangePlot.append("text")
     .attr("class", "annoClick")
     .attr("x", width/2 - 100)
     .attr("y", 65)
     .attr("font-size", "12px")
     .attr('fill', "grey")
     .style("font-weight", "bold")
     .text("Click on");

  var annoClick2 = PriceChangePlot.append("text")
     .attr("class", "annoClick")
     .attr("x", width/2-55)
     .attr("y", 65)
     .attr("font-size", "12px")
     .attr('fill', "grey")
     .text("a player to see their history");

  var annoGK = PriceChangePlot.append("text")
     .attr("x", width/2)
     .attr("y", height-10)
     .attr("font-size", "12px")
     .attr('fill', "grey")
     .style("text-anchor", "middle")
     .text("Position changes included (where applicable). Historic data points are still based on the 2019/20 positions.");

  var annoYLabel = PriceChangePlot.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "hanging")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height/2))
    .attr("dy", ".75em")
    .attr('fill', "#939393")
    .attr("transform", "rotate(-90)")
    .text("xPTS per 90 min (excl. penalties)");

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
      PriceChangePlot.append("path")
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

  PriceChangePlot.append("path")
            .attr("d", triangle)
            .attr("stroke", "white")
            .attr("fill", "white")
            .attr("transform", function(d) {
              return "translate(" + x(13.6) + "," + y(4.8) + ")rotate(80)";
             });

  PriceChangePlot.append("path")
            .attr("d", triangle)
            .attr("stroke", "white")
            .attr("fill", "white")
            .attr("transform", function(d) {
              return "translate(" + x(13.6) + "," + y(2.4) + ")rotate(90)";
            });

  // Info button

  var mouseOnInfo = function(d){

    d3.selectAll(".infoCircle2")
      .transition()
      .duration(200)
      .attr("stroke", "white");

    d3.selectAll(".infoButton2")
      .transition()
      .attr("fill", "white");

    d3.selectAll(".infoRect2")
      .transition()
      .attr("opacity", .9);

    d3.selectAll(".annoClick")
      .transition()
      .attr("opacity", 0);

    d3.selectAll(".infoText2")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".priceLines2")
      .transition()
      .attr("opacity", 0.02);

    d3.selectAll(".playerDot2")
      .transition()
      .attr("opacity", 0.05);

    d3.selectAll(".playerLabels2")
      .transition()
      .attr("opacity", 0.05);

    d3.selectAll(".legend2")
      .transition()
      .attr("opacity", 0.05);

    d3.selectAll(".exampleData")
      .transition()
      .attr("opacity", 1);

  };

  var mouseOutInfo = function(d){

    d3.selectAll(".infoCircle2")
      .transition()
      .duration(200)
      .attr("stroke", "grey");

    d3.selectAll(".infoButton2")
      .transition()
      .duration(200)
      .attr("fill", "grey");

    d3.selectAll(".infoRect2")
      .transition()
      .attr("opacity", 0);

    d3.selectAll(".annoClick")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".infoText2")
      .transition()
      .attr("opacity", 0);

    d3.selectAll(".priceLines2")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".playerDot2")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".playerLabels2")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".legend2")
      .transition()
      .attr("opacity", 1);

    d3.selectAll(".exampleData")
      .transition()
      .attr("opacity", 0);

  };

  var infoRect = PriceChangePlot.append("rect")
    .attr("class", "infoRect2")
    .attr("x", 33)
    .attr("y", 35)
    .attr("width", 500)
    .attr("height", 490)
    .attr("fill", "#2C363F")
    .attr("opacity", 0);

  var infoCircle = PriceChangePlot.append("circle")
    .attr("class", "infoCircle2")
    .attr("cx", 33)
    .attr("cy", 35)
    .attr("r", 8.5)
    .attr("fill", "#2C363F")
    .attr("stroke", "grey")
    .on("click", mouseOnInfo )
    .on("mouseleave", mouseOutInfo);

  var infoButton = PriceChangePlot.append("text")
    .attr("class", "infoButton2")
    .attr("x", 33)
    .attr("y", 37)
    .attr("font-size", "14px")
    .attr('fill', "grey")
    .style("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .text("i")
    .on("click", mouseOnInfo )
    .on("mouseleave", mouseOutInfo);

  var infoAnno = PriceChangePlot.append("text")
    .attr("class", "infoAnno")
    .attr("x", 40)
    .attr("y", 20)
    .attr("font-size", "11px")
    .attr('fill', "grey")
    .text("what are xPTS?")

  PriceChangePlot.append("path")
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

  PriceChangePlot.append("path")
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
    "The example above shows a player's price increase.",
    "",
    "Expected Points (xPTS) are based on xG. A player's xG, xA and xG against (clean sheets)",
    "are multiplied based on FPL's scoring rules for each position (i.e. midfielders score 5",
    "points for a goal, 1 point for a clean sheet and 3 points for an assist). For example, a",
    "forward with 7.8 xG and 2.1 xA would have a xPTS total of (7.8 x 4) + (2.1 x 3) = 37.5.",
    "This total is then divided by the total minutes played x 90 = per 90 mins. xPTS does not",
    "consider points for minutes played, yellow cards, bonus or other scoring ways in FPL.",
    "Value picks are those who are above the historical 80th percentile while cost picks",
    "are below. This does not mean Cost picks cannot be good in certain GWs - though",
    "across a full season better value is elsewhere.",
    "",
    "The faded grey dots on the plot are players from previous seasons (starting in 2014/15).",
    "GKs are excluced as a large % of their points is generated from saves. All xPTS are",
    "based on a player's current FPL position. Historic data points are based on a player's",
    "position in the 2019/20 season.",
    "",
    "Timo Werner's xPTS has been imputed based on his Bundesliga performance last season."
  ];

  for (var i = 0; i < infoTexts.length; i++) {

    // ySpacing in relation to title
    if (i>0) {
      var ySpacing = 90;
      var boldText = "normal";
    } else {
      var ySpacing = 0;
      var boldText = "bold";
    };

    PriceChangePlot.append("text")
      .attr("class", "infoText2")
      .attr("x", 50)
      .attr("y", 60 + ySpacing + i*20)
      .attr("font-weight", boldText)
      .attr("font-size", "12px")
      .attr("fill", "white")
      .attr("opacity", 0)
      .text(infoTexts[i]);
  };

  var exampleX = 5.65;
  var exampleY = 5;

  PriceChangePlot.append("path")
    .attr("class", "exampleData")
    .datum([{'x': exampleX, 'y': exampleY}, {'x': exampleX+1, 'y': exampleY}])
    .attr("d", d3.line()
      .x(function (d) {return x(d.x)})
      .y(function (d) {return y(d.y)})
    )
    .attr("fill", "white")
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0);

  PriceChangePlot.append("path")
    .attr("class", "exampleData")
    .datum([{'x': exampleX, 'y': exampleY-.3}, {'x': exampleX, 'y': exampleY-.2}])
    .attr("d", d3.line()
      .x(function (d) {return x(d.x)})
      .y(function (d) {return y(d.y)})
    )
    .attr("fill", "grey")
    .attr("stroke", "grey")
    .attr("stroke-width", 1)
    .attr("opacity", 0);

  PriceChangePlot.append("path")
    .attr("class", "exampleData")
    .datum([{'x': exampleX+1, 'y': exampleY-.3}, {'x': exampleX+1, 'y': exampleY-.2}])
    .attr("d", d3.line()
      .x(function (d) {return x(d.x)})
      .y(function (d) {return y(d.y)})
    )
    .attr("fill", "grey")
    .attr("stroke", "grey")
    .attr("stroke-width", 1)
    .attr("opacity", 0);

  PriceChangePlot.append("circle")
    .attr("class", "exampleData")
    .attr("cx", x(exampleX+1))
    .attr("cy", y(exampleY))
    .attr("r", 6)
    .attr("stroke", "#252932")
    .attr("stroke-width", 1)
    .attr("fill", "#f7b267")
    .attr("opacity", 0);

  PriceChangePlot.append("text")
      .attr("class", "exampleData")
      .attr("x", x(exampleX+1.1))
      .attr("y", y(exampleY+.1))
      .attr("font-size", "12px")
      .attr("fill", "#f7b267")
      .attr("opacity", 0)
      .text("Player Name");

  PriceChangePlot.append("text")
      .attr("class", "exampleData")
      .attr("x", x(exampleX))
      .attr("y", y(exampleY-.5))
      .attr("text-anchor", "end")
      .attr("font-size", "11px")
      .attr("fill", "grey")
      .attr("opacity", 0)
      .text("last season's price");

  PriceChangePlot.append("text")
      .attr("class", "exampleData")
      .attr("x", x(exampleX+1))
      .attr("y", y(exampleY-.5))
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "grey")
      .attr("opacity", 0)
      .text("new price");

  function updateChart(selectedTeam){

    if (selectedTeam == "(Most Popular Players)") {
      var dataFiltered = data.filter(function(d){
        return d.season == seasonNow+1 & d.label == "True";
      });

      var dataPriceLines = data.filter(function(d){
        return d.season >= seasonNow & d.label == "True";
      });

    } else {
      var dataFiltered = data.filter(function(d){
        return d.team_now == selectedTeam & d.season == seasonNow+1;
      });

      var dataPriceLines = data.filter(function(d){
        return d.team_now == selectedTeam & d.season >= seasonNow;
      });

    };

    var dataPriceLines = d3.nest()
      .key(function(d) {return d.fpl_player_code;})
      .entries(dataPriceLines);

    var dataPriceLines = dataPriceLines
      .map( function(d) {
        return d.values
      });

    var dataLabels = dataFiltered.filter(function(d){
      return d.label == "True";
    });

    // Price Lines
    PriceChangePlot.selectAll(".priceLines2")
      .data(dataPriceLines)
      .join(
        enter => enter.append("path")
          .attr("class", "priceLines2")
          .attr("d", d3.line()
            .x(function (d) {return x(d.avg_price)})
            .y(function (d) {return y(d.npxPTS_90)})
          )
          .attr("fill", "white")
          .attr("stroke", "white")
          .attr("stroke-width", 1.5),
        update => update
          .attr("class", "priceLines2")
          .attr("d", d3.line()
            .x(function (d) {return x(d.avg_price)})
            .y(function (d) {return y(d.npxPTS_90)})
          )
          .attr("fill", "white")
          .attr("stroke", "white")
          .attr("stroke-width", 1.5),
        exit => exit
            .remove()
       );

    // Add dots
    var scatter = PriceChangePlot.selectAll(".playerDot2")
      .data(dataFiltered)
      .join(
        enter => enter.append("circle")
            .attr("class", function (d) {
              return "playerDot2 fpl" + d.fpl_player_code.toString()
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
              return "playerDot2 fpl" + d.fpl_player_code.toString()
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
    var scatterLabels = PriceChangePlot.selectAll(".playerLabels2")
      .data(dataLabels)
      .join(
        enter => enter.append("text")
          .text(function(d){
            return d.web_name
          })
          .attr("x", function (d) {

            if (d.web_name == 'De Bruyne') {
              return x(d.avg_price)-57
            } else if (d.web_name == 'Jiménez') {
              return x(d.avg_price)-70
            } else if (d.web_name == 'Rodrigo') {
              return x(d.avg_price)-20
            } else if (d.web_name == 'Lundstram') {
              return x(d.avg_price)-14
            } else {
              return x(d.avg_price)+7
            };
          })
          .attr("y", function (d) {

            if (d.web_name == 'Salah') {
              return y(d.npxPTS_90)+11
            } else if (d.web_name == 'Martial') {
              return y(d.npxPTS_90)+11
            } else if (d.web_name == 'Rodrigo') {
              return y(d.npxPTS_90)-9
            } else if (d.web_name == 'Lundstram') {
              return y(d.npxPTS_90)+16
            } else {
              return y(d.npxPTS_90)-5
            }
          })
          .style("fill", function (d) {
            return d.color;
          })
          .attr("class", "playerLabels2")
          .style("font-size", 10)
          .style("font-weight", "bold"),
        update => update
          .text(function(d){
            return d.web_name
          })
          .attr("x", function (d) {

            if (d.web_name == 'De Bruyne') {
              return x(d.avg_price)-57
            } else if (d.web_name == 'Jiménez') {
              return x(d.avg_price)-70
            } else if (d.web_name == 'Rodrigo') {
              return x(d.avg_price)-20
            } else if (d.web_name == 'Lundstram') {
              return x(d.avg_price)-14
            } else {
              return x(d.avg_price)+7
            };
          })
          .attr("y", function (d) {

            if (d.web_name == 'Salah') {
              return y(d.npxPTS_90)+11
            } else if (d.web_name == 'Martial') {
              return y(d.npxPTS_90)+11
            } else if (d.web_name == 'Rodrigo') {
              return y(d.npxPTS_90)-9
            } else if (d.web_name == 'Lundstram') {
              return y(d.npxPTS_90)+16
            } else {
              return y(d.npxPTS_90)-5
            }
          })
          .style("fill", function (d) {
            return d.color;
          })
          .attr("class", "playerLabels2")
          .style("font-size", 10)
          .style("font-weight", "bold"),
        exit => exit
            .remove()
      );
  };

  d3.select("#selectButton2").on("change", function(d) {
      // recover the option that has been chosen
      var selectedOption = d3.select(this).property("value")
      // run the updateChart function with this selected option
      updateChart(selectedOption)
  });

  updateChart("(Most Popular Players)")

})
.catch(function(error) {
  // handle error
  console.log(error)

});
