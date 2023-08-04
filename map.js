import {scaleSequential, scalePow, interpolateYlOrRd} from 'd3';
import geoJson from 'world-geojson'
import D3Node from 'd3-node';
import fs from 'fs';
import {geoConicConformal, geoConicEqualArea, geoNaturalEarth1, geoMercator, geoPath} from 'd3-geo'

function buildImage(projection, opts) {
    const d3n = new D3Node()
    const width = opts.width,
          height = opts.height
    const svg = d3n.createSVG(width, height).append('g')

    svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", opts.backgroundColor);

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

    if (opts.showCountryLines) {
        // Drawing the country boundaries
        let worldMapData = fs.readFileSync('./data/world.geo.json');
        let worldMap = JSON.parse(worldMapData);
        svg.append("g")
            .selectAll("path")
            .data(worldMap.features)
            .enter()
            .append("path")
            .attr("fill", opts.countryBorderColor)
            .attr("d", geoPath().projection(gfg))
            .style("stroke", opts.backgroundColor)
            .style("stroke-width", 1);
    }

    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    const colorScale = scaleSequential(["#577590", "#4D908E", "#43AA8B", "#90BE6D", "#F9C74F", "#F9844A", "#F8961E", "#F3722C", "#F94144"])
        .domain([0, 1000000]); // Set the domain of the color scale based on the available bandwidth

    // Drawing Cables
    let cableGeoData = fs.readFileSync('./data/cable-geo.json');
    let cableGeo = JSON.parse(cableGeoData);
    svg.append("g")
        .selectAll("path")
        .data(cableGeo.features)
        .enter()
        .append("path")
        .attr("d", geoPath().projection(gfg))
        .attr("onmouseover", function(d) { return "displayName(`" + d.properties.name + "`)";})
        .attr("fill", "none")
        // .attr("stroke", function(d) { return d.properties.color; })
        .attr("stroke", function(d) { return colorScale(0); })
        .style("stroke-width", 2);

    // Drawing Landings
    let landingPointGeoData = fs.readFileSync('./data/landing-point-geo.json');
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

    let citySpeedsData = fs.readFileSync('./data/city-speeds.json');
    let citySpeeds = JSON.parse(citySpeedsData);
    const sizeScale = scalePow([0, 100000000], [10, 20])

    svg.append("g")
        .selectAll("circle")
        .data(citySpeeds)
        .enter()
        .append("circle")
        .attr("cx", d => gfg([d.long, d.lat])[0])
        .attr("cy", d => gfg([d.long, d.lat])[1])
        .attr("r", d => Math.floor(sizeScale(d.speed)))
        .attr("fill", d => colorScale(d.speed))
        .attr("stroke", "white")
        .attr("stroke-width", 1);

    const outFile = opts.outputPrefix + "geo-mercator.svg"
    console.log('writing output to ' + outFile);
    fs.writeFile(outFile, d3n.svgString(), function (err) {
      if (err) return console.log(err);
    })
}

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    showCountryLines: true,
    backgroundColor: "#333",
    countryBorderColor: "#888",
    outputPrefix: "output/"
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    showCountryLines: false,
    backgroundColor: "#333",
    countryBorderColor: "#888",
    outputPrefix: "output/nocountrylines_"
})
