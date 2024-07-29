let collarColors, tagForms, tagColors = [];
let individuals = {};

if (!getUsername())
{
    alert("Authorization is required to access this area.\nYou will now be redirected to the login page.");
    window.stop();
    location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`);
}

const getMarkerTypes = async () =>
{
    const resp = await fetch(`${api}/markers/types/all`);
    const res = await resp.json();
    return res;
}

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

const populateGroups = () =>
{
    if (!groups.length)
    {
        setTimeout(() => populateGroups(), 100);
        return;
    }

    $(`<option></option>`).appendTo("#groups");
    groups.forEach(g =>
    {
        $(`<option value="${g.gid}">${getGroupCaption(g.name, g.code)}</option>`).appendTo("#groups");
    });
}

const populateMarkers = () =>
{
    $(`<option></option>`).appendTo("#collar-colors");
    $(`<option></option>`).appendTo("#tag-forms");
    $(`<option></option>`).appendTo("#tag-colors");

    collarColors.forEach(cc =>
    {
        $(`<option value="${cc.id}">${toSentenceCase(cc.name.replace("_", " ").toLowerCase())} (${cc.code.toUpperCase()})</option>`).appendTo("#collar-colors");
    });

    tagForms.forEach(tf =>
    {
        $(`<option value="${tf.id}">${toSentenceCase(tf.name.replace("_", " ").toLowerCase())} (${tf.code.toUpperCase()})</option>`).appendTo("#tag-forms");
    });

    tagColors.forEach(tc =>
    {
        $(`<option value="${tc.id}">${toSentenceCase(tc.name.replace("_", " ").toLowerCase())} (${tc.code.toUpperCase()})</option>`).appendTo("#tag-colors");
    });
}

$(document).on("input focus blur", "#sifaka-id", async function (evt)
{
    let pid, individual, sid;

    $("#sifaka-id-label .sex-view").empty();
    $("#capture-status").text("New Capture");

    if (evt.hasOwnProperty("childPid"))
    {
        pid = evt.childPid;
        $(this).parent().siblings("input.untagged-pid").val(pid);
    }
    else
    {
        $(this).parent().siblings("input.untagged-pid").val("");

        if ($(this).val().length < 4)
        {
            if (evt.originalEvent.type === "blur")
            {
                showAlertBox(`Invalid sifaka id '${$(this).val()}'. Sifaka id is required.`);
            }

            return;
        }

        const sidMatch = $(this).val().match(sidPattern);

        if (!sidMatch)
        {
            showAlertBox(`Invalid sifaka id '${$(this).val()}'. Sifaka id is required.`);
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
        else
        {
            individual = await getSifakaByPid(pid);

            if (individual)
            {
                individuals[pid] = individual;
            }
        }

        if (individual)
        {
            const { sex, events } = individual;

            if (sex)
            {
                const img_src = sex.toLowerCase() === "female" ? "images/venus-solid.svg" : "images/mars-solid.svg";
                $("#sifaka-id-label .sex-view").append(`<img style="border: none;" src="${img_src}" height="15px" />`);
            }

            if (events && events.some(e => e.event_type === "capture"))
            {
                $("#capture-status").text("Recapture");
            }
        }
        else
        {
            showAlertBox("Individual not found.");
        }
    }
    else
    {
        if (evt.originalEvent.type === "blur")
        {
            if (confirm(`Individual with sifaka id: S${sid} was not found.\nWould you like to add it?`))
            {
                const cSid = $("#captures-widget-container #captures-widget #sifaka-id").val();
                handleClusterEdit(cSid);
            }
        }
    }
});

$(document).on("click", "#submit-capture", async function ()
{
    const username = getUsername();
    if (!username)
    {
        showAlertBox("Authorization is required to record captures.\nYou will be redirected to the login page shortly.",
            () => location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`));
        return;
    }

    let year, month, day, pid, gid, sid, is_new, verbatim_markers, markers, measurements, cc_txt, tf_txt, tc_txt;
    let can_save = true;

    const untaggedPid = $("input.untagged-pid").val();
    sid = $("#sifaka-id").val();
    sid = sid.match(sidPattern)?.[1].toLowerCase();
    is_new = $("#capture-status").text().toLowerCase === "new capture";
    cc_txt = $("#collar-colors option:selected").text() || undefined;
    tf_txt = $("#tag-forms option:selected").text() || undefined;
    tc_txt = $("#tag-colors option:selected").text() || undefined;

    let results = individualIds.filter(id => id.sids && id.sids.split(",")[0] === sid);
    pid = results.length ? results[0].pid : null;

    gid = $("#groups").val() || undefined;

    recDate = $("#record-date").val();

    if (recDate)
    {
        parsedDate = new Date(recDate);

        year = parsedDate.getFullYear();
        month = parsedDate.getMonth() + 1;
        day = parsedDate.getDate() + 1;
    }

    if (cc_txt && tf_txt && tc_txt)
    {
        const markerIds = [
            $("#collar-colors option:selected").val(), $("#tag-forms option:selected").val(), $("#tag-colors option:selected").val()
        ].map(id => parseInt(id));
        const collar_col = collarColors.find(m => m.id === markerIds[0]);
        const tag_form = tagForms.find(m => m.id === markerIds[1]);
        const tag_col = tagColors.find(m => m.id === markerIds[2]);
        verbatim_markers = `${collar_col.code},${tag_form.code},${tag_col.code}`;
        markers = [collar_col, tag_form, tag_col];
        markers = markers.map(m =>
        {
            return {
                "attr_id": m.attr_id,
                "type_id": m.id
            }
        });
    }
    else if (cc_txt || tf_txt || tc_txt)
    {
        showAlertBox("Missing marker part.");
        can_save = false;
    }

    if (!sid && !untaggedPid)
    {
        if (confirm("Adding a record for an untagged individual requires a mother. Would you like to find one?"))
        {
            handleClusterEdit(null, "#sifaka-id");
        }
        else
        {
            showAlertBox("Sifaka id is required.");
        }
        can_save = false;
    }
    else if (sid && !individualIds.find(id => id.pid === pid))
    {
        showAlertBox(`No individual matching Sifaka id '${sid ? "S" : ""}${sid}'.`);
        can_save = false;
    }

    if (can_save)
    {
        const numerics = $("[data-type-id]");
        invalids = numerics.filter(function()
        {
            return isNaN($(this).val());
        });

        if (invalids.length)
        {
            caption = $(invalids[0]).attr('title');
            showAlertBox(`${caption} value needs to be a numeric.`);
            return;
        }

        if (numerics.length) {
            measurements = numerics.filter(function()
            {
                return $(this).val().trim().length > 0;
            }).map((i, m) =>
            {
                return {
                    "type_id": $(m).attr("data-type-id"),
                    "value": $(m).val()
                };
            }).get();
        }

        try
        {
            const resp = await fetch(`${api}/captures/add/${username}`,
            {
                method: "PUT",
                headers:
                {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(
                {
                    "primary_id": pid || untaggedPid,
                    "group_id": gid,
                    "day": day,
                    "month": month,
                    "year": year,
                    "is_new": is_new,
                    "verbatim_markers": verbatim_markers,
                    "markers": markers,
                    "measurements": measurements
                })
            });

            if (resp.ok)
            {
                $("#captures-widget [class$='-view']").empty();
                $("#captures-widget input").val("");
                $("#captures-widget input[type='checkbox']").prop("checked", false);
                $("#captures-widget select").val("");

                showAlertBox("Capture record saved.");
            }
            else
            {
                const res = await resp.json();

                if (resp.status === 401)
                {
                    const msg = "Authorization is required to record capture.\nYou will be redirected to the login page shortly.";

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

$(async () =>
{
    const marker_types = await getMarkerTypes();
    collarColors = marker_types.filter(t => t.attr_id === 1);
    tagForms = marker_types.filter(t => t.attr_id === 2);
    tagColors = marker_types.filter(t => t.attr_id === 3);

    addAutoCompleteTo($("#captures-widget #sifaka-id"), sidInputHandler);
    addAutoCompleteTo($("#modal-cluster-box #cluster-widget input#cluster-mother-id"), sidInputHandler);
    addAutoCompleteTo($("#modal-cluster-box #cluster-widget input#previous-sid"), sidInputHandler);
    populateGroups();
    populateMarkers();
});