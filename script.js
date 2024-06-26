let years = {
    "population": {
        "startYear": 2000,
        "endYear": 2020
    },
    "gdp": {
        "startYear": 2000,
        "endYear": 2018
    }
}

// Set the dimensions to fill the screen
const width = window.innerWidth, height = window.innerHeight;

// Add popup urging user to refresh if the page is resized (otherwise things get messy)
window.addEventListener('resize', function(event) {
    showRefreshPopup();
}, true);

// Start with default values. Otherwise some may get cached.
document.getElementById('mercator').checked = true;
document.getElementById("metric-selector").value = "population";
document.getElementById("year-slider").value = "2000";
document.getElementById("item-count-slider").value = "10";

// Fix selector highlighter width at the top of the page
const switchContainer = document.getElementById('switchContainer');
const highlighter = document.getElementById('highlighter');
const switchLabels = switchContainer.querySelectorAll('.switch-label');

// Display the selector next to existing controls in bottom left corner.
document.getElementById('elements-selector').style.left = 
    `${document.getElementById('controls').getBoundingClientRect().right + 10}px`; // 10px gap

function setHighlighterWidth() {
    const checkedInput = switchContainer.querySelector('input[name="switch"]:checked');
    const checkedLabelWidth = checkedInput.nextElementSibling.offsetWidth;
    highlighter.style.width = checkedLabelWidth + 'px';
}

function setHighlighterPosition() {
    const checkedInput = switchContainer.querySelector('input[name="switch"]:checked');
    const index = Array.from(checkedInput.parentElement.querySelectorAll('input')).indexOf(checkedInput);
    let offset = 0;
    for (let i = 0; i < index; i++) {
        offset += switchLabels[i].offsetWidth;
    }
    highlighter.style.left = offset + 'px';
}

// Update the highlighter width on load
setHighlighterWidth();
setHighlighterPosition();

// Append the SVG object to the body of the page
const svgContainer = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const svg = svgContainer.append("g");

// Append Treemap SVG object
const svgTreemapContainer = d3.select("#treemapHolder")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const treemapSvg = svgTreemapContainer.append("g");

// Define ocean background
svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#a2d5f2");

// Map projection
const mercatorProjection = d3.geoMercator()
    .scale((width - 3) / (2 * Math.PI))
    .translate([width / 2, height / 2]);

const globeProjection = d3.geoOrthographic()
    .scale((width - 3) / 2)
    .translate([width / 2, height / 2])
    .clipAngle(90);

var projection = mercatorProjection;

// Define the scale and sensitivity for the globe view
const sensitivity = 75
const initialScale = projection.scale()

// Create a scale for the colors
var colorScale = d3.scaleQuantize()
    .domain([0, 100000000])
    .range(["#ffedea", "#ffcec5", "#ffad9f", "#ff8a75", "#ff5533", "#e2492d", "#be3d26", "#9a311f", "#782618"]);

