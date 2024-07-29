$(document).on("click submit", "#download", function(event)
{
    event.preventDefault();

    const intPattern = /^\d+$/i;
    const startMonth = $("#start-month").val().trim() || undefined;
    const startYear = $("#start-year").val().trim() || undefined;
    const endMonth = $("#end-month").val().trim() || undefined;
    const endYear = $("#end-year").val().trim() || undefined;
    const dataType = $("input[name='data-types']:checked").val();
    const sexType = $("input[name='sex-types']:checked").val();

    if (!dataType)
    {
        showAlertBox("Download data type is required.");
        return;
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
        return;
    }

    if (startYear && startMonth && endYear && endMonth && parseInt(startYear) === parseInt(endYear) && parseInt(startMonth) > parseInt(endMonth))
    {
        showAlertBox("Start month cannot be greater than end month.");
        return;
    }

    fetch(`${api}/downloads/${dataType}`,
    {
        method: "POST",
        headers:
        {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(
            {
                "min_month": startMonth,
                "min_year": startYear,
                "max_month": endMonth,
                "max_year": endYear,
                "sex": sexType
            }
        )
    })
    .then(res =>
        {
            const filename = res.headers.get('Content-Disposition').split('filename=')[1];
            return res.blob().then(blob => ({ filename, blob }));
        })
    .then(data =>
    {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(data.blob);
        a.download = data.filename;
        a.click();
    });
});

$(() =>
{
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    $("#start-month").val(11);
    $("#start-year").val(1984);
    $("#end-month").val(month);
    $("#end-year").val(year);
});