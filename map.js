import _ from 'lodash';
import {scaleSequential, scalePow, interpolateYlOrRd} from 'd3';
import geoJson from 'world-geojson'
import D3Node from 'd3-node';
import fs from 'fs';
import {geoConicConformal, geoConicEqualArea, geoNaturalEarth1, geoMercator, geoPath} from 'd3-geo'

const loadCableGeoData = _.memoize(function (n) { 
    let count = 0
    let futureCount = 0
    let lengthKm = 0

    let cableGeoData = fs.readFileSync('./data/submarinecables/cable/cable-geo.json');
    let cableGeo = JSON.parse(cableGeoData);

    const cableGeoFilteredFeatures = []
    for (const feature of cableGeo.features) {
        let cableData = fs.readFileSync('./data/submarinecables/cable/'+ feature.properties.id +'.json');
        let cable = JSON.parse(cableData);
        if (cable.is_planned) {
            console.log("skipping cable: "+ feature.properties.id)
            futureCount++
            continue
        }

        cableGeoFilteredFeatures.push(feature)
        count++

        if (cable.length != null) {
            const length = parseInt(cable.length.replace(",", ""))
            if (!isNaN(length)) {
                lengthKm += parseInt(cable.length)
            }
        }
    }

    return {
        count: count,
        futureCount: futureCount,
        lengthKm: lengthKm,
        cableGeoFeatures: cableGeoFilteredFeatures,
    }
});

const loadLandingGeoData = _.memoize(function (n) { 
    let count = 0
    let futureCount = 0

    let landingPointGeoData = fs.readFileSync('./data/submarinecables/landing-point/landing-point-geo.json');
    let landingPointGeo = JSON.parse(landingPointGeoData);

    const landingPointFilteredFeatures = []
    for (const feature of landingPointGeo.features) {
        try {
            let landingPointData = fs.readFileSync('./data/submarinecables/landing-point/'+ feature.properties.id +'.json');
            let landingPoint = JSON.parse(landingPointData);
            if (landingPoint.is_planned) {
                console.log("skipping landing point: "+ feature.properties.id)
                futureCount++
                continue
            }
            count++
        } catch (ENOENT) {
            console.log("data for landingPoint "+ feature.properties.id +" does not exist")
        }

        landingPointFilteredFeatures.push(feature)
    }


    return {
        count: count,
        futureCount: futureCount,
        landingPointFeatures: landingPointFilteredFeatures,
    }
});

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
            // document.getElementById('fiber-name').firstChild.data = name;
            console.log(name);
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
            .attr("fill", opts.countryBackgroundColor)
            .attr("d", geoPath().projection(gfg))
            .style("stroke", opts.backgroundColor)
            .style("stroke-width", 1);
    }

    const colorScale = scaleSequential(opts.InternetExchangeColorScale)
        .domain([0, 1000000]); // Set the domain of the color scale based on the available bandwidth

    // Drawing Cables
    const cableData = loadCableGeoData()
    console.log("Number of Cables: "+ cableData.count)
    console.log("Number of Planned Cables: "+ cableData.futureCount)
    console.log("Length of all cables: "+ cableData.lengthKm)
    svg.append("g")
        .selectAll("path")
        .data(cableData.cableGeoFeatures)
        .enter()
        .append("path")
        .attr("d", geoPath().projection(gfg))
        .attr("fill", "none")
        // .attr("stroke", function(d) { return d.properties.color; })
        .attr("stroke", function(d) { return opts.CableColor; })
        .style("stroke-width", 2)
        .attr("onmouseover", function(d) { return "displayName(`" + d.properties.name + "`)"; });

    // Drawing Landings
    const landingPointData = loadLandingGeoData()
    svg.append("g")
        .selectAll("path")
        .data(landingPointData.landingPointFeatures)
        .enter()
        .append("path")
        .attr("d", geoPath().projection(gfg).pointRadius(function(d) { return 0.3; }))
        .attr("fill", opts.LandingPointColor)
        .attr("stroke", function(d) { return "#eee"; })
        .style("stroke-width", 1)
        .attr("onmouseover", function(d) { return `displayName('${d.properties.name}')`;});

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
        .attr("stroke", opts.InternetExchangeCircleColor)
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
    backgroundColor: "#9ddbff",
    countryBackgroundColor: "#fefded",
    outputPrefix: "output/light_",
    // From https://design.gitlab.com/data-visualization/color
    InternetExchangeColorScale: ["#e9ebff", "#e99b60"],
    CableColor: "#555",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "black",
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    showCountryLines: true,
    backgroundColor: "#333",
    countryBackgroundColor: "#888",
    outputPrefix: "output/",
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    showCountryLines: false,
    backgroundColor: "#333",
    countryBackgroundColor: "#888",
    outputPrefix: "output/nocountrylines_",
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})