// Load external data
Promise.all([
    d3.json("map/world.geojson"),
    d3.csv("data/filtered_df.csv"),
    d3.csv("data/cities.csv"),
    d3.csv("data/weather-aggregated.csv"),
    d3.csv("data/countries.csv"),
    d3.csv("data/yearly_country_avg.csv")
]).then(function ([geoData, energyData, cityData, weatherData, countryData, yearlyCountryAvgData]) {
    // Process the weather data
    const processedWeatherData = yearlyCountryAvgData.map(d => ({
        country: d.country,
        year: +d.year,
        avg_temp_c: +d.avg_temp_c,
        max_temp_c: +d.max_temp_c,
        min_temp_c: +d.min_temp_c,
        snow_depth: +d.snow_depth,
        precipitation_mm: +d.precipitation_mm
    }));

    // Process the energy data
    const processedData = energyData.map(d => ({
        country: d.country,
        year: +d.year,
        population: +d.population,
        gdp: +d.gdp,
        biofuel_share_elec: +d.biofuel_share_elec,
        biofuel_share_energy: +d.biofuel_share_energy,
        coal_share_elec: +d.coal_share_elec,
        coal_share_energy: +d.coal_share_energy,
        electricity_share_energy: +d.electricity_share_energy,
        fossil_share_elec: +d.fossil_share_elec,
        fossil_share_energy: +d.fossil_share_energy,
        gas_share_elec: +d.gas_share_elec,
        gas_share_energy: +d.gas_share_energy,
        hydro_share_elec: +d.hydro_share_elec,
        hydro_share_energy: +d.hydro_share_energy,
        low_carbon_share_elec: +d.low_carbon_share_elec,
        low_carbon_share_energy: +d.low_carbon_share_energy,
        nuclear_share_elec: +d.nuclear_share_elec,
        nuclear_share_energy: +d.nuclear_share_energy,
        oil_share_elec: +d.oil_share_elec,
        oil_share_energy: +d.oil_share_energy,
        other_renewables_share_elec: +d.other_renewables_share_elec,
        other_renewables_share_elec_exc_biofuel: +d.other_renewables_share_elec_exc_biofuel,
        other_renewables_share_energy: +d.other_renewables_share_energy,
        renewables_share_elec: +d.renewables_share_elec,
        renewables_share_energy: +d.renewables_share_energy,
        solar_share_elec: +d.solar_share_elec,
        solar_share_energy: +d.solar_share_energy,
        wind_share_elec: +d.wind_share_elec,
        wind_share_energy: +d.wind_share_energy
    }));

    let currentYear = 2000;
    let currentMetric = 'population';

    let treemapCountryCount = 10;
    
    let seaPath = svg.append("circle")
        .attr("class", "sea-circle") // Assigning a class
        .attr("fill", "#0672cb")
        .attr("stroke", "#000")
        .attr("stroke-width", "1")
        .attr("cx", width/2)
        .attr("cy", height/2)
        .attr("r", initialScale)
        .style("display", "none");
        
    // play button
    let isPlaying = false;
    let interval;
    let startYear = currentMetric in years ? years[currentMetric]["startYear"] : 2000;
    let endYear = currentMetric in years ? years[currentMetric]["endYear"] : 2020;
    // end play button variables

    function updateColorScale(metric) {
        const metricData = processedData.map(d => d[metric]);
        const minValue = d3.min(metricData);
        const maxValue = d3.max(metricData);

        colorScale = d3.scaleQuantize()
            .domain([minValue, maxValue])
            .range(["#ffedea", "#ffcec5", "#ffad9f", "#ff8a75", "#ff5533", "#e2492d", "#be3d26", "#9a311f", "#782618"]);
    }

    function updateMap(year, metric) {
        updateColorScale(metric);
        const yearData = processedData.filter(d => d.year === year);

        // Join the geo data with the energy data
        const data = geoData.features.map(geo => {
            const energy = yearData.find(p => p.country === geo.properties.name);
            return {
                ...geo,
                properties: { ...geo.properties, ...energy }
            };
        });

        const countryPaths = svg.selectAll("path.country")
            .data(data);

        countryPaths
            .join("path")
            .attr("class", "country")
            .attr("fill", d => d.properties[metric] ? colorScale(d.properties[metric]) : "#ccc")
            .attr("d", d3.geoPath().projection(projection))
            .style("stroke", "black")
            .on("mouseover", function (event, d) {
                d3.select(this).style("stroke-width", 2).style("stroke", "orange");
                showTooltip(event, `${d.properties.name} - ${metric}: ${formatNumber(d.properties[metric]) || "N/A"}`);
            })
            .on("mouseout", function (event, d) {
                d3.select(this).style("stroke-width", 1).style("stroke", "black");
                hideTooltip();
            })
            .on("click", function (event, d) {
                showCountryModal(d.properties, cityData, weatherData);
            });

        updateLegend(metric);
    }
    
    // On clicking another projection, adjust the map and selector
    let previousId = null;
    switchContainer.addEventListener('change', (event) => {
        const switchId = event.target.id;
        if(previousId == "treemap"){
            d3.select("#elements-selector")
                .transition()
                .duration(500)
                .style("opacity", 0)
                .on("end", function() { // After the transition ends, set display to none
                    d3.select("#elements-selector").style("display", "none");
                });
        }
        switch(switchId) {
            case "treemap":
                d3.select("#map").style("display", "none");
                svg.style("display", "none");
                treemapSvg.style("display", "block");

                d3.select("#elements-selector")
                    .style("display", "block")
                    .transition()
                    .duration(500)
                    .style("opacity", 1);
            
                updateTreemap(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount);
                break;
            case "globe":
                d3.select("#map").style("display", "block");
                svg.style("display", "block");
                svg.style("transform","translate(0px,0)");
                treemapSvg.style("display", "none");
                projection = globeProjection;
                svg.call(globeDrag).call(globeZoom);
                projection.scale(initialScale);
                svg.selectAll("path.country").attr("d", d3.geoPath().projection(projection));
                svg.select(".sea-circle").attr("r", projection.scale());
                svg.select(".sea-circle").style("display", "block");
                break;
            default:
                d3.select("#map").style("display", "block");
                svg.style("display", "block");
                svg.style("transform","translate(0px,0)");
                treemapSvg.style("display", "none");
                projection = mercatorProjection;
                svg.call(mercatorZoom).call(d3.drag())
                    .call(mercatorZoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(1));
                svg.select(".sea-circle").style("display", "none");
                break;
        }
        updateMap(currentYear, currentMetric)

        setHighlighterPosition();
        setHighlighterWidth();
        previousId = switchId;
    });

    function updateLegend(metric) {
        d3.select(".legend").remove();

        const legend = svgContainer.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - 150}, ${height - 250})`);

        const legendTitle = legend.append("text")
            .attr("class", "legend-title")
            .attr("x", 0)
            .attr("y", -10)
            .text(metric.toUpperCase());

        const legendScale = d3.scaleLinear()
            .domain(colorScale.domain())
            .range([0, 200]);

        const legendAxis = d3.axisRight(legendScale)
            .tickSize(13)
            .tickValues(colorScale.domain())
            .tickFormat(formatNumber);

        legend.append("g")
            .selectAll("rect")
            .data(colorScale.range().map((color, i) => {
                return {
                    color: color,
                    value: colorScale.invertExtent(color)[0]
                };
            }))
            .enter()
            .append("rect")
            .attr("x", 0)
            .attr("y", (d, i) => i * 20)
            .attr("width", 20)
            .attr("height", 20)
            .style("fill", d => d.color);

        legend.append("g")
            .attr("transform", "translate(20, 0)")
            .call(legendAxis);
    }

    // Call updateMap initially to load the default view
    updateMap(currentYear, currentMetric);
    updateTreemap(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount);

    // Setup UI controls for year and metric
    d3.select("#year-slider").on("input", function () {
        currentYear = +this.value;
        d3.select("#year-display").text(`Year: ${currentYear}`);
        updateMap(currentYear, currentMetric);
        updateTreemap(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount);
    });
    
    d3.select("#metric-selector").on("change", function (event) {
        currentMetric = this.value;
        startYear = currentMetric in years ? years[currentMetric]["startYear"] : 2000;
        endYear = currentMetric in years ? years[currentMetric]["endYear"] : 2020;
        updateMap(currentYear, currentMetric);
        updateTreemap(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount);
    });
    
    d3.select("#item-count-slider").on("input", function () {
        treemapCountryCount = +this.value;
        d3.select("#item-count-display").text(`Display: ${treemapCountryCount} items`);
        updateTreemap(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount);
    });

    svg.call(mercatorZoom).call(d3.drag())
        .call(mercatorZoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(1));
    updateMap(currentYear, currentMetric);

    // dani code below:

    // Function to start the iteration
    function startIteration() {
        if (currentYear >= endYear) currentYear = startYear;
        interval = setInterval(() => {
            if (currentYear >= endYear) {
                clearInterval(interval);
                isPlaying = false;
                document.getElementById('playPauseBtn').textContent = 'Play';
                return;
            }
            updateMap(currentYear, currentMetric);
            updateTreemap(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount);
            currentYear++;
            d3.select("#year-display").text(`Year: ${currentYear}`);
            d3.select("#year-slider").property("value", currentYear);
        }, 1000);
    }

    // Play/Pause Button Event Listener
    document.getElementById('playPauseBtn').addEventListener('click', () => {
        if (isPlaying) {
            clearInterval(interval);
            document.getElementById('playPauseBtn').textContent = 'Play';
        } else {
            document.getElementById('playPauseBtn').textContent = 'Pause';
            startIteration();
        }
        isPlaying = !isPlaying;
    });

    // end dani code
});

// Tooltip functions
function showTooltip(event, text) {
    const tooltip = d3.select("body").append("div")
        .attr("id", "map-tooltip")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("opacity", 0)
        .html(text)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
        .transition()
        .duration(200)
        .style("opacity", 1);
}

function hideTooltip() {
    d3.select("#map-tooltip").remove();
}

function showCountryModal(properties, cityData, weatherData) {
    d3.selectAll(".modal-background").remove();

    const modalBackground = d3.select("body").append("div")
        .attr("class", "modal-background");

    const modal = modalBackground.append("div")
        .attr("class", "modal");

    // Container for the top two-thirds section
    const topContainer = modal.append("div")
        .attr("class", "top-container");

    // Left section for selections
    const selectionContainer = topContainer.append("div")
        .attr("class", "selection-container");

    // Country name at the top of the selection container
    selectionContainer.append("h1").text(properties.name);

    // Year range selector
    const yearRangeContainer = selectionContainer.append("div")
        .attr("id", "year-range-container")
        .style("margin-bottom", "10px");

    yearRangeContainer.append("label")
        .attr("for", "start-year")
        .text("Start Year:");

    const startYearInput = yearRangeContainer.append("input")
        .attr("type", "number")
        .attr("id", "start-year")
        .attr("min", "2000")
        .attr("max", "2020")
        .attr("value", "2000")
        .style("margin-right", "10px");

    yearRangeContainer.append("label")
        .attr("for", "end-year")
        .text("End Year:");

    const endYearInput = yearRangeContainer.append("input")
        .attr("type", "number")
        .attr("id", "end-year")
        .attr("min", "2000")
        .attr("max", "2020")
        .attr("value", "2020");

    // Features title
    selectionContainer.append("h3").text("Features");

    // Feature selector
    const featureSelector = selectionContainer.append("div")
        .attr("id", "feature-selector");

    const features = ['population', 'gdp', 'biofuel_share_elec', 'biofuel_share_energy', 'coal_share_elec', 'coal_share_energy',
        'electricity_share_energy', 'fossil_share_elec', 'fossil_share_energy', 'gas_share_elec', 'gas_share_energy',
        'hydro_share_elec', 'hydro_share_energy', 'low_carbon_share_elec', 'low_carbon_share_energy', 'nuclear_share_elec',
        'nuclear_share_energy', 'oil_share_elec', 'oil_share_energy', 'other_renewables_share_elec', 'other_renewables_share_elec_exc_biofuel',
        'other_renewables_share_energy', 'renewables_share_elec', 'renewables_share_energy', 'solar_share_elec', 'solar_share_energy',
        'wind_share_elec', 'wind_share_energy', 'avg_temp_c', 'max_temp_c', 'min_temp_c', 'snow_depth', 'precipitation_mm'];

    features.forEach(feature => {
        featureSelector.append("div")
            .attr("class", "feature-option")
            .style("padding", "5px")
            .style("cursor", "pointer")
            .style("user-select", "none")
            .text(feature)
            .on("click", function () {
                d3.select(this).classed("selected", !d3.select(this).classed("selected"));
            });
    });

    // Formula input section
    const formulaContainer = selectionContainer.append("div")
        .attr("id", "formula-container")
        .style("margin-top", "10px");

    formulaContainer.append("label")
        .attr("for", "formula-input")
        .text("Enter Formula:");

    const formulaInput = formulaContainer.append("input")
        .attr("type", "text")
        .attr("id", "formula-input")
        .attr("placeholder", "e.g., (d.gdp + d.population) / 2");

    const addFormulaButton = formulaContainer.append("button")
        .attr("class", "add-formula-button")
        .text("+")
        .on("click", function () {
            const formula = document.getElementById("formula-input").value;
            addFormula(formula);
        });

    // Formula list section
    const formulaListContainer = selectionContainer.append("div")
        .attr("id", "formula-list-container")
        .style("margin-top", "10px");

    formulaListContainer.append("h3").text("Formulas:");

    const formulaList = formulaListContainer.append("div")
        .attr("id", "formula-list")
        .style("height", "100px")
        .style("overflow-y", "scroll")
        .style("border", "1px solid #ddd")
        .style("padding", "5px");

    // Right section for the map
    const mapContainer = topContainer.append("div")
        .attr("class", "map-container");

    let isPlaying = false;
    let interval;
    let endYear = d3.select("#end-year").node().value;
    let startYear = d3.select("#start-year").node().value;
    let currentMetric = "precipitation_mm";
    let currentYear = startYear;
    // end play button variables

    let fn = "map/countries/" + properties.name.toLowerCase().replaceAll(" ", "_") + ".json";
    Promise.all([
        d3.json(fn)
    ]).then(function ([countryData]) {

        // Load and display the detailed country map
        const divMapContainer = mapContainer.append("div")
                                .attr("id", "divMapContainer")
                                .style("display", "flex")
                                .style("justify-content", "flex-end")
                                .style("align-items","center");

        const playButton = divMapContainer.append("button")
            .attr("id", "country-play-button")
            .text("Play")
            .on("click", function () {
                if (isPlaying) {
                    clearInterval(interval);
                    document.getElementById('country-play-button').textContent = 'Play';
                } else {
                    document.getElementById('country-play-button').textContent = 'Pause';
                    startIteration();
                }
                isPlaying = !isPlaying;
            });

        // Append the select element
        const select = divMapContainer.append("select")
            .attr("id", "country-metric-selector")
            .style("margin-left", "40px");

        // Append the option elements to the select element
        select.append("option")
            .attr("value", "precipitation_mm")
            .text("Precipitation");

        select.append("option")
            .attr("value", "avg_temp_c")
            .text("Avg Temp");

        select.append("option")
            .attr("value", "max_temp_c")
            .text("Max Temp");
        
        select.append("option")
            .attr("value", "min_temp_c")
            .text("Min Temp");

        d3.select("#country-metric-selector").on("change", function (event) {
            currentMetric = this.value;
            currentYear = startYear;
            updateCountryMap(properties, mapContainer, cityData, weatherData, countryData, currentYear, currentMetric);
        });

        divMapContainer.append("h4")
            .attr("id", "country-year-display")
            .style("margin-left", "40px")
            .text("Current Year: 2000");

        // Function to start the iteration
        function startIteration() {
            if (currentYear >= endYear) currentYear = startYear - 1;
            interval = setInterval(() => {
                if (currentYear >= endYear) {
                    clearInterval(interval);
                    isPlaying = false;
                    document.getElementById('country-play-button').textContent = 'Play';
                    return;
                }
                currentYear++;
                updateCountryMap(properties, mapContainer, cityData, weatherData, countryData, currentYear, currentMetric)
                d3.select("#country-year-display").text(`Current Year: ${currentYear}`);
            }, 1000);
        }
        
        drawCountryMap(properties, mapContainer, cityData, countryData);
        updateCountryMap(properties, mapContainer, cityData, weatherData, countryData, currentYear, currentMetric);
    });
    
    // Bottom section for the plot
    const plotContainer = modal.append("div")
        .attr("class", "plot-container");

    // Container for line plot area
    plotContainer.append("div")
        .attr("id", "line-plot-area")
        .attr("class", "plot-area");

    // Container for bar plot area
    plotContainer.append("div")
        .attr("id", "bar-plot-area")
        .attr("class", "plot-area");

    // Container for the buttons
    const buttonContainer = plotContainer.append("div")
        .attr("class", "button-container");

    // Plot Selected Features button
    const plotButton = buttonContainer.append("button")
        .attr("class", "plot-button")
        .text("Plot Selected Features")
        .on("click", function () {
            const selectedFeatures = d3.selectAll(".feature-option.selected").nodes().map(node => node.innerText);
            const startYear = +document.getElementById("start-year").value;
            const endYear = +document.getElementById("end-year").value;
            drawPlots(properties.name, selectedFeatures, startYear, endYear);
        });

    // Plot All Features button
    const plotAllButton = buttonContainer.append("button")
        .attr("class", "plot-button")
        .text("Plot All Features")
        .on("click", function () {
            const startYear = +document.getElementById("start-year").value;
            const endYear = +document.getElementById("end-year").value;
            drawPlots(properties.name, features, startYear, endYear);
        });

    // Plot Formula button
    const plotFormulaButton = buttonContainer.append("button")
        .attr("class", "plot-button")
        .text("Plot Formulas")
        .on("click", function () {
            const selectedFormulas = d3.selectAll(".formula-checkbox:checked").nodes().map(node => node.value);
            const startYear = +document.getElementById("start-year").value;
            const endYear = +document.getElementById("end-year").value;
            plotFormulas(properties.name, selectedFormulas, startYear, endYear);
        });

    modal.on("click", function (event) {
        event.stopPropagation();
    });

    modalBackground.on("click", function () {
        modalBackground.remove();
        svgContainer.style("filter", "");
    });

    // Apply the blur effect to the SVG container
    svgContainer.style("filter", "blur(8px)");
}

function getColor(i, countryCities, weatherData, currentYear, currentMetric) {
    const stationData = weatherData.filter(d => d.station_id == countryCities[i].station_id);
    const yearData = stationData.filter(d => d.date == currentYear);

    if (yearData.length < 1)
        return "#ccc";

    var t = yearData[0][currentMetric]
    var hue;
    if(currentMetric == "precipitation_mm")
        hue = 240 * (t / 60)
    else
        hue = 10 + 360 * (30 - t) / 60;
    return 'hsl(' + [hue, '70%', '50%'] + ')';
}

function updateCountryMap(properties, container, cityData, weatherData, countryData, currentYear, currentMetric) {
    const countryName = properties.name.toLowerCase();
    var projection = countryName == "russia" || countryName == "new zealand" ? 
            d3.geoMercator().rotate([-15, 0]) : d3.geoMercator();
    const parentComputedStyle = window.getComputedStyle(container.node());
    const paddingHor = parseFloat(parentComputedStyle.paddingLeft) + parseFloat(parentComputedStyle.paddingRight);
    const paddingVert = parseFloat(parentComputedStyle.paddingTop) + parseFloat(parentComputedStyle.paddingBottom);

    const effWidth = container.node().clientWidth - paddingHor;
    const effHeight = (container.node().clientHeight - paddingVert) * 0.92;
    projection.fitSize([effWidth, effHeight], countryData);

    const countryCities = cityData.filter(d => d.country === properties.name);
    var mapSvg = d3.select("#indiv-map-svg");
    var Tooltip = d3.select("#indiv-map-tooltip");

    // Define the functions for hovering a city
    var onMouseMove = function (event) {
        Tooltip.style("display", "block");
        d3.select(this).attr("r", 7);
        if (typeof event !== 'undefined') {
            Tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        }
    };

    var onMouseLeave = function () {
        Tooltip.style("display", "none");
        d3.select(this).attr("r", 5);
    };

    var onMouseOver = function (d) {
        const stationData = weatherData.filter(d => d.station_id == d3.select(this).attr("station-code"));
        const yearData = stationData.filter(d => d.date == currentYear);

        let value = parseFloat(yearData.length < 1 ? "NaN" : yearData[0][currentMetric]);
        Tooltip.html("City: " + d3.select(this).attr("data-city-name") + " - Value: " + value.toFixed(2));
    };
    
    // Update the voronoi diagram
    const coords = countryCities.map(city => projection([city.longitude, city.latitude]));
    const delaunay = d3.Delaunay.from(coords);
    const voronoi = delaunay.voronoi([0, 0, effWidth, effHeight]);

    // Define a geoPath generator
    const geoPath = d3.geoPath(projection);

    // Create a group for voronoi cells
    var voronoiGroup = mapSvg.select("#voronoi-mapgroup");
    
    // Apply the clip path to the voronoi diagram
    voronoiGroup.selectAll(".voronoi")
        .data(coords)
        .join("path")
        .attr("class", "voronoi")
        .attr("d", (d, i) => voronoi.renderCell(i))
        .attr("clip-path", "url(#clip-country)")
        .style("fill", (d, i) => getColor(i, countryCities, weatherData, currentYear, currentMetric))
        .style("stroke", "black");

    // Update city circles
    const cityCircles = mapSvg.select("#city-group").selectAll("circle")
        .data(countryCities);

    cityCircles.enter()
        .append("circle")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", 5)
        .style("fill", "black")
        .merge(cityCircles)
        .attr("data-city-name", d => d.city_name)
        .attr("station-code", d => d.station_id)
        .on("mouseover", onMouseOver)
        .on("mousemove", onMouseMove)
        .on("mouseleave", onMouseLeave);

    cityCircles.exit().remove();
}

function drawCountryMap(properties, container, cityData, countryData) {
    const countryName = properties.name.toLowerCase();
    const mapSvg = container.append("svg")
        .attr("id", "indiv-map-svg")
        .attr("width", "100%")
        .attr("height", "100%");

    const countryCities = cityData.filter(d => d.country === properties.name);

    // Russia and New Zealand have to be wrapped around
    var projection = countryName == "russia" || countryName == "new zealand" ? 
        d3.geoMercator().rotate([-15, 0]) : d3.geoMercator();
    var path = d3.geoPath().projection(projection);

    // Compute the actual height/width, taking padding into account
    const parentComputedStyle = window.getComputedStyle(container.node());
    const paddingHor = parseFloat(parentComputedStyle.paddingLeft) + parseFloat(parentComputedStyle.paddingRight);
    const paddingVert = parseFloat(parentComputedStyle.paddingTop) + parseFloat(parentComputedStyle.paddingBottom);

    const effWidth = container.node().clientWidth - paddingHor;
    const effHeight = (container.node().clientHeight - paddingVert) * 0.92;
    projection.fitSize([effWidth, effHeight], countryData);

    mapSvg.append("defs").append("clipPath")
        .attr("id", "map-clip")
        .append("path")
        .attr("d", path(countryData));
    
    var mapGroup = mapSvg.append("g")
        .attr("id", "voronoi-mapgroup")
        .attr("clip-path", "url(#map-clip)");

    const cityGroup = mapSvg.append("g")
        .attr("class", "city-group")
        .attr("id", "city-group");


    mapGroup.append("path")
        .datum(countryData)
        .attr("d", path)
        .attr("fill", "grey");

    container.append("div")
        .attr("id", "indiv-map-tooltip")
        .style("display", "none")
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px");
}

function drawPlots(countryName, selectedFeatures, startYear, endYear) {
    Promise.all([
        d3.csv("data/filtered_df.csv"),
        d3.csv("data/yearly_country_avg.csv")
    ]).then(([energyData, weatherData]) => {
        const countryEnergyData = energyData.filter(d => d.country === countryName && d.year >= startYear && d.year <= endYear);
        const countryWeatherData = weatherData.filter(d => d.country === countryName && d.year >= startYear && d.year <= endYear);
        
        // Combine energy and weather data
        const combinedData = countryEnergyData.map(energyEntry => {
            const weatherEntry = countryWeatherData.find(weatherEntry => weatherEntry.year === energyEntry.year);
            return { ...energyEntry, ...weatherEntry };
        });

        // Filter data for years divisible by 5
        const yearsDivisibleByFive = combinedData.filter(d => d.year % 5 === 0);

        // Line plot traces
        const lineTraces = selectedFeatures.map(feature => {
            return {
                x: combinedData.map(d => d.year),
                y: combinedData.map(d => +d[feature]),
                mode: 'lines+markers',
                name: feature
            };
        });

        const lineLayout = {
            title: selectedFeatures.length === 1 ? `${countryName} - ${selectedFeatures[0]}` : `${countryName}`,
            xaxis: { title: 'Year' },
            yaxis: { title: 'Value' },
            margin: { t: 40 }
        };

        Plotly.newPlot('line-plot-area', lineTraces, lineLayout);

        // Prepare data for bar plot
        const shareElecFeatures = [
            'biofuel_share_elec', 'coal_share_elec', 'gas_share_elec', 'hydro_share_elec',
            'nuclear_share_elec', 'oil_share_elec', 'other_renewables_share_elec',
            'solar_share_elec', 'wind_share_elec'
        ];

        // 'fossil_share_elec', 'low_carbon_share_elec', 'renewables_share_elec'

        const shareEnergyFeatures = [
            'biofuel_share_energy', 'coal_share_energy', 
            'gas_share_energy', 'hydro_share_energy', 'nuclear_share_energy',
            'oil_share_energy', 'other_renewables_share_energy', 'solar_share_energy',
            'wind_share_energy'
        ];

        // 'low_carbon_share_energy', 'renewables_share_energy', 'fossil_share_energy','electricity_share_energy', 

        const colors = {
            'biofuel_share_elec': '#1f77b4',
            'coal_share_elec': '#ff7f0e',
            'fossil_share_elec': '#2ca02c',
            'gas_share_elec': '#d62728',
            'hydro_share_elec': '#9467bd',
            'low_carbon_share_elec': '#8c564b',
            'nuclear_share_elec': '#e377c2',
            'oil_share_elec': '#7f7f7f',
            'other_renewables_share_elec': '#bcbd22',
            'renewables_share_elec': '#17becf',
            'solar_share_elec': '#9edae5',
            'wind_share_elec': '#aec7e8',
            'biofuel_share_energy': '#ff9896',
            'coal_share_energy': '#98df8a',
            'electricity_share_energy': '#ffbb78',
            'fossil_share_energy': '#c5b0d5',
            'gas_share_energy': '#c49c94',
            'hydro_share_energy': '#f7b6d2',
            'low_carbon_share_energy': '#c7c7c7',
            'nuclear_share_energy': '#dbdb8d',
            'oil_share_energy': '#9edae5',
            'other_renewables_share_energy': '#17becf',
            'renewables_share_energy': '#bcbd22',
            'solar_share_energy': '#8c564b',
            'wind_share_energy': '#e377c2'
        };

        const barTraces = [];

        // Creating traces for share_elec and share_energy for each year divisible by 5
        yearsDivisibleByFive.forEach(yearData => {
            const year = yearData.year;

            // Create stacked bar for each feature in share_elec
            shareElecFeatures.forEach(feature => {
                barTraces.push({
                    x: [year + '_elec'],
                    y: [yearData[feature]],
                    name: feature,
                    type: 'bar',
                    marker: { color: colors[feature] }
                });
            });

            // Create stacked bar for each feature in share_energy
            shareEnergyFeatures.forEach(feature => {
                barTraces.push({
                    x: [year + '_energy'],
                    y: [yearData[feature]],
                    name: feature,
                    type: 'bar',
                    marker: { color: colors[feature] }
                });
            });
        });

        const barLayout = {
            title: `${countryName} - Energy Data`,
            barmode: 'stack',
            xaxis: {
                title: 'Year',
                tickvals: yearsDivisibleByFive.map(d => d.year).flatMap(year => [year + '_elec', year + '_energy']),
                ticktext: yearsDivisibleByFive.map(d => d.year).flatMap(year => [year, year])
            },
            yaxis: { title: 'Share' },
            margin: { t: 40 }
        };

        Plotly.newPlot('bar-plot-area', barTraces, barLayout);
    });
}

function plotFormulas(countryName, formulas, startYear, endYear) {
    d3.csv("data/filtered_df.csv").then(data => {
        const countryData = data.filter(d => d.country === countryName && d.year >= startYear && d.year <= endYear);

        try {
            const traces = formulas.map((formula, index) => {
                const calculateFormula = new Function('d', `with (d) { return ${formula}; }`);
                const result = countryData.map(calculateFormula);
                return {
                    x: countryData.map(d => d.year),
                    y: result,
                    mode: 'lines+markers',
                    name: `Formula ${index + 1}`
                };
            });

            const layout = {
                title: `${countryName} - Formulas Result`,
                xaxis: { title: 'Year' },
                yaxis: { title: 'Value' },
                margin: { t: 40 }
            };

            Plotly.newPlot('line-plot-area', traces, layout);
        } catch (error) {
            alert('Error in formula: ' + error.message);
        }
    });
}

function addFormula(formula) {
    const formulaList = d3.select("#formula-list");

    const formulaItem = formulaList.append("div")
        .attr("class", "formula-item")
        .style("display", "flex")
        .style("align-items", "center");

    formulaItem.append("input")
        .attr("type", "checkbox")
        .attr("class", "formula-checkbox")
        .attr("value", formula);

    formulaItem.append("span")
        .style("margin-left", "10px")
        .text(formula);

    // Clear the formula input
    document.getElementById("formula-input").value = '';
}

// Custom drag behavior for globe
const globeDrag = d3.drag()
    .on('drag', (event) => {
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale();
        projection.rotate([
            rotate[0] + event.dx * k,
            rotate[1] - event.dy * k
        ]);
        svg.selectAll("path.country").attr("d", d3.geoPath().projection(projection));
    });

// Custom zoom behavior for globe 
const globeZoom = d3.zoom()
    .on('zoom', (event) => {
        if (event.transform.k > 0.3) {
            projection.scale(initialScale * event.transform.k);
            svg.selectAll("path.country").attr("d", d3.geoPath().projection(projection));
            svg.select(".sea-circle").attr("r", projection.scale());
        } else {
            event.transform.k = 0.3;
        }
    });

// Mercator zoom behavior
const mercatorZoom = d3.zoom()
    .scaleExtent([0.3, 10])
    .on('zoom', (event) => {
        const transform = event.transform;
        
        // Update the projection's scale and translation
        projection
            .scale(initialScale * transform.k)
            .translate([transform.x, transform.y]);
        
        // Update the paths with the new projection settings
        svg.selectAll("path.country").attr("d", d3.geoPath().projection(projection));
    });


// Transform the data for the treemap
function transformData(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount) {
    const yearData = processedData.filter(d => d.year === currentYear);

    const data = geoData.features.map(geo => {
        const energy = yearData.find(p => p.country === geo.properties.name);
        const country = countryData.find(p => p.country === geo.properties.name);
        return {
            ...geo,
            properties: { ...geo.properties, ...energy, ...country }
        };
    });
    
    const flattenedData = data.map(country => ({
        ...country,
        value: Number(country.properties[currentMetric]) || 0
    }));

    const sortedData = flattenedData.sort((a, b) => b.value - a.value);

    // Get the top n countries
    const topNData = sortedData.slice(0, treemapCountryCount);

    const temp = topNData.reduce((acc, country) => {
        const continent = country.properties.continent;
        const region = country.properties.region;

        if (!acc[continent]) {
            acc[continent] = {};
        }
        if (!acc[continent][region]) {
            acc[continent][region] = [];
        }
        acc[continent][region].push(country);

        return acc;
    }, {});


    // Convert the nested data to an array format similar to d3.nest()
    const nestedData = Object.keys(temp).map(continent => ({
        key: continent,
        values: Object.keys(temp[continent]).map(region => ({
            key: region,
            values: temp[continent][region]
        }))
    }));

    return {
        name: "root",
        children: nestedData.map(continent => ({
            name: continent.key,
            children: (continent.values || []).map(region => ({
                name: region.key,
                children: (region.values || []).map(country => ({
                    name: country.properties.name,
                    value: country.properties[currentMetric]
                }))
            }))
        }))
    };
}

// Handle the treemap tooltip
function updateTooltipPosition(event, d) {
    treemapTooltip.style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px");
}

function showTreemapTooltip(event, d) {
    treemapTooltip.style("display", "block")
        .html(`<strong>${d.data.name}</strong><br>${formatNumber(d.data.value)}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px");
}

