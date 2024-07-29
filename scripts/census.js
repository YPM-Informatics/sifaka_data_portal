let individuals = {};
let fetching = [];

if (!getUsername())
{
    alert("Authorization is required to access this area.\nYou will now be redirected to the login page.");
    window.stop();
    location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`);
}

const isSameEvent = (evt, evt1) =>
{
    return evt.event_type === evt1.event_type && evt.event_date.year === evt1.event_date.year && evt.event_date.month === evt1.event_date.month;
};

const byBirth = (s, s1) =>
{
    const { birthMonth: bm, birthDay: bd, birthYear: by } = s.birthDate;
    const { birthMonth: bm1, birthDay: bd1, birthYear: by1 } = s1.birthDate;

    if (by === by1)
    {
        if (bm === bm1)
        {
            if (bd === bd1)
            {
                return 0;
            }
            else
            {
                return bd - bd1;
            }
        }
        else
        {
            return bm - bm1;
        }
    }
    else
    {
        return by - by1
    }
};

const showLocalAlert = (msg) =>
{
    $("#group-widget-alert").show();
    $("#group-widget-alert").html(`<span>${msg}</span>`);
};

$(document).on("click", "#add-census-row", function ()
{
    const row = $(`<tr>
        <td class="date-input">
            <input type="text" placeholder="year" maxlength="4">
            <input type="text" placeholder="month" maxlength="2">
            <input type="text" placeholder="day" maxlength="2">
        </td>
        <td class="sid-input">
            <input type="text" placeholder="S1234" maxlength="10">
        </td>
        <td class="wc-input">
            <input type="checkbox" title="With Child">
        </td>
        <td class="group-input">
            <input type="text" placeholder="name, synonym or abbrev." maxlength="50">
        </td>
        <td>
            <input type="text" class="lon-input" maxlength="15" placeholder="44.628698">
        </td>
        <td>
            <input type="text" class="lat-input" maxlength="15" placeholder="-23.65046">
        </td>
        <td class="sex-view"></td>
        <td class="init-group-view"></td>
        <td class="last-group-view"></td>
        <td class="del-row-action">
            <button class="remove-row" type="button">
                <img title="remove row" src="images/delete.svg" />
            </button>
        </td>
    </tr>`);
    $("#census-widget .widget-pane > table > tbody").append(row);

    addAutoCompleteTo(row.find(".sid-input input"), sidInputHandler);
    addAutoCompleteTo(row.find(".group-input input"), groupInputHandler);
});

$(document).on("click", "#census-widget .widget-pane > table > tbody .del-row-action", function ()
{
    if($(this).parent().index() > 0)
    {
        $(this).parent().remove();
    }
    else
    {
        $(this).parent().find("input").val("");
        $(this).parent().find("td[class$='-view']").empty();
    }
});

$(document).on("click", "#submit-census", async function ()
{
    const username = getUsername();
    if (!username)
    {
        showAlertBox("Authorization is required to record census.\nYou will be redirected to the login page shortly.",
            () => location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`));
        return;
    }

    let year, month, day, pid, gid, sid, group, withChild, lon, lat;
    let can_save = true;
    let records = [];
    const rows = $("#census-widget .widget-pane > table > tbody > tr").get();

    for (let j = 0; j < rows.length; j++)
    {
        const row = rows[j];

        $(row).find(".date-input > input").each(function (i)
        {
            if (i === 0)
            {
                year = $(this).val();
            }

            if (i === 1)
            {
                month = $(this).val();
            }

            if (i === 2)
            {
                day = $(this).val();
            }
        });

        let lastSeenChild = null;
        sid = $(row).find(".sid-input input").val();
        const classification = sid.toUpperCase();
        sid = sid.match(sidPattern)?.[1].toLowerCase();
        group = $(row).find(".group-input input").val();
        withChild = $(row).find(".wc-input input").prop("checked");
        lon = $(row).find(".lon-input").val();
        lat = $(row).find(".lat-input").val();

        let results = individualIds.filter(id => id.sids && id.sids.split(",")[0] === sid);
        pid = results.length ? results[0].pid : null;

        results = groups.filter(g => getGroupCaption(g.name, g.code) === group);
        gid = results.length ? results[0].gid : null;

        can_save = can_save && validateCensus(row, year, month, day, pid, gid, sid, group, classification, lon, lat);

        if (can_save && withChild)
        {
            const mother = individuals[pid];

            if (mother.children)
            {
                const children = [];

                for (let i=0; i<mother.children.length; i++)
                {
                    const c = mother.children[i];
                    let child;

                    if (c.pid in individuals)
                    {
                        child = individuals[c.pid]
                    }
                    else
                    {
                        child = await getSifakaByPid(c.pid);

                        if (child)
                        {
                            individuals[c.pid] = child;
                        }
                    }
                    if (child)
                    {
                        children.push(child);
                    }
                }

                const liveChildren = children.filter(c => !c.deathDate || Object.entries(c.deathDate).every(([k, v]) => !v));
                liveChildren.sort(byBirth).reverse();
                lastSeenChild = liveChildren.find(c =>
                {
                    const cLastEvent = c.events.toReversed()[0];
                    const mLastEvent = mother.events.toReversed()[0];

                    if (!c.sids && mLastEvent && cLastEvent)
                    {
                        let { month: mMonth, year: mYear } = mLastEvent.event_date;
                        let { month: cMonth, year: cYear } = cLastEvent.event_date;

                        if (mYear === cYear)
                        {
                            mMonth = mMonth || 0;
                            cMonth = cMonth || 0;
                            const diff = cMonth - mMonth;

                            return 0 <= diff && diff <= 2;
                        }
                    }

                    return false;
                });
            }

            lastSeenChild = lastSeenChild || {
                "pid": "new"
            };
        }

        if (can_save)
        {
            records.push(
                {
                    "primary_id": pid || classification,
                    "group_id": gid,
                    "day": day,
                    "month": month,
                    "year": year,
                    "child": lastSeenChild?.pid,
                    "lon": lon,
                    "lat": lat
                }
            );
        }
        else
        {
            return;
        }
    }

    if (can_save)
    {
        try
        {
            const resp = await fetch(`${api}/census/add/${username}`,
            {
                method: "PUT",
                headers:
                {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(records)
            });

            if (resp.ok)
            {
                $("#census-widget .widget-pane > table > tbody > tr:gt(0)").remove();
                $("#census-widget .widget-pane > table > tbody > tr").find("input").val("");
                $("#census-widget .widget-pane > table > tbody > tr").find("td[class$='-view']").empty();

                showAlertBox("Census records saved.");
            }
            else
            {
                const res = await resp.json();

                if (resp.status === 401)
                {
                    const msg = "Authorization is required to record census.\nYou will be redirected to the login page shortly.";

                    if (res.message.startsWith("access expired"))
                    {
                        msg = "You last authorization has expired.\nYou will be redirected to the login page shortly.";
                    }

                    showAlertBox(msg, () => location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`));
                }
                else
                {
                    showAlertBox(`Unexpected error '${resp.status} - ${resp.statusText}'.\n${res.message}`);
                }
            }
        }
        catch (error)
        {
            showAlertBox(error.message);
            console.error(error);
        }
    }
});

$(document).on("input focus blur", "#census-widget .widget-pane table tbody input", async function (evt)
{
    let typed = $(this).val();
    const ancestors = $(this).parentsUntil("tbody");
    const tr = ancestors.get().toReversed()[0];

    if ((evt.type === "blur" || evt.originalEvent?.type === "blur") && !$(this).parent().parent().hasClass("sid-input"))
    {
        if ($(ancestors[0]).hasClass("date-input"))
        {
            switch ($(ancestors[0]).find("input").index(this))
            {
                case 0:
                    isYearValid(tr, typed);
                    break;

                case 1:
                    isMonthValid(tr, typed);
                    break;

                case 2:
                    isDayValid(tr, typed);
                    break;

                default: // This should not be reached unless another input is added inside the .date-input td.
                    throw new RangeError("Date input element index out of range.");
                    break;
            }
        }

        if ($(this).hasClass("lon-input"))
        {
            isLongitudeValid(tr, typed)
        }

        if ($(this).hasClass("lat-input"))
        {
            isLatitudeValid(tr, typed)
        }

        if ($(this).parent().parent().hasClass("group-input"))
        {
            while ($(this).next().is(":visible"))
            {
                await sleep(50);
            }

            typed = $(this).val();
            const results = groups.filter(g => getGroupCaption(g.name, g.code) === typed);
            const gid = results.length ? results[0].gid : null;

            if (!isGroupValid(tr, typed, gid) && typed.length > 2)
            {
                if (confirm(`No group matching name '${typed}'.\nWould you like to add it?`))
                {
                    $("#group-name").val(typed);
                    $("#add-group-modal").show();

                    $(document).on("click", "#clear-group", function()
                    {
                        $("#add-group-modal").hide();
                    });

                    $(document).on("input blur", "input[id^='group-']", function()
                    {
                        const val = $(this).val();
                        $("#group-widget-alert").html("");
                        $("#group-widget-alert").hide();

                        if (!val)
                        {
                            showLocalAlert(`${toSentenceCase($(this).prop("id").replace("-", " ").toLowerCase())} required.`);
                            $(this).addClass("invalid-input");
                        }
                        else
                        {
                            $(this).removeClass("invalid-input");
                        }
                    });

                    $(document).on("click", "#submit-group", async function()
                    {
                        const username = getUsername();
                        if (!username)
                        {
                            $("#clear-group").click();
                            $("#add-group-modal").hide(0, async function ()
                            {
                                showAlertBox("Authorization is required to add a group.\nYou will be redirected to the login page shortly.",
                                    () => location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`));
                            });

                            return;
                        }

                        const groupName = $("#group-name").val();
                        const groupCode = $("#group-code").val();

                        if (!groupName)
                        {
                            showLocalAlert("Group name required.");
                            $("#group-name").addClass("invalid-input");
                            return;
                        }

                        if (!groupCode)
                        {
                            showLocalAlert("Group code required.");
                            $("#group-code").addClass("invalid-input");
                            return;
                        }

                        $("#group-widget-alert").html("");
                        $("#group-widget-alert").hide();
                        $("#group-name").removeClass("invalid-input");
                        $("#group-code").removeClass("invalid-input");

                        try
                        {
                            const resp = await fetch(`${api}/groups/add/${username}`,
                            {
                                method: "PUT",
                                headers:
                                {
                                "Content-Type": "application/json"
                                },
                                body: JSON.stringify(
                                    {
                                        "name": groupName,
                                        "code": groupCode
                                    }
                                )
                            });

                            $("#add-group-modal").hide(0, async function()
                            {
                                const res = await resp.json();

                                if (resp.ok)
                                {
                                    if (res)
                                    {
                                        if (groups)
                                        {
                                            groups.push(res);
                                        }
                                        else
                                        {
                                            groups = [res];
                                        }
                                    }

                                    $("#clear-group").click();
                                    showAlertBox("Group saved.");
                                }
                                else
                                {
                                    if (resp.status === 401)
                                    {
                                        localStorage.removeItem("username");
                                        const msg = "Authorization is required to add a group.\nYou will be redirected to the login page shortly.";

                                        if (res.message.startsWith("access expired"))
                                        {
                                            msg = "Your last authorization has expired.\nYou will be redirected to the login page shortly.";
                                        }

                                        showAlertBox(msg, () => location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`));
                                    }
                                    else
                                    {
                                        showAlertBox(`Unexpected error '${resp.status} - ${resp.statusText}'.\n${res.message}`);
                                    }
                                }
                            });
                        }
                        catch (error)
                        {
                            showLocalAlert(error.message);
                            console.error(error);
                        }
                    });
                }
            }
        }
    }
    else if($(this).parent().parent().hasClass("sid-input"))
    {
        let pid, individual, sid, classification;
        $(this).parent().parent().siblings("td[class$='-view']").empty();
        $(this).parent().parent().siblings("td.wc-input").find("input").hide();

        if (typed.length < 2)
        {
            if (evt.originalEvent.type !== "focus")
            {
                let msg = '';

                if (typed)
                {
                    if (!untaggedCodes.some(u => u.startsWith(typed.toUpperCase())))
                    {
                        if (evt.originalEvent.type === "blur")
                        {
                            showAlertBox(`Invalid sifaka id '${typed}'. Sifaka id is required.`);
                        }

                        $($(tr).find(".sid-input input")[0]).addClass("invalid-input");
                    }
                    else
                    {
                        $($(tr).find(".sid-input input")[0]).removeClass("invalid-input");
                    }
                }
                else
                {
                    showAlertBox("Sifaka id is required.");
                    $($(tr).find(".sid-input input")[0]).addClass("invalid-input");
                }
            }
            return;
        }

        if (!untaggedCodes.some(u => u.startsWith(typed.toUpperCase())))
        {
            const sidMatch = typed.match(sidPattern);

            if (!sidMatch)
            {
                showAlertBox(`Invalid sifaka id '${typed}'. Sifaka id is required.`);
                $($(tr).find(".sid-input input")[0]).addClass("invalid-input");
                return;
            }

            sid = sidMatch[1].toLowerCase();
            pid = individualIds.find(id => id.sids && id.sids.split(",").some(i => i === sid))?.pid;
        }

        if (pid)
        {
            if (pid in individuals)
            {
                individual = individuals[pid];
            }
            else if (!fetching.includes(pid))
            {
                fetching.push(pid);
                individual = await getSifakaByPid(pid);

                const idx = fetching.indexOf(pid);

                if (idx > -1)
                {
                    fetching.splice(idx, 1);
                }

                if (individual)
                {
                    individuals[pid] = individual;
                }
            }
        }
        else
        {
            if (!untaggedCodes.includes(typed.toUpperCase()) && (evt.type === "blur" || evt.originalEvent?.type === "blur"))
            {
                while ($(this).next().is(":visible"))
                {
                    await sleep(50);
                }

                typed = $(this).val();
                const match = typed.match(sidPattern);
                sid = match ? match[1].toLowerCase() : null;
                pid = individualIds.find(id => id.sids && id.sids.split(",").some(i => i === sid))?.pid;

                if (!pid)
                {
                    showAlertBox(`Invalid sifaka id '${sid}'. Sifaka id is required.`);
                    $($(tr).find(".sid-input input")[0]).addClass("invalid-input");
                }
            }

            $(this).parent().parent().siblings("td.wc-input").find("input").prop("checked", false);
            return;
        }

        if (individual)
        {
            $($(tr).find(".sid-input input")[0]).removeClass("invalid-input");
            const { sex, events } = individual;

            if (sex)
            {
                let img_src = "images/mars-solid.svg";

                if (sex.toLowerCase() === "female")
                {
                    img_src = "images/venus-solid.svg";
                    $(this).parent().parent().siblings("td.wc-input").find("input").show();
                }
                else
                {
                    $(this).parent().parent().siblings("td.wc-input").find("input").prop("checked", false);
                }

                $(this).parent().parent().siblings(".sex-view").append(`<img style="border: none" src="${img_src}" height="21px" />`);
            }

            if (events && events.length)
            {
                const { group_name, group_abbrev } = events[0];
                let caption = getGroupCaption(group_name, group_abbrev);

                if (caption)
                {
                    $(this).parent().parent().siblings(".init-group-view").append(`<span>${caption}</span>`);
                }

                if (events.length > 1)
                {
                    const { group_name, group_abbrev } = events[events.length - 1];
                    caption = getGroupCaption(group_name, group_abbrev);

                    if (caption)
                    {
                        $(this).parent().parent().siblings(".last-group-view").append(`<span>${getGroupCaption(group_name, group_abbrev)}</span>`);
                    }
                }
            }
        }
        else
        {
            showAlertBox("Individual not found.");
            $($(tr).find(".sid-input input")[0]).addClass("invalid-input");
        }
    }
});

$(document).on("click", "#add-census-rows", function()
{
    $("#paste-target-container").fadeToggle(300, () => $("#clear-bulk-census").click());
});

$(document).on("click", "#input-bulk-census", function()
{
    const data = $("#paste-target").val();

    data.split("\n").forEach((l, idx) =>
    {
        const line = l?.trim();

        if (line)
        {
            if (idx === 0)
            {
                $(".del-row-action").click();
            }
            else
            {
                $("#add-census-row").click();
            }

            const falsies = ["no", "non", "0", 0];

            const cells = line.split("\t");
            const tr = $(".del-row-action").last().parent();
            tr.find("input:eq(0)").val(cells[0]); // Year.
            tr.find("input:eq(1)").val(cells[1]); // Month.
            tr.find("input:eq(2)").val(cells[2]); // Day.
            tr.find("input:eq(3)").val(cells[3]); // Sifaka id.
            tr.find("input:eq(4)").prop("checked", !falsies.includes(cells[4].toLowerCase())); // With child.
            tr.find("input:eq(5)").val(cells[5]); // Group.
            tr.find("input:eq(6)").val(cells[6]); // Longitude.
            tr.find("input:eq(7)").val(cells[7]); // Latitude.

            for (let i = 0; i < 8; i++)
            {
                tr.find(`input:eq(${i})`).trigger("focus");
                tr.find(`input:eq(${i})`).trigger("blur");
            }
        }
    });

    $("#add-census-rows").click();
})

const getGroupCaption = (name, code) =>
{
    let caption = name;

    if (caption && code)
    {
        caption = `${caption} (${code})`;
    }
    else if (code)
    {
        caption = ` (${code})`;
    }

    return caption.trim();
};

const isYearValid = (elem, year) =>
{
    if (!year.match(intPattern))
    {
        showAlertBox(year ? `Invalid year value '${year}'.` : `Year is required.`);
        $($(elem).find(".date-input > input")[0]).addClass("invalid-input");
        return false;
    }
    else
    {
        $($(elem).find(".date-input > input")[0]).removeClass("invalid-input");
        return true;
    }
};

const isMonthValid = (elem, month) =>
{
    if (!month.match(intPattern))
    {
        showAlertBox(month ? `Invalid month value '${month}'.` : `Month is required.`);
        $($(elem).find(".date-input > input")[1]).addClass("invalid-input");
        return false;
    }
    else
    {
        $($(elem).find(".date-input > input")[1]).removeClass("invalid-input");
        return true;
    }
};

const isDayValid = (elem, day) =>
{
    if (day && !day.match(intPattern))
    {
        showAlertBox(`Invalid day value '${day}'.`);
        $($(elem).find(".date-input > input")[2]).addClass("invalid-input");
        return false;
    }
    else
    {
        $($(elem).find(".date-input > input")[2]).removeClass("invalid-input");
        return true;
    }
};

const isIdValid = (elem, sid, pid, classification) =>
{
    if (!sid && !classification)
    {
        showAlertBox("Sifaka id is required.");
        $($(elem).find(".sid-input input")[0]).addClass("invalid-input");
        return false;
    }
    else if (!sid)
    {
        showAlertBox("Sifaka id is required.");
        $($(elem).find(".sid-input input")[0]).addClass("invalid-input");
        return false;
    }
    else if (sid && !individualIds.find(id => id.pid === pid))
    {
        showAlertBox(`No individual matching Sifaka id '${sid ? "S" : ""}${sid}'.`);
        $($(elem).find(".sid-input input")[0]).addClass("invalid-input");
        return false;
    }
    else
    {
        $($(elem).find(".sid-input input")[0]).removeClass("invalid-input");
        return true;
    }
};

const isGroupValid = (elem, group, gid) =>
{
    if (!group)
    {
        showAlertBox("Group is required.");
        $($(elem).find(".group-input input")[0]).addClass("invalid-input");
        return false;
    }
    else if (!groups.find(g => g.gid === gid))
    {
        showAlertBox(`No group matching name '${group}'.`);
        $($(elem).find(".group-input input")[0]).addClass("invalid-input");
        return false;
    }
    else
    {
        $($(elem).find(".group-input input")[0]).removeClass("invalid-input");
        return true;
    }
};

const isLongitudeValid = (elem, lon) =>
{
    if (lon === 0 || lon)
    {
        if (lon.match(numberPattern))
        {
            const { minLon, maxLon } = mapExtent;

            if (minLon <= lon && lon <= maxLon)
            {
                $($(elem).find(".lon-input")[0]).removeClass("invalid-input");
                return true;
            }
            else
            {
                showAlertBox("Longitude out of bounds.");
                $($(elem).find(".lon-input")[0]).addClass("invalid-input");
                return false;
            }
        }
        else
        {
            showAlertBox(`Invalid longitude value '${lon}'.`);
            $($(elem).find(".lon-input")[0]).addClass("invalid-input");
            return false;
        }
    }
    else
    {
        $($(elem).find(".lon-input")[0]).removeClass("invalid-input");
        return true;
    }
};

const isLatitudeValid = (elem, lat) =>
{
    if (lat === 0 || lat)
    {
        if (lat.match(numberPattern))
        {
            const { minLat, maxLat } = mapExtent;

            if (minLat <= lat && lat <= maxLat)
            {
                $($(elem).find(".lat-input")[0]).removeClass("invalid-input");
                return true;
            }
            else
            {
                showAlertBox("Latitude out of bounds.");
                $($(elem).find(".lat-input")[0]).addClass("invalid-input");
                return false;
            }
        }
        else
        {
            showAlertBox(`Invalid latitude value '${lat}'.`);
            $($(elem).find(".lat-input")[0]).addClass("invalid-input");
            return false;
        }
    }
    else
    {
        $($(elem).find(".lat-input")[0]).removeClass("invalid-input");
        return true;
    }
};

const areCoordinatesValid = (elem, lon, lat) =>
{
    if ((lon === 0 || lon) && (lat === 0 || lat))
    {
        return isLongitudeValid(elem, lon) && isLatitudeValid(elem, lat);
    }
    else if ((lon === 0 || lon) || (lat === 0 || lat))
    {
        if (lon === 0 || lon)
        {
            $($(elem).find(".lon-input")[0]).removeClass("invalid-input");
            $($(elem).find(".lat-input")[0]).addClass("invalid-input");
            showAlertBox("Missing latitude coordinate.");
        }
        else
        {
            $($(elem).find(".lon-input")[0]).addClass("invalid-input");
            $($(elem).find(".lat-input")[0]).removeClass("invalid-input");
            showAlertBox("Missing longitude coordinate.");
        }

        return false;
    }
    else
    {
        $($(elem).find(".lon-input")[0]).removeClass("invalid-input");
        $($(elem).find(".lat-input")[0]).removeClass("invalid-input");
        return true;
    }
};

const validateCensus = (elem, year, month, day, pid, gid, sid, group, classification, lon, lat) =>
{
    if (!isYearValid(elem, year))
    {
        return false;
    }

    if (!isMonthValid(elem, month))
    {
        return false;
    }

    if(!isDayValid(elem, day))
    {
        return false;
    }

    if(!isIdValid(elem, sid, pid, classification))
    {
        return false;
    }

    if(!isGroupValid(elem, group, gid))
    {
        return false;
    }

    if(!areCoordinatesValid(elem, lon, lat))
    {
        return false;
    }

    return true;
}

$(async () =>
{
    addAutoCompleteTo($("#census-widget .widget-pane > table > tbody .sid-input input"), sidInputHandler);
    addAutoCompleteTo($("#census-widget .widget-pane > table > tbody .group-input input"), groupInputHandler);

    $(document).on("click", "#add-group-modal > .modal-close", function ()
    {
        $("#clear-group").click();
        $("#add-group-modal").hide();
    });
});