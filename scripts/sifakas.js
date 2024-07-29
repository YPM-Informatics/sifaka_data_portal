const api = "http://127.0.0.1:5000";
const rootPath = ""; // "/static";
const sidPattern = /^[sS]?(\d+)$/i;
const intPattern = /^\d+$/i;
const numberPattern = /^(-?\d*\.?\d+)$/i;

let individualIds = [];
let groups = [];
let locations = [];

const untaggedCodes =
[
    "UJ",   // Untagged juvenile.
    "UM",   // Untagged male.
    "UF"    // Untagged female.
];

const mapExtent = {
    "maxLat": -23.528545,
    "maxLon": 44.839294,
    "minLat": -23.7751,
    "minLon": 44.418036
}

let map, baseLayer, markerLayer, layonLayer, parcelLayer, selectControl;

const birthDateTypes =
{
    "CER": "Certified",
    "EST": "Estimated",
    "UNK": "Unknown"
}

// Performs a non-blocking wait.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

$(document).on("change", "#filters", function ()
{
    const filter = $(this).find(":selected").val();
    $("table[name='filters']").hide();
    $(`#${filter}`).show();
});

$(document).on("click", "#apply-filter", async function ()
{
    const filter = $("table[name='filters']:visible").attr("id");
    let loc_promises = [];

    if (filter === "sex")
    {
        const sex = $("#sexes").val();
        const filtered = await filterPidsBySex(sex);

        if (filtered)
        {
            $(".spm").remove();
            let delay = 1;
            filtered.forEach(i =>
            {
                setTimeout(() => $("#spms").append(renderIndividualId(i)), delay++);

                loc_promises.push(getEventLocationsByPid(i.pid));
            });

        }
    }
    else if (filter === "sid")
    {
        const sid = $("#sifaka-id").val().match(sidPattern)?.[1].toLowerCase();
        const individualId = individualIds.find(id => id.sids && id.sids.split(",")[0].toLowerCase() === sid);

        if (individualId)
        {
            $(".spm").remove();
            $("#spms").append(renderIndividualId(individualId));

            loc_promises.push(getEventLocationsByPid(individualId.pid));
        }
        else
        {
            showAlertBox(`No individual matching Sifaka id '${sid ? "S" : ""}${sid}'.`);
        }
    }
    else // Date range.
    {
        const intPattern = /^\d+$/i;
        const startMonth = $("#start-month").val().trim() || '';
        const startYear = $("#start-year").val().trim() || '';
        const endMonth = $("#end-month").val().trim() || '';
        const endYear = $("#end-year").val().trim() || '';

        if (!startYear && !endYear)
        {
            showAlertBox("Either start year or end year is required.");
        }

        if (startYear && !startYear.match(intPattern))
        {
            showAlertBox(`Invalid start year value '${startYear}'.`);
            return;
        }

        if (endYear && !endYear.match(intPattern))
        {
            showAlertBox(`Invalid end year value '${endYear}'.`);
            return;
        }

        if (startMonth && !startMonth.match(intPattern))
        {
            showAlertBox(`Invalid start month value '${startMonth}'.`);
            return;
        }

        if (endMonth && !endMonth.match(intPattern))
        {
            showAlertBox(`Invalid end month value '${endMonth}'.`);
            return;
        }

        if (startYear && endYear && parseInt(startYear) > parseInt(endYear))
        {
            showAlertBox("Start year cannot be greater than end year.");
        }

        if (startYear && startMonth && endYear && endMonth && parseInt(startYear) === parseInt(endYear) && parseInt(startMonth) > parseInt(endMonth))
        {
            showAlertBox("Start month cannot be greater than end month.");
        }

        const filtered = await filterPidsByDateRange(startYear, startMonth, endYear, endMonth);

        if (filtered)
        {
            $(".spm").remove();
            let delay = 1;
            filtered.forEach(i =>
            {
                setTimeout(() => $("#spms").append(renderIndividualId(i)), delay++);

                loc_promises.push(getEventLocationsByPid(i.pid));
            });
        }
    }

    if (loc_promises.length)
    {
        clearMap();
        processLocationPromises(loc_promises);
    }
});

