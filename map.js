import _ from 'lodash';
import { scaleSequential, scalePow, scaleLinear, min, max } from 'd3';
import D3Node from 'd3-node';
import path from 'path';
import fs from 'fs';
import prettyBytes from 'pretty-bytes';
import humanize from 'humanize';
import { geoMercator, geoPath } from 'd3-geo'

const loadCableGeoData = _.memoize(function (n) {
    let count = 0
    let totalLengthKm = 0

    let cableGeoData = fs.readFileSync('./data/submarinecables/cable/cable-geo.json');
    let cableGeo = JSON.parse(cableGeoData);

    const cableGeoFilteredFeatures = new Map();
    for (const feature of cableGeo.features) {
        let cableData = fs.readFileSync('./data/submarinecables/cable/' + feature.properties.id + '.json');
        let cable = JSON.parse(cableData);

        if (cable.length != null) {
            var length_str = cable.length.replaceAll(",", "")
            length_str = length_str.replaceAll(" km", "")
            const length = parseInt(length_str)
            if (!isNaN(length)) {
                feature.lengthKm = length
                totalLengthKm += feature.lengthKm
            }
        }
        feature.properties.rfs_year = cable.rfs_year
        cableGeoFilteredFeatures.set(feature.properties.id, feature)
        count++
    }

    return {
        count: count,
        lengthKm: totalLengthKm,
        cableGeoFeatures: Array.from(cableGeoFilteredFeatures, ([k, v]) => v),
    }
});

const loadLandingGeoData = _.memoize(function (n) {
    let count = 0

    let landingPointGeoData = fs.readFileSync('./data/submarinecables/landing-point/landing-point-geo.json');
    let landingPointGeo = JSON.parse(landingPointGeoData);

    const landingPointFilteredFeatures = []
    for (const feature of landingPointGeo.features) {
        try {
            let landingPointData = fs.readFileSync('./data/submarinecables/landing-point/' + feature.properties.id + '.json');
            let landingPoint = JSON.parse(landingPointData);
            if (landingPoint.is_planned) {
                console.log("skipping landing point: " + feature.properties.id)
                continue
            }
            count++
        } catch (ENOENT) {
            console.log("data for landingPoint " + feature.properties.id + " does not exist")
        }

        landingPointFilteredFeatures.push(feature)
    }


    return {
        count: count,
        landingPointFeatures: landingPointFilteredFeatures,
    }
});

function longestCables(cables, count) {
    return _.chain(cables)
        .filter((cable) => cable.lengthKm > 0)
        .map((cable) => {
            return {
                lengthKm: cable.lengthKm,
                properties: {
                    id: cable.properties.id,
                    name: humanize.truncatechars(cable.properties.name, 60)
                }
            }
        })
        .sortBy('lengthKm')
        .reverse()
        .take(count)
        .value();
}

