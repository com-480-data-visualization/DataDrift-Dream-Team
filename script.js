// Set the dimensions to fill the screen
const width = window.innerWidth, height = window.innerHeight;

// Append the SVG object to the body of the page
const svgContainer = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const svg = svgContainer.append("g");

// Define ocean background
svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#a2d5f2");

// Map projection
const projection = d3.geoMercator()
    .scale((width - 3) / (2 * Math.PI))
    .translate([width / 2, height / 2]);

// Initial color scale for population
let colorScale = d3.scaleQuantize()
    .domain([0, 100000000])
    .range(["#ffedea", "#ffcec5", "#ffad9f", "#ff8a75", "#ff5533", "#e2492d", "#be3d26", "#9a311f", "#782618"]);

// Zoom behavior
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
        const { transform } = event;
        transform.x = Math.min(Math.max(transform.x, width * (1 - transform.k)), 0);
        transform.y = Math.min(Math.max(transform.y, height * (1 - transform.k)), 0);
        svg.attr("transform", transform);
    });

svgContainer.call(zoom);

// Add zoom buttons
const zoomInButton = d3.select("body").append("button")
    .text("+")
    .attr("class", "zoom-button")
    .on("click", () => {
        svgContainer.transition().call(zoom.scaleBy, 2);
    });

const zoomOutButton = d3.select("body").append("button")
    .text("-")
    .attr("class", "zoom-button")
    .style("left", "60px") // Adjust position
    .on("click", () => {
        svgContainer.transition().call(zoom.scaleBy, 0.5);
    });

// Load external data
Promise.all([
    d3.json("map/world.geojson"),
    d3.csv("data/filtered_df.csv"),
    d3.csv("data/cities.csv"),
    d3.csv("data/weather-aggregated.csv"),
    d3.csv("data/yearly_country_avg.csv") // New weather data
]).then(function ([geoData, energyData, cityData, weatherData, yearlyCountryAvgData]) {
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

    let currentYear = 2000;
    let currentMetric = 'population';

    function formatNumber(value) {
        if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
        if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
        if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
        return value;
    }

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

        svg.selectAll("path")
            .data(data)
            .join("path")
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

        // Update legend
        updateLegend(metric);
    }

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

    // Setup UI controls for year and metric
    d3.select("#year-slider").on("input", function () {
        currentYear = +this.value;
        d3.select("#year-display").text(`Year: ${currentYear}`);
        updateMap(currentYear, currentMetric);
    });

    d3.select("#metric-selector").on("change", function (event) {
        currentMetric = this.value;
        updateMap(currentYear, currentMetric);
    });
});

// Tooltip functions
function showTooltip(event, text) {
    const tooltip = d3.select("body").append("div")
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
    d3.select(".tooltip").remove();
}

function showCountryModal(properties, cityData, weatherData) {
    d3.selectAll(".modal-background").remove();

    const modalBackground = d3.select("body").append("div")
        .attr("class", "modal-background");

    const modal = modalBackground.append("div")
        .attr("class", "modal");

    // Container for the top section
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
        'wind_share_elec', 'wind_share_energy', 'avg_temp_c', 'max_temp_c', 'min_temp_c', 'snow_depth', 'precipitation_mm']; // Added weather features

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

    // Load and display the detailed country map
    drawCountryMap(properties, mapContainer, cityData, weatherData);

    // Bottom section for the plots
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

function drawCountryMap(properties, container, cityData, weatherData) {
    const countryName = properties.name.toLowerCase();
    const mapSvg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%");

    const countryCities = cityData.filter(d => d.country === properties.name);

    let fn = "map/countries/" + countryName.replaceAll(" ", "_") + ".json";
    Promise.all([
        d3.json(fn)
    ]).then(function ([countryData]) {
        var projection = d3.geoMercator();
        var path = d3.geoPath().projection(projection);

        // Compute the actual height/width, taking padding into account
        const parentComputedStyle = window.getComputedStyle(container.node());
        const paddingHor = parseFloat(parentComputedStyle.paddingLeft) + parseFloat(parentComputedStyle.paddingRight);
        const paddingVert = parseFloat(parentComputedStyle.paddingTop) + parseFloat(parentComputedStyle.paddingBottom);

        const effWidth = container.node().clientWidth - paddingHor;
        const effHeight = container.node().clientHeight - paddingVert;
        projection.fitSize([effWidth, effHeight], countryData);

        mapSvg.append("defs").append("clipPath")
            .attr("id", "map-clip")
            .append("path")
            .attr("d", path(countryData));
        
        var mapGroup = mapSvg.append("g")
            .attr("clip-path", "url(#map-clip)");

        mapGroup.append("path")
            .datum(countryData)
            .attr("d", path)
            .attr("fill", "grey");

        var Tooltip = container
            .append("div")
            .style("display", "none")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("border", "solid")
            .style("border-width", "2px")
            .style("border-radius", "5px")
            .style("padding", "5px");

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
            Tooltip.html("City: " + d3.select(this).attr("data-city-name"));
        };

        // Append a circle for each city
        coords = []
        countryCities.forEach(city => {
            const projectedCoords = projection([city.longitude, city.latitude])
            coords.push(projectedCoords)
            mapSvg.append("circle")
                .attr("cx", projectedCoords[0])
                .attr("cy", projectedCoords[1])
                .attr("r", 5)
                .style("fill", "black")
                .attr("data-city-name", city.city_name)
                .on("mouseover", onMouseOver)
                .on("mousemove", onMouseMove)
                .on("mouseleave", onMouseLeave);
        });

        // Add the voronoi diagram on top
        const delaunay = d3.Delaunay.from(coords);
        const voronoi = delaunay.voronoi([0, 0, effWidth, effHeight]);

        var test = function (d, i){
            const stationData = weatherData.filter(d => d.station_id == countryCities[i].station_id);

            // TODO: for now just pick 2018 data
            const yearData = stationData.filter(d => d.date == "2018");

            var t = yearData[0]["avg_temp_c"]
            var hue = 30 + 240 * (30 - t) / 60;
            return 'hsl(' + [hue, '70%', '50%'] + ')'
        }

        mapGroup.selectAll(".voronoi")
            .data(coords)
            .enter().append("path")
            .attr("class", "voronoi")
            .attr("d", (d, i) => voronoi.renderCell(i))
            .style("fill", (d, i) => test(d, i))
            .style("stroke", "blue");
    });
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
            'biofuel_share_elec', 'coal_share_elec', 'fossil_share_elec', 'gas_share_elec', 'hydro_share_elec',
            'low_carbon_share_elec', 'nuclear_share_elec', 'oil_share_elec', 'other_renewables_share_elec',
            'renewables_share_elec', 'solar_share_elec', 'wind_share_elec'
        ];
        const shareEnergyFeatures = [
            'biofuel_share_energy', 'coal_share_energy', 'electricity_share_energy', 'fossil_share_energy',
            'gas_share_energy', 'hydro_share_energy', 'low_carbon_share_energy', 'nuclear_share_energy',
            'oil_share_energy', 'other_renewables_share_energy', 'renewables_share_energy', 'solar_share_energy',
            'wind_share_energy'
        ];

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

            Plotly.newPlot('plot-area', traces, layout);
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