/*jslint browser: true*/
/*global L */
/*global GEOHEX */
var geohexCode = null;
var startZoomLevel = 10;
var localStoragePrefix = "EW_"; // earthWatchers
var user = localStorage.getItem(localStoragePrefix + "user") || "anonymous";
var satelliteImages = null;
var map = null;
var defaultGeohexLevel = null;
var defaultSatelliteType = "Landsat";
var defaultProject = "Borneo";
var selectedObservationType = null;
var project = null;
var projectObservationTypes = null;
var observationTypesObject = null;
var dragMarkerPosition = null;
var projectName = null;

function gotoNextHexagon() {
    var url = location.href.replace(location.hash, "#/" + projectName);
    location.href = url;
    window.location.reload();
}

function goToHexagon(event) {
    event.originalEvent.preventDefault();

    var newGeohexCode = event.originalEvent.srcElement.id;
    var url = location.href.replace(location.hash, "#/" + projectName + "/" + newGeohexCode);
    location.href = url;

    var previousSelectedHexagon = geohexCode;
    geohexCode = newGeohexCode;

    removeMakersByType("navigation");
    removeMakersByType("observation");
    removeStyles(previousSelectedHexagon);

    addCurrentHexagonStyle(newGeohexCode);
    loadJSON("/api/observations/" + projectName + "/" + geohexCode + "/" + user, function (observations) {
        showObservations(observations);
    });

    getHexagonNavigation(geohexCode, map, user, projectName);

    var polygon = findLayerByName("hexagon" + newGeohexCode);
    (polygon);
    //window.location.reload();
}

function showObservations(observations) {
    var status = getStatusHexagon(observations);
    if(status==="clear"){
       setHexagonColor("clear");
    }
    else if (status==="hasObservations"){
        drawObservations(observations, observationTypesObject);
        setHexagonColor("hasObservations");
    }
}

function clearhexagon() {
    var observations = getObservationsCount();
    if (observations === 0) {
        //post/save there are no observations for this hexagon
        postObservation("clear", user, geohexCode, 0, 0, project.properties.Name, function (resp) {
            setHexagonColor("clear");
            var total = document.getElementById("hexagonstotal").innerHTML;
            loadUserStatistics(project.properties.Name,user,total);
        });
    }
    else {
        var messageDiv = document.getElementById("messageDiv");
        messageDiv.style.display = 'block';
        messageDiv.innerHTML = "To clear the hexagon remove observations first!";
        messageDiv.className = "message messagesShown";
        window.setTimeout(function(){messageDiv.style.display = 'none'},750);
    }
}

function setObservationType(observationType) {
    selectedObservationType = observationType;
    styleObservationTypeButtons(projectObservationTypes, observationType.type);
}

function onMapClick(e) {
    var isInside = isPointInHexagon(geohexCode, e.latlng);
    if (isInside) {
        var observations = getObservationsCount();

        postObservation(selectedObservationType.type, user, geohexCode, e.latlng.lng, e.latlng.lat, project.properties.Name, function (resp) {
            var newMarker = getObservationMarker(map, e.latlng.lng, e.latlng.lat, geohexCode, selectedObservationType.name, resp.id, selectedObservationType,user,project.properties.Name);
            newMarker.options.type = "observation";
            newMarker.addTo(map);
            
            // update statistics
            var total = document.getElementById("hexagonstotal").innerHTML;
            loadUserStatistics(project.properties.Name,user,total);
            
        });

        if (observations === 0) {
            setHexagonColor("hasObservations");
        }
    }
}

function setHexagonColor(status) {
    var layer = findLayerByName("hexagon" + geohexCode);
    if (status === "hasObservations") {
        layer.setStyle({color: "#FF0000"});
    }
    else if (status === "clear") {
        layer.setStyle({color: "#00FF00"});
    }
}

function initializeRouting() {
    Path.map("#/:project").to(function () {
        // sample: #/borneo
        geohexCode = null;
        projectName = this.params["project"];
    });
    Path.map("#/:project/:hex").to(function () {
        // sample: #/borneo/PO2670248
        projectName = this.params["project"];
        geohexCode = this.params["hex"];
    });
    Path.listen();
}

(function (window, document, L) {
    "use strict";
    L.Icon.Default.imagePath = "images/";
    initializeRouting();

    initUserPanel();

    loadJSON("data/observationTypes.json", function (observationTypes) {
        loadJSON("data/projects.geojson", function (projects) {
            if (projectName === null) {
                projectName = defaultProject;
            }
            project = getProjectByName(projects, projectName);
            projectObservationTypes = project.properties.ObservationCategories.split(",");

            observationTypesObject = observationTypes;
            addObservationTypeButtons(projectObservationTypes, observationTypes);

            defaultGeohexLevel = project.properties.GeohexLevel;

            if (geohexCode === null) {
                geohexCode = getRandomHexagon(project, defaultGeohexLevel);
                location.hash = "#/" + projectName + "/" + geohexCode;
            }

            var hexagons = getTotalHexagons();
            console.log("Total Hexagons: " + hexagons.length);

            loadJSON("/api/observations/" + projectName + "/" + geohexCode + "/" + user, function (observations) {

                loadUserStatistics(projectName, user, hexagons.length);

                satelliteTypeSelectionChanged({value: defaultSatelliteType});

                map = L.map("map", {
                    zoomControl: false,
                    attributionControl: false
                });
                L.control.zoom({
                    position:'topright'
                }).addTo(map);
                
                map.on("click", onMapClick);

                drawSatelliteImages(map, defaultSatelliteType);

                drawHexagons(map, hexagons);

                getHexagonNavigation(geohexCode, map,user,projectName);

                var polygon = getGeohexPolygon(geohexCode, null);
                addCurrentHexagonStyle(geohexCode);

                var centerHex = centerOnPolygon(polygon);

                showObservations(observations);

                map.addControl(new L.Control.ZoomMin({
                    position: "topright", startLevel: startZoomLevel, startCenter: centerHex
                }));

                L.control.scale({imperial: false, position: "topleft"}).addTo(map);

                var ggl2 = new L.Google("satellite");
                map.addLayer(ggl2);

                L.geoJson(projects, {fill: false}).addTo(map);

            });
        });
    });

}(window, document, L));
