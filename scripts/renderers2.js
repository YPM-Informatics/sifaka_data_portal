const renderSifakaDate = (sDate, shortMonth = false) =>
{
    let day, monthNum, monthStr, year;

    Object.entries(sDate).forEach(([key, value]) => {
        if (key.toLowerCase().endsWith("day")) {
            day = value;
        }
        else if (key.toLowerCase().endsWith("month")) {
            monthNum = value;
        }
        else if (key.toLowerCase().endsWith("year")) {
            year = value;
        }
    });

    if (!day && !monthNum && !year)
    {
        return null;
    }

    if (monthNum) {
        const date = new Date();
        date.setMonth(monthNum - 1);
        monthStr = date.toLocaleString('en', { month: shortMonth ? 'short' : 'long' });
    }

    if (day && !monthNum) {
        return $(`<span>${year ?? ""}</span>`);
    }
    else {
        let parts = [monthStr, day, year].filter(p => !!p);
        if (parts.length > 2)
        {
            parts[1] = `${parts[1]},`;
        }

        return $(`<span>${parts && parts.length > 0 ? parts.join(" ") : ""}</span>`);
    }
};

const renderIndividualId = json =>
{
    const { pid: primaryId, sids: sifakaIdString, mSids: motherSifakaIdString, has_image } = json;
    const sifakaIds = sifakaIdString ? sifakaIdString.split(",") : null;

    const spm_head = $(`<div class="spm_head" id="${primaryId}_head"></div>`);
    const headline_left = $(`<span class="id_headline_left">${sifakaIds ? `Sifaka Id ${sifakaIds[0]}` : "Untagged Individual"}</span>`);
    const thumbnail = has_image ? `<img class='modal-opener' alt='S${sifakaIds.join('_')}' src='${api}/thumbnails/pid/${primaryId}'>` : "<img src='images/images-regular.svg' height='24'>";
    const headline_right = $(`<span class='id_headline_right'>${thumbnail}</span`);
    spm_head.append($("<h2></h2>").append(headline_left, [headline_right]));

    const spm_body = $(`<div class="spm_body" id="${primaryId}_body"></div>`);

    return $(`<div class="spm" id="${primaryId}"></div>`).append(spm_head, [spm_body]);
};

const renderIndividual = json =>
{
    const { pid: primaryId, mPid: motherPrimaryId, sids: sifakaIdString, mSids: motherSifakaIdString, sex, birthDate, birthDateType, deathDate, deathDateType, children, events: eventCol } = json;
    const motherSifakaIds = motherSifakaIdString ? motherSifakaIdString.split(",") : null;

    const events = $("<div class='events'></div>");
    const events_tbl = $("<table></table>").appendTo(events);
    const events_tbody = $("<tbody></tbody>").appendTo(events_tbl);

    const core_data = $("<div class='core-data'></div>");
    const core_data_tbl = $("<table></table>").appendTo(core_data);
    const core_data_tbody = $("<tbody></tbody>").appendTo(core_data_tbl);

    const birth_date = renderSifakaDate(birthDate);
    const death_date = renderSifakaDate(deathDate);

    let tbl_row;

    if (sex)
    {
        const img_src = sex.toLowerCase() === "female" ? "images/venus-solid.svg" : "images/mars-solid.svg";
        $(`#${primaryId}_head .id_headline_left`).append(" ", [$(`<img style="border: none" src="${img_src}" height="21px" />`)]);
    }

    if (birth_date)
    {
        let age = getSifakaAge(birthDate, deathDate);
	if (sifakaIdString ==  null & (age == null | age > 2))
	{
		age = " (unknown age)";
	}
	else
	{
        	age = age ? ` (aged ${age})` : "";
	}
        tbl_row = $("<tr></tr>").appendTo(core_data_tbody);
        tbl_row.append(`<th${birthDateType ? " rowspan='2'" : ""}>Born</th$>`, [$("<td></td>").append(birth_date, [age])]);

        if (birthDateType)
        {
            tbl_row = $("<tr></tr>").appendTo(core_data_tbody);
            tbl_row.append(`<td>${birthDateTypes[birthDateType]}</td>`)
        }
    }

    if (death_date)
    {
        tbl_row = $("<tr></tr>").appendTo(core_data_tbody);
        tbl_row.append(`<th${deathDateType ? " rowspan='2'" : ""}>Died</th$>`, [$("<td></td>").append(death_date)]);

        if (deathDateType)
        {
            tbl_row = $("<tr></tr>").appendTo(core_data_tbody);
            tbl_row.append(`<td>${deathDateType}</td>`)
        }
    }

    if (motherSifakaIds)
    {
        const mLink = $(`<a class="fam_ties" href="#${motherPrimaryId}">S${motherSifakaIds[0]}</a>`);
        tbl_row = $("<tr></tr>").appendTo(core_data_tbody);
        tbl_row.append("<th>Mother</th$>", [$("<td></td>").append(mLink)]);
    }

    if (children)
    {
        tbl_row = $("<tr></tr>").appendTo(core_data_tbody);
        tbl_row.append("<th>Offspring</th$>", [$("<td></td>").append(children.map(function (child, idx)
        {
            const { pid, sids: sidStr } = child;
            const sids = sidStr ? sidStr.split(",") : null;
            const cLink = `<a class="fam_ties" href="#${pid}">${(sids ? `S${sids[0]}` : "Untagged Individual")}</a>`;
            let nodes = [cLink];

            if (idx < children.length - 1)
            {
                nodes.push(" ");
            }

            return nodes;
        }))]);
    }

    if (eventCol)
    {
        events_tbody.append(eventCol.map(function (event)
        {
            tbl_row = $("<tr></tr>");
            const dateElem = renderSifakaDate(event.event_date, true);

            if (event.event_type.toLowerCase() === "capture")
            {
                dateElem.css("display", "flex");
                $(`<svg style="padding-left:5px; margin-top:2px;" height=20px width=88px> <polygon fill="white" stroke="black" stroke-width="2" points="10,0,0,8,10,16,70,16,70,0" />  <text x="40" y="12" text-anchor="middle" fill="black" font-size="12">${event.tag || ""}</text></svg>`).appendTo(dateElem);
            }

            let groupCaption = event.group_name;

            if (groupCaption && event.group_abbrev)
            {
                groupCaption = ` ${groupCaption} (${event.group_abbrev})`;
            }
            else if (event.group_abbrev)
            {
                groupCaption = ` (${event.group_abbrev})`;
            }

            tbl_row.append(`<th>${toSentenceCase(event.event_type)}</th$>`, [$(`<td></td>`).append(dateElem, [groupCaption])]);
            return tbl_row;
        }));
    }

    $(`#${primaryId}_body`).append(events, [core_data]);
};