function buildImage(projection, opts) {
    const d3n = new D3Node()
    const width = opts.width,
          height = opts.height
    const svg = d3n.createSVG("100%", "100%", {viewBox: `0 0 ${width} ${height}`}).append('g')

    if (!opts.cableFilter) {
        console.log("using default cableFilter")
        opts.cableFilter = (cable) => cable.properties.rfs_year != null && cable.properties.rfs_year <= new Date().getFullYear()
    }

    if (!opts.transparent) {
        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", opts.backgroundColor);
    }

    var gfg = projection
        .scale(width / 2.02 / Math.PI)
        .rotate([0, 0])
        .center([0, 40])
        .translate([width / 2, height / 2]);

    if (opts.animate) {
        svg.append('style')
            .text(`
            .svg-title {
                color: `+ opts.textColor + `;
                font-size: 8em;
                font-family: monospace, monospace;
            }
            .cable-lines {
                opacity: 0;
                height: 0;
                overflow: hidden;
                stroke: `+ opts.CableColor + `;
            }
            .cable-lines.shown {
                opacity: 1;
                height: auto;
                stroke-width: 2;
            }
            .cable-lines.active {
                stroke: `+ opts.ActiveCableColor +`;
            }
            .landing {
                opacity: 0;
                height: 0;
                overflow: hidden;
                stroke: `+ opts.LandingPointColor + `;
            }
            .landing.shown {
                opacity: 1;
                height: auto;
                stroke-width: 2;
            }
            .landing.active {
                stroke: `+ opts.ActiveCableColor +`;
            }
            .city {
                opacity: 0;
                height: 0;
                overflow: hidden;
            }
            .city.shown {
                opacity: 1;
                height: auto;
                stroke: `+ opts.CableColor + `;
                stroke-width: 2;
            }
            .city.active {
                stroke: `+ opts.ActiveCableColor + `;
            }
            .emphasized {
                font-weight: bold;
                stroke: `+ opts.CableColor + `;
                fill: `+ opts.CableColor + `;
            }
            .emphasized.active {
                font-weight: bold;
                stroke: `+ opts.ActiveCableColor +`;
                fill: `+ opts.ActiveCableColor +`;
            }
            `)
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

    // Drawing Cables
    const cableData = loadCableGeoData()
    const cableDataFiltered = cableData.cableGeoFeatures.filter(opts.cableFilter);
    const minYear = min(cableDataFiltered, function (cable) { return cable.properties.rfs_year; });
    const maxYear = max(cableDataFiltered, function (cable) { return cable.properties.rfs_year; });
    svg.append("g")
        .selectAll("path")
        .data(cableDataFiltered)
        .enter()
        .append("path")
        .attr("class", (d) => "cable-lines rfs-" + d.properties.rfs_year)
        .attr("d", geoPath().projection(gfg))
        .attr("fill", "none")
        // .attr("stroke", (d) => cableColorScale(d.properties.rfs_year))
        .attr("stroke", function(d) {
            if (d.properties.rfs_year == maxYear) {
                return opts.ActiveCableColor
            } else {
                return opts.CableColor
            }
        })
        .attr("stroke-width", 2);

    if (opts.showLandingPoints) {
        // Drawing Landings
        const landingPointData = loadLandingGeoData()
        svg.append("g")
            .selectAll("path")
            .data(landingPointData.landingPointFeatures)
            .enter()
            .append("path")
            .attr("d", geoPath().projection(gfg).pointRadius(() => 0.3))
            .attr("fill", opts.LandingPointColor)
            // .attr("stroke", d => cableColorScale(d.properties.rfs_year))
            .attr("stroke", function(d) {
                if (d.properties.rfs_year == maxYear) {
                    return opts.ActiveCableColor
                } else {
                    return opts.CableColor
                }
            })
            .attr("stroke-width", 1);
    }

    if (opts.animate) {
        var perYearCableStats = _(cableDataFiltered)
            .groupBy('properties.rfs_year')
            .map((grp, rfs_year) =>
                ({ rfs_year, lengthKm: _.sumBy(grp, 'lengthKm'), count: grp.length, longest: longestCables(grp, 5) }))
            .keyBy('rfs_year')
            .value();

        let citySpeedsData = fs.readFileSync('./data/city-speeds.json');
        let citySpeeds = JSON.parse(citySpeedsData);
        const minSpeed = min(citySpeeds, (city) => city.speed );
        const maxSpeed = max(citySpeeds, (city) => city.speed );
        const sizeScale = scalePow([minSpeed, maxSpeed], [8, 25])

        const yearlyCitySpeeds = _(citySpeeds)
            .reduce(function (result, city) {
                _.forEach(city.speedYears, function (yearSpeed, year) {
                    (result[year] || (result[year] = [])).push({ id: `city-${city.id}`, r: sizeScale(yearSpeed.total) })
                })
                return result;
            }, {})

        const topCities = _.chain(citySpeeds)
            .reduce(function (result, city) {
                _.forEach(city.speedYears, function (yearSpeed, year) {
                    (result[year] || (result[year] = [])).push({
                        id: `city-${city.id}`,
                        city: city.city,
                        country: city.country,
                        total: yearSpeed.total,
                        total_str: prettyBytes(yearSpeed.total * 1000 * 1000, { bits: true }),
                        added_str: prettyBytes(yearSpeed.added_speed * 1000 * 1000, { bits: true }),
                    })
                })
                return result;
            }, {})
            .reduce(function (result, cities, year) {
                result[year] = _(cities).sortBy('total').reverse().take(5)
                return result
            }, {})
            .value()

        var regions = _.chain(citySpeeds).groupBy('region').keys().value()
        var perYearRegionStats = _.chain(citySpeeds)
            .groupBy('region')
            .reduce(function (result, cities, region) {
                const regionEntry = {region: region, speedYears: {}}
                _.forEach(cities, function (city) {
                    _.forEach(city.speedYears, function (yearSpeed, year) {
                        const yearEntry = regionEntry.speedYears[year] || (regionEntry.speedYears[year] = {year: year, added_speed: 0, total: 0})
                        yearEntry.added_speed += yearSpeed.added_speed
                        yearEntry.total += yearSpeed.total
                        yearEntry.total_str = prettyBytes(yearEntry.total * 1000 * 1000, { bits: true })
                        yearEntry.added_str = prettyBytes(yearEntry.added_speed * 1000 * 1000, { bits: true })
                        regionEntry.speedYears[year] = yearEntry
                    })
                })
                result.push(regionEntry)
                return result
            }, [])
            .reduce(function (result, regionEntry) {
                _.forEach(regionEntry.speedYears, function (yearSpeed) {
                    const yearEntry = result[yearSpeed.year] || (result[yearSpeed.year] = [])
                    yearEntry.push({
                        region: regionEntry.region,
                        added_speed: yearSpeed.added_speed,
                        total: yearSpeed.total,
                        total_str: yearSpeed.total_str,
                        added_str: yearSpeed.added_str,
                    })
                    result[yearSpeed.year] = _.chain(result[yearSpeed.year]).sortBy("total").reverse().value()
                })
                return result
            }, {})
            .value()

        svg.append("g")
            .selectAll("circle")
            .data(citySpeeds)
            .enter()
            .append("circle")
            .attr("id", d => `city-${d.id}`)
            .attr("class", "city")
            .attr("cx", d => gfg([d.long, d.lat])[0])
            .attr("cy", d => gfg([d.long, d.lat])[1])
            .attr("r", 0)
            .attr("fill", "none")
            .attr("stroke", opts.CableColor)
            .style("stroke-width", 2);

        const mapEmbed = fs.readFileSync('./map-embed.js').toString()
        svg.append('script')
            .attr('type', 'text/javascript')
            .text(`<script type="text/javascript"><![CDATA[
            const perYearCableStats = `+ JSON.stringify(perYearCableStats) + `
            const yearlyCitySpeeds = `+ JSON.stringify(yearlyCitySpeeds) + `
            const yearlyTopCities = `+ JSON.stringify(topCities) + `
            const perYearRegionStats = `+ JSON.stringify(perYearRegionStats) + `
            const minYear = `+ minYear + `
            const maxYear = `+ maxYear + `
            `+ mapEmbed + `
        ]]></script>`)
    }

    if (opts.showControls) {
        const leftSideOfControls = parseInt(width * 0.05);

        // Begining
        svg.append("g")
            .append("path")
            .attr("d", "M493.6 445c-11.2 5.3-24.5 3.6-34.1-4.4L288 297.7V416c0 12.4-7.2 23.7-18.4 29s-24.5 3.6-34.1-4.4L64 297.7V416c0 17.7-14.3 32-32 32s-32-14.3-32-32V96C0 78.3 14.3 64 32 64s32 14.3 32 32V214.3L235.5 71.4c9.5-7.9 22.8-9.7 34.1-4.4S288 83.6 288 96V214.3L459.5 71.4c9.5-7.9 22.8-9.7 34.1-4.4S512 83.6 512 96V416c0 12.4-7.2 23.7-18.4 29z")
            .attr("fill", opts.countryBackgroundColor)
            .attr("transform", "scale(0.2)")
            .attr("transform-origin", `${leftSideOfControls} 5%`)

        // Step back
        svg.append("g")
            .append("path")
            .attr("d", "M267.5 440.6c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V96c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4l-192 160L64 241V96c0-17.7-14.3-32-32-32S0 78.3 0 96V416c0 17.7 14.3 32 32 32s32-14.3 32-32V271l11.5 9.6 192 160z")
            .attr("fill", opts.countryBackgroundColor)
            .attr("transform", "scale(0.2)")
            .attr("transform-origin", `${leftSideOfControls + 200} 5%`)

        // Play
        svg.append("g")
            .append("path")
            .attr("d", "M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z")
            .attr("fill", opts.countryBackgroundColor)
            .attr("transform", "scale(0.2)")
            .attr("transform-origin", `${leftSideOfControls + 400} 5%`)

        // Pause
        svg.append("g")
            .append("path")
            .attr("d", "M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z")
            .attr("fill", opts.countryBackgroundColor)
            .attr("transform", "scale(0.2)")
            .attr("transform-origin", `${leftSideOfControls + 600} 5%`)

        // Repeat
        svg.append("g")
            .append("path")
            .attr("d", "M0 224c0 17.7 14.3 32 32 32s32-14.3 32-32c0-53 43-96 96-96H320v32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9S320 19.1 320 32V64H160C71.6 64 0 135.6 0 224zm512 64c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 53-43 96-96 96H192V352c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6V448H352c88.4 0 160-71.6 160-160z")
            .attr("fill", opts.countryBackgroundColor)
            .attr("transform", "scale(0.2)")
            .attr("transform-origin", `${leftSideOfControls + 800} 5%`)

        // Step forward
        svg.append("g")
            .append("path")
            .attr("d", "M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416V96C0 83.6 7.2 72.3 18.4 67s24.5-3.6 34.1 4.4l192 160L256 241V96c0-17.7 14.3-32 32-32s32 14.3 32 32V416c0 17.7-14.3 32-32 32s-32-14.3-32-32V271l-11.5 9.6-192 160z")
            .attr("fill", opts.countryBackgroundColor)
            .attr("transform", "scale(0.2)")
            .attr("transform-origin", `${leftSideOfControls + 1000} 5%`)

        // End
        svg.append("g")
            .append("path")
            .attr("d", "M18.4 445c11.2 5.3 24.5 3.6 34.1-4.4L224 297.7V416c0 12.4 7.2 23.7 18.4 29s24.5 3.6 34.1-4.4L448 297.7V416c0 17.7 14.3 32 32 32s32-14.3 32-32V96c0-17.7-14.3-32-32-32s-32 14.3-32 32V214.3L276.5 71.4c-9.5-7.9-22.8-9.7-34.1-4.4S224 83.6 224 96V214.3L52.5 71.4c-9.5-7.9-22.8-9.7-34.1-4.4S0 83.6 0 96V416c0 12.4 7.2 23.7 18.4 29z")
            .attr("fill", opts.countryBackgroundColor)
            .attr("transform", "scale(0.2)")
            .attr("transform-origin", `${leftSideOfControls + 1200} 5%`)
    }

    // Set the domain of the color scale based on the year established
    // const cableColorScale = scalePow().range([opts.CableColor, opts.ActiveCableColor]).domain([minYear, maxYear]);

    if (opts.showCitySpeeds && !opts.animate) {
        let citySpeedsData = fs.readFileSync('./data/city-speeds.json');
        let citySpeeds = JSON.parse(citySpeedsData);
        const minSpeed = min(citySpeeds, (city) => city.speed );
        const maxSpeed = max(citySpeeds, (city) => city.speed );

        // Set the domain of the color scale based on the available bandwidth
        // const cityColorScale = scalePow().range([opts.CableColor, opts.ActiveCableColor]).domain([minSpeed, maxSpeed]);
        const citySizeScale = scalePow([minSpeed, maxSpeed], [8, 25])

        // Draw Cities that have an IX, sized/colored by bandwidth
        svg.append("g")
            .selectAll("circle")
            .data(citySpeeds)
            .enter()
            .append("circle")
            .attr("class", "city")
            .attr("cx", d => gfg([d.long, d.lat])[0])
            .attr("cy", d => gfg([d.long, d.lat])[1])
            .attr("r", d => Math.floor(citySizeScale(d.speed)))
            .attr("fill", "none")
            .attr("stroke", function(d) {
                let yearlySpeed = d.speedYears[maxYear]
                if (yearlySpeed && yearlySpeed.added_speed > 0) {
                    return opts.ActiveCableColor
                } else {
                    return opts.CableColor
                }
            })
            .attr("stroke-width", 2);
    }

    if (opts.animate || opts.title) {
        // Title
        svg.append("text")
            .attr("id", "svg-title")
            .attr("class", "svg-title")
            .attr("x", "50%")
            .attr("y", "7%")
            .attr("font-size", "120")
            .attr("font-weight", "bold")
            .attr("fill", opts.textColor)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("style", `font-family: monospace, monospace;`)
            .text(opts.title || "");

        svg.append("text")
            .attr("id", "svg-title-2")
            .attr("class", "svg-title")
            .attr("x", "50%")
            .attr("y", "12%")
            .attr("font-size", "120")
            .attr("font-weight", "bold")
            .attr("fill", opts.textColor)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("style", `font-family: monospace, monospace;`)
            .text(opts.title || "");
    }

    if (opts.animate) {
        svg.append("text")
            .attr("id", `top-title`)
            .attr("class", "top-title")
            .attr("x", "1%")
            .attr("y", `${height - 600}`)
            .attr("font-size", "80")
            .attr("font-weight", "bold")
            .attr("fill", opts.textColor)
            .attr("stroke", opts.textColor)
            .attr("style", `font-family: monospace, monospace;`)

        for (let topNumber = 0; topNumber < 5; topNumber++) {
            svg.append("text")
                .attr("id", `top-${topNumber}`)
                .attr("class", "top")
                .attr("x", "1%")
                .attr("y", `${height - 510 + (90 * topNumber)}`)
                .attr("font-size", "65")
                .attr("fill", opts.textColor)
                .attr("stroke", opts.textColor)
                .attr("style", `font-family: monospace, monospace;`)
        }

        svg.append("text")
            .attr("id", "top-peering-title")
            .attr("class", "top-peering-title")
            .attr("x", "1%")
            .attr("y", "200")
            .attr("font-size", "80")
            .attr("font-weight", "bold")
            .attr("fill", opts.textColor)
            .attr("stroke", opts.textColor)
            .attr("style", `font-family: monospace, monospace;`)

        for (let topNumber = 0; topNumber < 5; topNumber++) {
            svg.append("text")
                .attr("id", `top-peering-${topNumber}`)
                .attr("class", "top")
                .attr("x", "1%")
                .attr("y", `${290 + (90 * topNumber)}`)
                .attr("font-size", "65")
                .attr("fill", opts.textColor)
                .attr("stroke", opts.textColor)
                .attr("style", `font-family: monospace, monospace;`)
        }

        const leftColumnX = parseInt(width * 0.6);
        const rightColumnX = leftColumnX + 1000;

        svg.append("text")
            .attr("id", "this-year-cable-added")
            .attr("class", "stats")
            .attr("x", leftColumnX)
            .attr("y", `${height - 330}`)
            .attr("font-size", "65")
            .attr("fill", opts.textColor)
            .attr("stroke", opts.textColor)
            .attr("style", `font-family: monospace, monospace;`)

        svg.append("text")
            .attr("id", "total-cable-count")
            .attr("class", "stats")
            .attr("x", rightColumnX)
            .attr("y", `${height - 330}`)
            .attr("font-size", "65")
            .attr("fill", opts.textColor)
            .attr("stroke", opts.textColor)
            .attr("style", `font-family: monospace, monospace;`)


        svg.append("text")
            .attr("id", "this-year-km-added")
            .attr("class", "stats")
            .attr("x", leftColumnX)
            .attr("y", `${height - 240}`)
            .attr("font-size", "65")
            .attr("fill", opts.textColor)
            .attr("stroke", opts.textColor)
            .attr("style", `font-family: monospace, monospace;`)

        svg.append("text")
            .attr("id", "total-cable-km")
            .attr("class", "stats")
            .attr("x", rightColumnX)
            .attr("y", `${height - 240}`)
            .attr("font-size", "65")
            .attr("fill", opts.textColor)
            .attr("stroke", opts.textColor)
            .attr("style", `font-family: monospace, monospace;`)

        svg.append("text")
            .attr("id", "regions-title")
            .attr("class", "regions-title")
            .attr("x", "73%")
            .attr("y", "200")
            .attr("font-size", "80")
            .attr("font-weight", "bold")
            .attr("fill", opts.textColor)
            .attr("stroke", opts.textColor)
            .attr("style", `font-family: monospace, monospace;`)
            .text("Peering per region")

        regions.forEach((_, idx) => {
            svg.append("text")
                .attr("id", `regions-${idx}`)
                .attr("class", "top")
                .attr("x", "73%")
                .attr("y", `${290 + (90 * idx)}`)
                .attr("font-size", "65")
                .attr("fill", opts.textColor)
                .attr("stroke", opts.textColor)
                .attr("style", `font-family: monospace, monospace;`)
        })
    }

    const outFile = opts.outputPrefix + "the-internet-map.svg"
    const dirName = path.dirname(outFile)
    console.log('writing output to ' + outFile);
    fs.mkdirSync(dirName, { recursive: true });
    fs.writeFile(outFile, d3n.svgString(), function (err) {
        if (err) return console.log(err);
    })
}

let citySpeedsData = fs.readFileSync('./data/city-speeds.json');
let citySpeeds = JSON.parse(citySpeedsData);

const cityPeering = _.chain(citySpeeds)
    .reduce(function (result, city) {
        _.forEach(city.speedYears, function (yearSpeed, year) {
            (result[year] || (result[year] = [])).push({
                id: `city-${city.id}`,
                city: city.city,
                country: city.country,
                total: yearSpeed.total,
                total_str: prettyBytes(yearSpeed.total * 1000 * 1000, { bits: true }),
                added_str: prettyBytes(yearSpeed.added_speed * 1000 * 1000, { bits: true }),
            })
        })
        return result;
    }, {})
    .reduce(function (result, cities, year) {
        result[year] = _(cities).sortBy('total').reverse()
        return result
    }, {})
    .value()

fs.mkdirSync("output/", { recursive: true });
fs.writeFile("output/sorted-city-peering.json", JSON.stringify(cityPeering), function (err) {
    if (err) return console.log(err);
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: true,
    animate: false,
    showCitySpeeds: true,
    showCountryLines: false,
    backgroundColor: "#333",
    countryBackgroundColor: "#3c3c3c",
    textColor: "#888",
    outputPrefix: "output/transparent_",
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    ActiveCableColor: "#FFA500",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: false,
    animate: false,
    showCitySpeeds: true,
    showCountryLines: true,
    backgroundColor: "#333",
    countryBackgroundColor: "#3c3c3c",
    textColor: "#888",
    outputPrefix: "output/",
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    ActiveCableColor: "#FFA500",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: false,
    animate: false,
    showCitySpeeds: true,
    showCountryLines: false,
    backgroundColor: "#333",
    countryBackgroundColor: "#3c3c3c",
    textColor: "#888",
    outputPrefix: "output/nocountrylines_",
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    ActiveCableColor: "#FFA500",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: false,
    animate: true,
    showCitySpeeds: true,
    showLandingPoints: true,
    showCountryLines: true,
    backgroundColor: "#333",
    countryBackgroundColor: "#3c3c3c",
    textColor: "#888",
    outputPrefix: `output/animated/`,
    cableFilter: (cable) => cable.properties.rfs_year != null && cable.properties.rfs_year <= 2024,
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    ActiveCableColor: "#FFA500",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})

buildImage(geoMercator(), {
    width: 5600,
    height: 4000,
    transparent: false,
    animate: true,
    showCitySpeeds: true,
    showLandingPoints: true,
    showCountryLines: false,
    backgroundColor: "#333",
    countryBackgroundColor: "#3c3c3c",
    textColor: "#888",
    outputPrefix: `output/animated/nocountrylines_`,
    cableFilter: (cable) => cable.properties.rfs_year != null && cable.properties.rfs_year <= 2024,
    // https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1
    InternetExchangeColorScale: ["#577590", "#4D908E"],
    CableColor: "#577590",
    ActiveCableColor: "#FFA500",
    LandingPointColor: "#555",
    InternetExchangeCircleColor: "white",
})