$(document).on("click", "#auth-link", function (event)
{
    event.preventDefault();
    const action = $(this).html().toLowerCase();

    if (action === "login")
    {
        if (location.pathname.toLowerCase().indexOf("login.html") < 0)
        {
            location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`);
        }
        else
        {
            $("#login").trigger("click");
        }
    }
    else
    {
        logout();
    }
});

$(document).on("click", ".spm_head", function (evt)
{
    if (evt.target.id.length > 0 && $(this).siblings(".spm_body").is(":visible"))
    {
        return true;
    }

    $(this).siblings(".spm_body").toggle(0, function ()
    {
        handleSpmBodyToggle(this);
    });
});

$(document).on("click", ".fam_ties", function ()
{
    goToIndividual(this);
});

const getEventLocationsByPid = async pid =>
{
    const resp = await fetch(`${api}/events/locations/${pid}`);
    const res = await resp.json();
    return res;
}

const filterPidsBySex = async sex =>
{
    const resp = await fetch(`${api}/pids/filter_by/sex/${sex}`);
    const res = await resp.json();
    return res;
};

const filterPidsByDateRange = async (minYear, minMonth, maxYear, maxMonth) =>
{
    const resp = await fetch(`${api}/pids/filter_by/date_range?min_year=${minYear}&min_month=${minMonth}&max_year=${maxYear}&max_month=${maxMonth}`);
    const res = await resp.json();
    return res;
};

const getAllPids = async () =>
{
    const resp = await fetch(`${api}/pids/all`);
    const res = await resp.json();
    return res;
};

const getYearPids = async () =>
{
    const year = new Date().getFullYear() - 1;
    const month = new Date().getMonth() + 1;
    const resp = await fetch(`${api}/pids/filter_by/date_range?min_year=${year}&min_month=${month}`);
    const res = await resp.json();
    return res;
};

const getAllGroups = async() =>
{
    const resp = await fetch(`${api}/groups/all`);
    const res = await resp.json();
    return res;
}

const getSifakaByPid = async pid =>
{
    const resp = await fetch(`${api}/individuals_full_dev/pid/${pid}`);
    const res = await resp.json();

    return res;
};

const handleSpmBodyToggle = async elem =>
{
    const pid = $(elem).parent().attr("id");

    if ($(elem).is(":visible") && !$(elem).html().length)
    {
        const individual = await getSifakaByPid(pid);

        if (!individual)
        {
            showAlertBox("Individual not found.");
        }
        else
        {
            renderIndividual(individual);
        }
    }
};

const handleResize = () =>
{
    const map_element = document.getElementById("map");
    let window_height = window.innerHeight;
    let new_height = window_height - 140 + "px";
    map_element.style.height = new_height;

    const spms_element = document.getElementById("spms");
    window_height = window.innerHeight;
    new_height = window_height - 140 + "px";
    spms_element.style.height = new_height;
};

function onPopupClose(evt) {
    selectControl.unselect(selectedFeature);
};

function onFeatureSelect(feature) {
    selectedFeature = feature;
    const { lon, lat } = selectedFeature.attributes;

    const pids = locations.filter(l => l.longitude === lon && l.latitude == lat).map(l => l.primary_id);
    const iIds = individualIds.filter(i => pids.includes(i.pid));
    const bubbleCaption = $("<div class='bubble-caption'></div>");
    bubbleCaption.append(iIds.map((val, idx) =>
    {
        const { pid, sids: sidStr } = val;
        const sids = sidStr ? sidStr.split(",") : null;
        const cLink = `<a style="font-size: 11px;" class="fam_ties" href="#${pid}">${(sids ? `S${sids[0]}` : "Untagged Individual")}</a>`;
        let nodes = [cLink];

        if (idx < iIds.length - 1)
        {
            nodes.push(" ");
        }

        return nodes;
    }));

    const outer = $("<div></div>").append(bubbleCaption);
    popup = new OpenLayers.Popup.FramedCloud("group", feature.geometry.getBounds().getCenterLonLat(), null, outer.html(), null, true, onPopupClose);
    feature.popup = popup;
    map.addPopup(popup, true);

    $('.bubble-caption').on("click", ".fam_ties", function ()
    {
        goToIndividual(this);
    });
};

function onFeatureUnselect(feature) {
    map.removePopup(feature.popup);
    feature.popup.destroy();
    feature.popup = null;
};

const clearMap = () =>
{
    map.popups.forEach(p => map.removePopup(p));
    markerLayer.removeAllFeatures();
}

const initMap = () =>
{
    map = new OpenLayers.Map('map',
    {
        displayProjection: new OpenLayers.Projection("EPSG:4326")
    });
    baseLayer = new OpenLayers.Layer.OSM("OSM Layer");
    markerLayer = new OpenLayers.Layer.Vector("Event Locations");
    layonLayer = new OpenLayers.Layer.Vector("Trails/Layons",
    {
        strategies: [new OpenLayers.Strategy.Fixed()],
        protocol: new OpenLayers.Protocol.HTTP(
        {
            url: "map-layers/layons_v2.kml",
            format: new OpenLayers.Format.KML(
            {
                extractStyles: true,
                extractAttributes: true, maxDepth: 2
            })
        })
    });
    parcelLayer = new OpenLayers.Layer.Vector("Parcels",
    {
        strategies: [new OpenLayers.Strategy.Fixed()],
        protocol: new OpenLayers.Protocol.HTTP(
        {
            url: "map-layers/parcels.kml",
            format: new OpenLayers.Format.KML(
            {
                extractStyles: true,
                extractAttributes: true,
                maxDepth: 2
            })
        })
    });

    selectControl = new OpenLayers.Control.SelectFeature(markerLayer,
    {
        onSelect: onFeatureSelect,
        onUnselect: onFeatureUnselect
    });

    const scaleLine = new OpenLayers.Control.ScaleLine();
    scaleLine.geodesic = true;

    map.addLayers([baseLayer, markerLayer, layonLayer, parcelLayer]);
    map.setCenter(new OpenLayers.LonLat(44.628665, -23.651881).transform(new OpenLayers.Projection("EPSG:4326"), map.getProjectionObject()), 12);
    map.addControl(selectControl);
    map.addControl(new OpenLayers.Control.MousePosition({
        numDigits: 6,
        emptyString: "Off map."
    }));
    map.addControl(scaleLine);
    map.addControl(new OpenLayers.Control.LayerSwitcher());
    selectControl.activate();
};

const plotPoint = (point) => {
    const { lon, lat } = point;
    const marker = new OpenLayers.Geometry.Point(lon, lat);
    marker.transform(new OpenLayers.Projection("EPSG:4326"), map.getProjectionObject());
    markerLayer.addFeatures([new OpenLayers.Feature.Vector(marker, { lon, lat })]);
};

const goToIndividual = elem =>
{
    const targetSelector = $(elem).attr("href");

    if ($(`${targetSelector} .spm_head`).length === 0)
    {
        pid = targetSelector.substring(1);
        $("#spms").append(renderIndividualId(individualIds.find(i => i.pid === pid)));
    }

    $(`${targetSelector} .spm_head`).click();
};

const toSentenceCase = str => `${str.charAt(0).toUpperCase()}${str.slice(1)}`;

const getDateString = sDate =>
{
    let day, month, year;

    Object.entries(sDate).forEach(([key, value]) => {
        if (key.toLowerCase().endsWith("day")) {
            day = value;
        }
        else if (key.toLowerCase().endsWith("month")) {
            month = value;
        }
        else if (key.toLowerCase().endsWith("year")) {
            year = value;
        }
    });

    if (!day && !month && !year)
    {
        return null;
    }

    let dateString = year ? `${year}-` : "";

    if (month)
    {
        dateString = `${dateString}${month}-`;
    }

    if (day)
    {
        dateString = `${dateString}${day}-`;
    }

    return dateString.substring(0, dateString.length - 1);
};

const getSifakaAge = (birth, death) =>
{
    const bDateStr = getDateString(birth);
    const dDateStr = getDateString(death);

    if (!bDateStr)
    {
        return null;
    }

    const bDate = new Date(bDateStr);
    const dDate = dDateStr ? new Date(dDateStr) : new Date();

    const diffTime = Math.abs(dDate.getTime() - bDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
};

const showAlertBox = (msg, callback) => {
    $("#alert-box").html(msg.replace(/\n/gi, "<br />"));
    $("#alert-box").addClass("show");
    setTimeout(function (){
        $("#alert-box").removeClass("show");
        if (callback)
        {
            callback();
        }
    }, 3000);
};

const getUsername = () => localStorage.getItem("username");

const processLocationPromises = async locationPromises =>
{
    const points = [];
    locations = [];

    locationPromises.forEach(promise => {
        promise.then(r => r.forEach(l =>
        {
            if (!points.some(p => p.lon === l.longitude && p.lat === l.latitude))
            {
                const point =
                {
                    "lon": l.longitude,
                    "lat": l.latitude
                };

                plotPoint(point);
                points.push(point);
            }

            locations.push(l);
        }));
    });
};

async function logout()
{
    const username = getUsername();

    if (username)
    {
        const resp = await fetch(`${api}/users/logout/${username}`);

        if (resp.ok)
        {
            localStorage.removeItem("username");
            $("#auth-link").html("Login");
            $("#pwd-notice").show();
            $("#action-notice").hide();

            if (location.pathname.toLowerCase().indexOf("census.html") >= 0 || location.pathname.toLowerCase().indexOf("captures.html") >= 0)
            {
                location.assign(".");
            }

            showAlertBox("Logout successful.");
        }
        else
        {
            const res = await resp.json();

            showAlertBox(`Unexpected error '${resp.status} - ${resp.statusText}'.\n${res.message}`);
        }
    }

    showAlertBox("Logout successful.");
};

function sidInputHandler (elem)
{
    const ac_items = $(this).parent().find(".autocomplete-items");
    ac_items.empty();
    const typed = $(elem.target).val();
    const sid = typed.match(sidPattern)?.[1].toLowerCase();

    if (sid && sid.length > 1)
    {
        const results = individualIds.filter(id => id.sids && id.sids.split(",").some(i => i.startsWith(sid)));

        if (results && results.length)
        {
            results.slice(0, 5).forEach(function (res)
            {
                const sifakaIds = res.sids.split(",");
                const idx = sifakaIds.findIndex(i => i.startsWith(sid));
                const attr = idx > 0 ? ` style='font-size: 80%;' title='S${sifakaIds.join("_")}'` : "";
                ac_items.append(`<span${attr}>${idx > 0 ? "*" : ""}S${sifakaIds[0]}</span>`);
            });

            ac_items.show();
            ac_items.css("display", "block");
        }

        else
        {
            ac_items.hide();
        }
    }
    else
    {
        ac_items.hide();
    }
};

function groupInputHandler (elem)
{
    const ac_items = $(this).parent().find(".autocomplete-items");
    ac_items.empty();
    const typed = $(elem.target).val();

    if (typed && typed.length > 0)
    {
        const group_key = typed.toLowerCase();
        const results = groups.filter(g =>
            {
                return g.name.toLowerCase().startsWith(group_key) ||
                g.code.toLowerCase().startsWith(group_key) ||
                (g.synonyms && g.synonyms.split(",").some(s => s.toLowerCase().startsWith(group_key)));
            });

        if (results && results.length)
        {
            results.slice(0, 5).forEach(function (res)
            {
                const synonyms = res.synonyms ? res.synonyms.split(",") : null;
                ac_items.append(`<span ${synonyms ? `title="${synonyms.join(", ")}"` : ""}>${getGroupCaption(res.name, res.code)}</span>`);
            });

            ac_items.show();
            ac_items.css("display", "block");
        }

        else
        {
            ac_items.hide();
        }
    }
    else
    {
        ac_items.hide();
    }
};

$(async () =>
{
    if (getUsername())
    {
        $("#auth-link").html("Logout");
    }

    individualIds = await getAllPids();
    groups = await getAllGroups();
    const individualYearIds = await getYearPids();
    let loc_promises = [];
    let delay = 1;
    individualYearIds.forEach(i =>
    {
        if ($("#spms").length)
        {
            setTimeout(() => $("#spms").append(renderIndividualId(i)), delay++);
        }

        if ($("#map").length)
        {
            loc_promises.push(getEventLocationsByPid(i.pid));
        }
    });

    if ($("#map").length)
    {
        processLocationPromises(loc_promises);
    }

    if ($("#sid #sifaka-id").length)
    {
        addAutoCompleteTo($("#sid #sifaka-id"), sidInputHandler);
    }
});
