import D3Node from 'd3-node';
import fs from 'fs';
import {geoConicConformal, geoConicEqualArea, geoNaturalEarth1, geoMercator, geoPath} from 'd3-geo'

function buildImage(projection, outfile) {
    const d3n = new D3Node()
    const svg = d3n.createSVG(5000, 3000).append('g')

    const width = 5000,
          height = 3000

    svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "#333");

    var gfg = projection
        .scale(width / 2.5 / Math.PI)
        .rotate([0, 0])
        .center([0, 0])
        .translate([width / 2, height / 2]);

    // Drawing the map
    let worldMapData = fs.readFileSync('./data/world.geo.json');
    let worldMap = JSON.parse(worldMapData);
    svg.append("g")
        .selectAll("path")
        .data(worldMap.features)
        .enter()
        .append("path")
        .attr("fill", "#888")
        .attr("d", geoPath().projection(gfg))
        .style("stroke", "#333")
        .style("stroke-width", 1);

    // Drawing Cables
    let cableGeoData = fs.readFileSync('./data/cable-geo.json');
    let cableGeo = JSON.parse(cableGeoData);
    svg.append("g")
        .selectAll("path")
        .data(cableGeo.features)
        .enter()
        .append("path")
        .attr("d", geoPath().projection(gfg))
        .attr("fill", "none")
        .attr("stroke", function(d) { return d.properties.color; })
        // .attr("stroke", function(d) { return "#555"; })
        .style("stroke-width", 1);


    console.log('writing output to ' + outfile);
    fs.writeFile(outfile, d3n.svgString(), function (err) {
      if (err) return console.log(err);
    })
}

buildImage(geoConicConformal(), 'output/geo-conic-conformal.svg')
buildImage(geoConicEqualArea(), 'output/geo-conic-equal-area.svg')
buildImage(geoNaturalEarth1(), 'output/geo-natural-earth-1.svg')
buildImage(geoMercator(), 'output/geo-mercator.svg')
