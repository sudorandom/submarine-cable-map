const numberFormatter = new Intl.NumberFormat('en-US')

const setYear = function (year) {
    document.querySelectorAll(".active").forEach((cable) => {
        cable.classList.remove("active")
    })
    document.querySelectorAll(".rfs-"+year).forEach((cable) => {
        cable.classList.add("active")
        cable.classList.add("shown")
    })
    document.getElementById("svg-title").innerHTML = `<tspan class="emphasized">Undersea Cables and</tspan>`
    document.getElementById("svg-title-2").innerHTML = `<tspan class="emphasized">Internet Exchanges <tspan class="emphasized active">(${year})</tspan></tspan>`
    document.getElementById("top-title").innerHTML = `Longest cables added in ${year}`
    document.querySelectorAll(".top").forEach((entry) => {
        entry.innerHTML = ""
    })

    yearStats = yearlyStats[year]
    yearStats.longest.forEach((cable, idx) => {
        document.getElementById(`top-${idx}`).innerHTML = `${cable.properties.name}: <tspan class="emphasized active">${numberFormatter.format(cable.lengthKm)}km</tspan>`
    })
    var totalKm = 0
    var totalCount = 0
    for (let i = minYear; i <= year; i++) { 
        stats = yearlyStats[i]
        totalCount+= stats.count
        totalKm += stats.lengthKm
    }
    document.getElementById("this-year-cable-added").innerHTML = `<tspan><tspan class="emphasized active">${yearStats.count}</tspan> new cables</tspan>`
    document.getElementById("total-cable-count").innerHTML = `<tspan><tspan class="emphasized">${totalCount}</tspan> total cables</tspan>`
    document.getElementById("this-year-km-added").innerHTML = `<tspan><tspan class="emphasized active">${numberFormatter.format(yearStats.lengthKm)}km</tspan> of cable added</tspan>`
    document.getElementById("total-cable-km").innerHTML = `<tspan><tspan class="emphasized">${numberFormatter.format(totalKm)}km</tspan> of cable total</tspan>`

    var citySpeeds = yearlyCitySpeeds[year]
    if (citySpeeds) {
        citySpeeds.forEach((citySpeed) => {
            var elem = document.getElementById(citySpeed.id)
            elem.classList.add("active")
            elem.classList.add("shown")
            elem.setAttribute("r", citySpeed.r)
        })
    }
    var topCities = yearlyTopCities[year]
    if (topCities) {
        document.getElementById("top-peering-title").innerHTML = `Top peering cities in ${year}`
        topCities.forEach((city, idx) => {
            document.getElementById(`top-peering-${idx}`).innerHTML = `${city.city}, ${city.country}: <tspan class="emphasized">${city.total_str}</tspan> <tspan class="emphasized active">(+${city.added_str})</tspan>`
        })
    }
}

async function main() {
    for (let i = minYear; i <= maxYear; i++) { 
        setYear(i);
        if (i >= 2010) {
            await new Promise(r => setTimeout(r, 1090*2));
        }
    }
    await new Promise(r => setTimeout(r, 1090*8));

    // Clear all text
    const textElems = document.querySelectorAll("text")
    textElems.forEach((elem) => { elem.setAttribute("visibility", "hidden") })

    // Adjust cable line width so it looks cleaner when zoomed
    const cableLines = document.querySelectorAll(".cable-lines")
    cableLines.forEach((elem) => { elem.style.strokeWidth = "1" })

    // North America
    document.querySelectorAll("svg")[0].setAttribute("viewBox", "800 1400 1200 1200")
    await new Promise(r => setTimeout(r, 1090*4));

    // Europe
    document.querySelectorAll("svg")[0].setAttribute("viewBox", "2300 1300 1200 1000")
    await new Promise(r => setTimeout(r, 1090*4));

    // Africa
    document.querySelectorAll("svg")[0].setAttribute("viewBox", "2380 1900 1300 1500")
    await new Promise(r => setTimeout(r, 1090*4));

    // South America
    document.querySelectorAll("svg")[0].setAttribute("viewBox", "1400 2200 1050 1400")
    await new Promise(r => setTimeout(r, 1090*4));

    // Middle East and Asia
    document.querySelectorAll("svg")[0].setAttribute("viewBox", "3500 2000 1000 1000")
    await new Promise(r => setTimeout(r, 1090*4));

    // Pacific
    document.querySelectorAll("svg")[0].setAttribute("viewBox", "4200 2400 1000 1000")
    await new Promise(r => setTimeout(r, 1090*4));

    // Re-show all text
    textElems.forEach((elem) => { elem.setAttribute("visibility", "visible") })
    cableLines.forEach((elem) => { elem.style.strokeWidth = "2" })

    // Overall View
    document.querySelectorAll("svg")[0].setAttribute("viewBox", "0 0 5600 4000")
    await new Promise(r => setTimeout(r, 1090*8));

    // call stopCapture() if it's defined
    if (typeof stopCapture === 'function') {
        stopCapture()
    }
}

window.onload = function() { main() }
