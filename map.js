import _ from 'lodash';
import {scaleSequential, scalePow, extent, min, max} from 'd3';
import D3Node from 'd3-node';
import path from 'path';
import fs from 'fs';
import {geoMercator, geoPath} from 'd3-geo'

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

        feature.properties.rfs_year = cable.rfs_year
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

    if (!opts.cableFilter) {
        console.log("using default cableFilter")
        opts.cableFilter = (cable) => cable.properties.rfs_year != null
    } else {
        console.log("using custom cableFilter", opts.cableFilter)
    }

    if (!opts.transparent) {
        svg.append("rect")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("fill", opts.backgroundColor);
    }

    var gfg = projection
        .scale(width / 2.02 / Math.PI)
        .rotate([0, 0])
        .center([0, 40])
        .translate([width / 2, height / 2]);

    if (opts.animate) {
        svg.append('style')
            .text(`.svg-title {
                color: `+opts.countryBackgroundColor+`;
                font-size: 5em;
                font-family: monospace, monospace;
            }
            
            .cable-lines {
                display: none;
            }`)
    }

    // Drawing Cables
    const cableData = loadCableGeoData()

    const cableDataFiltered = cableData.cableGeoFeatures.filter(opts.cableFilter);
    const minYear = min(cableDataFiltered, function(cable) {return cable.properties.rfs_year; });
    const maxYear = max(cableDataFiltered, function(cable) {return cable.properties.rfs_year; });

    console.log("Number of Cables: "+ cableData.count)
    console.log("Number of Planned Cables: "+ cableData.futureCount)
    console.log("Length of all cables: "+ cableData.lengthKm)
    console.log("Years "+ minYear + " to " + maxYear)

    if (opts.animate) {
        svg.append('script')
            .attr('type', 'text/javascript')
            .text(`<script type="text/javascript"><![CDATA[
            const setYear = function (year) { 
                var cables = document.querySelectorAll(".rfs-"+year); 
                for (var i = 0; i < cables.length; i++) {
                    var str = cables[i].style.display = "block"
                }

                const s = year
                document.getElementById("svg-title").innerHTML = s
            }

            async function main() {
                const StartingYear = `+minYear+`;
                const EndingYear = `+maxYear+`;

                for (let i = StartingYear; i <= EndingYear; i++) { 
                    await new Promise(r => setTimeout(r, 1000));
                    setYear(i);
                }
            }

            main()
        ]]></script>`)
    }

    if (opts.showCountryLines) {
        // Drawing the country boundaries
        let worldMapData = fs.readFileSync('./data/world.geo.json');
        let worldMap = JSON.parse(worldMapData);
        svg.append("g")
            .selectAll("path")
            .data(worldMap.features)
            .enter()
            .append("path")
            .attr("class", "country-lines")
            .attr("fill", opts.countryBackgroundColor)
            .attr("d", geoPath().projection(gfg))
            .style("stroke", opts.backgroundColor)
            .style("stroke-width", 1);
    }

    const colorScale = scaleSequential(opts.InternetExchangeColorScale)
        .domain([0, 1000000]); // Set the domain of the color scale based on the available bandwidth

    svg.append("g")
        .selectAll("path")
        .data(cableDataFiltered)
        .enter()
        .append("path")
        .attr("class", function(d) { return "cable-lines rfs-" + d.properties.rfs_year })
        .attr("d", geoPath().projection(gfg))
        .attr("fill", "none")
        .attr("stroke", function(d) { return opts.CableColor; })
        .style("stroke-width", 2);

    if (opts.showLandingPoints) {
        // Drawing Landings
        const landingPointData = loadLandingGeoData()
        svg.append("g")
            .selectAll("path")
            .data(landingPointData.landingPointFeatures)
            .enter()
            .append("path")
            .attr("class", function(d) { return "landings rfs-" + d.properties.rfs_year })
            .attr("d", geoPath().projection(gfg).pointRadius(function(d) { return 0.3; }))
            .attr("fill", opts.LandingPointColor)
            .attr("stroke", function(d) { return "#eee"; })
            .style("stroke-width", 1);
    
        let citySpeedsData = fs.readFileSync('./data/city-speeds.json');
        let citySpeeds = JSON.parse(citySpeedsData);
        const sizeScale = scalePow([0, 100000000], [10, 20])
    
        // Dray Cities that have an IX, sized/colored by bandwidth
        svg.append("g")
            .selectAll("circle")
            .data(citySpeeds)
            .enter()
            .append("circle")
            .attr("class", "cities")
            .attr("cx", d => gfg([d.long, d.lat])[0])
            .attr("cy", d => gfg([d.long, d.lat])[1])
            .attr("r", d => Math.floor(sizeScale(d.speed)))
            .attr("fill", d => colorScale(d.speed))
            .attr("stroke", opts.InternetExchangeCircleColor)
            .attr("stroke-width", 1);
    }

    if (opts.animate || opts.title) {
        // Title
        svg.append("text")
            .attr("id", "svg-title")
            .attr("class", "svg-title")
            .attr("x", "5%")
            .attr("y", "10%")
            .attr("font-size", "120")
            .attr("font-weight", "bold")
            .attr("fill", opts.countryBackgroundColor)
            .attr("stroke", opts.countryBackgroundColor)
            .attr("text-anchor", "left")
            .attr("style", `font-family: monospace, monospace;`)
            .text(opts.title || "");
    }

    const outFile = opts.outputPrefix + "geo-mercator.svg"
    const dirName = path.dirname(outFile)
    console.log('writing output to ' + outFile);
    fs.mkdirSync(dirName, { recursive: true });
    fs.writeFile(outFile, d3n.svgString(), function (err) {
      if (err) return console.log(err);
    })
}


// buildImage(geoMercator(), {
//     width: 5600,
//     height: 4000,
//     transparent: false,
//     animate: true,
//     showCountryLines: true,
//     backgroundColor: "#9ddbff",
//     countryBackgroundColor: "#fefded",
//     outputPrefix: "output/light_",
//     // From https://design.gitlab.com/data-visualization/color
//     InternetExchangeColorScale: ["#e9ebff", "#e99b60"],
//     CableColor: "#555",
//     LandingPointColor: "#555",
//     InternetExchangeCircleColor: "black",
// })

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: true,
    animate: true,
    showCountryLines: false,
    backgroundColor: "#333",
    countryBackgroundColor: "#888",
    outputPrefix: "output/transparent_",
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: false,
    animate: false,
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
    transparent: false,
    animate: false,
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

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: false,
    animate: true,
    showLandingPoints: false,
    showCountryLines: true,
    backgroundColor: "#333",
    countryBackgroundColor: "#888",
    outputPrefix: `output/animated_`,
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: false,
    animate: true,
    showLandingPoints: false,
    showCountryLines: false,
    backgroundColor: "#333",
    countryBackgroundColor: "#888",
    outputPrefix: `output/animated_nocountrylines_`,
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})

for (let year = 1990; year <= new Date().getFullYear(); year++) { 
    buildImage(geoMercator(), {
        width: 5600,
        height: 4000,
        transparent: false,
        animate: false,
        showLandingPoints: false,
        showCountryLines: false,
        backgroundColor: "#333",
        countryBackgroundColor: "#888",
        title: `${year}`,
        outputPrefix: `output/tmp/parts/${year}_`,
        cableFilter: (cable) => cable.properties.rfs_year != null && cable.properties.rfs_year <= year,
        // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
        InternetExchangeColorScale: ["#577590", "#4D908E"],
        CableColor: "#577590",
        LandingPointColor: "#555",
        InternetExchangeCircleColor: "white",
    })
}