function hideTreemapTooltip(event, d) {
    treemapTooltip.style("display", "none");
}

// Create a treemapTooltip container
const treemapTooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("display", "none");

// Function to update the treemap
function updateTreemap(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount) {
    // Transform the data with the current metric
    const transformedData = transformData(geoData, processedData, countryData, currentMetric, currentYear, treemapCountryCount);

    // Create the root hierarchy
    const root = d3.hierarchy(transformedData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);

    // Apply the treemap layout
    const treemapLayout = d3.treemap()
        .size([width, height])
        .padding(1);
    treemapLayout(root);

    // Bind data to nodes
    const nodes = treemapSvg.selectAll("g")
        .data(root.leaves(), d => d.data.name);

    // Enter new nodes
    const nodesEnter = nodes.enter().append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    nodesEnter.append("rect")
        .attr("class", "node")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => color(d.parent.parent.data.name))
        .on("mouseover", (event, d) => showTreemapTooltip(event, d))
        .on("mouseout", (event, d) => hideTreemapTooltip(event, d))
        .on("mousemove", (event, d) => updateTooltipPosition(event, d));

    nodesEnter.append("text")
        .attr("class", "label")
        .attr("x", 4)
        .attr("y", 14)
        .text(d => d.data.name);

    // Update existing nodes with animation
    nodes.transition().duration(750)
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    nodes.select("rect")
        .transition().duration(750)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => color(d.parent.parent.data.name));

    nodes.select("text")
        .transition().duration(750)
        .attr("x", 4)
        .attr("y", 14)
        .text(d => d.data.name);

    // Remove old nodes
    nodes.exit().remove();
}

function showRefreshPopup() {
    d3.selectAll(".modal-background").remove();

    const modalBackground = d3.select("body").append("div")
        .attr("class", "modal-background");

    const modal = modalBackground.append("div")
        .attr("class", "modal-freesize");

    // Container for the top two-thirds section
    const titleContainer = modal.append("div")
        .attr("class", "top-container")
        .style("text-align", "center");

    const buttonContainer = modal.append("div")
        .style("text-align", "center");

    // Country name at the top of the selection container
    titleContainer
        .append("p")
        .html("You have resized your window.<br/>The visualizations may not be correct anymore.<br/>We recommend refreshing the page to make sure it is accurate!")
        .style("margin", "auto");

    // Plot All Features button
    buttonContainer.append("button")
        .attr("class", "plot-button")
        .text("Refresh!")
        .on("click", function () {
            location.reload();
        });

    modal.on("click", function (event) {
        event.stopPropagation();
    });

    modalBackground.on("click", function () {
        modalBackground.remove();
        svgContainer.style("filter", "");
    });

    // Apply the blur effect to the SVG container
    svgContainer.style("filter", "blur(8px)");
}

function formatNumber(value) {
    if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return value;
}
