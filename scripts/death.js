let individuals = {};

if (!getUsername())
{
    alert("Authorization is required to access this area.\nYou will now be redirected to the login page.");
    window.stop();
    location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`);
}

$(document).on("click", "#submit-death", async function()
{
    const username = getUsername();
    if (!username)
    {
        showAlertBox("Authorization is required to record captures.\nYou will be redirected to the login page shortly.",
            () => location.assign(`./login.html?returnUrl=${location.pathname.replace(rootPath, "")}`));
        return;
    }

    const year = $("#death-year").val();
    const month = $("#death-month").val();
    const day = $("#death-day").val();
    let can_save = true;

    let sid = $("#sifaka-id").val();
    sid = sid.match(sidPattern)?.[1].toLowerCase();
    const results = individualIds.filter(id => id.sids && id.sids.split(",")[0] === sid);
    const pid = results.length ? results[0].pid : null;

    if (!sid)
    {
        showAlertBox("Sifaka id is required.");
        can_save = false;
    }
    else if (sid && !individualIds.find(id => id.pid === pid))
    {
        showAlertBox(`No individual matching Sifaka id '${sid ? "S" : ""}${sid}'.`);
        can_save = false;
    }

    if (can_save && !year.match(intPattern))
    {
        showAlertBox(year ? `Invalid year value '${year}'.` : `Year is required.`);
        can_save = false;
    }

    if (can_save && !month.match(intPattern))
    {
        showAlertBox(month ? `Invalid month value '${month}'.` : `Month is required.`);
        can_save = false;
    }

    if (can_save && day && !day.match(intPattern))
    {
        showAlertBox(`Invalid day value '${day}'.`);
        can_save = false;
    }

    if (can_save)
    {
        try
        {
            const resp = await fetch(`${api}/death/edit/${username}`,
            {
                method: "PUT",
                headers:
                {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(
                {
                    "primary_id": pid,
                    "day": day,
                    "month": month,
                    "year": year
                }
                )
            });

            if (resp.ok)
            {
                $("#clear-death").click()
                $("#sex-view").empty();

                individuals[pid].deathDate =
                {
                    "deathMonth": month,
                    "deathDay": day,
                    "deathYear": year
                }
                
                showAlertBox("Death date updated.");
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

$(document).on("input focus blur", "#sifaka-id", async function (evt)
{
    let pid, individual, sid;
    const typed = $(this).val();

    $("#sex-view").empty();

    if (typed.length < 2)
    {
        return;
    }

    if (!"untagged individual".startsWith(typed.toLowerCase()))
    {
        const sidMatch = typed.match(sidPattern);

        if (!sidMatch)
        {
            showAlertBox(`Invalid sifaka id '${typed}'. Sifaka id is required.`);
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
            const { sex, deathDate } = individual;

            if (sex)
            {
                const img_src = sex.toLowerCase() === "female" ? "images/venus-solid.svg" : "images/mars-solid.svg";
                $("#sex-view").append(`<img style="border: none;" src="${img_src}" height="15px" />`);
            }

            if (deathDate)
            {
                const { deathYear: year, deathMonth: month, deathDay: day} = deathDate;

                if (year || month || day)
                {
                    $("#death-year").val(year);
                    $("#death-month").val(month);
                    $("#death-day").val(day);
                }
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
            showAlertBox(`Invalid sifaka id 'S${sid}'. Sifaka id is required.`);

            // if ("untagged individual".startsWith(typed.toLowerCase()))
            // {
            //     if (confirm("Adding a record for an untagged individual requires a mother. Would you like to find one?"))
            //     {
            //         handleClusterEdit(null, "#sifaka-id");
            //     }
            //     else
            //     {
            //         showAlertBox("Sifaka id is required.");
            //     }
            // }
            // else if (confirm(`Individual with sifaka id: S${sid} was not found.\nWould you like to add it?`))
            // {
            //     const cSid = $("#death-widget-container #death-widget #sifaka-id").val();
            //     handleClusterEdit(cSid);
            // }
            // else
            // {
            //     showAlertBox(`Invalid sifaka id 'S${sid}'. Sifaka id is required.`);
            // }
        }
    }
});

$(async () =>
{
    addAutoCompleteTo($("#death-widget #sifaka-id"), sidInputHandler);
});