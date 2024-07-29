const showLocalAlert = (msg) =>
{
    $("#cluster-widget #cluster-alert").show();
    $("#cluster-widget #cluster-alert").html(`<span>${msg}</span>`);
};

const handleClusterEdit = (clusterSid, triggerSelector) =>
{
    $("#modal-cluster-box").show();

    $(document).on("click", "#is_retag", function()
    {
        if ($(this).prop("checked"))
        {
            $("#retag-row").show();
        }
        else
        {
            $("#retag-row").hide();
        }
    });

    $(document).on("focus", "#modal-cluster-box input", function ()
    {
        $("#cluster-widget #cluster-alert").html("");
        $("#cluster-widget #cluster-alert").hide();
    });

    $(document).on("focus", "#modal-cluster-box select", function ()
    {
        $("#cluster-widget #cluster-alert").html("");
        $("#cluster-widget #cluster-alert").hide();
    });

    $(document).on("click", "#clear-cluster", function ()
    {
        $("#modal-cluster-box").hide();
    });

    $(document).on("click", "#cluster-widget button", async function ()
    {
        if ($(this).prop("id") === "submit-cluster")
        {
            const username = getUsername();
            if (!username)
            {
                $("#cluster-widget #children").remove();
                $("#clear-cluster").click();
                $("#modal-cluster-box").hide(0, async function ()
                {
                    showAlertBox("Authorization is required to record captures.\nYou will be redirected to the login page shortly.",
                        () => location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`));
                });

                return;
            }

            let bYear, bMonth, bDay, dYear, dMonth, dDay, mPid, mSid, sid, isRetag, prevSid, prevPid;
            let can_save = true;
            const intPattern = /^\d+$/i;

            isRetag = Boolean($("#is_retag:checked").length);
            prevSid = isRetag ? $("#previous-sid").val() : null;
            prevSid = prevSid?.match(sidPattern)?.[1].toLowerCase();
            let results = individualIds.filter(id => id.sids && id.sids.split(",")[0] === prevSid);
            prevPid = results.length ? results[0].pid : null;

            mSid = $("#cluster-mother-id").val();
            mSid = mSid.match(sidPattern)?.[1].toLowerCase();
            sid = $("#cluster-id").html().match(sidPattern)[1].toLowerCase();
            results = individualIds.filter(id => id.sids && id.sids.split(",")[0] === mSid);
            mPid = results.length ? results[0].pid : null;

            $("#cluster-widget .birth-date-input > input").each(function (i)
            {
                if (i === 0)
                {
                    bYear = $(this).val();
                }

                if (i === 1)
                {
                    bMonth = $(this).val();
                }

                if (i === 2)
                {
                    bDay = $(this).val();
                }
            });

            if (can_save && bYear && !bYear.match(intPattern))
            {
                showLocalAlert(`Invalid birth year value '${bYear}'.`);
                can_save = false;
            }

            if (can_save && bMonth && !bMonth.match(intPattern))
            {
                showLocalAlert(`Invalid birth month value '${bMonth}'.`);
                can_save = false;
            }

            if (can_save && bDay && !bDay.match(intPattern))
            {
                showLocalAlert(`Invalid birth day value '${bDay}'.`);
                can_save = false;
            }

            if (isRetag && prevSid && !individualIds.find(id => id.pid === prevPid))
            {
                showLocalAlert(`No individual matching previous Sifaka id '${prevSid ? "S" : ""}${prevSid}'.`);
                can_save = false;
            }

            if (mSid && !individualIds.find(id => id.pid === mPid))
            {
                showLocalAlert(`No individual matching mother Sifaka id '${mSid ? "S" : ""}${mSid}'.`);
                can_save = false;
            }

            if (can_save)
            {
                const sexId = $("#cluster-sex option:selected").val() || null;
                const bDateTypeId = $("#birth-date-type option:selected").val() || null;

                const payload =
                {
                    "sex_id": sexId,
                    "sid": sid,
                    "mother_pid": mPid,
                    "birth_date_type_id": bDateTypeId,
                    "birth_year": bYear,
                    "birth_month": bMonth,
                    "birth_day": bDay
                };

                if (isRetag)
                {
                    payload.prev_sid = prevSid;
                }

                try
                {
                    const resp = await fetch(`${api}/individuals/add/${username}`,
                    {
                        method: "PUT",
                        headers:
                        {
                        "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    });

                    $("#cluster-widget #children").remove();
                    $("#clear-cluster").click();
                    $("#modal-cluster-box").hide(0, async function ()
                    {
                        const res = await resp.json();

                        if (resp.ok)
                        {
                            if (res)
                            {
                                if (individualIds)
                                {
                                    individualIds.push(...res);
                                }
                                else
                                {
                                    individualIds = res;
                                }
                            }

                            showAlertBox("Sifaka individual saved.");
                        }
                        else
                        {
                            if (resp.status === 401)
                            {
                                localStorage.removeItem("username");
                                const msg = "Authorization is required to record capture.\nYou will be redirected to the login page shortly.";

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
            }
        }
        else
        {
            $("#modal-cluster-box").hide();
        }
    });

    const sid = clusterSid ? clusterSid.match(sidPattern)[1].toLowerCase() : "";
    $("#cluster-id").html(`${sid ? "S" : ""}${sid}`);
    $("#cluster-widget #children").remove();

    if (clusterSid)
    {
        $("#submit-cluster").prop("disabled", false);
    }
    else
    {
        $("#submit-cluster").prop("disabled", true);
        $(document).on("input focus blur", "#cluster-mother-id", async function ()
        {
            if ($(this).val().length < 4)
            {
                $("#cluster-widget #children").remove();
            }
            else
            {
                let mother;
                const sidMatch = $(this).val().match(sidPattern);

                if (sidMatch)
                {
                    const sid = sidMatch[1].toLowerCase();

                    if ($("#cluster-widget #children").length > 0 && $("#cluster-widget #children").attr("data-msid") === sid)
                    {
                        return;
                    }

                    const pid = individualIds.find(id => id.sids && id.sids.split(",").some(i => i === sid))?.pid;

                    if (pid)
                    {
                        if (pid in individuals)
                        {
                            mother = individuals[pid];
                        }
                        else
                        {
                            mother = await getSifakaByPid(pid);
            
                            if (mother)
                            {
                                individuals[pid] = mother;
                            }
                        }

                        if (mother)
                        {
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

                                const dead = children.filter(c => c.deathDate && Object.entries(c.deathDate).some(([k, v]) => !!v));
                                const tagged = children.filter(c => !!c.sids && !dead.includes(c));
                                const untagged = children.filter(c => !c.sids && !dead.includes(c));
                                const maxLength = Math.max(dead.length, tagged.length, untagged.length);

                                const orderedChildren = [];

                                for (let i=0; i<maxLength; i++)
                                {
                                    orderedChildren.push(untagged.shift());
                                    orderedChildren.push(tagged.shift());
                                    orderedChildren.push(dead.shift());
                                }

                                const cols = 3;
                                const rows = Math.ceil(orderedChildren.length / cols);
                                let tr = $(`<tr id="children" data-msid="${sid}"></tr>`);
                                let td = $("<td colspan='2'></td>");
                                const tbl = $("<table style='width: 100%;'></table>");
                                td.append(tbl);
                                tr.append(td);
                                $("#cluster-widget #action-row").before(tr);

                                for (let i=0; i<rows; i++)
                                {
                                    tr = $("<tr></tr>");

                                    for (let j=0; j<cols; j++)
                                    {
                                        const idx = (i * cols) + j;
                                        const data = idx < orderedChildren.length ? orderedChildren[idx] : null;

                                        if (data)
                                        {
                                            const {sex, pid: childPid, sids: sidsStr, birthDate, birthDateType, deathDate, deathDateType} = data;
                                            const sids = sidsStr?.split(",");
                                            const birth_date = renderSifakaDate(birthDate);
                                            const death_date = renderSifakaDate(deathDate);
                                            
                                            td = $("<td style='border: solid 1px #a2a9b1;'></td>");
                                            td.append(`<span>${sids ? "S" + sids[0] : "Untagged individual"}</span>`);

                                            if (sex)
                                            {
                                                td.append("<br/>", [`<span>${sex}</span>`]);
                                            }

                                            if (birth_date)
                                            {
                                                td.append("<br/>", ["<span>Born </span>", birth_date]);

                                                if (birthDateType)
                                                {
                                                    td.append(`<span> (${birthDateTypes[birthDateType]})</span>`);
                                                }
                                            }

                                            if (death_date)
                                            {
                                                td.append("<br/>", ["<span>Died </span>", death_date]);

                                                if (deathDateType)
                                                {
                                                    td.append(`<span> (${deathDateType})</span>`);
                                                }
                                            }

                                            if (j == 0)
                                            {
                                                td.wrapInner(`<a href="#${childPid}"></a>`);
                                                td.on("click", "a", function()
                                                {
                                                    if (triggerSelector)
                                                    {
                                                        const event = $.Event("blur");
                                                        event.childPid = $(this).attr("href").substring(1);
                                                        $(triggerSelector).trigger(event);
                                                    }

                                                    $("#modal-cluster-box > .modal-close").click();
                                                });
                                            }
                                        }
                                        else
                                        {
                                            td = "<td></td>";
                                        }

                                        tr.append(td);
                                    }

                                    tbl.append(tr);
                                }
                            }
                            else
                            {
                                $("#cluster-widget #children").remove();
                            }
                        }
                        else
                        {
                            $("#cluster-widget #children").remove();
                        }
                    }
                    else
                    {
                        $("#cluster-widget #children").remove();
                    }
                }
                else
                {
                    $("#cluster-widget #children").remove();
                }
            }
        });
    }

    // if (!is_new)
    // {
    //     const pid = individualIds.find(id => id.sids && id.sids.split(",").some(i => i === sid))?.pid;
    //     const individual = individuals[pid];

    //     const motherSids = individual.mSids ? individual.mSids.split(",") : null;

    //     if (individual.sex)
    //     {
    //         $(`#cluster-sex option:contains("${individual.sex}")`).prop('selected', true);
    //     }

    //     if (motherSids)
    //     {
    //         $("#cluster-mother-id").val(`S${motherSids[0]}`)
    //     }

    //     if (individual.birthDateType)
    //     {
    //         $(`#birth-date-type option:contains("${individual.birthDateType}")`).prop('selected', true);
    //     }

    //     Object.entries(individual.birthDate).forEach(([key, value]) => {
    //         if (key.toLowerCase().endsWith("day")) {
    //             $($("#cluster-widget .birth-date-input input")[2]).val(value);
    //         }
    //         else if (key.toLowerCase().endsWith("month")) {
    //             $($("#cluster-widget .birth-date-input input")[1]).val(value);
    //         }
    //         else if (key.toLowerCase().endsWith("year")) {
    //             $($("#cluster-widget .birth-date-input input")[0]).val(value);
    //         }
    //     });
    // }
};

$(async () =>
{
    $(document).on("click", "#modal-cluster-box > .modal-close", function ()
    {
        $("#cluster-widget #children").remove();
        $("#clear-cluster").click();
        $("#modal-cluster-box").hide();
    });
});