import D3Node from 'd3-node';
import fs from 'fs';
import {geoConicConformal, geoConicEqualArea, geoNaturalEarth1, geoMercator, geoPath} from 'd3-geo'

function buildImage(projection, outfile) {
    const d3n = new D3Node()
    const width = 5600,
          height = 4000
    const svg = d3n.createSVG(width, height).append('g')

    svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "#333");

    var gfg = projection
        .scale(width / 2.02 / Math.PI)
        .rotate([0, 0])
        .center([0, 40])
        .translate([width / 2, height / 2]);

    svg.append('script')
        .attr('type', 'text/javascript')
        .text(`<script type="text/javascript"><![CDATA[
        function displayName(name) {
            document.getElementById('fiber-name').firstChild.data = name;
        }
    ]]></script>`)

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
    let cableGeoData = fs.readFileSync('./data/www.submarinecablemap.com/web/public/api/v3/cable/cable-geo.json');
    let cableGeo = JSON.parse(cableGeoData);
    svg.append("g")
        .selectAll("path")
        .data(cableGeo.features)
        .enter()
        .append("path")
        .attr("d", geoPath().projection(gfg))
        .attr("onmouseover", function(d) { return "displayName(`" + d.properties.name + "`)";})
        .attr("fill", "none")
        .attr("stroke", function(d) { return d.properties.color; })
        // .attr("stroke", function(d) { return "#555"; })
        .style("stroke-width", 2);

    // Drawing Landings
    let landingPointGeoData = fs.readFileSync('./data/www.submarinecablemap.com/web/public/api/v3/landing-point/landing-point-geo.json');
    let landingPointGeo = JSON.parse(landingPointGeoData);
    svg.append("g")
        .selectAll("path")
        .data(landingPointGeo.features)
        .enter()
        .append("path")
        .attr("onmouseover", function(d) { return `displayName('${d.properties.name}')`;})
        .attr("d", geoPath().projection(gfg).pointRadius(function(d) { return 0.3; }))
        .attr("fill", "#555")
        .attr("stroke", function(d) { return "#eee"; })
        .style("stroke-width", 1);

    console.log('writing output to ' + outfile);
    fs.writeFile(outfile, d3n.svgString(), function (err) {
      if (err) return console.log(err);
    })
}

// buildImage(geoConicConformal(), 'output/geo-conic-conformal.svg')
// buildImage(geoConicEqualArea(), 'output/geo-conic-equal-area.svg')
// buildImage(geoNaturalEarth1(), 'output/geo-natural-earth-1.svg')
buildImage(geoMercator(), 'output/geo-mercator.svg')
